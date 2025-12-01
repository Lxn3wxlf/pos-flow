interface BiometricAuthResult {
  success: boolean;
  error?: string;
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
   * Check if biometric authentication is available (Web only for now)
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check for WebAuthn support
      return !!(
        window.PublicKeyCredential &&
        navigator.credentials &&
        typeof navigator.credentials.create === 'function'
      );
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return false;
    }
  }

  /**
   * Authenticate using biometrics (WebAuthn for web)
   */
  async authenticate(reason: string = 'Verify your identity'): Promise<BiometricAuthResult> {
    try {
      return await this.authenticateWebAuthN(reason);
    } catch (error) {
      console.error('Biometric authentication error:', error);
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
      
      if (!storedCredentialId) {
        // No credentials stored, need to register first
        return await this.registerWebAuthN();
      }

      // Create authentication challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

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
        return { success: false, error: 'Authentication was cancelled' };
      }

      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        return { success: false, error: 'Authentication was cancelled' };
      }
      return {
        success: false,
        error: 'Biometric authentication not available on this device'
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

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'Shop Stride POS',
          id: window.location.hostname
        },
        user: {
          id: userId,
          name: 'user@pos.system',
          displayName: 'POS User'
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          requireResidentKey: false
        },
        timeout: 60000,
        attestation: 'none'
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      }) as PublicKeyCredential | null;

      if (!credential) {
        return { success: false, error: 'Registration was cancelled' };
      }

      // Store credential ID for future authentications
      const credentialId = this.arrayBufferToBase64(credential.rawId);
      localStorage.setItem('webauthn_credential_id', credentialId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to setup biometric authentication'
      };
    }
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
