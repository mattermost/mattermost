// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"reflect"
	"testing"

	mock_app "github.com/mattermost/mattermost-server/v6/server/playbooks/server/app/mocks"

	"github.com/pkg/errors"

	sq "github.com/Masterminds/squirrel"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func Test_userInfoStore_Get(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		userInfoStore := setupUserInfoStore(t, db)

		t.Run("gets existing userInfo correctly", func(t *testing.T) {
			expected := app.UserInfo{
				ID:                         model.NewId(),
				LastDailyTodoDMAt:          12345678,
				DigestNotificationSettings: app.DigestNotificationSettings{DisableDailyDigest: false, DisableWeeklyDigest: false},
			}
			err := userInfoStore.Upsert(expected)
			require.NoError(t, err)

			actual, err := userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}
		})

		t.Run("gets non-existing userInfo correctly", func(t *testing.T) {
			expected := app.UserInfo{}
			actual, err := userInfoStore.Get(model.NewId())
			require.Error(t, err)
			require.True(t, errors.Is(err, app.ErrNotFound))
			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}
		})

		t.Run("gets null DigestNotificationSettingsJSON correctly", func(t *testing.T) {
			expected := app.UserInfo{
				ID:                         model.NewId(),
				LastDailyTodoDMAt:          12345678,
				DigestNotificationSettings: app.DigestNotificationSettings{DisableDailyDigest: false, DisableWeeklyDigest: false},
			}

			statement, args, err := sq.Insert("IR_UserInfo").
				Columns("ID", "LastDailyTodoDMAt", "DigestNotificationSettingsJSON").
				Values(expected.ID, expected.LastDailyTodoDMAt, nil).ToSql()
			require.NoError(t, err)
			_, err = db.Exec(db.Rebind(statement), args...)
			require.NoError(t, err)

			actual, err := userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}
		})
	}
}

func Test_userInfoStore_Upsert(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		userInfoStore := setupUserInfoStore(t, db)

		t.Run("inserts userInfo correctly", func(t *testing.T) {
			userID := model.NewId()
			expected := app.UserInfo{}

			// assert doesn't exist yet:
			actual, err := userInfoStore.Get(expected.ID)
			require.Error(t, err)
			require.True(t, errors.Is(err, app.ErrNotFound))
			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}

			// insert:
			expected = app.UserInfo{
				ID:                         userID,
				LastDailyTodoDMAt:          12345678,
				DigestNotificationSettings: app.DigestNotificationSettings{DisableDailyDigest: false, DisableWeeklyDigest: false},
			}

			err = userInfoStore.Upsert(expected)
			require.NoError(t, err)

			actual, err = userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}
		})

		t.Run("upserts userInfo correctly", func(t *testing.T) {
			expected := app.UserInfo{
				ID:                         model.NewId(),
				LastDailyTodoDMAt:          12345678,
				DigestNotificationSettings: app.DigestNotificationSettings{DisableDailyDigest: false, DisableWeeklyDigest: false},
			}

			// insert:
			err := userInfoStore.Upsert(expected)
			require.NoError(t, err)

			actual, err := userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}

			// update:
			expected.LastDailyTodoDMAt = 48102939451
			expected.DisableDailyDigest = true
			err = userInfoStore.Upsert(expected)
			require.NoError(t, err)

			actual, err = userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}

			// update dailyDigest one more time:
			expected.DisableDailyDigest = false
			err = userInfoStore.Upsert(expected)
			require.NoError(t, err)

			actual, err = userInfoStore.Get(expected.ID)
			require.NoError(t, err)

			if !reflect.DeepEqual(actual, expected) {
				t.Errorf("Get() actual = %#v, expected %#v", actual, expected)
			}
		})
	}
}

func setupUserInfoStore(t *testing.T, db *sqlx.DB) app.UserInfoStore {
	sqlStore := setupSQLStoreForUserInfo(t, db)

	return NewUserInfoStore(sqlStore)
}

func setupSQLStoreForUserInfo(t *testing.T, db *sqlx.DB) *SQLStore {
	t.Helper()

	mockCtrl := gomock.NewController(t)
	scheduler := mock_app.NewMockJobOnceScheduler(mockCtrl)

	driverName := db.DriverName()

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if driverName == model.DatabaseDriverPostgres {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	sqlStore := &SQLStore{
		db,
		builder,
		scheduler,
	}

	setupChannelsTable(t, db)
	setupPostsTable(t, db)
	setupKVStoreTable(t, db)
	setupTeamMembersTable(t, db)
	setupChannelMembersTable(t, db)
	setupBotsTable(t, db)

	err := sqlStore.RunMigrations()
	require.NoError(t, err)

	return sqlStore
}
