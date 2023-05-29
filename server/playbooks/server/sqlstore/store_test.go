// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/app"

	mock_app "github.com/mattermost/mattermost-server/server/v8/playbooks/server/app/mocks"

	sq "github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
)

func TestMigrations(t *testing.T) {
	mockCtrl := gomock.NewController(t)
	scheduler := mock_app.NewMockJobOnceScheduler(mockCtrl)

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if getDriverName() == model.DatabaseDriverPostgres {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	t.Run("Run every migration twice", func(t *testing.T) {
		db := setupTestDB(t)
		sqlStore := &SQLStore{
			db,
			builder,
			scheduler,
		}

		// Make sure we start from scratch
		currentSchemaVersion, err := sqlStore.GetCurrentVersion()
		require.NoError(t, err)
		require.Equal(t, currentSchemaVersion, semver.Version{})

		// Migration to 0.10.0 needs the Channels table to work
		setupChannelsTable(t, db)
		// Migration to 0.21.0 need the Posts table
		setupPostsTable(t, db)
		// Migration to 0.31.0 needs the PluginKeyValueStore
		setupKVStoreTable(t, db)
		// Migration to 0.55.0 needs the TeamMembers table
		setupTeamMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupChannelMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupBotsTable(t, db)

		// Apply each migration twice
		for _, migration := range migrations {
			for i := 0; i < 2; i++ {
				err := sqlStore.migrate(migration)
				require.NoError(t, err)

				currentSchemaVersion, err := sqlStore.GetCurrentVersion()
				require.NoError(t, err)
				require.Equal(t, currentSchemaVersion, migration.toVersion)
			}
		}
	})

	t.Run("Run the whole set of migrations twice", func(t *testing.T) {
		db := setupTestDB(t)
		sqlStore := &SQLStore{
			db,
			builder,
			scheduler,
		}

		// Make sure we start from scratch
		currentSchemaVersion, err := sqlStore.GetCurrentVersion()
		require.NoError(t, err)
		require.Equal(t, currentSchemaVersion, semver.Version{})

		// Migration to 0.10.0 needs the Channels table to work
		setupChannelsTable(t, db)
		// Migration to 0.21.0 need the Posts table
		setupPostsTable(t, db)
		// Migration to 0.31.0 needs the PluginKeyValueStore
		setupKVStoreTable(t, db)
		// Migration to 0.55.0 needs the TeamMembers table
		setupTeamMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupChannelMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupBotsTable(t, db)

		// Apply the whole set of migrations twice
		for i := 0; i < 2; i++ {
			for _, migration := range migrations {
				err := sqlStore.migrate(migration)
				require.NoError(t, err)

				currentSchemaVersion, err := sqlStore.GetCurrentVersion()
				require.NoError(t, err)
				require.Equal(t, currentSchemaVersion, migration.toVersion)
			}
		}
	})

	t.Run("force incidents to have a reminder set", func(t *testing.T) {
		db := setupTestDB(t)
		sqlStore := &SQLStore{
			db,
			builder,
			scheduler,
		}

		// Make sure we start from scratch
		currentSchemaVersion, err := sqlStore.GetCurrentVersion()
		require.NoError(t, err)
		require.Equal(t, currentSchemaVersion, semver.Version{})

		// Migration to 0.10.0 needs the Channels table to work
		setupChannelsTable(t, db)
		// Migration to 0.21.0 need the Posts table
		setupPostsTable(t, db)
		// Migration to 0.31.0 needs the PluginKeyValueStore
		setupKVStoreTable(t, db)
		// Migration to 0.55.0 needs the TeamMembers table
		setupTeamMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupChannelMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupBotsTable(t, db)

		// Apply the migrations up to and including 0.36
		migrateUpTo(t, sqlStore, semver.MustParse("0.36.0"))

		now := time.Now()
		// Insert runs to test
		expired, err := insertRunWithExpiredReminder(sqlStore, 1*time.Minute)
		require.NoError(t, err)
		noReminder, err := insertRunWithNoReminder(sqlStore)
		require.NoError(t, err)
		oldExpired, err := insertRunWithExpiredReminder(sqlStore, 4*24*time.Hour)
		require.NoError(t, err)
		activeReminder, err := insertRunWithActiveReminder(sqlStore, 24*time.Hour)
		require.NoError(t, err)
		inactive1, err := insertInactiveRunWithExpiredReminder(sqlStore, 23*time.Hour)
		require.NoError(t, err)
		inactive2, err := insertInactiveRunWithNoReminder(sqlStore)
		require.NoError(t, err)

		// set expected calls we will get below when we run migration
		newReminder := 24 * 7 * time.Hour
		scheduler.EXPECT().Cancel(expired)
		scheduler.EXPECT().ScheduleOnce(expired, gomock.Any()).
			Return(nil, nil).
			Times(1).
			Do(func(id string, at time.Time) {
				shouldHaveReminderBefore := now.Add(newReminder + 1*time.Second)
				shouldHaveReminderAfter := now.Add(newReminder - 1*time.Second)
				if at.Before(shouldHaveReminderAfter) || at.After(shouldHaveReminderBefore) {
					t.Errorf("expected call to ScheduleOnce: %d to be after: %d and before: %d",
						model.GetMillisForTime(at), model.GetMillisForTime(shouldHaveReminderAfter),
						model.GetMillisForTime(shouldHaveReminderBefore))
				}
			})
		scheduler.EXPECT().Cancel(noReminder)
		scheduler.EXPECT().ScheduleOnce(noReminder, gomock.Any()).
			Return(nil, nil).
			Times(1).
			Do(func(id string, at time.Time) {
				shouldHaveReminderBefore := now.Add(newReminder + 1*time.Second)
				shouldHaveReminderAfter := now.Add(newReminder - 1*time.Second)
				if at.Before(shouldHaveReminderAfter) || at.After(shouldHaveReminderBefore) {
					t.Errorf("expected call to ScheduleOnce: %d to be after: %d and before: %d",
						model.GetMillisForTime(at), model.GetMillisForTime(shouldHaveReminderAfter),
						model.GetMillisForTime(shouldHaveReminderBefore))
				}
			})
		scheduler.EXPECT().Cancel(oldExpired)
		scheduler.EXPECT().ScheduleOnce(oldExpired, gomock.Any()).
			Return(nil, nil).
			Times(1).
			Do(func(id string, at time.Time) {
				shouldHaveReminderBefore := now.Add(newReminder + 1*time.Second)
				shouldHaveReminderAfter := now.Add(newReminder - 1*time.Second)
				if at.Before(shouldHaveReminderAfter) || at.After(shouldHaveReminderBefore) {
					t.Errorf("expected call to ScheduleOnce: %d to be after: %d and before: %d",
						model.GetMillisForTime(at), model.GetMillisForTime(shouldHaveReminderAfter),
						model.GetMillisForTime(shouldHaveReminderBefore))
				}
			})

		// Apply the migrations from 0.37-on
		migrateFrom(t, sqlStore, semver.MustParse("0.36.0"))

		// Test that the runs that should have been changed now have new reminders
		expiredRun, err := getRun(expired, sqlStore)
		require.NoError(t, err)
		require.Equal(t, expiredRun.PreviousReminder, newReminder)
		noReminderRun, err := getRun(noReminder, sqlStore)
		require.NoError(t, err)
		require.Equal(t, noReminderRun.PreviousReminder, newReminder)

		// Test that the runs that should not have been changed do /not/ have new reminders
		activeReminderRun, err := getRun(activeReminder, sqlStore)
		require.NoError(t, err)
		require.Equal(t, activeReminderRun.PreviousReminder, 24*time.Hour)
		inactive1Run, err := getRun(inactive1, sqlStore)
		require.NoError(t, err)
		require.Equal(t, inactive1Run.PreviousReminder, 23*time.Hour)
		inactive2Run, err := getRun(inactive2, sqlStore)
		require.NoError(t, err)
		require.Equal(t, inactive2Run.PreviousReminder, time.Duration(0))
	})

	t.Run("copy Description column into new RunSummaryTemplate", func(t *testing.T) {
		db := setupTestDB(t)
		sqlStore := &SQLStore{
			db,
			builder,
			scheduler,
		}

		// Make sure we start from scratch
		currentSchemaVersion, err := sqlStore.GetCurrentVersion()
		require.NoError(t, err)
		require.Equal(t, currentSchemaVersion, semver.Version{})

		// Migration to 0.10.0 needs the Channels table to work
		setupChannelsTable(t, db)
		// Migration to 0.21.0 need the Posts table
		setupPostsTable(t, db)
		// Migration to 0.31.0 needs the PluginKeyValueStore
		setupKVStoreTable(t, db)
		// Migration to 0.55.0 needs the TeamMembers table
		setupTeamMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupChannelMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupBotsTable(t, db)

		// Apply the migrations up to and including 0.38
		migrateUpTo(t, sqlStore, semver.MustParse("0.38.0"))

		playbookWithDescriptionID := model.NewId()
		nonEmptyDescription := "a non-empty description"

		// Insert a playbook with a non-empty description
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("IR_Playbook").
			SetMap(map[string]interface{}{
				"ID":          playbookWithDescriptionID,
				"Description": nonEmptyDescription,
				// Have to be set:
				"Title":                                "Playbook",
				"TeamID":                               model.NewId(),
				"CreatePublicIncident":                 true,
				"CreateAt":                             0,
				"DeleteAt":                             0,
				"ChecklistsJSON":                       []byte("{}"),
				"NumStages":                            0,
				"NumSteps":                             0,
				"ReminderTimerDefaultSeconds":          0,
				"RetrospectiveReminderIntervalSeconds": 0,
				"UpdateAt":                             0,
				"ExportChannelOnFinishedEnabled":       false,
			}))
		require.NoError(t, err)

		playbookWithEmptyDescriptionID := model.NewId()

		// Insert a playbook with an empty description
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("IR_Playbook").
			SetMap(map[string]interface{}{
				"ID":          playbookWithEmptyDescriptionID,
				"Description": "",
				// Have to be set:
				"Title":                                "Playbook",
				"Teamid":                               model.NewId(),
				"CreatePublicIncident":                 true,
				"CreateAt":                             0,
				"DeleteAt":                             0,
				"ChecklistsJSON":                       []byte("{}"),
				"NumStages":                            0,
				"NumSteps":                             0,
				"ReminderTimerDefaultSeconds":          0,
				"RetrospectiveReminderIntervalSeconds": 0,
				"UpdateAt":                             0,
				"ExportChannelOnFinishedEnabled":       false,
			}))
		require.NoError(t, err)

		// Apply the migrations from 0.38-on
		migrateFrom(t, sqlStore, semver.MustParse("0.38.0"))

		// Get the playbook with the non-empty description
		var playbookWithDescription app.Playbook
		err = sqlStore.getBuilder(sqlStore.db, &playbookWithDescription, sqlStore.builder.
			Select("ID", "Description", "RunSummaryTemplate").
			From("IR_Playbook").
			Where(sq.Eq{"ID": playbookWithDescriptionID}))
		require.NoError(t, err)

		// Get the playbook with the empty description
		var playbookWithEmptyDescription app.Playbook
		err = sqlStore.getBuilder(sqlStore.db, &playbookWithEmptyDescription, sqlStore.builder.
			Select("ID", "Description", "RunSummaryTemplate").
			From("IR_Playbook").
			Where(sq.Eq{"ID": playbookWithEmptyDescriptionID}))
		require.NoError(t, err)

		// Check that the copy was successful in the playbook with the non-empty description
		require.Equal(t, playbookWithDescription.Description, "")
		require.Equal(t, playbookWithDescription.RunSummaryTemplate, nonEmptyDescription)

		// Check that the copy was successful in the playbook with the empty description
		require.Equal(t, playbookWithEmptyDescription.Description, "")
		require.Equal(t, playbookWithEmptyDescription.RunSummaryTemplate, "")
	})

	t.Run("playbook member migration", func(t *testing.T) {
		db := setupTestDB(t)
		sqlStore := &SQLStore{
			db,
			builder,
			scheduler,
		}

		// Make sure we start from scratch
		currentSchemaVersion, err := sqlStore.GetCurrentVersion()
		require.NoError(t, err)
		require.Equal(t, currentSchemaVersion, semver.Version{})

		// Migration to 0.10.0 needs the Channels table to work
		setupChannelsTable(t, db)
		// Migration to 0.21.0 need the Posts table
		setupPostsTable(t, db)
		// Migration to 0.31.0 needs the PluginKeyValueStore
		setupKVStoreTable(t, db)
		// Migration to 0.55.0 needs the TeamMembers table
		setupTeamMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupChannelMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupBotsTable(t, db)

		migrateUpTo(t, sqlStore, semver.MustParse("0.55.0"))

		// Public playbook
		publicPlaybookID := model.NewId()
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("IR_Playbook").
			SetMap(map[string]interface{}{
				"ID":          publicPlaybookID,
				"Description": "",
				"Public":      true,
				// Have to be set:
				"Title":                                "Playbook",
				"Teamid":                               model.NewId(),
				"CreatePublicIncident":                 true,
				"CreateAt":                             0,
				"DeleteAt":                             0,
				"ChecklistsJSON":                       []byte("{}"),
				"NumStages":                            0,
				"NumSteps":                             0,
				"ReminderTimerDefaultSeconds":          0,
				"RetrospectiveReminderIntervalSeconds": 0,
				"UpdateAt":                             0,
				"ExportChannelOnFinishedEnabled":       false,
			}))
		require.NoError(t, err)

		// Private playbook
		privatePlaybookID := model.NewId()
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("IR_Playbook").
			SetMap(map[string]interface{}{
				"ID":          privatePlaybookID,
				"Description": "",
				"Public":      true,
				// Have to be set:
				"Title":                                "Playbook",
				"Teamid":                               model.NewId(),
				"CreatePublicIncident":                 true,
				"CreateAt":                             0,
				"DeleteAt":                             0,
				"ChecklistsJSON":                       []byte("{}"),
				"NumStages":                            0,
				"NumSteps":                             0,
				"ReminderTimerDefaultSeconds":          0,
				"RetrospectiveReminderIntervalSeconds": 0,
				"UpdateAt":                             0,
				"ExportChannelOnFinishedEnabled":       false,
			}))
		require.NoError(t, err)

		channel1ID := model.NewId()
		user1ID := model.NewId()
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("ChannelMembers").
			SetMap(map[string]interface{}{
				"UserID":    user1ID,
				"ChannelID": channel1ID,
			}))
		require.NoError(t, err)

		channel2ID := model.NewId()
		user2ID := model.NewId()
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("ChannelMembers").
			SetMap(map[string]interface{}{
				"UserID":    user2ID,
				"ChannelID": channel2ID,
			}))
		require.NoError(t, err)

		publicPlaybookRunID := model.NewId()
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("IR_Incident").
			SetMap(map[string]interface{}{
				"ID":            publicPlaybookRunID,
				"CreateAt":      model.GetMillis(),
				"CurrentStatus": app.StatusInProgress,
				"PlaybookID":    publicPlaybookID,
				// have to be set:
				"Name":            "test",
				"Description":     "test",
				"IsActive":        true,
				"CommanderUserID": "commander",
				"TeamID":          "testTeam",
				"ChannelID":       channel1ID,
				"ActiveStage":     0,
				"ChecklistsJSON":  "{}",
			}))
		require.NoError(t, err)

		privatePlaybookRunID := model.NewId()
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("IR_Incident").
			SetMap(map[string]interface{}{
				"ID":            privatePlaybookRunID,
				"CreateAt":      model.GetMillis(),
				"CurrentStatus": app.StatusInProgress,
				"PlaybookID":    privatePlaybookRunID,
				// have to be set:
				"Name":            "test",
				"Description":     "test",
				"IsActive":        true,
				"CommanderUserID": "commander",
				"TeamID":          "testTeam",
				"ChannelID":       channel2ID,
				"ActiveStage":     0,
				"ChecklistsJSON":  "{}",
			}))
		require.NoError(t, err)

		migrateFrom(t, sqlStore, semver.MustParse("0.55.0"))

		// Check to see if we added the playbook member correctly
		var member playbookMember
		err = sqlStore.getBuilder(sqlStore.db, &member, sqlStore.builder.
			Select("PlaybookID", "MemberID", "Roles").
			From("IR_PlaybookMember").
			Where(sq.Eq{"PlaybookID": publicPlaybookID}).
			Where(sq.Eq{"MemberID": user1ID}))
		require.NoError(t, err)
		assert.Equal(t, publicPlaybookID, member.PlaybookID)
		assert.Equal(t, user1ID, member.MemberID)
		assert.Equal(t, "playbook_member", member.Roles)

		// Make sure we don't add to private playbooks
		err = sqlStore.getBuilder(sqlStore.db, &member, sqlStore.builder.
			Select("PlaybookID", "MemberID", "Roles").
			From("IR_PlaybookMember").
			Where(sq.Eq{"PlaybookID": privatePlaybookID}).
			Where(sq.Eq{"MemberID": user2ID}))
		require.ErrorIs(t, err, sql.ErrNoRows)

		// Must be a member of that playbooks run
		err = sqlStore.getBuilder(sqlStore.db, &member, sqlStore.builder.
			Select("PlaybookID", "MemberID", "Roles").
			From("IR_PlaybookMember").
			Where(sq.Eq{"PlaybookID": publicPlaybookID}).
			Where(sq.Eq{"MemberID": user2ID}))
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	t.Run("run participants migration", func(t *testing.T) {
		db := setupTestDB(t)
		sqlStore := &SQLStore{
			db,
			builder,
			scheduler,
		}

		// Make sure we start from scratch
		currentSchemaVersion, err := sqlStore.GetCurrentVersion()
		require.NoError(t, err)
		require.Equal(t, currentSchemaVersion, semver.Version{})

		// Migration to 0.10.0 needs the Channels table to work
		setupChannelsTable(t, db)
		// Migration to 0.21.0 need the Posts table
		setupPostsTable(t, db)
		// Migration to 0.31.0 needs the PluginKeyValueStore
		setupKVStoreTable(t, db)
		// Migration to 0.55.0 needs the TeamMembers table
		setupTeamMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupChannelMembersTable(t, db)
		// Migration to 0.56.0 needs ChannelMembers table
		setupBotsTable(t, db)

		// Apply the migrations up to and including 0.57.0
		migrateUpTo(t, sqlStore, semver.MustParse("0.57.0"))

		bot1 := userInfo{
			ID:   model.NewId(),
			Name: "Mr. Bot",
		}
		bot2 := userInfo{
			ID:   model.NewId(),
			Name: "Mrs. Bot",
		}
		// Add two bots
		addBots(t, sqlStore, []userInfo{bot1, bot2})

		userIDs := []string{model.NewId(), model.NewId(), model.NewId(), model.NewId()}
		runs := []struct {
			ID               string
			ChannelID        string
			ChannelMemberIDs []string
		}{
			{ID: model.NewId(), ChannelID: model.NewId(), ChannelMemberIDs: []string{userIDs[0], userIDs[1], userIDs[2], bot1.ID}},
			{ID: model.NewId(), ChannelID: model.NewId(), ChannelMemberIDs: []string{userIDs[0], userIDs[1], bot2.ID}},
			{ID: model.NewId(), ChannelID: model.NewId(), ChannelMemberIDs: []string{userIDs[0]}},
			{ID: model.NewId(), ChannelID: model.NewId(), ChannelMemberIDs: []string{bot1.ID, bot2.ID}},
		}
		for _, run := range runs {
			// Insert runs
			_, err = sqlStore.execBuilder(sqlStore.db, sq.
				Insert("IR_Incident").
				SetMap(map[string]interface{}{
					"ID":            run.ID,
					"CreateAt":      model.GetMillis(),
					"CurrentStatus": app.StatusInProgress,
					// have to be set:
					"Name":            "test",
					"Description":     "test",
					"IsActive":        true,
					"CommanderUserID": "commander",
					"TeamID":          "testTeam",
					"ChannelID":       run.ChannelID,
					"ActiveStage":     0,
					"ChecklistsJSON":  "{}",
				}))
			require.NoError(t, err)

			// Insert channel members
			for _, userID := range run.ChannelMemberIDs {
				_, err = sqlStore.execBuilder(sqlStore.db, sq.
					Insert("ChannelMembers").
					SetMap(map[string]interface{}{
						"UserID":    userID,
						"ChannelID": run.ChannelID,
					}))
				require.NoError(t, err)
			}
		}

		// Add users to IR_Run_Participants
		// Channel member and follower
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("IR_Run_Participants").
			SetMap(map[string]interface{}{
				"UserID":     userIDs[0],
				"IncidentID": runs[0].ID,
				"IsFollower": true,
			}))
		require.NoError(t, err)
		// Channel member, not follower
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("IR_Run_Participants").
			SetMap(map[string]interface{}{
				"UserID":     userIDs[0],
				"IncidentID": runs[1].ID,
				"IsFollower": false,
			}))
		require.NoError(t, err)
		// Not channel member, follower
		_, err = sqlStore.execBuilder(sqlStore.db, sq.
			Insert("IR_Run_Participants").
			SetMap(map[string]interface{}{
				"UserID":     userIDs[3],
				"IncidentID": runs[3].ID,
				"IsFollower": false,
			}))
		require.NoError(t, err)

		type RunParticipant struct {
			UserID     string
			IncidentID string
		}

		var runMembers1 []RunParticipant
		err = sqlStore.selectBuilder(sqlStore.db, &runMembers1, sqlStore.builder.
			Select("UserID", "IncidentID").
			From("IR_Run_Participants").
			OrderBy("UserID ASC"))
		require.NoError(t, err)

		// Apply the migrations from 0.57.0-on
		migrateFrom(t, sqlStore, semver.MustParse("0.57.0"))

		// Compare run members list and channel members list
		var runMembers []RunParticipant
		err = sqlStore.selectBuilder(sqlStore.db, &runMembers, sqlStore.builder.
			Select("UserID", "IncidentID").
			From("IR_Run_Participants").
			Where(sq.Eq{"IsParticipant": true}).
			OrderBy("UserID ASC").
			OrderBy("IncidentID ASC"))
		require.NoError(t, err)

		var channelMembers []RunParticipant
		err = sqlStore.selectBuilder(sqlStore.db, &channelMembers, sqlStore.builder.
			Select("cm.UserID as UserID", "i.ID as IncidentID").
			From("ChannelMembers as cm").
			Join("IR_Incident AS i ON i.ChannelID = cm.ChannelID").
			OrderBy("UserID ASC").
			OrderBy("IncidentID ASC"))
		require.NoError(t, err)
		require.Len(t, runMembers, 10)
		require.Equal(t, runMembers, channelMembers)

		var count int64

		// Verify followers number
		err = sqlStore.getBuilder(sqlStore.db, &count, sqlStore.builder.
			Select("COUNT(*)").
			From("IR_Run_Participants").
			Where(sq.Eq{"IsFollower": true}))
		require.NoError(t, err)
		require.Equal(t, int64(1), count)
	})
}

