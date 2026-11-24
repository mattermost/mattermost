// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PasskeyAssertionCredential, PasskeyRegistrationCredential} from '@mattermost/types/passkeys';

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

// Best effort: older browsers lack signalUnknownCredential, and a failed signal is not worth showing the user.
export function signalUnknownPasskey(rpId: string, credentialId: string): void {
    try {
        PublicKeyCredential.signalUnknownCredential({rpId, credentialId}).catch(() => {});
    } catch {
        // PublicKeyCredential or the method is missing.
    }
}
