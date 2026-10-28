import { CssBaseline, ThemeProvider } from '@mui/material';
import { createRoot } from 'react-dom/client';
import './api.ts';
import SelectionApp from './SelectionApp.tsx';
import { theme } from './theme.ts';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <ThemeProvider theme={theme}>
    <CssBaseline enableColorScheme />
    <SelectionApp api={window.selection} />
  </ThemeProvider>,
);
