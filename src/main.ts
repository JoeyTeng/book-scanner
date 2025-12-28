import './styles/main.css';
import { App } from './app';
import { PWAInstallPrompt } from './components/pwa-install-prompt';
import { storage } from './modules/storage';

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Initialize PWA install prompt
new PWAInstallPrompt();

// Initialize app after storage is ready
async function initApp() {
  try {
    // Wait for storage to initialize
    await storage.waitForInit();

    const app = new App();
    await app.init();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    // Show error to user
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h1>Failed to initialize app</h1>
        <pre style="text-align: left; background: #f5f5f5; padding: 10px; overflow: auto;">${error}</pre>
        <button onclick="location.reload()">Reload</button>
      </div>
    `;
  }
}

void initApp();
