/**
 * PWA Install Prompt Component
 * Shows a banner prompting users to install the app
 */
import { i18n } from '../modules/i18n';

export class PWAInstallPrompt {
  private deferredPrompt: any = null;
  private promptElement: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      this.deferredPrompt = e;
      // Show the install prompt
      this.showPrompt();
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.hidePrompt();
      this.deferredPrompt = null;
    });
  }

  private showPrompt(): void {
    // Don't show if already installed or user dismissed
    if (this.isAppInstalled() || this.wasPromptDismissed()) {
      return;
    }

    this.promptElement = document.createElement('div');
    this.promptElement.className = 'pwa-install-prompt';
    this.promptElement.innerHTML = `
      <div class="pwa-install-content">
        <div class="pwa-install-text">
          <strong>${i18n.t('pwa.install.title')}</strong>
          <p>${i18n.t('pwa.install.message')}</p>
        </div>
        <div class="pwa-install-actions">
          <button class="pwa-install-btn" id="pwa-install">${i18n.t('pwa.install.button')}</button>
          <button class="pwa-dismiss-btn" id="pwa-dismiss">×</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.promptElement);

    // Add event listeners
    const installBtn = document.getElementById('pwa-install');
    const dismissBtn = document.getElementById('pwa-dismiss');

    installBtn?.addEventListener('click', () => this.handleInstall());
    dismissBtn?.addEventListener('click', () => this.handleDismiss());

    // Add styles
    this.injectStyles();
  }

  private hidePrompt(): void {
    if (this.promptElement) {
      this.promptElement.remove();
      this.promptElement = null;
    }
  }

  private async handleInstall(): Promise<void> {
    if (!this.deferredPrompt) {
      return;
    }

    // Show the install prompt
    this.deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    if (outcome === 'accepted') {
      this.hidePrompt();
    }

    // Clear the deferredPrompt
    this.deferredPrompt = null;
  }

  private handleDismiss(): void {
    this.hidePrompt();
    // Remember that user dismissed the prompt (for 7 days)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }

  private isAppInstalled(): boolean {
    // Check if running in standalone mode (already installed)
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  private wasPromptDismissed(): boolean {
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (!dismissedTime) {
      return false;
    }

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - parseInt(dismissedTime) < sevenDays;
  }

  private injectStyles(): void {
    const styleId = 'pwa-install-prompt-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .pwa-install-prompt {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        max-width: 90%;
        width: 400px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from {
          transform: translateX(-50%) translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }

      .pwa-install-content {
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .pwa-install-text {
        flex: 1;
      }

      .pwa-install-text strong {
        display: block;
        font-size: 16px;
        color: #1f2937;
        margin-bottom: 4px;
      }

      .pwa-install-text p {
        margin: 0;
        font-size: 14px;
        color: #6b7280;
      }

      .pwa-install-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .pwa-install-btn {
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }

      .pwa-install-btn:hover {
        background: #2563eb;
      }

      .pwa-dismiss-btn {
        background: transparent;
        color: #9ca3af;
        border: none;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        padding: 4px;
        transition: color 0.2s;
      }

      .pwa-dismiss-btn:hover {
        color: #6b7280;
      }

      @media (max-width: 640px) {
        .pwa-install-prompt {
          bottom: 10px;
          width: calc(100% - 20px);
        }

        .pwa-install-content {
          flex-direction: column;
          align-items: stretch;
        }

        .pwa-install-actions {
          justify-content: space-between;
        }
      }
    `;

    document.head.appendChild(style);
  }
}
