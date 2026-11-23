// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PasskeyRegistrationCredential} from '@mattermost/types/passkeys';

// Hand-written rather than PublicKeyCredential.parseCreationOptionsFromJSON / toJSON(), which
// are missing from browsers older than Safari 18.4 and its contemporaries.

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
