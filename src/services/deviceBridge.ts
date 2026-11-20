import { Contact, ToolExecutionResult } from '../types/assistant';

declare global {
  interface Window {
    AndroidBridge?: {
      openWhatsApp?: (message?: string) => boolean | string;
      openApp?: (appName: string) => boolean | string;
      openUrl?: (url: string) => boolean | string;
      makeCall?: (phoneNumber: string) => boolean | string;
      callContact?: (contactName: string) => string;
      getContacts?: () => string;
    };
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: any;
    };
  }
}

const DEFAULT_CONTACTS: Contact[] = [
  { id: '1', name: 'Mom', phone: '+919876543210', relationship: 'Mother' },
  { id: '2', name: 'Mummy', phone: '+919876543210', relationship: 'Mother' },
  { id: '3', name: 'Dad', phone: '+919876543211', relationship: 'Father' },
  { id: '4', name: 'Papa', phone: '+919876543211', relationship: 'Father' },
  { id: '5', name: 'Rahul Sharma', phone: '+919876543220', relationship: 'Friend' },
  { id: '6', name: 'Rahul Verma', phone: '+919876543221', relationship: 'Colleague' },
  { id: '7', name: 'Priya', phone: '+919876543230', relationship: 'Sister' },
  { id: '8', name: 'Emergency', phone: '112', relationship: 'Emergency' },
];

const APP_ALLOWLIST: Record<string, { name: string; url: string; scheme?: string }> = {
  whatsapp: { name: 'WhatsApp', url: 'https://web.whatsapp.com', scheme: 'whatsapp://' },
  youtube: { name: 'YouTube', url: 'https://www.youtube.com', scheme: 'vnd.youtube://' },
  instagram: { name: 'Instagram', url: 'https://www.instagram.com', scheme: 'instagram://' },
  spotify: { name: 'Spotify', url: 'https://open.spotify.com', scheme: 'spotify://' },
  maps: { name: 'Google Maps', url: 'https://maps.google.com', scheme: 'geo:0,0?q=' },
  googlemaps: { name: 'Google Maps', url: 'https://maps.google.com', scheme: 'geo:0,0?q=' },
  gmail: { name: 'Gmail', url: 'https://mail.google.com', scheme: 'googlegmail://' },
  twitter: { name: 'X (Twitter)', url: 'https://x.com', scheme: 'twitter://' },
  x: { name: 'X (Twitter)', url: 'https://x.com', scheme: 'twitter://' },
  telegram: { name: 'Telegram', url: 'https://web.telegram.org', scheme: 'tg://' },
  calculator: { name: 'Calculator', url: 'https://www.google.com/search?q=calculator' },
  clock: { name: 'Clock', url: 'https://time.is' },
  chrome: { name: 'Google Chrome', url: 'https://www.google.com' },
};

export class DeviceBridge {
  private contacts: Contact[] = [];

  constructor() {
    this.loadContacts();
  }

  private loadContacts() {
    try {
      const stored = localStorage.getItem('arushi_contacts');
      if (stored) {
        this.contacts = JSON.parse(stored);
      } else {
        this.contacts = [...DEFAULT_CONTACTS];
        this.saveContacts();
      }
    } catch {
      this.contacts = [...DEFAULT_CONTACTS];
    }
  }

  public saveContacts() {
    try {
      localStorage.setItem('arushi_contacts', JSON.stringify(this.contacts));
    } catch (e) {
      console.error('[DeviceBridge] Error saving contacts to localStorage', e);
    }
  }

  public getContacts(): Contact[] {
    return [...this.contacts];
  }

  public addContact(contact: Omit<Contact, 'id'>): Contact {
    const newContact: Contact = {
      ...contact,
      id: Date.now().toString(),
    };
    this.contacts.push(newContact);
    this.saveContacts();
    return newContact;
  }

  public deleteContact(id: string) {
    this.contacts = this.contacts.filter(c => c.id !== id);
    this.saveContacts();
  }

