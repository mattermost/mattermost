// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlUserTermsOfServiceStore struct {
	*SqlStore
}

func newSqlUserTermsOfServiceStore(sqlStore *SqlStore) store.UserTermsOfServiceStore {
	s := SqlUserTermsOfServiceStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.UserTermsOfService{}, "UserTermsOfService").SetKeys(false, "UserId")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("TermsOfServiceId").SetMaxSize(26)
	}

	return s
}

func (s SqlUserTermsOfServiceStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_user_terms_of_service_user_id", "UserTermsOfService", "UserId")
}

func (s SqlUserTermsOfServiceStore) GetByUser(userId string) (*model.UserTermsOfService, error) {
	var userTermsOfService *model.UserTermsOfService

	err := s.GetReplica().SelectOne(&userTermsOfService, "SELECT * FROM UserTermsOfService WHERE UserId = :userId", map[string]interface{}{"userId": userId})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("UserTermsOfService", "userId="+userId)
		}
		return nil, errors.Wrapf(err, "failed to get UserTermsOfService with userId=%s", userId)
	}
	return userTermsOfService, nil
}

func (s SqlUserTermsOfServiceStore) Save(userTermsOfService *model.UserTermsOfService) (*model.UserTermsOfService, error) {
	userTermsOfService.PreSave()

	if err := userTermsOfService.IsValid(); err != nil {
		return nil, err
	}

	c, err := s.GetMaster().Update(userTermsOfService)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update UserTermsOfService with userId=%s and termsOfServiceId=%s", userTermsOfService.UserId, userTermsOfService.TermsOfServiceId)
	}

	if c == 0 {
		if err := s.GetMaster().Insert(userTermsOfService); err != nil {
			return nil, errors.Wrapf(err, "failed to save UserTermsOfService with userId=%s and termsOfServiceId=%s", userTermsOfService.UserId, userTermsOfService.TermsOfServiceId)
		}
	}

	return userTermsOfService, nil
}

func (s SqlUserTermsOfServiceStore) Delete(userId, termsOfServiceId string) error {
	if _, err := s.GetMaster().Exec("DELETE FROM UserTermsOfService WHERE UserId = :UserId AND TermsOfServiceId = :TermsOfServiceId", map[string]interface{}{"UserId": userId, "TermsOfServiceId": termsOfServiceId}); err != nil {
		return errors.Wrapf(err, "failed to delete UserTermsOfService with userId=%s and termsOfServiceId=%s", userId, termsOfServiceId)
	}
	return nil
}
