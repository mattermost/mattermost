package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) RegisterDeviceWithKeys(c request.CTX, userId string, req *model.E2EERegisterDeviceRequest) (*model.E2EERegisterDeviceResponse, *model.AppError) {
	if req == nil {
		return nil, model.NewAppError("RegisterDeviceWithKeys", "app.e2ee.register.nill", nil, "", http.StatusBadRequest)
	}

	de := &model.E2EEDevice{
		UserId:                 userId,
		DeviceId:               req.Device.DeviceId,
		DeviceLabel:            req.Device.DeviceLabel,
		RegistrationId:         req.Device.RegistrationId,
		IdentityKeyPublic:      req.Device.IdentityKeyPublic,
		IdentityKeyFingerprint: req.Device.IdentityKeyFingerprint,
	}

	var err error
	de, err = a.Srv().Store().E2EE().UpsertDevice(c, de)
	if err != nil {
		return nil, model.NewAppError("RegisterDeviceWithKeys", "app.e2ee.register.upsert_device", nil, err.Error(), http.StatusInternalServerError)
	}
	if req.SignedPreKey.KeyId != 0 {
		spk := &model.E2EESignedPreKey{
			UserId:    userId,
			DeviceId:  de.DeviceId,
			KeyId:     req.SignedPreKey.KeyId,
			PublicKey: req.SignedPreKey.PublicKey,
			Signature: req.SignedPreKey.Signature,
		}
		if err = a.Srv().Store().E2EE().UpsertSignedPreKey(c, spk); err != nil {
			return nil, model.NewAppError("RegisterDeviceWithKeys", "app.e2ee.register.upsert_signed_prekey", nil, err.Error(), http.StatusInternalServerError)
		}
	}
	saved := 0
	if len(req.OneTimePreKeys) > 0 {
		batch := make([]model.E2EEOneTimePreKey, 0, len(req.OneTimePreKeys))
		for _, k := range req.OneTimePreKeys {
			batch = append(batch, model.E2EEOneTimePreKey{
				UserId:    userId,
				DeviceId:  de.DeviceId,
				KeyId:     k.KeyId,
				PublicKey: k.PublicKey,
				DeleteAt:  0,
			})
		}
		if err = a.Srv().Store().E2EE().InsertOneTimePreKeys(c, batch); err != nil {
			return nil, model.NewAppError("RegisterDeviceWithKeys", "app.e2ee.register.insert_opk", nil, err.Error(), http.StatusInternalServerError)
		}
		saved = len(batch)
	}
	if err = a.Srv().Store().E2EE().RecomputeDeviceListSnapshot(c, userId); err != nil {
		return nil, model.NewAppError("RegisterDeviceWithKeys", "app.e2ee.register.recompute_device_list_snapshot", nil, err.Error(), http.StatusInternalServerError)
	}

	resp := &model.E2EERegisterDeviceResponse{
		UserId:              userId,
		DeviceId:            de.DeviceId,
		SavedOneTimePreKeys: saved,
	}
	return resp, nil
}

