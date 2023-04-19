// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

func getKeyHash(key string) string {
	hash := sha256.New()
	hash.Write([]byte(key))
	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

func (a *App) SetPluginKey(pluginID string, key string, value []byte) *model.AppError {
	return a.SetPluginKeyWithExpiry(pluginID, key, value, 0)
}

func (a *App) SetPluginKeyWithExpiry(pluginID string, key string, value []byte, expireInSeconds int64) *model.AppError {
	options := model.PluginKVSetOptions{
		ExpireInSeconds: expireInSeconds,
	}
	_, err := a.SetPluginKeyWithOptions(pluginID, key, value, options)
	return err
}

func (a *App) CompareAndSetPluginKey(pluginID string, key string, oldValue, newValue []byte) (bool, *model.AppError) {
	options := model.PluginKVSetOptions{
		Atomic:   true,
		OldValue: oldValue,
	}
	return a.SetPluginKeyWithOptions(pluginID, key, newValue, options)
}

func (a *App) SetPluginKeyWithOptions(pluginID string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError) {
	return a.Srv().Platform().SetPluginKeyWithOptions(pluginID, key, value, options)
}

func (a *App) CompareAndDeletePluginKey(pluginID string, key string, oldValue []byte) (bool, *model.AppError) {
	kv := &model.PluginKeyValue{
		PluginId: pluginID,
		Key:      key,
	}

	deleted, err := a.Srv().Store().Plugin().CompareAndDelete(kv, oldValue)
	if err != nil {
		mlog.Error("Failed to compare and delete plugin key value", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return deleted, appErr
		default:
			return false, model.NewAppError("CompareAndDeletePluginKey", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Clean up a previous entry using the hashed key, if it exists.
	if err := a.Srv().Store().Plugin().Delete(pluginID, getKeyHash(key)); err != nil {
		mlog.Warn("Failed to clean up previously hashed plugin key value", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
	}

	return deleted, nil
}

// TODO: platform: remove
func (s *Server) getPluginKey(pluginID string, key string) ([]byte, *model.AppError) {
	if kv, err := s.Store().Plugin().Get(pluginID, key); err == nil {
		return kv.Value, nil
	} else if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
		mlog.Error("Failed to query plugin key value", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		return nil, model.NewAppError("GetPluginKey", "app.plugin_store.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Lookup using the hashed version of the key for keys written prior to v5.6.
	if kv, err := s.Store().Plugin().Get(pluginID, getKeyHash(key)); err == nil {
		return kv.Value, nil
	} else if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
		mlog.Error("Failed to query plugin key value using hashed key", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		return nil, model.NewAppError("GetPluginKey", "app.plugin_store.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil, nil
}

func (a *App) GetPluginKey(pluginID string, key string) ([]byte, *model.AppError) {
	return a.Srv().getPluginKey(pluginID, key)
}

func (a *App) DeletePluginKey(pluginID string, key string) *model.AppError {
	return a.Srv().Platform().DeletePluginKey(pluginID, key)
}

func (a *App) DeleteAllKeysForPlugin(pluginID string) *model.AppError {
	if err := a.Srv().Store().Plugin().DeleteAllForPlugin(pluginID); err != nil {
		mlog.Error("Failed to delete all plugin key values", mlog.String("plugin_id", pluginID), mlog.Err(err))
		return model.NewAppError("DeleteAllKeysForPlugin", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) DeleteAllExpiredPluginKeys() *model.AppError {
	if a.Srv() == nil {
		return nil
	}

	if err := a.Srv().Store().Plugin().DeleteAllExpired(); err != nil {
		mlog.Error("Failed to delete all expired plugin key values", mlog.Err(err))
		return model.NewAppError("DeleteAllExpiredPluginKeys", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) ListPluginKeys(pluginID string, page, perPage int) ([]string, *model.AppError) {
	return a.Srv().Platform().ListPluginKeys(pluginID, page, perPage)
}
