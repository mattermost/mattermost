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
		Key:      getKeyHash(key),
		Value:    value,
		ExpireAt: expireInSeconds,
	}

	result := <-a.Srv.Store.Plugin().SaveOrUpdate(kv)

	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	return result.Err
}

func (a *App) GetPluginKey(pluginId string, key string) ([]byte, *model.AppError) {
	result := <-a.Srv.Store.Plugin().Get(pluginId, getKeyHash(key))

	if result.Err != nil {
		if result.Err.StatusCode == http.StatusNotFound {
			return nil, nil
		}
		mlog.Error(result.Err.Error())
		return nil, result.Err
	}

	kv := result.Data.(*model.PluginKeyValue)

	return kv.Value, nil
}

func (a *App) DeletePluginKey(pluginId string, key string) *model.AppError {
	result := <-a.Srv.Store.Plugin().Delete(pluginId, getKeyHash(key))

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
