package model

type E2EEDevice struct {
	UserId                 string `json:"user_id"`
	DeviceId               int64  `json:"device_id"`
	DeviceLabel            string `json:"device_label"`
	RegistrationId         int32  `json:"registration_id"`
	IdentityKeyPublic      string `json:"identity-key-public"`
	IdentityKeyFingerprint string `json:"identity_key_fingerprint"`

	CreateAt int64 `json:"create_at"`
	UpdateAt int64 `json:"update_at"`
	DeleteAt int64 `json:"delete_at"`
}

type E2EESignedPreKey struct {
	UserId    string `json:"user_id"`
	DeviceId  int64  `json:"device_id"`
	KeyId     int32  `json:"key_id"`
	PublicKey string `json:"public_key"`
	Signature string `json:"signature"`

	CreateAt int64 `json:"create_at"`
	RotateAt int64 `json:"rotate_at"`
	DeleteAt int64 `json:"delete_at"`
}

type E2EEOneTimePreKey struct {
	UserId    string `json:"user_id"`
	DeviceId  int64  `json:"device_id"`
	KeyId     int32  `json:"key_id"`
	PublicKey string `json:"public_key"`

	CreateAt   int64 `json:"create_at"`
	ConsumedAt int64 `json:"consumed_at"`
	DeleteAt   int64 `json:"delete_at"`
}

type E2EEDeviceListSnapshot struct {
	UserId         string `json:"user_id"`
	DeviceListHash string `json:"device_list_hash"`
	DevicesCount   int32  `json:"devices_count"`
	Version        int64  `json:"version"`
	UpdateAt       int64  `json:"update_at"`
}

// ==== RequestPayload (API -> App) ===

type E2EEUpsertDeviceRequest struct {
	DeviceId               int64  `json:"device_id"`
	DeviceLabel            string `json:"device_label,omitempty"`
	RegistrationId         int32  `json:"registration_id"`
	IdentityKeyPublic      string `json:"identity_key_public,omitempty"`
	IdentityKeyFingerprint string `json:"identity_key_fingerprint,omitempty"`
}

type E2EERegisterDeviceRequest struct {
	Device         E2EEUpsertDeviceRequest `json:"device"`
	SignedPreKey   E2EESignedPreKeyPayload `json:"signed_prekey,omitempty"`
	OneTimePreKeys []E2EEOneTimePreKey     `json:"one_time_prekeys,omitempty"`
}

type E2EESignedPreKeyPayload struct {
	KeyId     int32  `json:"key_id"`
	PublicKey string `json:"public_key"`
	Signature string `json:"signature"`
}

type E2EEOneTimePreKeyPayload struct {
	KeyId     int32  `json:"key_id"`
	PublicKey string `json:"public_key"`
}

type E2EERotateSPKRequest struct {
	DeviceId     int64                   `json:"device_id"`
	SignedPreKey E2EESignedPreKeyPayload `json:"signed_prekey"`
}

type E2EEReplenishOPKsRequest struct {
	DeviceId       int64                      `json:"device_id"`
	OneTimePreKeys []E2EEOneTimePreKeyPayload `json:"one_time_prekeys"`
}

// ==== Response DTOs (App -> API -> Client) ====

type E2EERegisterDeviceResponse struct {
	UserId              string `json:"user_id"`
	DeviceId            int64  `json:"device_id"`
	SavedOneTimePreKeys int    `json:"saved_one_time_prekeys"`
}

type PreKeyBundle struct {
	DeviceId          int64                    `json:"device_id"`
	RegistrationId    int32                    `json:"registration_id"`
	IdentityKeyPublic string                   `json:"identity_key_public"`
	SignedPreKey      E2EESignedPreKeyPayload  `json:"signed_prekey"`
	OneTimePreKey     E2EEOneTimePreKeyPayload `json:"one_time_prekeys,omitempty"`
}

type PreKeyBundleResponse struct {
	UserId         string         `json:"user_id"`
	Bundles        []PreKeyBundle `json:"bundles"`
	DeviceListHash string         `json:"device_list_hash"`
	DevicesCount   int32          `json:"devices_count"`
	Version        int64          `json:"version"`
}
