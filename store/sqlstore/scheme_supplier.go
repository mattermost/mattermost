// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func initSqlSupplierSchemes(sqlStore SqlStore) {
	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Scheme{}, "Schemes").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Name").SetMaxSize(64)
		table.ColMap("Description").SetMaxSize(1024)
		table.ColMap("Scope").SetMaxSize(32)
		table.ColMap("DefaultTeamAdminRole").SetMaxSize(64)
		table.ColMap("DefaultTeamUserRole").SetMaxSize(64)
		table.ColMap("DefaultChannelAdminRole").SetMaxSize(64)
		table.ColMap("DefaultChannelUserRole").SetMaxSize(64)
	}
}

func (s *SqlSupplier) SchemeSave(ctx context.Context, scheme *model.Scheme, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if len(scheme.Id) == 0 {
		if !scheme.IsValidWithoutId() {
			result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.invalid_scheme.app_error", nil, "", http.StatusBadRequest)
			return result
		}

		scheme.Id = model.NewId()
		scheme.CreateAt = model.GetMillis()
		scheme.UpdateAt = scheme.CreateAt

		if err := s.GetMaster().Insert(scheme); err != nil {
			result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.insert.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	} else {
		if !scheme.IsValid() {
			result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.invalid_scheme.app_error", nil, "", http.StatusBadRequest)
			return result
		}

		scheme.UpdateAt = model.GetMillis()

		if rowsChanged, err := s.GetMaster().Update(scheme); err != nil {
			result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.update.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if rowsChanged != 1 {
			result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.update.app_error", nil, "no record to update", http.StatusInternalServerError)
		}
	}

	result.Data = scheme

	return result
}

func (s *SqlSupplier) SchemeGet(ctx context.Context, schemeId string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var scheme model.Scheme

	if err := s.GetReplica().SelectOne(&scheme, "SELECT * from Schemes WHERE Id = :Id", map[string]interface{}{"Id": schemeId}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlSchemeStore.Get", "store.sql_scheme.get.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlSchemeStore.Get", "store.sql_scheme.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	result.Data = &scheme

	return result
}
