// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pglayer

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgPluginStore struct {
	sqlstore.SqlPluginStore
}

func (ps PgPluginStore) SaveOrUpdate(kv *model.PluginKeyValue) (*model.PluginKeyValue, *model.AppError) {
	if err := kv.IsValid(); err != nil {
		return nil, err
	}

	// Unfortunately PostgreSQL pre-9.5 does not have an atomic upsert, so we use
	// separate update and insert queries to accomplish our upsert
	if rowsAffected, err := ps.GetMaster().Update(kv); err != nil {
		return nil, model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else if rowsAffected == 0 {
		// No rows were affected by the update, so let's try an insert
		if err := ps.GetMaster().Insert(kv); err != nil {
			// If the error is from unique constraints violation, it's the result of a
			// valid race and we can report success. Otherwise we have a real error and
			// need to return it
			if !IsUniqueConstraintError(err, []string{"PRIMARY", "PluginId", "Key", "PKey"}) {
				return nil, model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	return kv, nil
}

func (ps PgPluginStore) CompareAndSet(kv *model.PluginKeyValue, oldValue []byte) (bool, *model.AppError) {
	if err := kv.IsValid(); err != nil {
		return false, err
	}

	if kv.Value == nil {
		// Setting a key to nil is the same as removing it
		return ps.CompareAndDelete(kv, oldValue)
	}

	if oldValue == nil {
		// Insert if oldValue is nil
		if err := ps.GetMaster().Insert(kv); err != nil {
			// If the error is from unique constraints violation, it's the result of a
			// race condition, return false and no error. Otherwise we have a real error and
			// need to return it.
			if IsUniqueConstraintError(err, []string{"PRIMARY", "PluginId", "Key", "PKey"}) {
				return false, nil
			} else {
				return false, model.NewAppError("SqlPluginStore.CompareAndSet", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	} else {
		// Update if oldValue is not nil
		updateResult, err := ps.GetMaster().Exec(
			`UPDATE PluginKeyValueStore SET PValue = :New, ExpireAt = :ExpireAt WHERE PluginId = :PluginId AND PKey = :Key AND PValue = :Old`,
			map[string]interface{}{
				"PluginId": kv.PluginId,
				"Key":      kv.Key,
				"Old":      oldValue,
				"New":      kv.Value,
				"ExpireAt": kv.ExpireAt,
			},
		)
		if err != nil {
			return false, model.NewAppError("SqlPluginStore.CompareAndSet", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		if rowsAffected, err := updateResult.RowsAffected(); err != nil {
			// Failed to update
			return false, model.NewAppError("SqlPluginStore.CompareAndSet", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if rowsAffected == 0 {
			// No rows were affected by the update, where condition was not satisfied,
			// return false, but no error.
			return false, nil
		}
	}

	return true, nil
}

func (ps PgPluginStore) SetWithOptions(pluginId string, key string, value []byte, opt model.PluginKVSetOptions) (bool, *model.AppError) {
	if err := opt.IsValid(); err != nil {
		return false, err
	}

	kv, err := model.NewPluginKeyValueFromOptions(pluginId, key, value, opt)
	if err != nil {
		return false, err
	}

	if opt.Atomic {
		return ps.CompareAndSet(kv, opt.OldValue)
	}

	savedKv, err := ps.SaveOrUpdate(kv)
	if err != nil {
		return false, err
	}

	return savedKv != nil, nil
}
