import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [iosHint] = useState(() => /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone());

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  if (promptEvent) {
    return (
      <button
        type="button"
        className="rounded-full border border-line bg-card px-3 py-2 text-sm font-semibold text-navy"
        onClick={async () => {
          await promptEvent.prompt();
          setPromptEvent(null);
        }}
      >
        Install app
      </button>
    );
  }

  if (!iosHint) return null;

  return (
    <p className="max-w-48 text-right text-xs text-muted">
      Add to Home Screen from the Share menu.
    </p>
  );
}
