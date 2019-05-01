// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func getKeyHash(key string) string {
	hash := sha256.New()
	hash.Write([]byte(key))
	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

func (a *App) SetPluginKey(pluginId string, key string, value []byte) *model.AppError {
	return a.SetPluginKeyWithExpiry(pluginId, key, value, 0)
}

func (a *App) SetPluginKeyWithExpiry(pluginId string, key string, value []byte, expireInSeconds int64) *model.AppError {
	if expireInSeconds > 0 {
		expireInSeconds = model.GetMillis() + (expireInSeconds * 1000)
	}

	kv := &model.PluginKeyValue{
		PluginId: pluginId,
		Key:      key,
		Value:    value,
		ExpireAt: expireInSeconds,
	}

	if result := <-a.Srv.Store.Plugin().SaveOrUpdate(kv); result.Err != nil {
		mlog.Error("Failed to set plugin key value", mlog.String("plugin_id", pluginId), mlog.String("key", key), mlog.Err(result.Err))
		return result.Err
	}

	// Clean up a previous entry using the hashed key, if it exists.
	if result := <-a.Srv.Store.Plugin().Delete(pluginId, getKeyHash(key)); result.Err != nil {
		mlog.Error("Failed to clean up previously hashed plugin key value", mlog.String("plugin_id", pluginId), mlog.String("key", key), mlog.Err(result.Err))
	}

	return nil
}

func (a *App) CompareAndSetPluginKey(pluginId string, key string, oldValue, newValue []byte) (bool, *model.AppError) {
	kv := &model.PluginKeyValue{
		PluginId: pluginId,
		Key:      key,
		Value:    newValue,
	}

	updated, err := a.Srv.Store.Plugin().CompareAndSet(kv, oldValue)
	if err != nil {
		mlog.Error("Failed to compare and set plugin key value", mlog.String("plugin_id", pluginId), mlog.String("key", key), mlog.Err(err))
		return updated, err
	}

	// Clean up a previous entry using the hashed key, if it exists.
	if result := <-a.Srv.Store.Plugin().Delete(pluginId, getKeyHash(key)); result.Err != nil {
		mlog.Error("Failed to clean up previously hashed plugin key value", mlog.String("plugin_id", pluginId), mlog.String("key", key), mlog.Err(result.Err))
	}

	return updated, nil
}

func (a *App) GetPluginKey(pluginId string, key string) ([]byte, *model.AppError) {
	if result := <-a.Srv.Store.Plugin().Get(pluginId, key); result.Err == nil {
		return result.Data.(*model.PluginKeyValue).Value, nil
	} else if result.Err.StatusCode != http.StatusNotFound {
		mlog.Error("Failed to query plugin key value", mlog.String("plugin_id", pluginId), mlog.String("key", key), mlog.Err(result.Err))
		return nil, result.Err
	}

	// Lookup using the hashed version of the key for keys written prior to v5.6.
	if result := <-a.Srv.Store.Plugin().Get(pluginId, getKeyHash(key)); result.Err == nil {
		return result.Data.(*model.PluginKeyValue).Value, nil
	} else if result.Err.StatusCode != http.StatusNotFound {
		mlog.Error("Failed to query plugin key value using hashed key", mlog.String("plugin_id", pluginId), mlog.String("key", key), mlog.Err(result.Err))
		return nil, result.Err
	}

	return nil, nil
}

func (a *App) DeletePluginKey(pluginId string, key string) *model.AppError {
	if result := <-a.Srv.Store.Plugin().Delete(pluginId, getKeyHash(key)); result.Err != nil {
		mlog.Error("Failed to delete plugin key value", mlog.String("plugin_id", pluginId), mlog.String("key", key), mlog.Err(result.Err))
		return result.Err
	}

	// Also delete the key without hashing
	if result := <-a.Srv.Store.Plugin().Delete(pluginId, key); result.Err != nil {
		mlog.Error("Failed to delete plugin key value using hashed key", mlog.String("plugin_id", pluginId), mlog.String("key", key), mlog.Err(result.Err))
		return result.Err
	}

	return nil
}

func (a *App) DeleteAllKeysForPlugin(pluginId string) *model.AppError {
	if result := <-a.Srv.Store.Plugin().DeleteAllForPlugin(pluginId); result.Err != nil {
		mlog.Error("Failed to delete all plugin key values", mlog.String("plugin_id", pluginId), mlog.Err(result.Err))
		return result.Err
	}

	return nil
}

func (a *App) DeleteAllExpiredPluginKeys() *model.AppError {
	if a.Srv == nil {
		return nil
	}

	if result := <-a.Srv.Store.Plugin().DeleteAllExpired(); result.Err != nil {
		mlog.Error("Failed to delete all expired plugin key values", mlog.Err(result.Err))
		return result.Err
	}

	return nil
}

func (a *App) ListPluginKeys(pluginId string, page, perPage int) ([]string, *model.AppError) {
	result := <-a.Srv.Store.Plugin().List(pluginId, page*perPage, perPage)

	if result.Err != nil {
		mlog.Error("Failed to list plugin key values", mlog.Int("page", page), mlog.Int("perPage", perPage), mlog.Err(result.Err))
		return nil, result.Err
	}

	return result.Data.([]string), nil
}
