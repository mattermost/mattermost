// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgPreferenceStore struct {
	sqlstore.SqlPreferenceStore
}

func (s PgPreferenceStore) Save(preferences *model.Preferences) *model.AppError {
	// wrap in a transaction so that if one fails, everything fails
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlPreferenceStore.Save", "store.sql_preference.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	defer finalizeTransaction(transaction)
	for _, preference := range *preferences {
		if upsertErr := s.save(transaction, &preference); upsertErr != nil {
			return upsertErr
		}
	}

	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return model.NewAppError("SqlPreferenceStore.Save", "store.sql_preference.save.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s PgPreferenceStore) update(transaction *gorp.Transaction, preference *model.Preference) *model.AppError {
	if _, err := transaction.Update(preference); err != nil {
		return model.NewAppError("SqlPreferenceStore.update", "store.sql_preference.update.app_error", nil,
			"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s PgPreferenceStore) insert(transaction *gorp.Transaction, preference *model.Preference) *model.AppError {
	if err := transaction.Insert(preference); err != nil {
		if IsUniqueConstraintError(err, []string{"UserId", "preferences_pkey"}) {
			return model.NewAppError("SqlPreferenceStore.insert", "store.sql_preference.insert.exists.app_error", nil,
				"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error(), http.StatusBadRequest)
		}
		return model.NewAppError("SqlPreferenceStore.insert", "store.sql_preference.insert.save.app_error", nil,
			"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (s PgPreferenceStore) save(transaction *gorp.Transaction, preference *model.Preference) *model.AppError {
	preference.PreUpdate()

	if err := preference.IsValid(); err != nil {
		return err
	}

	params := map[string]interface{}{
		"UserId":   preference.UserId,
		"Category": preference.Category,
		"Name":     preference.Name,
		"Value":    preference.Value,
	}

	// postgres has no way to upsert values until version 9.5 and trying inserting and then updating causes transactions to abort
	count, err := transaction.SelectInt(
		`SELECT
			count(0)
		FROM
			Preferences
		WHERE
			UserId = :UserId
			AND Category = :Category
			AND Name = :Name`, params)
	if err != nil {
		return model.NewAppError("SqlPreferenceStore.save", "store.sql_preference.save.updating.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if count == 1 {
		return s.update(transaction, preference)
	}
	return s.insert(transaction, preference)
}
