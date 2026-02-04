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
// Includes session info (platform, os, browser, last activity) and identifies orphaned keys.
func (s *SqlEncryptionSessionKeyStore) GetAll() ([]*model.EncryptionSessionKeyWithUser, error) {
	// Use a raw SQL query to extract props from the sessions table
	// LEFT JOIN to include orphaned keys (where session no longer exists)
	query := `
		SELECT
			e.sessionid,
			e.userid,
			u.username,
			e.publickey,
			e.createat,
			COALESCE(s.lastactivityat, 0) as lastactivityat,
			COALESCE(s.expiresat, 0) as sessionexpiresat,
			COALESCE(s.deviceid, '') as deviceid,
			COALESCE(s.props::json->>'platform', '') as platform,
			COALESCE(s.props::json->>'os', '') as os,
			COALESCE(s.props::json->>'browser', '') as browser
		FROM encryptionsessionkeys e
		INNER JOIN users u ON e.userid = u.id
		LEFT JOIN sessions s ON e.sessionid = s.id
		ORDER BY e.createat DESC
	`

	rows, err := s.GetReplica().Query(query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get all EncryptionSessionKeys")
	}
	defer rows.Close()

	var keys []*model.EncryptionSessionKeyWithUser
	for rows.Next() {
		var key model.EncryptionSessionKeyWithUser
		if err := rows.Scan(
			&key.SessionId,
			&key.UserId,
			&key.Username,
			&key.PublicKey,
			&key.CreateAt,
			&key.LastActivityAt,
			&key.SessionExpiresAt,
			&key.DeviceId,
			&key.Platform,
			&key.OS,
			&key.Browser,
		); err != nil {
			return nil, errors.Wrap(err, "failed to scan EncryptionSessionKey")
		}
		// Session is active if it exists (lastactivityat > 0) and not expired
		key.SessionActive = key.LastActivityAt > 0 && (key.SessionExpiresAt == 0 || key.SessionExpiresAt > model.GetMillis())
		keys = append(keys, &key)
	}

	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to iterate EncryptionSessionKeys")
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

// DeleteOrphaned removes encryption keys for sessions that no longer exist or are expired.
func (s *SqlEncryptionSessionKeyStore) DeleteOrphaned() (int64, error) {
	query := `
		DELETE FROM encryptionsessionkeys
		WHERE sessionid NOT IN (
			SELECT id FROM sessions WHERE expiresat = 0 OR expiresat > $1
		)
	`

	result, err := s.GetMaster().Exec(query, model.GetMillis())
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete orphaned EncryptionSessionKeys")
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "failed to get rows affected for orphaned EncryptionSessionKeys deletion")
	}

	return rowsAffected, nil
}
