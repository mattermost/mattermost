import { Direction, SessionRecordType, StorageType } from "@privacyresearch/libsignal-protocol-typescript";

interface KeyPairType {
    pubKey: ArrayBuffer;
    privKey: ArrayBuffer;
}

interface PreKeyType {
    keyId: number;
    keyPair: KeyPairType;
}

interface SignedPreKeyType extends PreKeyType {
    signature: ArrayBuffer;
}

export function isKeyPairType(kp: any): kp is KeyPairType {
    return !!(kp?.privKey && kp?.pubKey);
}

export function isPreKeyType(pk: any): pk is PreKeyType {
    return typeof pk?.keyId === 'number' && isKeyPairType(pk.keyPair);
}

export function isSignedPreKeyType(spk: any): spk is SignedPreKeyType {
    return spk?.signature && isPreKeyType(spk);
}

export interface SenderKey {
    senderChainKey: {
        msgIndex: number;
        chainKey: Uint8Array;
    };
    epoch: number;
    senderSigningKeyPrivate: Uint8Array | undefined;
    senderSigningKeyPublic: Uint8Array;
    unusedMsgKeys: Array<[number, string]>;
}

export interface UserMetadata {
    userId: string,
    devicesCount: number,
    deviceListHash?: string;
}

export interface ChannelState {
    users: UserMetadata[],
    newMembers: string[],
    outMember: boolean;
}

type StoreValue = 
    | KeyPairType 
    | string 
    | number 
    | PreKeyType
    | SignedPreKeyType
    | ArrayBuffer
    | SenderKey[]
    | ChannelState
    | undefined;

function isArrayBuffer(thing: StoreValue): boolean {
    const t = typeof thing;
    return !!thing && t !== 'number' && t !== 'string' && 'byteLength' in (thing as any);
}

export function arrayBufferToString(b: ArrayBuffer): string {
    return uint8ArrayToString(new Uint8Array(b));
}

export function uint8ArrayToString(arr: Uint8Array): string {
    const end = arr.length;
    let begin = 0;
    if (begin === end) return "";
    let chars: number[] = [];
    let parts: string[] = [];
    while (begin < end) {
        chars.push(arr[begin++]);
        if (chars.length >= 1024) {
            parts.push(String.fromCharCode(...chars));
            chars = [];
        }
    }
    return parts.join('') + String.fromCharCode(...chars);
}

type StoreName = 'base-key-store' | 'signal-meta-store' | 'identity-store' | 'signed-prekey-store' | 'prekey-store' | 'session-store' | 'senderkey-store'| 'channel-store';

interface Row {
    [key: string | number]: StoreValue;
}

async function openDB(dbName: string, version = 2): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, version);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('base-key-store')) db.createObjectStore('base-key-store', {keyPath: 'id', autoIncrement: true});
            if (!db.objectStoreNames.contains('signal-meta-store')) db.createObjectStore('signal-meta-store', {keyPath: 'key'});
            if (!db.objectStoreNames.contains('identity-store')) db.createObjectStore('identity-store', {keyPath: 'identifier'});
            if (!db.objectStoreNames.contains('signed-prekey-store')) db.createObjectStore('signed-prekey-store', {keyPath: 'keyId', autoIncrement: true});
            if (!db.objectStoreNames.contains('prekey-store')) db.createObjectStore('prekey-store', {keyPath: 'keyId', autoIncrement: true});
            if (!db.objectStoreNames.contains('session-store')) db.createObjectStore('session-store', {keyPath: 'address'});
            if (!db.objectStoreNames.contains('senderkey-store')) db.createObjectStore('senderkey-store', {keyPath: 'senderKeyName'});
            if (!db.objectStoreNames.contains('channel-store')) db.createObjectStore('channel-store', {keyPath: 'channelId'});
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function txGet<T = Row> (db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readonly');
        const s = t.objectStore(store);
        const r = s.get(key);
        r.onsuccess = () => resolve(r.result as T ?? undefined);
        r.onerror = () => reject(r.error);
    })
}

async function txPut(db: IDBDatabase, store: StoreName, value: Row): Promise<void> {
    return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        const s = t.objectStore(store);
        const r = s.put(value);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
    });
}

async function txDelete(db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        const s = t.objectStore(store);
        const r = s.delete(key);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
    });
}

