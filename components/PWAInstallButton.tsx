'use client';

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure proper mounting
    const readyTimer = setTimeout(() => {
      setIsReady(true);
    }, 500);

    // Check if user previously dismissed the prompt (for this session only)
    const dismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return () => clearTimeout(readyTimer);
    }

    // Check if app is already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    if (isStandalone || isIOSStandalone) {
      setIsInstalled(true);
      setShowButton(false);
      return () => clearTimeout(readyTimer);
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was just installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      clearTimeout(readyTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setShowButton(false);
    }

    // Clear the prompt
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowButton(false);
    setIsDismissed(true);
    // Remember dismissal for this session only
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!isReady || !showButton || isInstalled || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-[80] animate-slide-down lg:hidden">
      <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border-2 border-green-300 p-4 flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
            Install PadBuddy App
          </h3>
          <p className="text-xs text-gray-600 truncate">
            I-install para mas mabilis at offline access!
          </p>
        </div>
        <button
          onClick={handleInstallClick}
          className="flex-shrink-0 flex items-center justify-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-bold px-3 py-2.5 rounded-xl shadow-lg transition-all active:scale-95"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          <Download className="h-4 w-4" />
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 transition-all"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>
      </div>
    </div>
  );
}


