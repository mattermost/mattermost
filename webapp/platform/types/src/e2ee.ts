export type E2EEDevice = {
    user_id: string;
    device_id: number;
    device_label?: string;
    registration_id: number;
    identity_key_public: string;
    identity_key_fingerprint: string;
    create_at: number;
    update_at: number;
    delete_at: number;
}

export type E2EESignedPreKey = {
    user_id: string;
    device_id: number;
    key_id: number;
    public_key: string;
    signature: string;
    create_at: number;
    rotate_at: number;
    delete_at: number;
}

export type E2EEOneTimePreKey = {
    user_id: string;
    device_id: number;
    key_id: number;
    public_key: string;
    create_at: number;
    consumed_at?: number | null;
    delete_at: number;
}

export type E2EEDeviceListSnapshot = {
    user_id: string;
    device_list_hash: string;
    devices_count: number;
    version: number;
    update_at: number;
}

export type E2EEUpsertDeviceRequest = {
    device_id: number;
    device_label?: string;
    registration_id: number;
    identity_key_public: string;
    identity_key_fingerprint: string;
}

export type E2EESignedPreKeyPayload = {
    key_id: number;
    public_key: string;
    signature: string;
}

export type E2EEOneTimePreKeyPayload = {
    key_id: number;
    public_key: string;
}

export type E2EERegisterDeviceRequest = {
    device: E2EEUpsertDeviceRequest;
    signed_prekey: E2EESignedPreKeyPayload;
    one_time_prekeys: E2EEOneTimePreKeyPayload[];
}

export type E2EERotateSPKRequest = {
    device_id: number;
    signed_prekey: E2EESignedPreKeyPayload;
}

export type E2EEReplenishOPKsRequest = {
    device_id: number;
    one_time_prekeys: E2EEOneTimePreKeyPayload[];
}

export type E2EERegisterDeviceResponse = {
    user_id: string;
    device_id: number;
    saved_one_time_prekeys: number;
}

export type PreKeyBundle = {
    device_id: number;
    registration_id: number;
    identity_key_public: string;
    signed_prekey: E2EESignedPreKeyPayload;
    one_time_prekey?: E2EEOneTimePreKeyPayload | null;
}

export type E2EEPreKeyBundleResponse = {
    user_id: string;
    bundles: PreKeyBundle[];
    device_list_hash?: string;
    devices_count: number;
    version: number;
}