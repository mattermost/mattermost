// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

// Ensure KV store wrapper implements `product.KVStoreService`
var _ product.KVStoreService = (*kvStoreWrapper)(nil)

// kvStoreWrapper provides an implementation of `product.KVStoreService` for use by products.
type kvStoreWrapper struct {
	srv *Server
}

func (k *kvStoreWrapper) SetPluginKeyWithOptions(c request.CTX, pluginID string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError) {
	return k.srv.setPluginKeyWithOptions(c, pluginID, key, value, options)
}

func getKeyHash(key string) string {
	hash := sha256.New()
	hash.Write([]byte(key))
	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

func (a *App) SetPluginKey(c request.CTX, pluginID string, key string, value []byte) *model.AppError {
	return a.SetPluginKeyWithExpiry(c, pluginID, key, value, 0)
}

func (a *App) SetPluginKeyWithExpiry(c request.CTX, pluginID string, key string, value []byte, expireInSeconds int64) *model.AppError {
	options := model.PluginKVSetOptions{
		ExpireInSeconds: expireInSeconds,
	}
	_, err := a.SetPluginKeyWithOptions(c, pluginID, key, value, options)
	return err
}

func (a *App) CompareAndSetPluginKey(c request.CTX, pluginID string, key string, oldValue, newValue []byte) (bool, *model.AppError) {
	options := model.PluginKVSetOptions{
		Atomic:   true,
		OldValue: oldValue,
	}
	return a.SetPluginKeyWithOptions(c, pluginID, key, newValue, options)
}

func (s *Server) setPluginKeyWithOptions(c request.CTX, pluginID string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError) {
	if err := options.IsValid(); err != nil {
		c.Logger().Debug("Failed to set plugin key value with options", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		return false, err
	}

	updated, err := s.Store.Plugin().SetWithOptions(pluginID, key, value, options)
	if err != nil {
		c.Logger().Error("Failed to set plugin key value with options", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return false, appErr
		default:
			return false, model.NewAppError("SetPluginKeyWithOptions", "app.plugin_store.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Clean up a previous entry using the hashed key, if it exists.
	if err := s.Store.Plugin().Delete(pluginID, getKeyHash(key)); err != nil {
		c.Logger().Warn("Failed to clean up previously hashed plugin key value", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
	}

	return updated, nil
}

func (a *App) SetPluginKeyWithOptions(c request.CTX, pluginID string, key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError) {
	return a.Srv().setPluginKeyWithOptions(c, pluginID, key, value, options)
}

func (a *App) CompareAndDeletePluginKey(c request.CTX, pluginID string, key string, oldValue []byte) (bool, *model.AppError) {
	kv := &model.PluginKeyValue{
		PluginId: pluginID,
		Key:      key,
	}

	deleted, err := a.Srv().Store.Plugin().CompareAndDelete(kv, oldValue)
	if err != nil {
		c.Logger().Error("Failed to compare and delete plugin key value", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return deleted, appErr
		default:
			return false, model.NewAppError("CompareAndDeletePluginKey", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Clean up a previous entry using the hashed key, if it exists.
	if err := a.Srv().Store.Plugin().Delete(pluginID, getKeyHash(key)); err != nil {
		c.Logger().Warn("Failed to clean up previously hashed plugin key value", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
	}

	return deleted, nil
}

func (s *Server) getPluginKey(c request.CTX, pluginID string, key string) ([]byte, *model.AppError) {
	if kv, err := s.Store.Plugin().Get(pluginID, key); err == nil {
		return kv.Value, nil
	} else if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
		c.Logger().Error("Failed to query plugin key value", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		return nil, model.NewAppError("GetPluginKey", "app.plugin_store.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Lookup using the hashed version of the key for keys written prior to v5.6.
	if kv, err := s.Store.Plugin().Get(pluginID, getKeyHash(key)); err == nil {
		return kv.Value, nil
	} else if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
		c.Logger().Error("Failed to query plugin key value using hashed key", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		return nil, model.NewAppError("GetPluginKey", "app.plugin_store.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil, nil
}

func (a *App) GetPluginKey(c request.CTX, pluginID string, key string) ([]byte, *model.AppError) {
	return a.Srv().getPluginKey(c, pluginID, key)
}

func (s *Server) deletePluginKey(c request.CTX, pluginID string, key string) *model.AppError {
	if err := s.Store.Plugin().Delete(pluginID, getKeyHash(key)); err != nil {
		c.Logger().Error("Failed to delete plugin key value", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		return model.NewAppError("DeletePluginKey", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Also delete the key without hashing
	if err := s.Store.Plugin().Delete(pluginID, key); err != nil {
		c.Logger().Error("Failed to delete plugin key value using hashed key", mlog.String("plugin_id", pluginID), mlog.String("key", key), mlog.Err(err))
		return model.NewAppError("DeletePluginKey", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) DeletePluginKey(c request.CTX, pluginID string, key string) *model.AppError {
	return a.Srv().deletePluginKey(c, pluginID, key)
}

func (a *App) DeleteAllKeysForPlugin(c request.CTX, pluginID string) *model.AppError {
	if err := a.Srv().Store.Plugin().DeleteAllForPlugin(pluginID); err != nil {
		c.Logger().Error("Failed to delete all plugin key values", mlog.String("plugin_id", pluginID), mlog.Err(err))
		return model.NewAppError("DeleteAllKeysForPlugin", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) DeleteAllExpiredPluginKeys(c request.CTX) *model.AppError {
	if a.Srv() == nil {
		return nil
	}

	if err := a.Srv().Store.Plugin().DeleteAllExpired(); err != nil {
		c.Logger().Error("Failed to delete all expired plugin key values", mlog.Err(err))
		return model.NewAppError("DeleteAllExpiredPluginKeys", "app.plugin_store.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (s *Server) listPluginKeys(c request.CTX, pluginID string, page, perPage int) ([]string, *model.AppError) {
	data, err := s.Store.Plugin().List(pluginID, page*perPage, perPage)

	if err != nil {
		c.Logger().Error("Failed to list plugin key values", mlog.Int("page", page), mlog.Int("perPage", perPage), mlog.Err(err))
		return nil, model.NewAppError("ListPluginKeys", "app.plugin_store.list.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return data, nil
}

func (a *App) ListPluginKeys(c request.CTX, pluginID string, page, perPage int) ([]string, *model.AppError) {
	return a.Srv().listPluginKeys(c, pluginID, page, perPage)
}