  public isNativeAndroidAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.AndroidBridge || (window.Capacitor && window.Capacitor.isNativePlatform?.()));
  }

  public getPlatformMode(): 'native-android' | 'browser-fallback' {
    return this.isNativeAndroidAvailable() ? 'native-android' : 'browser-fallback';
  }

  public async openWhatsApp(message: string = ''): Promise<ToolExecutionResult> {
    console.log('[DeviceBridge] Executing openWhatsApp', { message });
    try {
      if (typeof window !== 'undefined' && window.AndroidBridge?.openWhatsApp) {
        const res = window.AndroidBridge.openWhatsApp(message);
        return {
          success: true,
          action: 'openWhatsApp',
          message: 'WhatsApp opened via native Android bridge',
          rawDetails: { nativeResult: res }
        };
      }

      // Browser fallback
      const encodedMsg = encodeURIComponent(message || '');
      const waUrl = encodedMsg ? `https://api.whatsapp.com/send?text=${encodedMsg}` : 'https://api.whatsapp.com';
      
      const opened = window.open(waUrl, '_blank');
      if (opened) {
        return {
          success: true,
          action: 'openWhatsApp',
          message: 'WhatsApp opened in browser window',
          url: waUrl
        };
      } else {
        // Pop-up blocked, try location redirect or direct deep-link
        window.location.href = `whatsapp://send?text=${encodedMsg}`;
        return {
          success: true,
          action: 'openWhatsApp',
          message: 'WhatsApp deep-link triggered',
          url: 'whatsapp://'
        };
      }
    } catch (err: any) {
      console.error('[DeviceBridge] Failed to open WhatsApp:', err);
      return {
        success: false,
        action: 'openWhatsApp',
        error: `Could not open WhatsApp: ${err?.message || 'Unknown error'}`
      };
    }
  }

  public async openApp(appName: string): Promise<ToolExecutionResult> {
    console.log('[DeviceBridge] Executing openApp', { appName });
    const cleanApp = appName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    // Allow WhatsApp direct forwarding
    if (cleanApp.includes('whatsapp')) {
      return this.openWhatsApp();
    }

    // Check allowlist
    const matchedKey = Object.keys(APP_ALLOWLIST).find(
      key => key === cleanApp || cleanApp.includes(key) || key.includes(cleanApp)
    );

    if (!matchedKey) {
      console.warn(`[DeviceBridge] App "${appName}" is not in the supported allowlist.`);
      return {
        success: false,
        action: 'openApp',
        appName,
        error: `App "${appName}" is not supported or permitted for security reasons. Supported apps: ${Object.values(APP_ALLOWLIST).map(a => a.name).join(', ')}`
      };
    }

    const appInfo = APP_ALLOWLIST[matchedKey];

    try {
      if (typeof window !== 'undefined' && window.AndroidBridge?.openApp) {
        const res = window.AndroidBridge.openApp(matchedKey);
        return {
          success: true,
          action: 'openApp',
          appName: appInfo.name,
          message: `${appInfo.name} opened via Android native bridge`,
          rawDetails: { nativeResult: res }
        };
      }

      // Browser fallback: open web version or deep link
      const opened = window.open(appInfo.url, '_blank');
      if (opened) {
        return {
          success: true,
          action: 'openApp',
          appName: appInfo.name,
          message: `Opened ${appInfo.name} in browser`,
          url: appInfo.url
        };
      } else {
        return {
          success: true,
          action: 'openApp',
          appName: appInfo.name,
          message: `Attempting to launch ${appInfo.name}`,
          url: appInfo.url
        };
      }
    } catch (err: any) {
      return {
        success: false,
        action: 'openApp',
        appName: appInfo.name,
        error: `Failed to open ${appInfo.name}: ${err?.message || 'Unknown error'}`
      };
    }
  }

  public async openWebsite(url: string): Promise<ToolExecutionResult> {
    console.log('[DeviceBridge] Executing openWebsite', { url });
    let cleanUrl = url.trim();

    // Auto prepend https if missing
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    try {
      const parsed = new URL(cleanUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          success: false,
          action: 'openWebsite',
          error: 'Only HTTP and HTTPS URLs are allowed for safety.'
        };
      }

      if (typeof window !== 'undefined' && window.AndroidBridge?.openUrl) {
        window.AndroidBridge.openUrl(cleanUrl);
        return {
          success: true,
          action: 'openWebsite',
          url: cleanUrl,
          message: `Website opened via Android bridge: ${cleanUrl}`
        };
      }

      const opened = window.open(cleanUrl, '_blank', 'noopener,noreferrer');
      return {
        success: !!opened,
        action: 'openWebsite',
        url: cleanUrl,
        message: opened ? `Opened ${cleanUrl} in new tab` : `Popup blocked for ${cleanUrl}`
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'openWebsite',
        error: `Invalid URL format: ${url}`
      };
    }
  }

  public async makeCall(phoneNumber: string): Promise<ToolExecutionResult> {
    console.log('[DeviceBridge] Executing makeCall', { phoneNumber });
    // Sanitize phone number (allow +, digits, dashes, spaces)
    const sanitized = phoneNumber.replace(/[^0-9+]/g, '');

    if (!sanitized || sanitized.length < 3) {
      return {
        success: false,
        action: 'makeCall',
        phoneNumber,
        error: `Invalid phone number provided: ${phoneNumber}`
      };
    }

    try {
      if (typeof window !== 'undefined' && window.AndroidBridge?.makeCall) {
        const res = window.AndroidBridge.makeCall(sanitized);
        return {
          success: true,
          action: 'makeCall',
          phoneNumber: sanitized,
          message: `Calling ${sanitized} via Android native dialer`,
          rawDetails: { nativeResult: res }
        };
      }

      // Browser standard dialer trigger
      const telUrl = `tel:${sanitized}`;
      const anchor = document.createElement('a');
      anchor.href = telUrl;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      return {
        success: true,
        action: 'makeCall',
        phoneNumber: sanitized,
        message: `Phone dialer opened with number: ${sanitized}`
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'makeCall',
        phoneNumber: sanitized,
        error: `Could not trigger dialer: ${err?.message || 'Unknown error'}`
      };
    }
  }

  public async callContact(contactName: string): Promise<ToolExecutionResult> {
    console.log('[DeviceBridge] Executing callContact', { contactName });
    const query = contactName.trim().toLowerCase();

    if (!query) {
      return {
        success: false,
        action: 'callContact',
        error: 'Please provide a contact name to call.'
      };
    }

    // First, check native bridge if available
    if (typeof window !== 'undefined' && window.AndroidBridge?.callContact) {
      try {
        const nativeResStr = window.AndroidBridge.callContact(contactName);
        const parsed = JSON.parse(nativeResStr);
        return parsed;
      } catch (e) {
        console.warn('[DeviceBridge] Native callContact failed, falling back to local address book', e);
      }
    }

    // Search contacts
    const exactMatches = this.contacts.filter(
      c => c.name.toLowerCase() === query || (c.relationship && c.relationship.toLowerCase() === query)
    );

    let candidates = exactMatches;
    if (candidates.length === 0) {
      candidates = this.contacts.filter(
        c => c.name.toLowerCase().includes(query) || (c.relationship && c.relationship.toLowerCase().includes(query))
      );
    }

    if (candidates.length === 0) {
      console.warn(`[DeviceBridge] No contact found for "${contactName}"`);
      return {
        success: false,
        action: 'callContact',
        contactName,
        error: `Contact "${contactName}" was not found in your contacts list.`
      };
    }

    if (candidates.length > 1) {
      // Multiple matches! Do not guess.
      const matchNames = candidates.map(c => `${c.name} (${c.relationship || 'Mobile'})`);
      console.warn(`[DeviceBridge] Multiple matches found for "${contactName}":`, matchNames);
      return {
        success: false,
        action: 'callContact',
        multipleMatches: true,
        matches: matchNames,
        contactName,
        error: `Found ${candidates.length} contacts matching "${contactName}": ${matchNames.join(', ')}. Please specify which one you would like to call.`
      };
    }

    // Exactly one matching contact found
    const target = candidates[0];
    console.log(`[DeviceBridge] Exactly one match found: ${target.name} (${target.phone})`);
    
    // Call the contact via dialer / native call
    const callResult = await this.makeCall(target.phone);
    return {
      success: callResult.success,
      action: 'callContact',
      contactName: target.name,
      phoneNumber: target.phone,
      message: `Calling ${target.name} at ${target.phone}`,
      error: callResult.error
    };
  }
}

export const deviceBridge = new DeviceBridge();
