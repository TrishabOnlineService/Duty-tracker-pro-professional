export class AdService {
  private static bannerScript: HTMLScriptElement | null = null;
  private static trackerScript: HTMLScriptElement | null = null;

  public static updateAds(isPremium: boolean) {
    if (typeof window === 'undefined') return;

    if (isPremium) {
      this.disableAds();
    } else {
      this.enableAds();
    }
  }

  private static enableAds() {
    // Inject the Monetag general tag if not already loaded
    if (!this.trackerScript) {
      const tracker = document.createElement('script');
      tracker.src = 'https://alwingulla.com/88/ce/6c/88ce6c8ddbace03ec6f707f168019b88.js';
      tracker.async = true;
      document.head.appendChild(tracker);
      this.trackerScript = tracker;
    }

    // Load Monetag Banner SDK if not already loaded
    if (!this.bannerScript) {
      const script = document.createElement('script');
      script.src = 'https://grouteels.com/act/files/tag.min.js';
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      document.head.appendChild(script);
      this.bannerScript = script;
    }

    // Display ad containers
    const containers = document.querySelectorAll('.monetag-ad-container');
    containers.forEach(el => {
      (el as HTMLElement).style.display = 'block';
    });
  }

  private static disableAds() {
    // Remove Monetag Scripts
    if (this.bannerScript) {
      this.bannerScript.remove();
      this.bannerScript = null;
    }
    if (this.trackerScript) {
      this.trackerScript.remove();
      this.trackerScript = null;
    }

    const scripts = document.querySelectorAll('script');
    scripts.forEach(s => {
      if (
        s.src.includes('grouteels.com') ||
        s.src.includes('alwingulla.com') ||
        s.src.includes('monetag')
      ) {
        s.remove();
      }
    });

    // Hide all containers
    const containers = document.querySelectorAll('.monetag-ad-container');
    containers.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  }
}
