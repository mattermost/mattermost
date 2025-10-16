import { DeviceType, KeyHelper, MessageType, PreKeyType, SessionBuilder, SessionCipher, SignalProtocolAddress, SignedPublicPreKeyType } from "@privacyresearch/libsignal-protocol-typescript";
import { E2EEStore } from "../storage/E2EEStore";
import { E2EEOneTimePreKeyPayload, E2EERegisterDeviceRequest, E2EESignedPreKeyPayload } from "@mattermost/types/e2ee";

const toBase64 = (ab: ArrayBuffer): string => {
    const bytes = new Uint8Array(ab);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) 
        bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

export type CiphertextEnvelope = {
    type: MessageType['type'];
    body: string;
}

async function computeIdentityKeyFingerprint(identityPublicKey: ArrayBuffer): Promise<string> {
    let keyBytes = new Uint8Array(identityPublicKey);
    if (keyBytes.byteLength === 33 && keyBytes[0] === 0x05) {
        keyBytes = keyBytes.subarray(1);
    }
    if (keyBytes.length !== 32) {
        throw new Error(`Invalid identity public key length: ${keyBytes.length}`);
    }
    const hashBuf = await crypto.subtle.digest('SHA-256', keyBytes);
    return toBase64(hashBuf);
}

export class E2EEService {
    private readonly userId: string;
    public store: E2EEStore;

    constructor(userId: string) {
        this.userId = userId;
        this.store = new E2EEStore(`signal::${userId}`);
    }

    async installDevice(initialOPKCount?: number): Promise<E2EERegisterDeviceRequest> {
        const initalOPKCount = initialOPKCount ?? 100;
        
        const registrationId = KeyHelper.generateRegistrationId();
        await this.store.saveRegistrationId(registrationId);
        const identity = await KeyHelper.generateIdentityKeyPair();
        const identityPubB64 = toBase64(identity.pubKey);
        await this.store.saveIdentityKeyPair(identity);

        let spkId = await this.store.getCurSignedPreKeyId();
        if (!spkId) {
            spkId = 0;
        }
        const signedPreKey = await KeyHelper.generateSignedPreKey(identity, ++spkId);
        await this.store.storeSignedPreKey(spkId, signedPreKey.keyPair);
        const signedPreKeyPayload: E2EESignedPreKeyPayload = {
            key_id: spkId,
            public_key: toBase64(signedPreKey.keyPair.pubKey),
            signature: toBase64(signedPreKey.signature),
        };
        await this.store.saveCurSignedPreKeyId(spkId);

        let opkId = await this.store.getCurOneTimePreKeyId();
        if (!opkId) {
            opkId = 0;
        }
        const opksPayload: E2EEOneTimePreKeyPayload[] = [];
        for (let i = 0; i < initalOPKCount; i++) {
            const preKey = await KeyHelper.generatePreKey(++opkId);
            await this.store.storePreKey(opkId, preKey.keyPair);
            opksPayload.push({
                key_id: opkId,
                public_key: toBase64(preKey.keyPair.pubKey)
            });
        }
        await this.store.saveCurOneTimePreKeyId(opkId);
        
        const registerPayload: E2EERegisterDeviceRequest = {
            device: {
                device_id: 0,
                device_label: navigator.userAgent,
                registration_id: registrationId,
                identity_key_public: identityPubB64,
                identity_key_fingerprint: await computeIdentityKeyFingerprint(identity.pubKey)
            },
            signed_prekey: signedPreKeyPayload,
            one_time_prekeys: opksPayload,
        }
        return registerPayload;
    }

    async rotateSignedPreKey(): Promise<E2EESignedPreKeyPayload> {
        const identity = await this.store.getIdentityKeyPair();
        if (!identity) {
            throw new Error('Identity key not installed');
        }
        let spkId = await this.store.getCurSignedPreKeyId();
        if (!spkId) {
            spkId = 0;
        }
        const spk = await KeyHelper.generateSignedPreKey(identity, ++spkId);
        await this.store.storeSignedPreKey(spkId, spk.keyPair);
        await this.store.saveCurSignedPreKeyId(spkId);
        return {
            key_id: spkId,
            public_key: toBase64(spk.keyPair.pubKey),
            signature: toBase64(spk.signature)
        };
    }

    async replenishOneTimePreKeys(count: number): Promise<E2EEOneTimePreKeyPayload[]> {
        if (count <= 0) return [];
        const out: E2EEOneTimePreKeyPayload[] = []
        let opkId = await this.store.getCurOneTimePreKeyId();
        if (!opkId) opkId = 0;
        for (let i = 0; i < count; i++) {
            const prekey = await KeyHelper.generatePreKey(++opkId);
            await this.store.storePreKey(opkId, prekey.keyPair);
            out.push({key_id: opkId, public_key: toBase64(prekey.keyPair.pubKey)});
        }
        await this.store.saveCurOneTimePreKeyId(opkId);
        return out;
    }

    async ensureSessionWithPeer(recipientUserId: string, recipientDeviceId: number, bundle: {
        registrationId: number;
        identityPubKeyB64: string;
        signedPreKey: {keyId: number, publicKeyB64: string, signatureB64: string};
        oneTimePreKey?: {keyId: number; publicKeyB64: string} | null
    }): Promise<void> {
        const address = new SignalProtocolAddress(recipientUserId, recipientDeviceId);
        const builder = new SessionBuilder(this.store as any, address);

        const preKeyBundle: {
            registrationId: number;
            identityKey: ArrayBuffer;
            signedPreKey: SignedPublicPreKeyType;
            preKey?: PreKeyType | null
        } = {
            registrationId: bundle.registrationId,
            identityKey: Uint8Array.from(atob(bundle.identityPubKeyB64), c => c.charCodeAt(0)).buffer,
            signedPreKey: {
                keyId: bundle.signedPreKey.keyId,
                publicKey: Uint8Array.from(atob(bundle.signedPreKey.publicKeyB64), c => c.charCodeAt(0)).buffer,
                signature: Uint8Array.from(atob(bundle.signedPreKey.signatureB64), c => c.charCodeAt(0)).buffer,
            },
            preKey: bundle.oneTimePreKey
                ? {
                    keyId: bundle.oneTimePreKey.keyId,
                    publicKey: Uint8Array.from(atob(bundle.oneTimePreKey.publicKeyB64), c => c.charCodeAt(0)).buffer,
                } : null,
        };
        await builder.processPreKey(preKeyBundle as DeviceType);
    }

    async encryptForPeer(recipientUserId: string, recipientDeviceId: number, plaintext: ArrayBuffer): Promise<CiphertextEnvelope> {
        const address = new SignalProtocolAddress(recipientUserId, recipientDeviceId);
        const cipher = new SessionCipher(this.store as any, address);
        const ct = await cipher.encrypt(plaintext);
        return {type: ct.type, body: ct.body!};
    }

    async decryptFromPeer(senderUserId: string, senderDeviceId: number, envelope: CiphertextEnvelope): Promise<ArrayBuffer> {
        const address = new SignalProtocolAddress(senderUserId, senderDeviceId);
        const cipher = new SessionCipher(this.store as any, address);

        if (envelope.type === 3) {
            return cipher.decryptPreKeyWhisperMessage(envelope.body, 'binary');
        }
        return cipher.decryptWhisperMessage(envelope.body, 'binary');
    }
    
}