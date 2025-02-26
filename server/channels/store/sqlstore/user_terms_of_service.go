// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlUserTermsOfServiceStore struct {
	*SqlStore
}

func newSqlUserTermsOfServiceStore(sqlStore *SqlStore) store.UserTermsOfServiceStore {
	return SqlUserTermsOfServiceStore{sqlStore}
}

func (s SqlUserTermsOfServiceStore) GetByUser(userId string) (*model.UserTermsOfService, error) {
	var userTermsOfService model.UserTermsOfService
	query := `
		SELECT * 
		FROM UserTermsOfService 
		WHERE UserId = ?
	`
	if err := s.GetReplica().Get(&userTermsOfService, query, userId); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("UserTermsOfService", "userId="+userId)
		}

		return nil, errors.Wrapf(err, "failed to get UserTermsOfService with userId=%s", userId)
	}

	return &userTermsOfService, nil
}

func (s SqlUserTermsOfServiceStore) Save(userTermsOfService *model.UserTermsOfService) (*model.UserTermsOfService, error) {
	userTermsOfService.PreSave()
	if err := userTermsOfService.IsValid(); err != nil {
		return nil, err
	}

	query := `
		UPDATE UserTermsOfService
		SET UserId = :UserId, TermsOfServiceId = :TermsOfServiceId, CreateAt = :CreateAt
		WHERE UserId = :UserId
	`
	result, err := s.GetMaster().NamedExec(query, userTermsOfService)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update UserTermsOfService with userId=%s and termsOfServiceId=%s", userTermsOfService.UserId, userTermsOfService.TermsOfServiceId)
	}

	updatedRows, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to retrieve the number of affected rows for the update of UserTermsOfService")
	}
	if updatedRows == 0 {
		query := `
			INSERT INTO UserTermsOfService
				(UserId, TermsOfServiceId, CreateAt)
			VALUES
				(:UserId, :TermsOfServiceId, :CreateAt)
		`
		if _, err := s.GetMaster().NamedExec(query, userTermsOfService); err != nil {
			return nil, errors.Wrapf(err, "failed to save UserTermsOfService with userId=%s and termsOfServiceId=%s", userTermsOfService.UserId, userTermsOfService.TermsOfServiceId)
		}
	}

	return userTermsOfService, nil
}

func (s SqlUserTermsOfServiceStore) Delete(userId, termsOfServiceId string) error {
	query := `
		DELETE 
		FROM UserTermsOfService 
		WHERE UserId = ? AND TermsOfServiceId = ?
	`
	if _, err := s.GetMaster().Exec(query, userId, termsOfServiceId); err != nil {
		return errors.Wrapf(err, "failed to delete UserTermsOfService with userId=%s and termsOfServiceId=%s", userId, termsOfServiceId)
	}

	return nil
}
