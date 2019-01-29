// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlUserTermsOfServiceStore struct {
	SqlStore
}

func NewSqlUserTermsOfServiceStore(sqlStore SqlStore) store.UserTermsOfServiceStore {
	s := SqlUserTermsOfServiceStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.UserTermsOfService{}, "UserTermsOfService").SetKeys(false, "UserId")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("TermsOfServiceId").SetMaxSize(26)
	}

	return s
}

func (s SqlUserTermsOfServiceStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_user_terms_of_service_user_id", "UserTermsOfService", "UserId")
}

func (s SqlUserTermsOfServiceStore) GetByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var userTermsOfService *model.UserTermsOfService

		err := s.GetReplica().SelectOne(&userTermsOfService, "SELECT * FROM UserTermsOfService WHERE UserId = :userId", map[string]interface{}{"userId": userId})
		if err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("NewSqlUserTermsOfServiceStore.GetByUser", "store.sql_user_terms_of_service.get_by_user.no_rows.app_error", nil, "", http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("NewSqlUserTermsOfServiceStore.GetByUser", "store.sql_user_terms_of_service.get_by_user.app_error", nil, "", http.StatusInternalServerError)
			}
		} else {
			result.Data = userTermsOfService
		}
	})
}

func (s SqlUserTermsOfServiceStore) Save(userTermsOfService *model.UserTermsOfService) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		userTermsOfService.PreSave()

		if result.Err = userTermsOfService.IsValid(); result.Err != nil {
			return
		}

		if c, err := s.GetMaster().Update(userTermsOfService); err != nil {
			result.Err = model.NewAppError(
				"SqlUserTermsOfServiceStore.Save",
				"store.sql_user_terms_of_service.save.app_error",
				nil,
				"user_terms_of_service_user_id="+userTermsOfService.UserId+",user_terms_of_service_terms_of_service_id="+userTermsOfService.TermsOfServiceId+",err="+err.Error(),
				http.StatusInternalServerError,
			)
		} else if c == 0 {
			if err := s.GetMaster().Insert(userTermsOfService); err != nil {
				result.Err = model.NewAppError(
					"SqlUserTermsOfServiceStore.Save",
					"store.sql_user_terms_of_service.save.app_error",
					nil,
					"user_terms_of_service_user_id="+userTermsOfService.UserId+",user_terms_of_service_terms_of_service_id="+userTermsOfService.TermsOfServiceId+",err="+err.Error(),
					http.StatusInternalServerError,
				)
			}
		}

		result.Data = userTermsOfService
	})
}

func (s SqlUserTermsOfServiceStore) Delete(userId, termsOfServiceId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM UserTermsOfService WHERE UserId = :UserId AND TermsOfServiceId = :TermsOfServiceId", map[string]interface{}{"UserId": userId, "TermsOfServiceId": termsOfServiceId}); err != nil {
			result.Err = model.NewAppError("SqlUserTermsOfServiceStore.Delete", "store.sql_user_terms_of_service.delete.app_error", nil, "userId="+userId+", termsOfServiceId="+termsOfServiceId, http.StatusInternalServerError)
			return
		}
	})
}