async function txGetAll<T = Row> (db: IDBDatabase, store: StoreName): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readonly');
        const s = t.objectStore(store);
        const r = s.getAll();
        r.onsuccess = () => resolve((r.result as T[]) ?? []);
        r.onerror = () => reject(r.error);
    });
} 


export class KeyMutex {
    private locks = new Map<string, Promise<void>> ();
    async run<T> (key: string, fn: () => Promise<T>): Promise<T> {
        const prev = this.locks.get(key) ?? Promise.resolve();
        let release !: () => void;
        const p = new Promise<void> (res => (release = res));
        this.locks.set(key, prev.then(() => p));
        try {
            await prev;
            return await fn();
        } finally {
            release();
            if (this.locks.get(key) === p) this.locks.delete(key);
        }
    }
}

export class E2EEStore implements StorageType {
    private _dbp: Promise<IDBDatabase>;
    private _dbName: string;
    private cache: Record<string | number, StoreValue>;
    private mux: KeyMutex;

    constructor(dbName: string) {
        this._dbName = dbName;
        this._dbp = openDB(dbName, 1);
        this.cache = {};
        this.mux = new KeyMutex();
    }

    async close(): Promise<void> {
        const db = await this._dbp;
        db.close();
    }

    async get(store: StoreName, key: string | number): Promise<Row | undefined> {
        if (key === null || key === undefined)
            throw new Error('Tried to get value for undefined/null key');
        const db = await this._dbp;
        const value = await txGet<Row>(db, store, key);
        return value;
    }

    async put(store: StoreName, value: Row): Promise<void> {
        if (value === undefined || value === null) {
            throw new Error('Tried to store undefined/null.');
        }
        const db = await this._dbp;
        await txPut(db, store, value);
    }

    async getAll(store: StoreName): Promise<Row[]> {
        const db = await this._dbp;
        const res = await txGetAll<Row> (db, store);
        return res;
    }

    async remove(store: StoreName, key: string | number): Promise<void> {
        if (key === undefined || key === null) 
            throw new Error('Tried to delete undefined/null.');
        const db = await this._dbp;
        await txDelete(db, store, key);
    }

    async getDeviceId(): Promise<number | undefined> {
        const deviceId = this.cache['signal-device-id'];
        if (deviceId !== undefined) 
            return deviceId as number;

        const val = await this.get('signal-meta-store', 'signal-device-id');
        if (!val) 
            return undefined;
        if (typeof val.value === 'number' || typeof val.value === 'undefined') {
            this.cache['signal-device-id'] = val.value;
            return val.value;
        }
        throw new Error('Item stored as device id of unknown type.');
    }

    async saveDeviceId(deviceId: number): Promise<void> {
        if (deviceId === null || deviceId === undefined) 
            throw new Error('Tried to store invalid deviceId');
        await this.put('signal-meta-store', {key: 'signal-device-id', value: deviceId});
        this.cache['signal-device-id'] = deviceId;
    }

    async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
        const identityKeyPair = this.cache['signal-identity-key'];
        if (identityKeyPair !== undefined) 
            return identityKeyPair as KeyPairType;