func insertRunWithExpiredReminder(sqlStore *SQLStore, reminderExpiredAgo time.Duration) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":                 id,
			"CreateAt":           model.GetMillis(),
			"PreviousReminder":   24 * time.Hour,
			"CurrentStatus":      app.StatusInProgress,
			"LastStatusUpdateAt": model.GetMillisForTime(time.Now().Add(-24*time.Hour - reminderExpiredAgo)),
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func insertRunWithNoReminder(sqlStore *SQLStore) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":            id,
			"CreateAt":      model.GetMillis(),
			"CurrentStatus": app.StatusInProgress,
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func insertRunWithActiveReminder(sqlStore *SQLStore, previousReminder time.Duration) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":                 id,
			"CreateAt":           model.GetMillis(),
			"PreviousReminder":   previousReminder,
			"CurrentStatus":      app.StatusInProgress,
			"LastStatusUpdateAt": model.GetMillisForTime(time.Now().Add(-24*time.Hour + 10*time.Second)),
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func insertInactiveRunWithExpiredReminder(sqlStore *SQLStore, previousReminder time.Duration) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":                 id,
			"CreateAt":           model.GetMillis(),
			"PreviousReminder":   previousReminder,
			"CurrentStatus":      app.StatusFinished,
			"LastStatusUpdateAt": model.GetMillisForTime(time.Now().Add(-25 * time.Hour)),
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func insertInactiveRunWithNoReminder(sqlStore *SQLStore) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":            id,
			"CreateAt":      model.GetMillis(),
			"CurrentStatus": app.StatusFinished,
			// have to be set:
			"Name":            "test",
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     0,
			"ChecklistsJSON":  "{}",
		}))

	return id, err
}

