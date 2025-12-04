interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

interface BiometricAvailabilityInfo {
  available: boolean;
  reason?: string;
}

/**
 * Biometric authentication service for web browsers using WebAuthn
 * Mobile native support can be added later via Capacitor plugins
 */
export class BiometricAuth {
  private static instance: BiometricAuth;

  private constructor() {}

  static getInstance(): BiometricAuth {
    if (!BiometricAuth.instance) {
      BiometricAuth.instance = new BiometricAuth();
    }
    return BiometricAuth.instance;
  }

  /**
   * Check if biometric authentication is available with detailed info
   */
  async getAvailabilityInfo(): Promise<BiometricAvailabilityInfo> {
    try {
      // Check for WebAuthn support
      if (!window.PublicKeyCredential) {
        console.log('❌ WebAuthn: PublicKeyCredential not supported');
        return { available: false, reason: 'Browser does not support WebAuthn' };
      }

      if (!navigator.credentials) {
        console.log('❌ WebAuthn: navigator.credentials not available');
        return { available: false, reason: 'Credentials API not available' };
      }

      // Check if running on HTTPS (required for WebAuthn)
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        console.log('❌ WebAuthn: Requires HTTPS. Current protocol:', window.location.protocol);
        return { available: false, reason: 'Requires HTTPS (secure connection)' };
      }

      console.log('✓ WebAuthn: Basic requirements met');
      console.log('  - Protocol:', window.location.protocol);
      console.log('  - Hostname:', window.location.hostname);

      // Check for platform authenticator (fingerprint/face)
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
        console.log('❌ WebAuthn: isUserVerifyingPlatformAuthenticatorAvailable not supported');
        return { available: false, reason: 'Platform authenticator check not supported' };
      }

      const platformAuthAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      console.log('✓ Platform authenticator available:', platformAuthAvailable);
      
      if (!platformAuthAvailable) {
        return { 
          available: false, 
          reason: 'No biometric sensor detected by browser. Try using Chrome or Edge browser, or ensure your fingerprint is enrolled in your device settings.' 
        };
      }

      return { available: true };
    } catch (error) {
      console.error('❌ Biometric availability check failed:', error);
      return { 
        available: false, 
        reason: `Error checking availability: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Check if biometric authentication is available (Web only for now)
   * Requires HTTPS and platform authenticator support
   */
  async isAvailable(): Promise<boolean> {
    const info = await this.getAvailabilityInfo();
    return info.available;
  }

  /**
   * Authenticate using biometrics (WebAuthn for web)
   */
  async authenticate(reason: string = 'Verify your identity'): Promise<BiometricAuthResult> {
    try {
      console.log('🔐 Starting biometric authentication...');
      return await this.authenticateWebAuthN(reason);
    } catch (error) {
      console.error('❌ Biometric authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Authenticate using WebAuthn (Web browsers)
   */
  private async authenticateWebAuthN(reason: string): Promise<BiometricAuthResult> {
    try {
      // Check if we have stored credentials
      const storedCredentialId = localStorage.getItem('webauthn_credential_id');
      console.log('📝 Stored credential exists:', !!storedCredentialId);
      
      if (!storedCredentialId) {
        // No credentials stored, need to register first
        console.log('🆕 No credentials found, starting registration...');
        return await this.registerWebAuthN();
      }

      // Create authentication challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      console.log('🔑 Requesting authentication with stored credential...');
      
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        allowCredentials: [{
          id: this.base64ToArrayBuffer(storedCredentialId),
          type: 'public-key',
          transports: ['internal']
        }]
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      }) as PublicKeyCredential | null;

      if (!credential) {
        console.log('❌ Authentication cancelled by user');
        return { success: false, error: 'Authentication was cancelled' };
      }

      console.log('✓ Authentication successful!');
      return { success: true };
    } catch (error) {
      console.error('❌ WebAuthn authentication error:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          return { success: false, error: 'Authentication was cancelled or timed out' };
        }
        if (error.name === 'InvalidStateError') {
          // Credential may be invalid, clear and try again
          console.log('🔄 Invalid credential state, clearing stored credential...');
          localStorage.removeItem('webauthn_credential_id');
          return { success: false, error: 'Please try again to re-register your fingerprint' };
        }
      }
      
      return {
        success: false,
        error: 'Biometric authentication failed. Please try again.'
      };
    }
  }

  /**
   * Register WebAuthn credentials (first time setup)
   */
  private async registerWebAuthN(): Promise<BiometricAuthResult> {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      console.log('📝 Creating new WebAuthn credential...');
      console.log('  - RP ID:', window.location.hostname);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'Casbah POS',
          id: window.location.hostname
        },
        user: {
          id: userId,
          name: 'pos-user@casbah.local',
          displayName: 'POS User'
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged'
        },
        timeout: 60000,
        attestation: 'none'
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      }) as PublicKeyCredential | null;

      if (!credential) {
        console.log('❌ Registration cancelled by user');
        return { success: false, error: 'Registration was cancelled' };
      }

      // Store credential ID for future authentications
      const credentialId = this.arrayBufferToBase64(credential.rawId);
      localStorage.setItem('webauthn_credential_id', credentialId);
      
      console.log('✓ Fingerprint registered successfully!');
      return { success: true };
    } catch (error) {
      console.error('❌ WebAuthn registration error:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          return { success: false, error: 'Registration was cancelled or denied' };
        }
        if (error.name === 'InvalidStateError') {
          return { success: false, error: 'A credential already exists. Try clearing browser data.' };
        }
      }
      
      return {
        success: false,
        error: 'Failed to setup fingerprint authentication'
      };
    }
  }

  /**
   * Clear stored credentials (for re-registration)
   */
  clearStoredCredentials(): void {
    localStorage.removeItem('webauthn_credential_id');
    console.log('🗑️ Stored credentials cleared');
  }

  /**
   * Helper: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Helper: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const biometricAuth = BiometricAuth.getInstance();
