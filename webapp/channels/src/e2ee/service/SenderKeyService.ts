import { E2EEStore, KeyMutex, SenderKey } from "e2ee/storage/E2EEStore";

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
    const buf = view.buffer;
    if (buf instanceof ArrayBuffer) {
        if (view.byteOffset === 0 && view.byteLength === buf.byteLength) {
            return buf;
        }
        return buf.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }

    const out = new ArrayBuffer(view.byteLength);
    new Uint8Array(out).set(view);
    return out;
}

const te = new TextEncoder();
const td = new TextDecoder();

function toBytes(data: ArrayBuffer | Uint8Array | string): Uint8Array {
    if (typeof data === 'string') return te.encode(data);
    if (data instanceof Uint8Array) return data;
    return new Uint8Array(data);
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
    const len = arrs.reduce((n, a) => n + a.length, 0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const a of arrs) { out.set(a, off); off += a.length; }
    return out;
}

const b64e = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));
const b64d = (s: string) => new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)));

function ctEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
    return r === 0;
}

const mapToPairs = (m: Map<number, Uint8Array>) => 
    Array.from(m.entries()).map(([k, v]) => [k, b64e(v)] as [number, string]);

const pairsToMap = (pairs: Array<[number, string]> = []) => 
    new Map<number, Uint8Array>(pairs.map(([k, sv]) => [k, b64d(sv)]));


async function hmacSHA256(keyRaw: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyRaw), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, toArrayBuffer(data));
    return new Uint8Array(sig);
}

async function hkdfSHA256(ikm: Uint8Array, info: string, length: number): Promise<Uint8Array> {
    const salt = new Uint8Array(32);
    const base = await crypto.subtle.importKey('raw', toArrayBuffer(ikm), 'HKDF', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        {name: 'HKDF', hash: 'SHA-256', salt: toArrayBuffer(salt), info: toArrayBuffer(te.encode(info))},
        base,
        length * 8
    );
    return new Uint8Array(bits);
}

async function aesCbcEncrypt(aesKey: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(aesKey), {name: 'AES-CBC'}, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({name: 'AES-CBC', iv: toArrayBuffer(iv)}, key, toArrayBuffer(plaintext));
  return new Uint8Array(ct);
}

async function aesCbcDecrypt(aesKey: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', toArrayBuffer(aesKey), {name: 'AES-CBC'}, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({name: 'AES-CBC', iv: toArrayBuffer(iv)}, key, toArrayBuffer(ciphertext));
    return new Uint8Array(pt);
}

export interface SignatureKeyPair {
    publicKey: Uint8Array;
    privateKey?: Uint8Array | undefined;
}

export interface SignatureProvider {
    generate(): Promise<SignatureKeyPair>;
    sign(priv: Uint8Array, data: Uint8Array): Promise<Uint8Array>;
    verify(pub: Uint8Array, data: Uint8Array, sig: Uint8Array): Promise<boolean>;
}

export class Ed25519Provider implements SignatureProvider {
    async generate(): Promise<SignatureKeyPair> {
        const kp = await crypto.subtle.generateKey({name: 'Ed25519'}, true, ['sign', 'verify']);
        const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
        const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
        return {publicKey: rawPub, privateKey: pkcs8};
    }

    async sign(priv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
        const sk = await crypto.subtle.importKey('pkcs8', toArrayBuffer(priv), {name: 'Ed25519'}, false, ['sign']);
        const sig  = await crypto.subtle.sign({name: 'Ed25519'}, sk, toArrayBuffer(data));
        return new Uint8Array(sig);
    }

    async verify(pub: Uint8Array, data: Uint8Array, sig: Uint8Array): Promise<boolean> {
        const pk = await crypto.subtle.importKey('raw', toArrayBuffer(pub), {name: 'Ed25519'}, false, ['verify']);
        return crypto.subtle.verify({name: 'Ed25519'}, pk, toArrayBuffer(sig), toArrayBuffer(data));
    }
}

export interface SenderState {
    channelId: string;
    epoch: number;
    chainKey: Uint8Array;
    msgIndex: number;
    signing: SignatureKeyPair;
}

