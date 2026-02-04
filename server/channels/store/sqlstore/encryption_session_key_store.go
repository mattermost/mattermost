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

type SqlEncryptionSessionKeyStore struct {
	*SqlStore
}

func newSqlEncryptionSessionKeyStore(sqlStore *SqlStore) store.EncryptionSessionKeyStore {
	return &SqlEncryptionSessionKeyStore{
		SqlStore: sqlStore,
	}
}

// Save stores an encryption key for a session. Replaces existing key if present.
func (s *SqlEncryptionSessionKeyStore) Save(key *model.EncryptionSessionKey) error {
	key.PreSave()

	if err := key.IsValid(); err != nil {
		return err
	}

	// Upsert: insert or replace
	query := `
		INSERT INTO encryptionsessionkeys (sessionid, userid, publickey, createat)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (sessionid) DO UPDATE SET
			publickey = EXCLUDED.publickey,
			createat = EXCLUDED.createat
	`

	if _, err := s.GetMaster().Exec(query, key.SessionId, key.UserId, key.PublicKey, key.CreateAt); err != nil {
		return errors.Wrap(err, "failed to save EncryptionSessionKey")
	}

	return nil
}

// GetBySession returns the encryption key for a specific session.
func (s *SqlEncryptionSessionKeyStore) GetBySession(sessionId string) (*model.EncryptionSessionKey, error) {
	var key model.EncryptionSessionKey

	query, args, err := s.getQueryBuilder().
		Select("sessionid", "userid", "publickey", "createat").
		From("encryptionsessionkeys").
		Where(sq.Eq{"sessionid": sessionId}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "encryption_session_key_get_by_session_tosql")
	}

	if err := s.GetReplica().Get(&key, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("EncryptionSessionKey", sessionId)
		}
		return nil, errors.Wrapf(err, "failed to get EncryptionSessionKey with sessionId=%s", sessionId)
	}

	return &key, nil
}

// GetByUser returns all encryption keys for a user (one per active session).
// Only returns keys for sessions that still exist (not expired/revoked).
func (s *SqlEncryptionSessionKeyStore) GetByUser(userId string) ([]*model.EncryptionSessionKey, error) {
	var keys []*model.EncryptionSessionKey

	// Join with sessions table to only return keys for active sessions
	query, args, err := s.getQueryBuilder().
		Select("e.sessionid", "e.userid", "e.publickey", "e.createat").
		From("encryptionsessionkeys e").
		InnerJoin("sessions s ON e.sessionid = s.id").
		Where(sq.Eq{"e.userid": userId}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "encryption_session_key_get_by_user_tosql")
	}

	if err := s.GetReplica().Select(&keys, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get EncryptionSessionKeys for userId=%s", userId)
	}

	return keys, nil
}

// GetByUsers returns all encryption keys for multiple users.
// Only returns keys for sessions that still exist (not expired/revoked).
func (s *SqlEncryptionSessionKeyStore) GetByUsers(userIds []string) ([]*model.EncryptionSessionKey, error) {
	if len(userIds) == 0 {
		return []*model.EncryptionSessionKey{}, nil
	}

	var keys []*model.EncryptionSessionKey

	// Join with sessions table to only return keys for active sessions
	query, args, err := s.getQueryBuilder().
		Select("e.sessionid", "e.userid", "e.publickey", "e.createat").
		From("encryptionsessionkeys e").
		InnerJoin("sessions s ON e.sessionid = s.id").
		Where(sq.Eq{"e.userid": userIds}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "encryption_session_key_get_by_users_tosql")
	}

	if err := s.GetReplica().Select(&keys, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get EncryptionSessionKeys for userIds")
	}

	return keys, nil
}

// DeleteBySession removes the encryption key for a specific session.
func (s *SqlEncryptionSessionKeyStore) DeleteBySession(sessionId string) error {
	query, args, err := s.getQueryBuilder().
		Delete("encryptionsessionkeys").
		Where(sq.Eq{"sessionid": sessionId}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "encryption_session_key_delete_by_session_tosql")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrapf(err, "failed to delete EncryptionSessionKey with sessionId=%s", sessionId)
	}

	return nil
}

// DeleteByUser removes all encryption keys for a user.
func (s *SqlEncryptionSessionKeyStore) DeleteByUser(userId string) error {
	query, args, err := s.getQueryBuilder().
		Delete("encryptionsessionkeys").
		Where(sq.Eq{"userid": userId}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "encryption_session_key_delete_by_user_tosql")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrapf(err, "failed to delete EncryptionSessionKeys for userId=%s", userId)
	}

	return nil
}

// DeleteExpired removes encryption keys for sessions that no longer exist.
func (s *SqlEncryptionSessionKeyStore) DeleteExpired() error {
	query := `
		DELETE FROM encryptionsessionkeys
		WHERE sessionid NOT IN (SELECT id FROM sessions)
	`

	if _, err := s.GetMaster().Exec(query); err != nil {
		return errors.Wrap(err, "failed to delete expired EncryptionSessionKeys")
	}

	return nil
}

// GetAll returns all encryption keys with user info (admin only).
func (s *SqlEncryptionSessionKeyStore) GetAll() ([]*model.EncryptionSessionKeyWithUser, error) {
	var keys []*model.EncryptionSessionKeyWithUser

	query := `
		SELECT e.sessionid, e.userid, u.username, e.publickey, e.createat
		FROM encryptionsessionkeys e
		INNER JOIN users u ON e.userid = u.id
		ORDER BY e.createat DESC
	`

	if err := s.GetReplica().Select(&keys, query); err != nil {
		return nil, errors.Wrap(err, "failed to get all EncryptionSessionKeys")
	}

	return keys, nil
}

// GetStats returns statistics about encryption keys.
func (s *SqlEncryptionSessionKeyStore) GetStats() (*model.EncryptionKeyStats, error) {
	var stats model.EncryptionKeyStats

	// Get total keys count
	countQuery := `SELECT COUNT(*) FROM encryptionsessionkeys`
	if err := s.GetReplica().Get(&stats.TotalKeys, countQuery); err != nil {
		return nil, errors.Wrap(err, "failed to count EncryptionSessionKeys")
	}

	// Get unique users count
	usersQuery := `SELECT COUNT(DISTINCT userid) FROM encryptionsessionkeys`
	if err := s.GetReplica().Get(&stats.TotalUsers, usersQuery); err != nil {
		return nil, errors.Wrap(err, "failed to count unique users with EncryptionSessionKeys")
	}

	return &stats, nil
}

// DeleteAll removes all encryption keys.
func (s *SqlEncryptionSessionKeyStore) DeleteAll() error {
	query := `DELETE FROM encryptionsessionkeys`

	if _, err := s.GetMaster().Exec(query); err != nil {
		return errors.Wrap(err, "failed to delete all EncryptionSessionKeys")
	}

	return nil
}