func (a *App) RotateSignedPreKey(c request.CTX, userId string, deviceId int64, payload model.E2EESignedPreKeyPayload) *model.AppError {
	if payload.KeyId == 0 || payload.PublicKey == "" || payload.Signature == "" {
		return model.NewAppError("RotateSignedPreKey", "app.e2ee.rotate_spk.invalid", nil, "", http.StatusBadRequest)
	}
	spk := &model.E2EESignedPreKey{
		UserId:    userId,
		DeviceId:  deviceId,
		KeyId:     payload.KeyId,
		PublicKey: payload.PublicKey,
		Signature: payload.Signature,
	}
	if err := a.Srv().Store().E2EE().UpsertSignedPreKey(c, spk); err != nil {
		return model.NewAppError("RotateSignedPreKey", "app.e2ee.rotate_spk.store_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (a *App) ReplenishOneTimePreKeys(c request.CTX, userId string, deviceId int64, payload []model.E2EEOneTimePreKeyPayload) (int, *model.AppError) {
	if len(payload) == 0 {
		return 0, nil
	}
	batch := make([]model.E2EEOneTimePreKey, 0, len(payload))
	for _, k := range payload {
		if k.KeyId == 0 || k.PublicKey == "" {
			return 0, model.NewAppError("ReplenishOneTimePreKeys", "app.e2ee.replenish_opk.invalid_key", nil, "", http.StatusBadRequest)
		}
		batch = append(batch, model.E2EEOneTimePreKey{
			UserId:    userId,
			DeviceId:  deviceId,
			KeyId:     k.KeyId,
			PublicKey: k.PublicKey,
		})
	}

	if err := a.Srv().Store().E2EE().InsertOneTimePreKeys(c, batch); err != nil {
		return 0, model.NewAppError("ReplenishOneTimePreKeys", "app.e2ee.replenish_opk.store_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return len(batch), nil
}

func (a *App) GetPreKeyBundle(c request.CTX, recipientUserId string) (*model.PreKeyBundleResponse, *model.AppError) {
	devs, err := a.Srv().Store().E2EE().GetDevicesByUser(c, recipientUserId, false)
	if err != nil {
		return nil, model.NewAppError("GetPreKeyBundle", "app.e2ee.get_devices_by_user.app_ERROR", nil, err.Error(), http.StatusInternalServerError)
	}
	if len(devs) == 0 {
		return &model.PreKeyBundleResponse{UserId: recipientUserId, Bundles: []model.PreKeyBundle{}}, nil
	}
	bundles := make([]model.PreKeyBundle, 0, len(devs))

	for _, d := range devs {
		spk, spkErr := a.Srv().Store().E2EE().GetLatestSignedPreKey(c, d.UserId, d.DeviceId)
		if spkErr != nil {
			return nil, model.NewAppError("GetPreKeyBundle", "app.e2ee.get_latest_signed_prekey.app_error", nil, spkErr.Error(), http.StatusInternalServerError)
		}
		if spk == nil {
			continue
		}

		opk, _ := a.Srv().Store().E2EE().ConsumeOneTimePreKey(c, d.UserId, d.DeviceId)
		b := model.PreKeyBundle{
			DeviceId:          d.DeviceId,
			RegistrationId:    d.RegistrationId,
			IdentityKeyPublic: d.IdentityKeyPublic,
			SignedPreKey: model.E2EESignedPreKeyPayload{
				KeyId:     spk.KeyId,
				PublicKey: spk.PublicKey,
				Signature: spk.Signature,
			},
		}
		if opk != nil {
			b.OneTimePreKey = model.E2EEOneTimePreKeyPayload{
				KeyId:     opk.KeyId,
				PublicKey: opk.PublicKey,
			}
		}
		bundles = append(bundles, b)
	}
	resp := &model.PreKeyBundleResponse{
		UserId:  recipientUserId,
		Bundles: bundles,
	}
	snap, _ := a.Srv().Store().E2EE().GetDeviceListSnapshot(c, recipientUserId)
	if snap != nil {
		resp.DeviceListHash = snap.DeviceListHash
		resp.DevicesCount = snap.DevicesCount
		resp.Version = snap.Version
	}
	return resp, nil
}

func (a *App) CompareDeviceListHashes(c request.CTX, expectedHashes map[string]string) ([]string, *model.AppError) {
	userIds := make([]string, 0, len(expectedHashes))
	for uid := range expectedHashes {
		userIds = append(userIds, uid)
	}

	hashes, err := a.Srv().Store().E2EE().GetDeviceListHashes(c, userIds)

	if err != nil {
		return nil, model.NewAppError("CompareDeviceListHashes", "app.e2ee.get_device_list_hashes.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result := make([]string, 0, len(hashes))
	for _, uid := range userIds {
		expected := expectedHashes[uid]
		if hash, ok := hashes[uid]; !ok {
			result = append(result, uid)
		} else if hash != expected {
			result = append(result, uid)
		}
	}

	return result, nil
}
