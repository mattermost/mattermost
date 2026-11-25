// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Passkey, PasskeyAssertionCredential, PasskeyLoginOptions, PasskeyRegistrationCredential, PasskeyRegistrationOptions} from '@mattermost/types/passkeys';

// Hand-written rather than PublicKeyCredential.parseCreationOptionsFromJSON / toJSON(), which
// are missing from older browsers (Safari before 18.4, for one).

export function base64urlEncode(buffer: ArrayBuffer): string {
    let binary = '';
    for (const byte of new Uint8Array(buffer)) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
}

export function base64urlDecode(value: string): ArrayBuffer {
    // atob accepts unpadded input, so padding is dropped rather than restored.
    const binary = atob(value.replace(/[=]+$/, '').replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
}

export function creationOptionsFromJSON(json: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
    return {
        ...json,
        challenge: base64urlDecode(json.challenge),
        user: {...json.user, id: base64urlDecode(json.user.id)},
        excludeCredentials: json.excludeCredentials?.map((c) => ({...c, id: base64urlDecode(c.id)})),
    } as PublicKeyCredentialCreationOptions;
}

export function registrationToJSON(credential: PublicKeyCredential): PasskeyRegistrationCredential {
    const response = credential.response as AuthenticatorAttestationResponse;
    return {
        id: credential.id,
        rawId: base64urlEncode(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: {
            clientDataJSON: base64urlEncode(response.clientDataJSON),
            attestationObject: base64urlEncode(response.attestationObject),
            transports: response.getTransports?.() ?? [],
        },
    };
}

export function requestOptionsFromJSON(json: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
    return {
        ...json,
        challenge: base64urlDecode(json.challenge),
        allowCredentials: json.allowCredentials?.map((c) => ({...c, id: base64urlDecode(c.id)})),
    } as PublicKeyCredentialRequestOptions;
}

export function assertionToJSON(credential: PublicKeyCredential): PasskeyAssertionCredential {
    const response = credential.response as AuthenticatorAssertionResponse;
    return {
        id: credential.id,
        rawId: base64urlEncode(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: {
            clientDataJSON: base64urlEncode(response.clientDataJSON),
            authenticatorData: base64urlEncode(response.authenticatorData),
            signature: base64urlEncode(response.signature),

            // The server refuses a missing handle: a usernameless sign-in needs it to find the user.
            userHandle: response.userHandle ? base64urlEncode(response.userHandle) : null,
        },
    };
}

const isDismissed = (e: unknown) => (e as Error).name === 'NotAllowedError' || (e as Error).name === 'AbortError';

// Resolves null when the user backs out of the browser prompt; the unused ceremony expires on the server.
export async function createPasskey(
    begin: () => Promise<PasskeyRegistrationOptions>,
    finish: (ceremonyId: string, credential: PasskeyRegistrationCredential) => Promise<Passkey>,
): Promise<Passkey | null> {
    let created: {rpId: string; credentialId: string} | undefined;
    try {
        const {ceremony_id: ceremonyId, options} = await begin();
        const credential = await navigator.credentials.create({publicKey: creationOptionsFromJSON(options.publicKey)});
        if (!credential) {
            return null;
        }

        // An omitted rp.id means the page's own host to WebAuthn.
        created = {rpId: options.publicKey.rp.id ?? window.location.hostname, credentialId: credential.id};
        return await finish(ceremonyId, registrationToJSON(credential as PublicKeyCredential));
    } catch (e) {
        const err = e as Error & {server_error_id?: string; status_code?: number};

        // Only a definite refusal: after a network error or 5xx the server may have stored the passkey, and already_registered means the device's passkey is a working one.
        if (created && err.server_error_id && err.status_code && err.status_code >= 400 && err.status_code < 500 &&
            err.server_error_id !== 'app.passkey.already_registered.app_error') {
            signalUnknownPasskey(created.rpId, created.credentialId);
        }
        if (isDismissed(err)) {
            return null;
        }
        throw err;
    }
}

// Resolves false when the user backs out of the browser prompt; the unused ceremony expires on the server.
export async function verifyPasskey(
    begin: () => Promise<PasskeyLoginOptions>,
    finish: (ceremonyId: string, credential: PasskeyAssertionCredential) => Promise<unknown>,
): Promise<boolean> {
    try {
        const {ceremony_id: ceremonyId, options} = await begin();
        const credential = await navigator.credentials.get({publicKey: requestOptionsFromJSON(options.publicKey)}) as PublicKeyCredential | null;
        if (!credential) {
            return false;
        }
        await finish(ceremonyId, assertionToJSON(credential));
        return true;
    } catch (e) {
        if (isDismissed(e)) {
            return false;
        }
        throw e;
    }
}

// Best effort: older browsers lack signalUnknownCredential, and a failed signal is not worth showing the user.
export function signalUnknownPasskey(rpId: string, credentialId: string): void {
    try {
        PublicKeyCredential.signalUnknownCredential({rpId, credentialId}).catch(() => {});
    } catch {
        // PublicKeyCredential or the method is missing.
    }
}

// Best effort, like signalUnknownPasskey. Every call lists all credential ids: the browser only compares them
// with the credential it holds under that handle, and a manager that compares against everything it holds for
// the site would otherwise hide the passkeys registered under another handle.
export function signalAcceptedPasskeys(rpId: string, passkeys: Passkey[]): void {
    const allAcceptedCredentialIds = passkeys.map((p) => p.credential_id);
    for (const userId of new Set(passkeys.map((p) => p.user_handle))) {
        try {
            PublicKeyCredential.signalAllAcceptedCredentials({rpId, userId, allAcceptedCredentialIds}).catch(() => {});
        } catch {
            // PublicKeyCredential or the method is missing, or the call threw.
        }
    }
}
