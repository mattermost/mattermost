// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {base64urlDecode, base64urlEncode, creationOptionsFromJSON, registrationToJSON} from './passkeys';

const bytes = (...b: number[]) => new Uint8Array(b).buffer;
const toArray = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf));

describe('utils/passkeys', () => {
    describe('base64url', () => {
        test('uses the URL-safe alphabet', () => {
            expect(base64urlEncode(bytes(0xfb, 0xff))).toBe('-_8');
        });

        test.each([0, 1, 2, 3, 4, 5])('round-trips %i bytes without padding', (length) => {
            const input = Array.from({length}, (_, i) => (0xfb + (i * 7)) % 256);
            const encoded = base64urlEncode(bytes(...input));
            expect(encoded).not.toContain('=');
            expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
            expect(toArray(base64urlDecode(encoded))).toEqual(input);
        });

        test('decodes padded and unpadded input', () => {
            expect(toArray(base64urlDecode('-_8'))).toEqual([0xfb, 0xff]);
            expect(toArray(base64urlDecode('-_8='))).toEqual([0xfb, 0xff]);
            expect(toArray(base64urlDecode('AQ=='))).toEqual([1]);
            expect(toArray(base64urlDecode('AQ'))).toEqual([1]);
        });
    });

    describe('creationOptionsFromJSON', () => {
        test('decodes the binary fields and leaves the rest untouched', () => {
            const result = creationOptionsFromJSON({
                challenge: base64urlEncode(bytes(1, 2, 3)),
                rp: {name: 'Mattermost', id: 'example.com'},
                user: {id: base64urlEncode(bytes(0xfb, 0xff)), name: 'alice', displayName: 'Alice'},
                pubKeyCredParams: [{type: 'public-key', alg: -7}],
                timeout: 60000,
                authenticatorSelection: {userVerification: 'required'},
                excludeCredentials: [{type: 'public-key', id: base64urlEncode(bytes(9, 8)), transports: ['usb']}],
            });

            expect(toArray(result.challenge as ArrayBuffer)).toEqual([1, 2, 3]);
            expect(toArray(result.user.id as ArrayBuffer)).toEqual([0xfb, 0xff]);
            expect(result.excludeCredentials).toHaveLength(1);
            expect(toArray(result.excludeCredentials![0].id as ArrayBuffer)).toEqual([9, 8]);
            expect(result.excludeCredentials![0].transports).toEqual(['usb']);
            expect(result.rp).toEqual({name: 'Mattermost', id: 'example.com'});
            expect(result.user.name).toBe('alice');
            expect(result.user.displayName).toBe('Alice');
            expect(result.pubKeyCredParams).toEqual([{type: 'public-key', alg: -7}]);
            expect(result.timeout).toBe(60000);
            expect(result.authenticatorSelection).toEqual({userVerification: 'required'});
        });

        test('handles missing excludeCredentials', () => {
            const result = creationOptionsFromJSON({
                challenge: 'AQ',
                rp: {name: 'Mattermost'},
                user: {id: 'AQ', name: 'a', displayName: 'a'},
                pubKeyCredParams: [],
            });
            expect(result.excludeCredentials).toBeUndefined();
        });
    });

    describe('registrationToJSON', () => {
        const fake = (getTransports?: () => string[]) => ({
            id: 'abc',
            rawId: bytes(0xfb, 0xff),
            type: 'public-key',
            authenticatorAttachment: 'platform',
            getClientExtensionResults: () => ({credProps: {rk: true}}),
            response: {
                clientDataJSON: bytes(1, 2, 3),
                attestationObject: bytes(4, 5),
                getTransports,
            },
        }) as unknown as PublicKeyCredential;

        test('produces the WebAuthn JSON shape', () => {
            expect(registrationToJSON(fake(() => ['internal']))).toEqual({
                id: 'abc',
                rawId: '-_8',
                type: 'public-key',
                authenticatorAttachment: 'platform',
                clientExtensionResults: {credProps: {rk: true}},
                response: {
                    clientDataJSON: base64urlEncode(bytes(1, 2, 3)),
                    attestationObject: base64urlEncode(bytes(4, 5)),
                    transports: ['internal'],
                },
            });
        });

        test('uses empty transports when getTransports is absent', () => {
            expect(registrationToJSON(fake()).response.transports).toEqual([]);
        });
    });
});