func getRun(id string, sqlStore *SQLStore) (app.PlaybookRun, error) {
	var run app.PlaybookRun
	err := sqlStore.getBuilder(sqlStore.db, &run, sqlStore.builder.
		Select("ID", "Name", "CreateAt", "PreviousReminder", "CurrentStatus", "LastStatusUpdateAt").
		From("IR_Incident").
		Where(sq.Eq{"ID": id}))
	return run, err
}

func TestHasConsistentCharset(t *testing.T) {
	if getDriverName() != model.DatabaseDriverMysql {
		t.Skip("TestHasConsistentCharset only needed for MySQL")
		return
	}

	t.Run("MySQL", func(t *testing.T) {
		db := setupTestDB(t)
		setupPlaybookStore(t, db) // To run the migrations and everything
		badCharsets := []string{}
		err := db.Select(&badCharsets, `
			SELECT tab.table_name
			FROM   information_schema.tables tab
			WHERE  tab.table_schema NOT IN ( 'mysql', 'information_schema',
											 'performance_schema',
											 'sys' )
			AND tab.table_schema = (SELECT DATABASE())
			AND NOT (tab.table_collation = 'utf8mb4_general_ci' OR tab.table_collation = 'utf8mb4_0900_ai_ci')
		`)
		require.Len(t, badCharsets, 0)
		require.NoError(t, err)
	})
}

