// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var passkeyColumns = []string{
	"id", "userid", "userhandle", "credentialid", "publickey", "aaguid", "transports",
	"signcount", "backupeligible", "backupstate", "name", "createat", "lastusedat",
}

type SqlPasskeyStore struct {
	*SqlStore
}

func newSqlPasskeyStore(sqlStore *SqlStore) store.PasskeyStore {
	return &SqlPasskeyStore{SqlStore: sqlStore}
}

func (s *SqlPasskeyStore) SaveIfUnderLimit(passkey *model.Passkey, limit int) (*model.Passkey, error) {
	passkey.PreSave()
	if appErr := passkey.IsValid(); appErr != nil {
		return nil, appErr
	}

	// Locking the owner's row serializes this user's saves so the COUNT/INSERT check cannot race.
	// SERIALIZABLE would instead abort overlapping saves from different users with 40001.
	tx, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin transaction for passkey SaveIfUnderLimit")
	}
	defer finalizeTransactionX(tx, &err)

	lock := s.getQueryBuilder().Select("Id").From("Users").Where(sq.Eq{"Id": passkey.UserId}).Suffix("FOR UPDATE")
	if _, err = tx.ExecBuilder(lock); err != nil {
		return nil, errors.Wrapf(err, "failed to lock user for passkey SaveIfUnderLimit userId=%s", passkey.UserId)
	}

	var count int
	countQuery := s.getQueryBuilder().Select("COUNT(*)").From("passkeys").Where(sq.Eq{"userid": passkey.UserId})
	if err = tx.GetBuilder(&count, countQuery); err != nil {
		return nil, errors.Wrapf(err, "failed to count passkeys for userId=%s", passkey.UserId)
	}
	if count >= limit {
		err = store.NewErrLimitExceeded("passkeys_per_user", count, "userId="+passkey.UserId)
		return nil, err
	}

	insert := s.getQueryBuilder().Insert("passkeys").SetMap(map[string]any{
		"id":             passkey.Id,
		"userid":         passkey.UserId,
		"userhandle":     passkey.UserHandle,
		"credentialid":   passkey.CredentialId,
		"publickey":      passkey.PublicKey,
		"aaguid":         passkey.AAGUID,
		"transports":     passkey.Transports,
		"signcount":      passkey.SignCount,
		"backupeligible": passkey.BackupEligible,
		"backupstate":    passkey.BackupState,
		"name":           passkey.Name,
		"createat":       passkey.CreateAt,
		"lastusedat":     passkey.LastUsedAt,
	})
	if _, err = tx.ExecBuilder(insert); err != nil {
		if IsUniqueConstraintError(err, []string{"passkeys_credentialid_key"}) {
			err = store.NewErrConflict("Passkey", err, "credentialId")
			return nil, err
		}
		return nil, errors.Wrap(err, "failed to save Passkey")
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit transaction for passkey SaveIfUnderLimit")
	}
	return passkey, nil
}

func (s *SqlPasskeyStore) GetForUser(userID string) ([]*model.Passkey, error) {
	query := s.getQueryBuilder().
		Select(passkeyColumns...).
		From("passkeys").
		Where(sq.Eq{"userid": userID}).
		OrderBy("createat ASC")

	// Read from master: registration counts and lists right after a write, and a lagging
	// replica would show a just-added or just-deleted passkey wrongly.
	passkeys := []*model.Passkey{}
	if err := s.GetMaster().SelectBuilder(&passkeys, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get passkeys for userId=%s", userID)
	}
	return passkeys, nil
}

func (s *SqlPasskeyStore) GetByCredentialId(credentialID []byte) (*model.Passkey, error) {
	query := s.getQueryBuilder().
		Select(passkeyColumns...).
		From("passkeys").
		Where(sq.Eq{"credentialid": credentialID})

	// Read from master: a passkey registered or deleted a moment ago must be seen as such at sign-in.
	var passkey model.Passkey
	if err := s.GetMaster().GetBuilder(&passkey, query); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("Passkey", "credentialId")
		}
		return nil, errors.Wrap(err, "failed to get Passkey by credential id")
	}
	return &passkey, nil
}

func (s *SqlPasskeyStore) UpdateUsage(id string, prevSignCount, signCount, lastUsedAt int64) error {
	// The signcount condition is a compare-and-swap: of two sign-ins presenting the same counter, only one matches.
	query := s.getQueryBuilder().
		Update("passkeys").
		SetMap(map[string]any{"signcount": signCount, "lastusedat": lastUsedAt}).
		Where(sq.Eq{"id": id, "signcount": prevSignCount})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to update usage of Passkey with id=%s", id)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to retrieve affected rows for Passkey usage update")
	}
	if n == 0 {
		return store.NewErrNotFound("Passkey", id)
	}
	return nil
}

func (s *SqlPasskeyStore) Delete(userID, passkeyID string) error {
	query := s.getQueryBuilder().
		Delete("passkeys").
		Where(sq.Eq{"id": passkeyID, "userid": userID})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete Passkey with id=%s", passkeyID)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to retrieve affected rows for Passkey delete")
	}
	if n == 0 {
		return store.NewErrNotFound("Passkey", passkeyID)
	}
	return nil
}

func (s *SqlPasskeyStore) PermanentDeleteByUser(userID string) error {
	query := s.getQueryBuilder().Delete("passkeys").Where(sq.Eq{"userid": userID})
	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to delete passkeys with userId=%s", userID)
	}
	return nil
}