export interface ReceiverState {
    channelId: string;
    senderUserId: string;
    senderDeviceId: number;
    epoch: number;
    chainKey: Uint8Array;
    msgIndex: number;
    signaturePub: Uint8Array;
    skipped: Map<number, Uint8Array>;
}

export interface SenderKeyDistributionMessage {
    channelId: string;
    epoch: number;
    chainKey_b64: string;
    signaturePub_b64: string;
    senderDeviceId: number;
    senderUserId: string;
}

export interface EncryptedMessage {
    channelId: string;
    senderUserId: string;
    senderDeviceId: number;
    epoch: number;
    msgIndex: number;
    ct_b64: string;
    iv_b64: string;
    mac_b64: string;
    sig_b64: string;
}

class SenderStateStore {
    private store: Map<string, SenderState[]>;
    constructor() {
        this.store = new Map<string, SenderState[]>();
    }

    load(channelId: string): SenderState[] | undefined {
        const res = this.store.get(channelId);
        return res;
    }
    save(channelId: string, states: SenderState[]) {
        this.store.set(channelId, states);
    }
}

class ReceiverStateStore {
    private store: Map<string, ReceiverState[]>;
    constructor() {
        this.store = new Map<string, ReceiverState[]>();
    }
    load(channelId: string, userId: string, deviceId: number): ReceiverState[] | undefined {
        const rsArr = this.store.get(`${channelId}::${userId}.${deviceId}`);
        return rsArr;
    }
    save(channelId: string, userId: string, deviceId: number, receiverState: ReceiverState[]) {
        this.store.set(`${channelId}::${userId}.${deviceId}`, receiverState);
    }
}


export class SenderKeyService {
    private store: E2EEStore;
    private senders = new SenderStateStore();
    private receivers = new ReceiverStateStore();
    private userId: string;
    private deviceId: number;

    private sign: SignatureProvider;
    private mux: KeyMutex;

    constructor(userId: string, deviceId: number) {
        this.userId = userId;
        this.deviceId = deviceId;
        this.sign = new Ed25519Provider();
        this.store = new E2EEStore('signal::'+ userId);
        this.mux = new KeyMutex();
    }

    async loadSenderState(channelId: string): Promise<SenderState[]> {
        let res = this.senders.load(channelId);
        if (!res) {
            res = [];
            const senderStates = await this.store.getSenderState(channelId, this.userId, 0);
            if (!senderStates) {
                return [];
            }
            for (const s of senderStates) {
                res.push({
                    channelId,
                    epoch: s.epoch,
                    chainKey: s.senderChainKey.chainKey,
                    msgIndex: s.senderChainKey.msgIndex,
                    signing: {publicKey: s.senderSigningKeyPublic, privateKey: s.senderSigningKeyPrivate}
                });
            }
        }
        return res;
    }

    async loadReceiverState(channelId: string, userId: string, deviceId: number): Promise<ReceiverState[]> {
        let res = this.receivers.load(channelId, userId, deviceId);
        if (!res) {
            res = [];
            const receiverStates = await this.store.getSenderState(channelId, userId, deviceId);
            if (!receiverStates) {
                return [];
            }
            for (const r of receiverStates) {
                if (r.senderSigningKeyPrivate) continue;
                res.push({
                    channelId,
                    senderUserId: userId,
                    senderDeviceId: deviceId,
                    epoch: r.epoch,
                    chainKey: r.senderChainKey.chainKey,
                    msgIndex: r.senderChainKey.msgIndex,
                    skipped: pairsToMap(r.unusedMsgKeys as any),
                    signaturePub: r.senderSigningKeyPublic
                });
            }
        }
        return res;
    }

    async saveSenderState(channelId: string, stArr: SenderState[]): Promise<void> {
        this.senders.save(channelId, stArr);
        const val: SenderKey[] = [];
        for (const st of stArr) {
            val.push({
                senderChainKey: {
                    chainKey: st.chainKey,
                    msgIndex: st.msgIndex,
                },
                epoch: st.epoch,
                senderSigningKeyPrivate: st.signing.privateKey,
                senderSigningKeyPublic: st.signing.publicKey,
                unusedMsgKeys: []
            });
        }
        await this.store.saveSenderState(channelId, this.userId, 0, val);
    }