func TestHasPrimaryKeys(t *testing.T) {
	t.Run("MySQL", func(t *testing.T) {
		if getDriverName() != model.DatabaseDriverMysql {
			t.Skip("TestHasPrimaryKeys skipping MySQL specific test")
			return
		}

		db := setupTestDB(t)
		setupPlaybookStore(t, db) // To run the migrations and everything
		tablesWithoutPrimaryKeys := []string{}
		err := db.Select(&tablesWithoutPrimaryKeys, `
			SELECT tab.table_name
				   AS tablename
			FROM   information_schema.tables tab
				   LEFT JOIN information_schema.table_constraints tco
						  ON tab.table_schema = tco.table_schema
							 AND tab.table_name = tco.table_name
							 AND tco.constraint_type = 'PRIMARY KEY'
				   LEFT JOIN information_schema.key_column_usage kcu
						  ON tco.constraint_schema = kcu.constraint_schema
							 AND tco.constraint_name = kcu.constraint_name
							 AND tco.table_name = kcu.table_name
			WHERE tab.table_schema = (SELECT DATABASE())
			AND tco.constraint_name is NULL
			GROUP  BY tab.table_schema,
					  tab.table_name,
					  tco.constraint_name
		`)
		require.Len(t, tablesWithoutPrimaryKeys, 0)
		require.NoError(t, err)
	})

	t.Run("Postgres", func(t *testing.T) {
		if getDriverName() != model.DatabaseDriverPostgres {
			t.Skip("TestHasPrimaryKeys skipping Postgres specific test")
			return
		}

		db := setupTestDB(t)
		setupPlaybookStore(t, db) // To run the migrations and everything
		tablesWithoutPrimaryKeys := []string{}
		err := db.Select(&tablesWithoutPrimaryKeys, `
			SELECT tab.table_name AS pk_name
			FROM   information_schema.tables tab
				   LEFT JOIN information_schema.table_constraints tco
						  ON tco.table_schema = tab.table_schema
							 AND tco.table_name = tab.table_name
							 AND tco.constraint_type = 'PRIMARY KEY'
				   LEFT JOIN information_schema.key_column_usage kcu
						  ON kcu.constraint_name = tco.constraint_name
							 AND kcu.constraint_schema = tco.constraint_schema
							 AND kcu.constraint_name = tco.constraint_name
			WHERE  tab.table_schema NOT IN ( 'pg_catalog', 'information_schema' )
				   AND tab.table_type = 'BASE TABLE'
				   AND tab.table_catalog = (SELECT current_database())
				   AND tco.constraint_name is NULL
			GROUP  BY tab.table_schema,
					  tab.table_name,
					  tco.constraint_name
		`)
		tablesToBeFiltered := []string{"teammembers"}
		for _, table := range tablesToBeFiltered {
			tablesWithoutPrimaryKeys = removeFromSlice(tablesWithoutPrimaryKeys, table)
		}
		require.Len(t, tablesWithoutPrimaryKeys, 0)
		require.NoError(t, err)
	})

}

func removeFromSlice(slice []string, item string) []string {
	for i, elem := range slice {
		if elem == item {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}
