import { CssBaseline, ThemeProvider } from '@mui/material';
import { renderToString } from 'react-dom/server';
import { SelectionView } from '../../src/renderer/selection/SelectionApp.tsx';
import { theme } from '../../src/renderer/selection/theme.ts';
import type { RenderProps } from './render-selection.ts';

const noop = () => {};
const handlers = {
  onAdd: noop,
  onCancelPick: noop,
  onRemove: noop,
  onOpenMenu: noop,
  onCloseMenu: noop,
  onAskClear: noop,
  onConfirmClear: noop,
  onCancelClear: noop,
  onCloseMessage: noop,
  onCancel: noop,
  onDone: noop,
};

export function render(props: RenderProps): string {
  return renderToString(
    <ThemeProvider theme={theme} defaultMode={props.dark ? 'dark' : 'light'}>
      <CssBaseline />
      <SelectionView
        draft={props.draft}
        picking={props.picking ?? false}
        message={props.message ?? null}
        confirmClearOpen={false}
        menuAnchor={null}
        handlers={handlers}
      />
    </ThemeProvider>,
  );
}
