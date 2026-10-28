# Contract: Google Services Used (Picker API + OAuth)

Source: [research.md R1 and R4](../research.md). These are the only network calls the app makes
(FR-027). All of them are made from the main process through **`google-auth-library`**
`OAuth2Client` (research R11). Tests build the client with
`transporter: new Gaxios({fetchImplementation: fakeFetch})`, and every call is tested against
fixtures in `tests/fixtures/`.

## Picker API

Base `https://photospicker.googleapis.com/v1`. Every request is
`oauth2Client.request({url, method, data?, params?, responseType?, retryConfig})`. The library
adds `Authorization: Bearer <access token>`. Downloads use `responseType: 'arraybuffer'`.

| Step | Request | Response fields used |
|------|---------|----------------------|
| Create session | `POST /sessions`, body `{}` | `id`, `pickerUri`, `pollingConfig.pollInterval` (duration string, e.g. `"5s"`), `pollingConfig.timeoutIn`, `expireTime` |
| Open picker | `openExternal(pickerUri + "/autoclose")` | — |
| Poll | `GET /sessions/{id}` every `pollInterval` | `mediaItemsSet`, `pollingConfig` (may change) |
| List | `GET /mediaItems?sessionId={id}&pageSize=100[&pageToken=…]` | `mediaItems[].id`, `.type`, `.createTime`, `.mediaFile.baseUrl`, `.mediaFile.mimeType`, `.mediaFile.mediaFileMetadata.width` / `.height`, `nextPageToken` |
| Wallpaper image | `GET {baseUrl}=w{W}-h{H}` | JPEG bytes. W×H is the largest display's pixel size. `baseUrl` is valid for 60 minutes |
| Thumbnail | `GET {baseUrl}=w256-h256-c` | JPEG bytes, 256×256, center-cropped |
| Clean up | `DELETE /sessions/{id}` | — |

## OAuth 2.0 (Desktop client, PKCE, loopback) through `OAuth2Client`

The client is created as `new OAuth2Client({clientId, clientSecret, redirectUri:
'http://127.0.0.1:<port>', eagerRefreshThresholdMillis: 60000, transporter})`.

| Step | Library call | Wire request it makes |
|------|--------------|-----------------------|
| PKCE | `generateCodeVerifierAsync()` → `{codeVerifier, codeChallenge}` | — |
| Authorize | `generateAuthUrl({access_type: 'offline', prompt: 'consent', scope: [picker scope, 'openid', 'email'], code_challenge_method: CodeChallengeMethod.S256, code_challenge, state})`, then `openExternal(url)` | `https://accounts.google.com/o/oauth2/v2/auth?…` |
| Redirect | The app's loopback server (`node:http`, 127.0.0.1, ephemeral port) accepts exactly one `GET /?code=…&state=…`. A `state` mismatch or `error=…` fails sign-in. It times out after 5 minutes | — |
| Exchange code | `getToken({code, codeVerifier, redirect_uri})`, then `setCredentials(tokens)` | `POST https://oauth2.googleapis.com/token` → `access_token`, `expiry_date`, `refresh_token`, `id_token` |
| Refresh | Automatic inside `request()`. New tokens arrive on the `tokens` event, are merged (keeping the old `refresh_token` if none is returned) and saved to `TokenStore` | `POST https://oauth2.googleapis.com/token` (`grant_type=refresh_token`) |
| Revoke | `revokeToken(refreshToken)` | `POST https://oauth2.googleapis.com/revoke` |
| Email | Decode the `id_token` payload (`email` claim). No network call | — |

## Error handling

| Condition | Behavior |
|-----------|----------|
| Access token within 60 s of expiry | The library refreshes it before the call (`eagerRefreshThresholdMillis`) |
| 401 or 403 on a Picker call | The library refreshes once and retries once. If it still fails, set `needsReauth` |
| Refresh fails with `GaxiosError` and `response.data.error === 'invalid_grant'` | `needsReauth`. Rotation continues from saved photos |
| 429 or 5xx | gaxios `retryConfig` (research R11): 5 tries, backoff 1 s, 2 s, 4 s, 8 s. Then fail the step. A failed download marks the photo `unavailable` |
| `fetch` throws (offline) | Downloads stay `pending` and are retried on the next `tick()`, or when the dialog reopens, while `isOnline()` |
| Poll passes `timeoutIn` | `PickResult.timedOut`. The draft is unchanged, and the session is deleted |
| `cancelPick()` | Stop polling and delete the session. `PickResult.cancelled` |
| Revoke fails | Ignored. Local sign-out cleanup still finishes |
