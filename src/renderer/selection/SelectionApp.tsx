import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import {
  Alert,
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ImageList,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DraftView } from '../../shared/ipc-types.ts';
import type { SelectionApi } from './api.ts';
import PhotoTile from './PhotoTile.tsx';
import { headerTitle, pickMessage, tileModel, type PickMessage } from './view-model.ts';

const drag = { WebkitAppRegion: 'drag' } as const;
const noDrag = { WebkitAppRegion: 'no-drag' } as const;

export type SelectionHandlers = {
  onAdd(): void;
  onCancelPick(): void;
  onRemove(id: string): void;
  onOpenMenu(anchor: HTMLElement): void;
  onCloseMenu(): void;
  onAskClear(): void;
  onConfirmClear(): void;
  onCancelClear(): void;
  onCloseMessage(): void;
  onCancel(): void;
  onDone(): void;
};

export type SelectionViewProps = {
  draft: DraftView;
  picking: boolean;
  message: PickMessage | null;
  confirmClearOpen: boolean;
  menuAnchor: HTMLElement | null;
  handlers: SelectionHandlers;
};

/** The whole window as a pure function of its props (contracts/selection-dialog-ui.md). */
export function SelectionView({ draft, picking, message, confirmClearOpen, menuAnchor, handlers: h }: SelectionViewProps) {
  const wide = useMediaQuery('(min-width:900px)');
  const medium = useMediaQuery('(min-width:640px)');
  const cols = wide ? 6 : medium ? 5 : 4;
  const empty = draft.photos.length === 0;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Header doubles as the title bar: the traffic lights sit in the left padding. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ ...drag, alignItems: 'center', pl: '84px', pr: 2, pt: 1.5, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 650 }}>
            Choose photos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {headerTitle(draft)}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddPhotoAlternateOutlined />} onClick={h.onAdd} disabled={picking} sx={noDrag}>
          Add from Google Photos
        </Button>
        <IconButton aria-label="More" onClick={(e) => h.onOpenMenu(e.currentTarget)} sx={noDrag}>
          <MoreHorizRounded />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={h.onCloseMenu}>
          <MenuItem disabled={empty} onClick={h.onAskClear}>
            Clear all
          </MenuItem>
        </Menu>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
        {empty ? (
          <Stack spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <PhotoLibraryOutlined sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography variant="h6">No photos yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Pick photos in Google Photos to use them as your wallpaper.
            </Typography>
            <Button variant="contained" startIcon={<AddPhotoAlternateOutlined />} onClick={h.onAdd} disabled={picking}>
              Add from Google Photos
            </Button>
          </Stack>
        ) : (
          <ImageList cols={cols} gap={6} sx={{ m: 0, overflow: 'visible' }}>
            {draft.photos.map((p) => (
              <PhotoTile key={p.id} tile={tileModel(p)} onRemove={() => h.onRemove(p.id)} />
            ))}
          </ImageList>
        )}
      </Box>

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button variant="text" onClick={h.onCancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={h.onDone}>
          Done
        </Button>
      </Stack>

      <Backdrop open={picking} sx={{ zIndex: (t) => t.zIndex.modal + 1, color: '#fff', flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography>Finish choosing in your browser…</Typography>
        <Button variant="outlined" color="inherit" onClick={h.onCancelPick}>
          Cancel
        </Button>
      </Backdrop>

      <Dialog open={confirmClearOpen} onClose={h.onCancelClear}>
        <DialogTitle>Remove all photos?</DialogTitle>
        <DialogContent>
          <DialogContentText>This only changes this list. Your Google Photos library isn't touched.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={h.onCancelClear}>Cancel</Button>
          <Button color="error" variant="contained" onClick={h.onConfirmClear}>
            Remove all
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={message !== null}
        autoHideDuration={6000}
        onClose={(_e, reason) => reason !== 'clickaway' && h.onCloseMessage()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 72 } }}
      >
        {message ? (
          <Alert variant="filled" severity={message.severity} onClose={h.onCloseMessage}>
            {message.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

/** State and IPC for the selection window; renders SelectionView. */
export default function SelectionApp({ api }: { api: SelectionApi }) {
  const [draft, setDraft] = useState<DraftView>({ photos: [], skippedNonPhotoCount: 0 });
  const [picking, setPicking] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState<PickMessage | null>(null);

  useEffect(() => {
    void api.getDraft().then(setDraft);
    return api.onDraftChanged(setDraft);
  }, [api]);

  const add = useCallback(async () => {
    setMessage(null);
    setPicking(true);
    try {
      setMessage(pickMessage(await api.pick()));
      setDraft(await api.getDraft());
    } finally {
      setPicking(false);
    }
  }, [api]);

  // Keyboard: Esc = Cancel (closing an open menu, dialog or pick first), ⌘↩ = Done.
  const latest = useRef({ picking, confirmClearOpen, menuOpen: menuAnchor !== null });
  latest.current = { picking, confirmClearOpen, menuOpen: menuAnchor !== null };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = latest.current;
      if (e.key === 'Escape') {
        if (s.confirmClearOpen || s.menuOpen) return; // MUI closes these itself
        e.preventDefault();
        if (s.picking) void api.cancelPick();
        else void api.discard();
      } else if (e.key === 'Enter' && e.metaKey && !s.picking && !s.confirmClearOpen) {
        e.preventDefault();
        void api.commit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  return (
    <SelectionView
      draft={draft}
      picking={picking}
      message={message}
      confirmClearOpen={confirmClearOpen}
      menuAnchor={menuAnchor}
      handlers={{
        onAdd: () => void add(),
        onCancelPick: () => void api.cancelPick(),
        onRemove: (id) => void api.remove(id).then(setDraft),
        onOpenMenu: setMenuAnchor,
        onCloseMenu: () => setMenuAnchor(null),
        onAskClear: () => {
          setMenuAnchor(null);
          setConfirmClearOpen(true);
        },
        onConfirmClear: () => {
          setConfirmClearOpen(false);
          void api.clearDraft().then(setDraft);
        },
        onCancelClear: () => setConfirmClearOpen(false),
        onCloseMessage: () => setMessage(null),
        onCancel: () => void api.discard(),
        onDone: () => void api.commit(),
      }}
    />
  );
}