        const val = await this.get('signal-meta-store', 'signal-identity-key');
        if (!val) 
            return undefined;
        if (isKeyPairType(val.keyPair) || typeof val.keyPair === 'undefined'){
            this.cache['signal-identity-key'] = val.keyPair;
            return val.keyPair;
        }
        throw new Error('Item stored as identity key of unknown type.');
    }

    async saveIdentityKeyPair(identityKeyPair: KeyPairType): Promise<void> {
        if (identityKeyPair === null || identityKeyPair === undefined) 
            throw new Error('Tried to store invalid identityKeyPair');
        await this.put('signal-meta-store', {key: 'signal-identity-key', keyPair: identityKeyPair});
        this.cache['signal-identity-key'] = identityKeyPair;
    }

    async saveRegistrationId(registrationId: number): Promise<void> {
        if (registrationId === null || registrationId === undefined)
            throw new Error('Tried to store invalid registrationId');
        await this.put('signal-meta-store', {key: 'signal-reg-id', value: registrationId} as Row);
        this.cache['signal-reg-id'] = registrationId;
    }

    async getLocalRegistrationId(): Promise<number | undefined> {
        const registrationId = this.cache['signal-reg-id'];
        if (registrationId !== undefined) 
            return registrationId as number;
        const val = await this.get('signal-meta-store', 'signal-reg-id');
        if (!val) return undefined;
        if (typeof val.value === 'number' || typeof val.value === 'undefined') {
            this.cache['signal-reg-id'] = val.value;
            return val.value;
        }
        throw new Error('Item stored as registration id of unknown type.');
    }

    async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer, direction: Direction): Promise<boolean> {
        if (identifier === null || identifier === undefined) {
            throw new Error('Tried to check identity key for undefined/null key');
        }
        let trusted = this.cache[`identity:${identifier}`];
        if (!trusted) {
            const val = await this.get('identity-store', identifier);
            if (!val) return true;
            trusted = val.identityKey;
            this.cache[`identity:${identifier}`] = trusted;
        }
        return (arrayBufferToString(trusted as ArrayBuffer) === arrayBufferToString(identityKey));
    }

    async loadPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
        const preKey = this.cache[`prekey:${keyId}`];
        if (preKey !== undefined) {
            return preKey as KeyPairType;
        }
        const val = await this.get('prekey-store', keyId);
        if (!val) return undefined
        if (isKeyPairType(val.keyPair)) {
            this.cache[`prekey:${keyId}`] = {pubKey: val.keyPair.pubKey, privKey: val.keyPair.privKey};
            return {pubKey: val.keyPair.pubKey, privKey: val.keyPair.privKey};
        }
        if (typeof val.keyPair === 'undefined') {
            return undefined;
        }
        throw new Error('stored key has wrong type');
    }

    async loadSession(address: string): Promise<SessionRecordType | undefined> {
        const session = this.cache[`session:${address}`];
        if (session !== undefined){
            return session as SessionRecordType;
        }
        const val = await this.get('session-store', address);
        if (!val) return undefined;
        if (typeof val.record === 'string' || isArrayBuffer(val.record) || typeof val.record === 'undefined') {
            this.cache[`session:${address}`] = val.record;
            return val.record as any;
        }
        throw new Error('stored session has wrong type');
    }

    async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
        const signedPreKey = this.cache[`signedPrekey:${keyId}`];
        if (signedPreKey !== undefined) {
            return signedPreKey as KeyPairType;
        }
        const val = await this.get('signed-prekey-store', keyId);
        if (!val) return undefined;
        if (isKeyPairType(val.keyPair)) {
            this.cache[`signedPrekey:${keyId}`] = {pubKey: val.keyPair.pubKey, privKey: val.keyPair.privKey};
            return {pubKey: val.keyPair.pubKey, privKey: val.keyPair.privKey};
        }
        if (typeof val.keyPair === 'undefined')
            return undefined;
        throw new Error('stored key has wrong type');
    }

    async removePreKey(keyId: number | string): Promise<void> {
        await this.remove('prekey-store', keyId);
        if (this.cache[`prekey:${keyId}`]) {
            delete this.cache[`prekey:${keyId}`];
        }
    }

    async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
        let existing = this.cache[`identity:${identifier}`];
        if (!existing) {
            const val = await this.get('identity-store', identifier);
            if (val) {
                existing = val.identityKey;
            }
        }
        this.cache[`identity:${identifier}`] = identityKey;
        await this.put('identity-store', {identifier, identityKey});
        if (existing && !isArrayBuffer(existing)) {
            throw new Error('Identity key is incorrect type');
        }
        if (existing && arrayBufferToString(identityKey) !== arrayBufferToString(existing as ArrayBuffer))
            return true;
        return false;
    }

    async storeSession(identifier: string, record: SessionRecordType): Promise<void> {
        await this.put('session-store', {address: identifier, record});
        this.cache[`session:${identifier}`] = record;
    }

    async storePreKey(keyId: number | string , keyPair: KeyPairType): Promise<void> {
        await this.put('prekey-store', {keyId, keyPair});
        this.cache[`prekey:${keyId}`] = keyPair;
    }

    async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
        await this.put('signed-prekey-store', {keyId, keyPair});
        this.cache[`signedPrekey:${keyId}`] = keyPair;
    }

    async removeSignedPreKey(keyId: number | string): Promise<void> {
        await this.remove('signed-prekey-store', keyId);
        if (this.cache[`signedPrekey:${keyId}`]) {
            delete this.cache[`signedPrekey:${keyId}`];
        }
    }

    async getCurSignedPreKeyId(): Promise<number | undefined> {
        const currentSPKId = this.cache['curSignedPrekeyId'];
        if (currentSPKId !== undefined) {
            return currentSPKId as number;
        }
        const val = await this.get('signal-meta-store', 'signal-cur-spkid');
        if (!val) {
            return undefined;
        }
        if (typeof val.value === 'number' || typeof val.value === 'undefined') {
            this.cache['curSignedPrekeyId'] = val.value;
            return val.value;
        }
        throw new Error('stored spkid has wrong type');
    }

    async saveCurSignedPreKeyId(spkId: number): Promise<void> {
        if (spkId === null || spkId === undefined) {
            throw new Error('Tried to store invalid spkId');
        }
        await this.put('signal-meta-store', {key: 'signal-cur-spkid', value: spkId});
        this.cache['curSignedPrekeyId'] = spkId;
    }

    async getCurOneTimePreKeyId(): Promise<number | undefined> {
        const currentOPKId = this.cache['curOPKId'];
        if (currentOPKId !== undefined) {
            return currentOPKId as number;
        }
        const val = await this.get('signal-meta-store', 'signal-cur-opkid');
        if (!val) {
            return undefined;
        }
        if (typeof val.value === 'number' || typeof val.value === 'undefined') {
            this.cache['curOPKId'] = val.value;
            return val.value;
        }
        throw new Error('stored opkid has wrong type');
    }

    async saveCurOneTimePreKeyId(opkId: number): Promise<void> {
        if (opkId === null || opkId === undefined) {
            throw new Error('Tried to store invalid opkId');
        }
        await this.put('signal-meta-store', {key: 'signal-cur-opkid', value: opkId});
        this.cache['curOPKId'] = opkId;
    }

    async getSenderState(channelId: string, userId: string, deviceId: number): Promise<SenderKey[] | undefined> {
        const val = await this.get('senderkey-store', `${channelId}::${userId}.${deviceId}`);
        return val?.senderKey as SenderKey[] | undefined;
    }

    async saveSenderState(channelId: string, userId: string, deviceId: number, senderState: SenderKey[]): Promise<void> {
        await this.put('senderkey-store', {senderKeyName: `${channelId}::${userId}.${deviceId}`, senderKey: senderState});
    }

    async getChannelState(channelId: string): Promise<ChannelState> {
        const state = this.cache[`channel:${channelId}`] as ChannelState | undefined;
        if (state !== undefined) {
            return state;
        }
        const val = await this.get('channel-store', channelId);
        if (!val) {
            return {
                users: [],
                newMembers: [],
                outMember: false
            };
        }
        this.cache[`channel:${channelId}`] = val.state;
        return val.state as ChannelState;
    }

    async getChannelMembers(channelId: string): Promise<UserMetadata[] | undefined> {
        const state = await this.getChannelState(channelId);
        return state.users;
    }

    async addChannelMember(channelId: string, userId: string, devicesCount: number, deviceListHash?: string): Promise<void> {
        const lockKey = channelId;
        return this.mux.run(lockKey, async() => {
            let state = await this.getChannelState(channelId);
            state.users.push({userId, devicesCount, deviceListHash});
            await this.put('channel-store', {channelId, state});
            this.cache[`channel:${channelId}`] = state;
        });
    }

    async newChannelMember(channelId: string, userId: string): Promise<void> {
        const lockKey = channelId;
        return this.mux.run(lockKey, async() => {
            let state = await this.getChannelState(channelId);
            state.newMembers.push(userId);
            await this.put('channel-store', {channelId, state});
            this.cache[`channel:${channelId}`] = state;
        })
    }

    async removeChannelMember(channelId: string, userId: string): Promise<void> {
        const lockKey = channelId;
        return this.mux.run(lockKey, async() => {
            let state = await this.getChannelState(channelId);
            state.users = state.users.filter(u => u.userId !== userId);
            state.newMembers = state.newMembers.filter(u => u !== userId);
            state.outMember = true;
            await this.put('channel-store', {channelId, state});
            this.cache[`channel:${channelId}`] = state;
        });
    }

    async updateChannelState(channelId: string, newMembers?: string[], outMember?: boolean): Promise<void> {
        const lockKey = channelId;
        return this.mux.run(lockKey, async() => {
            let state = await this.getChannelState(channelId);
            if (newMembers !== undefined)
                state.newMembers = newMembers;
            if (outMember !== undefined)
                state.outMember = outMember;
            await this.put('channel-store', {channelId, state});
            this.cache[`channel:${channelId}`] = state;
        });
    }
}
