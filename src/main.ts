// Self-hosted font: no request to third-party servers (privacy / GDPR).
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/500-italic.css';
import './styles/tokens.css';
import './styles/app.css';
import { startApp } from './app';

const root = document.getElementById('app');
if (root) {
  startApp(root).catch((err) => {
    console.error(err);
    root.textContent = 'Protocol Explorer could not start. Please reload the page.';
  });
}
