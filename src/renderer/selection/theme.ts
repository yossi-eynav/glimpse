import { createTheme } from '@mui/material/styles';

/** One theme for the selection window: Material components with Mac proportions (research R4). */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: { palette: { primary: { main: '#0A84FF' }, background: { default: '#f5f5f7', paper: '#ffffff' } } },
    dark: { palette: { primary: { main: '#0A84FF' }, background: { default: '#1e1e1e', paper: '#2a2a2c' } } },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});
