import CloseRounded from '@mui/icons-material/CloseRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { Box, IconButton, ImageListItem, Skeleton, Tooltip } from '@mui/material';
import type { TileModel } from './view-model.ts';

const RADIUS = 8;

/** One square thumbnail: ready, downloading, or unavailable (contracts/selection-dialog-ui.md). */
export default function PhotoTile({ tile, onRemove }: { tile: TileModel; onRemove(): void }) {
  const image =
    tile.state === 'loading' ? (
      <Skeleton variant="rounded" animation="wave" sx={{ width: '100%', height: '100%', borderRadius: `${RADIUS}px` }} />
    ) : (
      <Box
        component="img"
        src={tile.thumbUrl ?? undefined}
        alt=""
        loading="lazy"
        decoding="async"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          borderRadius: `${RADIUS}px`,
          opacity: tile.state === 'unavailable' ? 0.35 : 1,
        }}
      />
    );

  return (
    <ImageListItem
      aria-busy={tile.state === 'loading' ? true : undefined}
      aria-label={tile.state === 'ready' ? undefined : tile.label}
      sx={{
        aspectRatio: '1 / 1',
        position: 'relative',
        borderRadius: `${RADIUS}px`,
        overflow: 'hidden',
        '&:hover .remove, &:focus-within .remove': { opacity: 1 },
      }}
    >
      {tile.state === 'unavailable' ? (
        <Tooltip title={tile.label}>
          <Box sx={{ width: '100%', height: '100%' }}>
            {image}
            <WarningAmberRounded color="warning" sx={{ position: 'absolute', left: 8, bottom: 8 }} />
          </Box>
        </Tooltip>
      ) : (
        image
      )}
      <IconButton
        className="remove"
        size="small"
        aria-label="Remove photo"
        onClick={onRemove}
        sx={{
          position: 'absolute',
          top: 6,
          right: 6,
          opacity: 0,
          transition: 'opacity 120ms',
          color: '#fff',
          bgcolor: 'rgb(0 0 0 / 0.55)',
          '&:hover': { bgcolor: 'rgb(0 0 0 / 0.75)' },
        }}
      >
        <CloseRounded fontSize="small" />
      </IconButton>
    </ImageListItem>
  );
}
