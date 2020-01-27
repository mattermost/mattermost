// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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
