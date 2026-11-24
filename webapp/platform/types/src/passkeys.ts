// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Passkey = {
    id: string;
    user_id: string;
    name: string;
    create_at: number;

    // 0 means the passkey has never been used to sign in.
    last_used_at: number;
};

export type PasskeyRegistrationOptions = {
    ceremony_id: string;
    options: {publicKey: PublicKeyCredentialCreationOptionsJSON};
};

// Registration result in the WebAuthn JSON form the server parses. Binary fields are base64url.
export type PasskeyRegistrationCredential = {
    id: string;
    rawId: string;
    type: string;
    authenticatorAttachment: string | null;
    clientExtensionResults: AuthenticationExtensionsClientOutputs;
    response: {
        clientDataJSON: string;
        attestationObject: string;
        transports: string[];
    };
};

export type PasskeyLoginOptions = {
    ceremony_id: string;
    options: {publicKey: PublicKeyCredentialRequestOptionsJSON};
};

export type PasskeyEnrollmentTicket = {
    ticket: string;
    expire_at: number;
};

// Sign-in result in the WebAuthn JSON form the server parses. Binary fields are base64url.
export type PasskeyAssertionCredential = {
    id: string;
    rawId: string;
    type: string;
    authenticatorAttachment: string | null;
    clientExtensionResults: AuthenticationExtensionsClientOutputs;
    response: {
        clientDataJSON: string;
        authenticatorData: string;
        signature: string;
        userHandle: string | null;
    };
};
