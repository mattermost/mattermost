// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"

	"github.com/mattermost/mattermost-server/server/public/model"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/app"
	"github.com/pkg/errors"
)

type sqlUserInfo struct {
	app.UserInfo
	DigestNotificationSettingsJSON json.RawMessage
}

type userInfoStore struct {
	store          *SQLStore
	queryBuilder   sq.StatementBuilderType
	userInfoSelect sq.SelectBuilder
}

// Ensure userInfoStore implements the userInfo.Store interface
var _ app.UserInfoStore = (*userInfoStore)(nil)

func NewUserInfoStore(sqlStore *SQLStore) app.UserInfoStore {
	userInfoSelect := sqlStore.builder.
		Select("ID", "LastDailyTodoDMAt", "COALESCE(DigestNotificationSettingsJSON, '{}') DigestNotificationSettingsJSON").
		From("IR_UserInfo")

	newStore := &userInfoStore{
		store:          sqlStore,
		queryBuilder:   sqlStore.builder,
		userInfoSelect: userInfoSelect,
	}
	return newStore
}

// Get retrieves a UserInfo struct by the user's userID.
func (s *userInfoStore) Get(userID string) (app.UserInfo, error) {
	var raw sqlUserInfo
	err := s.store.getBuilder(s.store.db, &raw, s.userInfoSelect.Where(sq.Eq{"ID": userID}))
	if err == sql.ErrNoRows {
		return app.UserInfo{}, errors.Wrapf(app.ErrNotFound, "userInfo does not exist for userId '%s'", userID)
	} else if err != nil {
		return app.UserInfo{}, errors.Wrapf(err, "failed to get userInfo by userId '%s'", userID)
	}

	return toUserInfo(raw)
}

// Upsert inserts (creates) or updates the UserInfo in info.
func (s *userInfoStore) Upsert(info app.UserInfo) error {
	if info.ID == "" {
		return errors.New("ID should not be empty")
	}
	raw, err := toSQLUserInfo(info)
	if err != nil {
		return err
	}

	if s.store.db.DriverName() == model.DatabaseDriverMysql {
		_, err = s.store.execBuilder(s.store.db,
			sq.Insert("IR_UserInfo").
				Columns("ID", "LastDailyTodoDMAt", "DigestNotificationSettingsJSON").
				Values(raw.ID, raw.LastDailyTodoDMAt, raw.DigestNotificationSettingsJSON).
				Suffix("ON DUPLICATE KEY UPDATE LastDailyTodoDMAt = ?, DigestNotificationSettingsJSON = ?",
					raw.LastDailyTodoDMAt, raw.DigestNotificationSettingsJSON))
	} else {
		_, err = s.store.execBuilder(s.store.db,
			sq.Insert("IR_UserInfo").
				Columns("ID", "LastDailyTodoDMAt", "DigestNotificationSettingsJSON").
				Values(raw.ID, raw.LastDailyTodoDMAt, raw.DigestNotificationSettingsJSON).
				Suffix("ON CONFLICT (ID) DO UPDATE SET LastDailyTodoDMAt = ?, DigestNotificationSettingsJSON = ?",
					raw.LastDailyTodoDMAt, raw.DigestNotificationSettingsJSON))
	}

	if err != nil {
		return errors.Wrapf(err, "failed to upsert userInfo with id '%s'", raw.ID)
	}

	return nil
}

func toUserInfo(rawUserInfo sqlUserInfo) (app.UserInfo, error) {
	userInfo := rawUserInfo.UserInfo
	if len(rawUserInfo.DigestNotificationSettingsJSON) == 0 {
		return userInfo, nil
	}

	if err := json.Unmarshal(rawUserInfo.DigestNotificationSettingsJSON, &userInfo.DigestNotificationSettings); err != nil {
		return userInfo, errors.Wrapf(err, "failed to unmarshal DigestNotificationSettings for userid: %s", userInfo.ID)
	}

	return userInfo, nil
}

func toSQLUserInfo(userInfo app.UserInfo) (*sqlUserInfo, error) {
	digestNotificationSettingsJSON, err := json.Marshal(userInfo.DigestNotificationSettings)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal DigestNotificationSettings for userid: %s", userInfo.ID)
	}

	if len(digestNotificationSettingsJSON) > maxJSONLength {
		return nil, errors.Wrapf(errors.New("invalid data"), "digestNotificationSettings json for user id '%s' is too long (max %d)", userInfo.ID, maxJSONLength)
	}

	return &sqlUserInfo{
		UserInfo:                       userInfo,
		DigestNotificationSettingsJSON: digestNotificationSettingsJSON,
	}, nil
}
