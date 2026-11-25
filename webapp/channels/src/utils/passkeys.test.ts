// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Passkey} from '@mattermost/types/passkeys';

import {Client4} from 'mattermost-redux/client';

import {assertionToJSON, base64urlDecode, base64urlEncode, createPasskey, creationOptionsFromJSON, currentSessionCanAddPasskey, registrationToJSON, requestOptionsFromJSON, signalAcceptedPasskeys, signalUnknownPasskey, verifyPasskey} from './passkeys';

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

    describe('requestOptionsFromJSON', () => {
        test('decodes the binary fields and leaves the rest untouched', () => {
            const result = requestOptionsFromJSON({
                challenge: base64urlEncode(bytes(1, 2, 3)),
                rpId: 'example.com',
                timeout: 60000,
                userVerification: 'required',
                allowCredentials: [{type: 'public-key', id: base64urlEncode(bytes(0xfb, 0xff)), transports: ['usb']}],
            });

            expect(toArray(result.challenge as ArrayBuffer)).toEqual([1, 2, 3]);
            expect(result.allowCredentials).toHaveLength(1);
            expect(toArray(result.allowCredentials![0].id as ArrayBuffer)).toEqual([0xfb, 0xff]);
            expect(result.allowCredentials![0].transports).toEqual(['usb']);
            expect(result.rpId).toBe('example.com');
            expect(result.timeout).toBe(60000);
            expect(result.userVerification).toBe('required');
        });

        test('handles missing allowCredentials', () => {
            const result = requestOptionsFromJSON({challenge: 'AQ'});
            expect(toArray(result.challenge as ArrayBuffer)).toEqual([1]);
            expect(result.allowCredentials).toBeUndefined();
        });
    });

    describe('assertionToJSON', () => {
        const fake = (userHandle: ArrayBuffer | null) => ({
            id: 'abc',
            rawId: bytes(0xfb, 0xff),
            type: 'public-key',
            authenticatorAttachment: 'platform',
            getClientExtensionResults: () => ({}),
            response: {
                clientDataJSON: bytes(1, 2, 3),
                authenticatorData: bytes(4, 5),
                signature: bytes(6),
                userHandle,
            },
        }) as unknown as PublicKeyCredential;

        test('produces the WebAuthn JSON shape', () => {
            expect(assertionToJSON(fake(bytes(0xfb, 0xff)))).toEqual({
                id: 'abc',
                rawId: '-_8',
                type: 'public-key',
                authenticatorAttachment: 'platform',
                clientExtensionResults: {},
                response: {
                    clientDataJSON: base64urlEncode(bytes(1, 2, 3)),
                    authenticatorData: base64urlEncode(bytes(4, 5)),
                    signature: base64urlEncode(bytes(6)),
                    userHandle: '-_8',
                },
            });
        });

        test('keeps a missing userHandle null', () => {
            expect(assertionToJSON(fake(null)).response.userHandle).toBeNull();
        });
    });

    describe('signalUnknownPasskey', () => {
        const original = (window as any).PublicKeyCredential;
        afterEach(() => {
            (window as any).PublicKeyCredential = original;
        });

        test('calls the browser function with the rp and credential id', () => {
            const signal = jest.fn().mockResolvedValue(undefined);
            (window as any).PublicKeyCredential = {signalUnknownCredential: signal};

            signalUnknownPasskey('example.com', 'abc');

            expect(signal).toHaveBeenCalledWith({rpId: 'example.com', credentialId: 'abc'});
        });

        test('does nothing when the browser has no PublicKeyCredential or no such function', () => {
            (window as any).PublicKeyCredential = undefined;
            expect(() => signalUnknownPasskey('example.com', 'abc')).not.toThrow();

            (window as any).PublicKeyCredential = {};
            expect(() => signalUnknownPasskey('example.com', 'abc')).not.toThrow();
        });

        test('swallows a rejection and a synchronous throw', async () => {
            const unhandled = jest.fn();
            process.on('unhandledRejection', unhandled);

            (window as any).PublicKeyCredential = {signalUnknownCredential: jest.fn().mockRejectedValue(new Error('nope'))};
            expect(() => signalUnknownPasskey('example.com', 'abc')).not.toThrow();

            (window as any).PublicKeyCredential = {signalUnknownCredential: jest.fn(() => {
                throw new Error('sync');
            })};
            expect(() => signalUnknownPasskey('example.com', 'abc')).not.toThrow();

            await new Promise((resolve) => setTimeout(resolve, 0));
            process.off('unhandledRejection', unhandled);
            expect(unhandled).not.toHaveBeenCalled();
        });
    });

    describe('signalAcceptedPasskeys', () => {
        const original = (window as any).PublicKeyCredential;
        afterEach(() => {
            (window as any).PublicKeyCredential = original;
        });

        const pk = (credentialId: string, userHandle: string) => ({credential_id: credentialId, user_handle: userHandle}) as Passkey;

        test('sends one call for a handle shared by several passkeys, listing every id', () => {
            const signal = jest.fn().mockResolvedValue(undefined);
            (window as any).PublicKeyCredential = {signalAllAcceptedCredentials: signal};

            signalAcceptedPasskeys('example.com', [pk('c1', 'h1'), pk('c2', 'h1')]);

            expect(signal).toHaveBeenCalledTimes(1);
            expect(signal).toHaveBeenCalledWith({rpId: 'example.com', userId: 'h1', allAcceptedCredentialIds: ['c1', 'c2']});
        });

        test('sends one call per distinct handle, each listing every id', () => {
            const signal = jest.fn().mockResolvedValue(undefined);
            (window as any).PublicKeyCredential = {signalAllAcceptedCredentials: signal};

            signalAcceptedPasskeys('example.com', [pk('c1', 'h1'), pk('c2', 'h2'), pk('c3', 'h1')]);

            expect(signal).toHaveBeenCalledTimes(2);
            expect(signal).toHaveBeenCalledWith({rpId: 'example.com', userId: 'h1', allAcceptedCredentialIds: ['c1', 'c2', 'c3']});
            expect(signal).toHaveBeenCalledWith({rpId: 'example.com', userId: 'h2', allAcceptedCredentialIds: ['c1', 'c2', 'c3']});
        });

        test('sends nothing without passkeys', () => {
            const signal = jest.fn().mockResolvedValue(undefined);
            (window as any).PublicKeyCredential = {signalAllAcceptedCredentials: signal};

            signalAcceptedPasskeys('example.com', []);

            expect(signal).not.toHaveBeenCalled();
        });

        test('does nothing when the browser has no PublicKeyCredential or no such function', () => {
            (window as any).PublicKeyCredential = undefined;
            expect(() => signalAcceptedPasskeys('example.com', [pk('c1', 'h1')])).not.toThrow();

            (window as any).PublicKeyCredential = {};
            expect(() => signalAcceptedPasskeys('example.com', [pk('c1', 'h1')])).not.toThrow();
        });

        test('swallows a rejection and a synchronous throw, and still signals the other handles', async () => {
            const unhandled = jest.fn();
            process.on('unhandledRejection', unhandled);

            (window as any).PublicKeyCredential = {signalAllAcceptedCredentials: jest.fn().mockRejectedValue(new Error('nope'))};
            expect(() => signalAcceptedPasskeys('example.com', [pk('c1', 'h1')])).not.toThrow();

            const signal = jest.fn().
                mockImplementationOnce(() => {
                    throw new Error('sync');
                }).
                mockResolvedValue(undefined);
            (window as any).PublicKeyCredential = {signalAllAcceptedCredentials: signal};
            expect(() => signalAcceptedPasskeys('example.com', [pk('c1', 'h1'), pk('c2', 'h2')])).not.toThrow();
            expect(signal).toHaveBeenCalledTimes(2);

            await new Promise((resolve) => setTimeout(resolve, 0));
            process.off('unhandledRejection', unhandled);
            expect(unhandled).not.toHaveBeenCalled();
        });
    });

    describe('createPasskey and verifyPasskey', () => {
        const originalCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials');
        const originalPKC = (window as any).PublicKeyCredential;
        const create = jest.fn();
        const get = jest.fn();
        const signal = jest.fn();

        const rawCredential = {
            id: 'cred1',
            rawId: bytes(1, 2),
            type: 'public-key',
            authenticatorAttachment: 'platform',
            getClientExtensionResults: () => ({}),
            response: {
                clientDataJSON: bytes(3),
                attestationObject: bytes(4),
                authenticatorData: bytes(5),
                signature: bytes(6),
                userHandle: bytes(7),
                getTransports: () => ['internal'],
            },
        };

        const registrationOptions = {
            ceremony_id: 'cer1',
            options: {publicKey: {challenge: 'AQID', rp: {name: 'Mattermost', id: 'example.com'}, user: {id: 'BAUG', name: 'me', displayName: 'me'}, pubKeyCredParams: [{type: 'public-key', alg: -7}]}},
        } as never;
        const loginOptions = {ceremony_id: 'cer2', options: {publicKey: {challenge: 'AQID'}}} as never;

        const domError = (name: string) => new DOMException('x', name);
        const serverError = (id: string, status: number) => Object.assign(new Error('refused'), {server_error_id: id, status_code: status});

        beforeEach(() => {
            create.mockReset();
            get.mockReset();
            signal.mockReset().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'credentials', {value: {create, get}, configurable: true});
            (window as any).PublicKeyCredential = {signalUnknownCredential: signal};
        });

        afterEach(() => {
            if (originalCredentials) {
                Object.defineProperty(navigator, 'credentials', originalCredentials);
            } else {
                delete (navigator as any).credentials;
            }
            (window as any).PublicKeyCredential = originalPKC;
        });

        describe('createPasskey', () => {
            const saved = {id: 'p1', name: 'laptop'} as never;

            test('returns the passkey finish returned, after passing it the converted credential', async () => {
                create.mockResolvedValue(rawCredential);
                const finish = jest.fn().mockResolvedValue(saved);

                await expect(createPasskey(async () => registrationOptions, finish)).resolves.toBe(saved);

                expect(finish).toHaveBeenCalledWith('cer1', registrationToJSON(rawCredential as unknown as PublicKeyCredential));
                expect(toArray(create.mock.calls[0][0].publicKey.challenge)).toEqual([1, 2, 3]);
            });

            test('returns null without calling finish when the browser yields no credential', async () => {
                create.mockResolvedValue(null);
                const finish = jest.fn();

                await expect(createPasskey(async () => registrationOptions, finish)).resolves.toBeNull();
                expect(finish).not.toHaveBeenCalled();
            });

            test.each(['NotAllowedError', 'AbortError'])('returns null when the user dismisses the prompt (%s)', async (name) => {
                create.mockRejectedValue(domError(name));
                const finish = jest.fn();

                await expect(createPasskey(async () => registrationOptions, finish)).resolves.toBeNull();
                expect(finish).not.toHaveBeenCalled();
            });

            test('rethrows InvalidStateError unchanged', async () => {
                create.mockRejectedValue(domError('InvalidStateError'));

                await expect(createPasskey(async () => registrationOptions, jest.fn())).rejects.toMatchObject({name: 'InvalidStateError'});
                expect(signal).not.toHaveBeenCalled();
            });

            test('signals the browser to forget the credential when finish refuses it', async () => {
                create.mockResolvedValue(rawCredential);
                const err = serverError('app.passkey.limit_reached.app_error', 400);

                await expect(createPasskey(async () => registrationOptions, jest.fn().mockRejectedValue(err))).rejects.toBe(err);
                expect(signal).toHaveBeenCalledWith({rpId: 'example.com', credentialId: 'cred1'});
            });

            test('signals nothing for already_registered, a 5xx or a failing begin', async () => {
                create.mockResolvedValue(rawCredential);
                const already = serverError('app.passkey.already_registered.app_error', 400);
                const unavailable = serverError('api.error', 500);
                const begin = new Error('begin failed');

                await expect(createPasskey(async () => registrationOptions, jest.fn().mockRejectedValue(already))).rejects.toBe(already);
                await expect(createPasskey(async () => registrationOptions, jest.fn().mockRejectedValue(unavailable))).rejects.toBe(unavailable);
                await expect(createPasskey(() => Promise.reject(begin), jest.fn())).rejects.toBe(begin);
                expect(signal).not.toHaveBeenCalled();
            });
        });

        describe('verifyPasskey', () => {
            test('returns true once finish has accepted the converted assertion', async () => {
                get.mockResolvedValue(rawCredential);
                const finish = jest.fn().mockResolvedValue({});

                await expect(verifyPasskey(async () => loginOptions, finish)).resolves.toBe(true);
                expect(finish).toHaveBeenCalledWith('cer2', assertionToJSON(rawCredential as unknown as PublicKeyCredential));
            });

            test('returns false without calling finish when the browser yields no credential', async () => {
                get.mockResolvedValue(null);
                const finish = jest.fn();

                await expect(verifyPasskey(async () => loginOptions, finish)).resolves.toBe(false);
                expect(finish).not.toHaveBeenCalled();
            });

            test.each(['NotAllowedError', 'AbortError'])('returns false when the user dismisses the prompt (%s)', async (name) => {
                get.mockRejectedValue(domError(name));
                const finish = jest.fn();

                await expect(verifyPasskey(async () => loginOptions, finish)).resolves.toBe(false);
                expect(finish).not.toHaveBeenCalled();
            });

            test('rethrows a server refusal from finish and signals nothing', async () => {
                get.mockResolvedValue(rawCredential);
                const err = serverError('app.passkey.not_found.app_error', 400);

                await expect(verifyPasskey(async () => loginOptions, jest.fn().mockRejectedValue(err))).rejects.toBe(err);
                expect(signal).not.toHaveBeenCalled();
            });
        });
    });

    describe('currentSessionCanAddPasskey', () => {
        const WINDOW = 10 * 60 * 1000;
        const now = 1_700_000_000_000;
        const session = (props: Record<string, string>, age: number) => ({props, create_at: now - age});
        let dateNow: jest.SpyInstance;
        let getSessions: jest.SpyInstance;

        beforeEach(() => {
            dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
            getSessions = jest.spyOn(Client4, 'getSessions');
        });

        afterEach(() => {
            dateNow.mockRestore();
            getSessions.mockRestore();
        });

        test.each([
            ['a standard session inside the window', session({csrf: 'k', login_method: 'standard'}, 1000), true],
            ['a standard session exactly at the window edge', session({csrf: 'k', login_method: 'standard'}, WINDOW), true],
            ['a standard session past the window', session({csrf: 'k', login_method: 'standard'}, WINDOW + 1), false],
            ['a passkey session', session({csrf: 'k', login_method: 'passkey'}, 1000), false],
            ['a session with no login method', session({csrf: 'k'}, 1000), false],
        ])('resolves for %s', async (_name, current, want) => {
            getSessions.mockResolvedValue([session({csrf: 'other', login_method: 'passkey'}, WINDOW * 5), current] as never);

            await expect(currentSessionCanAddPasskey('k')).resolves.toBe(want);
            expect(getSessions).toHaveBeenCalledWith('me');
        });

        test('resolves true when no session matches the login key', async () => {
            getSessions.mockResolvedValue([session({csrf: 'other', login_method: 'passkey'}, WINDOW * 5)] as never);

            await expect(currentSessionCanAddPasskey('k')).resolves.toBe(true);
        });

        test('rejects when the session list cannot be read', async () => {
            const err = new Error('offline');
            getSessions.mockRejectedValue(err);

            await expect(currentSessionCanAddPasskey('k')).rejects.toBe(err);
        });
    });
});
