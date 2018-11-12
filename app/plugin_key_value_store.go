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

	// First try deleting hashed key, then set using unhashed key
	_ = <-a.Srv.Store.Plugin().Delete(pluginId, getKeyHash(key))

	result := <-a.Srv.Store.Plugin().SaveOrUpdate(kv)

	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	return result.Err
}

func (a *App) GetPluginKey(pluginId string, key string) ([]byte, *model.AppError) {
	result := <-a.Srv.Store.Plugin().Get(pluginId, key)

	if result.Err == nil {
		kv := result.Data.(*model.PluginKeyValue)
		return kv.Value, nil
	}

	result = <-a.Srv.Store.Plugin().Get(pluginId, getKeyHash(key))
	if result.Err != nil {
		if result.Err.StatusCode == http.StatusNotFound {
			return nil, nil
		}
		mlog.Error(result.Err.Error())
		return nil, result.Err
	}

	kv := result.Data.(*model.PluginKeyValue)

	// If we are here that means we are using old hashed key. Remove it and insert the new key without hashing it
	_ = <-a.Srv.Store.Plugin().Delete(pluginId, getKeyHash(key))

	// Insert the key without hashing
	err := a.SetPluginKeyWithExpiry(pluginId, key, kv.Value, kv.ExpireAt)
	if err != nil {
		// Setting the key failed at this point and we will not be able to fetch the key again so return error
		mlog.Error(err.Error())
		return nil, err
	}
	// return the fetched value
	return kv.Value, nil
}

func (a *App) DeletePluginKey(pluginId string, key string) *model.AppError {
	result := <-a.Srv.Store.Plugin().Delete(pluginId, getKeyHash(key))

	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	// Also delete the key without hashing
	result = <-a.Srv.Store.Plugin().Delete(pluginId, key)
	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	return result.Err
}

func (a *App) DeleteAllKeysForPlugin(pluginId string) *model.AppError {
	result := <-a.Srv.Store.Plugin().DeleteAllForPlugin(pluginId)

	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	return result.Err
}

func (a *App) DeleteAllExpiredPluginKeys() *model.AppError {

	if a.Srv == nil {
		return nil
	}

	result := <-a.Srv.Store.Plugin().DeleteAllExpired()

	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	return result.Err
}

func (a *App) ListPluginKeys(pluginId string, page, perPage int) ([]string, *model.AppError) {
	result := <-a.Srv.Store.Plugin().List(pluginId, page, perPage)

	if result.Err != nil {
		mlog.Error(result.Err.Error())
		return nil, result.Err
	}

	return result.Data.([]string), nil
}
