// Turns Google API failures into user-facing messages (FR-025) plus details for the log.

export type PickerErrorKind = 'apiDisabled' | 'scopeMissing' | 'network' | 'http';

export type PickerErrorDescription = {
  kind: PickerErrorKind;
  /** Shown to the user. */
  message: string;
  /** HTTP status, or null when no response arrived. */
  status: number | null;
  /** Google's own error text, for the log only. */
  detail: string;
};

type GoogleErrorBody = { error?: { message?: string; details?: { reason?: string }[] } };

export function describePickerError(e: unknown): PickerErrorDescription {
  const response = (e as { response?: { status?: number; data?: unknown } } | null)?.response;
  const fallbackDetail = e instanceof Error ? e.message : String(e);
  if (!response?.status) {
    return {
      kind: 'network',
      message: "Couldn't reach Google Photos. Check your connection and try again.",
      status: null,
      detail: fallbackDetail,
    };
  }

  const body = (response.data ?? {}) as GoogleErrorBody;
  const detail = body.error?.message ?? fallbackDetail;
  const reasons = new Set((body.error?.details ?? []).map((d) => d.reason));

  if (reasons.has('SERVICE_DISABLED') || /has not been used in project|is disabled/i.test(detail)) {
    return {
      kind: 'apiDisabled',
      message:
        "The Google Photos Picker API isn't enabled for this app's Google Cloud project. Enable it in the Cloud Console, wait a few minutes, and try again.",
      status: response.status,
      detail,
    };
  }
  if (reasons.has('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || /insufficient authentication scopes/i.test(detail)) {
    return {
      kind: 'scopeMissing',
      message: 'Google Photos access was not granted. Sign in again and tick the Google Photos permission.',
      status: response.status,
      detail,
    };
  }
  return {
    kind: 'http',
    message: `Google Photos returned an error (HTTP ${response.status}). Try again in a few minutes.`,
    status: response.status,
    detail,
  };
}
