// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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

func (s SqlUserTermsOfServiceStore) GetByUser(userId string) (*model.UserTermsOfService, *model.AppError) {
	var userTermsOfService *model.UserTermsOfService

	err := s.GetReplica().SelectOne(&userTermsOfService, "SELECT * FROM UserTermsOfService WHERE UserId = :userId", map[string]interface{}{"userId": userId})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("NewSqlUserTermsOfServiceStore.GetByUser", "store.sql_user_terms_of_service.get_by_user.no_rows.app_error", nil, "", http.StatusNotFound)
		}
		return nil, model.NewAppError("NewSqlUserTermsOfServiceStore.GetByUser", "store.sql_user_terms_of_service.get_by_user.app_error", nil, "", http.StatusInternalServerError)
	}
	return userTermsOfService, nil
}

func (s SqlUserTermsOfServiceStore) Save(userTermsOfService *model.UserTermsOfService) (*model.UserTermsOfService, *model.AppError) {
	userTermsOfService.PreSave()

	if err := userTermsOfService.IsValid(); err != nil {
		return nil, err
	}

	c, err := s.GetMaster().Update(userTermsOfService)
	if err != nil {
		return nil, model.NewAppError("SqlUserTermsOfServiceStore.Save", "store.sql_user_terms_of_service.save.app_error", nil, "user_terms_of_service_user_id="+userTermsOfService.UserId+",user_terms_of_service_terms_of_service_id="+userTermsOfService.TermsOfServiceId+",err="+err.Error(), http.StatusInternalServerError)
	}

	if c == 0 {
		if err := s.GetMaster().Insert(userTermsOfService); err != nil {
			return nil, model.NewAppError("SqlUserTermsOfServiceStore.Save", "store.sql_user_terms_of_service.save.app_error", nil, "user_terms_of_service_user_id="+userTermsOfService.UserId+",user_terms_of_service_terms_of_service_id="+userTermsOfService.TermsOfServiceId+",err="+err.Error(), http.StatusInternalServerError)
		}
	}

	return userTermsOfService, nil
}

func (s SqlUserTermsOfServiceStore) Delete(userId, termsOfServiceId string) *model.AppError {
	if _, err := s.GetMaster().Exec("DELETE FROM UserTermsOfService WHERE UserId = :UserId AND TermsOfServiceId = :TermsOfServiceId", map[string]interface{}{"UserId": userId, "TermsOfServiceId": termsOfServiceId}); err != nil {
		return model.NewAppError("SqlUserTermsOfServiceStore.Delete", "store.sql_user_terms_of_service.delete.app_error", nil, "userId="+userId+", termsOfServiceId="+termsOfServiceId, http.StatusInternalServerError)
	}
	return nil
}