    async saveReceiverState(channelId: string, userId: string, deviceId: number, rsArr: ReceiverState[]): Promise<void> {
        this.receivers.save(channelId, userId, deviceId, rsArr);
        const val: SenderKey[] = [];
        for (const rs of rsArr) {
            val.push({
                senderChainKey: {
                    chainKey: rs.chainKey,
                    msgIndex: rs.msgIndex,
                },
                epoch: rs.epoch,
                senderSigningKeyPrivate: undefined,
                senderSigningKeyPublic: rs.signaturePub,
                unusedMsgKeys: mapToPairs(rs.skipped),
            });
        }
        await this.store.saveSenderState(channelId, userId, deviceId, val);
    }

    async createOrRotateSenderKey(channelId: string): Promise<SenderKeyDistributionMessage> {
        let stArr = await this.loadSenderState(channelId);
        const epoch = (crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;
        const chainKey = crypto.getRandomValues(new Uint8Array(32));
        const signing = await this.sign.generate();
        const st: SenderState = {channelId, epoch, chainKey, msgIndex: 0, signing};

        stArr.push(st);
        await this.saveSenderState(channelId, stArr);
        return {
            channelId, 
            senderUserId: this.userId, senderDeviceId: this.deviceId,
            epoch,
            chainKey_b64: b64e(chainKey),
            signaturePub_b64: b64e(signing.publicKey)
        };
    }

    async importSenderKeyDistribution(msg: SenderKeyDistributionMessage) {
        let rsArr = await this.loadReceiverState(msg.channelId, msg.senderUserId, msg.senderDeviceId);
        const chainKey = b64d(msg.chainKey_b64);
        const pub = b64d(msg.signaturePub_b64);
        const rs: ReceiverState = {
            channelId: msg.channelId,
            senderUserId: msg.senderUserId,
            senderDeviceId: msg.senderDeviceId,
            epoch: msg.epoch,
            chainKey,
            msgIndex: 0,
            skipped: new Map(),
            signaturePub: pub
        };
        rsArr.push(rs);
        await this.saveReceiverState(msg.channelId, msg.senderUserId, msg.senderDeviceId, rsArr);
    }

    async encryptGroupMessage(channelId: string, plaintext: Uint8Array | string): Promise<EncryptedMessage> {
        const lockKey = `${channelId}|${this.deviceId}`;
        return this.mux.run(lockKey, async() => {
            const stArr = await this.loadSenderState(channelId);
            
            if (stArr.length === 0) {
                throw new Error('No SenderKey state — call createOrRotateSenderKey() first.');
            }
            const st = stArr[stArr?.length! - 1];
            const {mk80, nextCK} = await this.deriveMessageKeyAndAdvance(st.chainKey);

            const aesKeyRaw = mk80.subarray(0, 32);
            const macKey    = mk80.subarray(32, 64);
            const iv        = mk80.subarray(64, 80);

            const pt = toBytes(plaintext);
            const ct = await aesCbcEncrypt(aesKeyRaw, iv, pt);
            const mac = await hmacSHA256(macKey, ct);

            const header = this.headerBytes(channelId, st.epoch, st.msgIndex, st.signing.publicKey);
            const toSign = concatBytes(header, ct, mac);
            const sig = await this.sign.sign(st.signing.privateKey!, toSign);

            const updated: SenderState = {
                ...st,
                chainKey: nextCK,
                msgIndex: st.msgIndex + 1
            };
            stArr[stArr.length - 1] = updated;
            await this.saveSenderState(channelId, stArr);

            return {
                channelId,
                senderUserId: this.userId,
                senderDeviceId: this.deviceId,
                epoch: st.epoch,
                msgIndex: st.msgIndex,
                iv_b64: b64e(iv),
                ct_b64: b64e(ct),
                mac_b64: b64e(mac),
                sig_b64: b64e(sig),
            };
        })
    }

    async decryptGroupMessage(msg: EncryptedMessage): Promise<Uint8Array> {
        const lockKey = `${msg.channelId}|${msg.senderUserId}|${msg.senderDeviceId}|${msg.epoch}`;
        return this.mux.run(lockKey, async() => {
            const rsArr = await this.loadReceiverState(msg.channelId, msg.senderUserId, msg.senderDeviceId);
            if (rsArr.length === 0) {
                throw new Error('Missing ReceiverState. Did you import the SenderKey distribution for this epoch?');
            }

            const idx = rsArr.findIndex(s => s.epoch === msg.epoch);
            if (idx < 0) throw new Error('Unknown epoch/KeyID for this sender');
            const rs = rsArr[idx];

            const iv = b64d(msg.iv_b64);
            const ct = b64d(msg.ct_b64);
            const mac = b64d(msg.mac_b64);  
            const sig = b64d(msg.sig_b64);
            
            const header = this.headerBytes(msg.channelId, msg.epoch, msg.msgIndex, rs.signaturePub);
            const signed = concatBytes(header, ct, mac);
            const ok = await this.sign.verify(rs.signaturePub, signed, sig);
            if (!ok) throw new Error('Signature verification failed!');

            if (msg.msgIndex < rs.msgIndex) {
                const mk80 = rs.skipped.get(msg.msgIndex);
                if (!mk80) throw new Error('Stale/duplicate message and MK not cached');
                rs.skipped.delete(msg.msgIndex);
                rsArr[idx] = rs;
                this.saveReceiverState(msg.channelId, msg.senderUserId, msg.senderDeviceId, rsArr);
                return this.decryptWithMk80(mk80, iv, ct, mac);
            }

            let ck = rs.chainKey;
            while (rs.msgIndex < msg.msgIndex) {
                const {mk80, nextCK} = await this.deriveMessageKeyAndAdvance(ck);
                if (rs.skipped.size >= 2000) {
                    const firstKey = rs.skipped.keys().next().value as number | undefined;
                    if (firstKey !== undefined) rs.skipped.delete(firstKey);
                }
                rs.skipped.set(rs.msgIndex, mk80);
                ck = nextCK;
                rs.msgIndex++;
            }
            const {mk80, nextCK} = await this.deriveMessageKeyAndAdvance(ck);
            rs.chainKey = nextCK;
            rs.msgIndex = rs.msgIndex + 1;
            rsArr[idx] = rs;
            await this.saveReceiverState(msg.channelId, msg.senderUserId, msg.senderDeviceId, rsArr);

            return this.decryptWithMk80(mk80, iv, ct, mac);
        })
    }

    private headerBytes(channelId: string, epoch: number, msgIndex: number, signaturePub: Uint8Array): Uint8Array {
        const parts = [
            te.encode('MM-SK-V1'),
            te.encode(channelId),
            te.encode(String(epoch)),
            te.encode(String(msgIndex)),
            signaturePub
        ];
        return concatBytes(...parts);
    }

    private async deriveMessageKeyAndAdvance(chainKey: Uint8Array): Promise<{mk80: Uint8Array, nextCK: Uint8Array}> {
        const mkSeed = await hmacSHA256(chainKey, new Uint8Array([0x01]));
        const mk80 = await hkdfSHA256(mkSeed, 'MSG_KEY_80', 80);
        const nextCK = await hmacSHA256(chainKey, new Uint8Array([0x02]));
        return {mk80, nextCK};
    }

    private async decryptWithMk80(mk80: Uint8Array, iv: Uint8Array, ct: Uint8Array, mac: Uint8Array): Promise<Uint8Array> {
        const aesKeyRaw  = mk80.subarray(0, 32);
        const macKey     = mk80.subarray(32, 64);
        const ivExpected = mk80.subarray(64, 80);

        if (!ctEqual(iv, ivExpected)) throw new Error('IV mismatch');
        const macCalc = await hmacSHA256(macKey, ct);
        if (!ctEqual(macCalc, mac)) throw new Error('HMAC verification failed');

        return await aesCbcDecrypt(aesKeyRaw, iv, ct);
    }
}
