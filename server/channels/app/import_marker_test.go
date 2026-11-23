// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func runMarkerTestImport(t *testing.T, th *TestHelper, r io.Reader, runID string) (*imports.ImportReport, *model.AppError) {
	t.Helper()
	_, report, appErr := th.App.BulkImportWithPathAndOpts(th.Context, r, nil, false, false, 1, "", model.BulkImportOpts{
		ImportedUsers: model.ImportedUsersInactive,
		RunID:         runID,
	})
	return report, appErr
}

func importMarkers(t *testing.T, th *TestHelper) []*model.PropertyValue {
	t.Helper()
	require.NotEmpty(t, th.App.ch.importMarkerFieldID, "the marker field must be set up at startup")
	values, err := th.App.Srv().Store().PropertyValue().SearchPropertyValues(th.Context, model.PropertyValueSearchOpts{
		GroupID:        th.App.ch.importMarkerGroupID,
		FieldID:        th.App.ch.importMarkerFieldID,
		IncludeDeleted: true,
		PerPage:        100,
	})
	require.NoError(t, err)
	return values
}

func markerTestArchive(user imports.UserImportData) identityTestArchive {
	return identityTestArchive{
		scoped:      true,
		teamName:    model.NewRandomTeamName(),
		channelName: model.NewId(),
		user:        user,
		membership: &imports.UserTeamImportData{
			Roles:    new(model.TeamUserRoleId + " " + model.TeamAdminRoleId),
			Channels: &[]imports.UserChannelImportData{{}},
		},
	}
}

func cleanupPending(t *testing.T, th *TestHelper, runMarker string) bool {
	t.Helper()
	require.NotEmpty(t, runMarker)
	pending, err := th.App.importMarkerCleanupPending(th.Context, runMarker)
	require.NoError(t, err)
	return pending
}

// blockWrites makes matching row writes fail in the database, so cleanup
// failures are exercised without a test seam in the app. It returns a function
// that lifts the block.
func blockWrites(t *testing.T, th *TestHelper, trigger, event, table, condition string) func() {
	t.Helper()
	_, err := th.SQLStore.GetMaster().Exec(`CREATE OR REPLACE FUNCTION test_block_write() RETURNS trigger AS $$
		BEGIN RAISE EXCEPTION 'write blocked by test'; END $$ LANGUAGE plpgsql`)
	require.NoError(t, err)
	_, err = th.SQLStore.GetMaster().Exec(`CREATE TRIGGER ` + trigger + ` BEFORE ` + event + ` ON ` + table +
		` FOR EACH ROW WHEN (` + condition + `) EXECUTE FUNCTION test_block_write()`)
	require.NoError(t, err)
	unblock := func() {
		_, err := th.SQLStore.GetMaster().Exec(`DROP TRIGGER IF EXISTS ` + trigger + ` ON ` + table)
		require.NoError(t, err)
	}
	t.Cleanup(unblock)
	return unblock
}

func blockMarkerDeletion(t *testing.T, th *TestHelper, userID string) func() {
	t.Helper()
	require.True(t, model.IsValidId(userID))
	return blockWrites(t, th, "test_block_marker_delete", "DELETE", "PropertyValues", "OLD.TargetID = '"+userID+"'")
}

func blockCleanupRecord(t *testing.T, th *TestHelper, runID string) func() {
	t.Helper()
	sum := sha256.Sum256([]byte(runID))
	key := importMarkerCleanupKey(hex.EncodeToString(sum[:]))
	return blockWrites(t, th, "test_block_cleanup_record", "INSERT OR UPDATE", "Systems", "NEW.Name = '"+key+"'")
}

// interruptedMarkerImport creates the archive user and its marker without
// completing the import.
func interruptedMarkerImport(t *testing.T, th *TestHelper, runID string) (identityTestArchive, *model.User) {
	t.Helper()
	archive := markerTestArchive(archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId))
	archive.postMessage = "interrupted before this"
	archive.postCreate = model.GetMillis()
	_, appErr := runMarkerTestImport(t, th, &truncatedErrReader{data: firstNLines(archive.jsonl(t), 4)}, runID)
	require.NotNil(t, appErr)
	created, err := th.App.Srv().Store().User().GetByUsername(*archive.user.Username)
	require.NoError(t, err)
	require.Len(t, importMarkers(t, th), 1)
	return archive, created
}

func editFirstName(t *testing.T, th *TestHelper, userID, firstName string) {
	t.Helper()
	user, err := th.App.Srv().Store().User().Get(th.Context, userID)
	require.NoError(t, err)
	user.FirstName = firstName
	_, appErr := th.App.UpdateUser(th.Context, user, false)
	require.Nil(t, appErr)
}

func reportReasons(report *imports.ImportReport, username string) []string {
	var reasons []string
	for _, row := range report.UnmatchedUsers.All() {
		if row.Username == username {
			reasons = append(reasons, row.Reason+"/"+string(row.Action))
		}
	}
	return reasons
}

func TestScopedImportRunMarker(t *testing.T) {
	mainHelper.Parallel(t)

	testsDir, _ := fileutils.FindDir("tests")

	t.Run("retry of an interrupted import finishes setting up the accounts it created", func(t *testing.T) {
		th := setupIdentityTest(t)
		runID := model.NewId() + "_export.zip"

		user := archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId)
		importDir := t.TempDir()
		require.NoError(t, os.WriteFile(filepath.Join(importDir, "broken.png"), []byte("not an image"), 0600))
		png, err := os.ReadFile(filepath.Join(testsDir, "test.png"))
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(filepath.Join(importDir, "test.png"), png, 0600))
		runInDir := func(archive identityTestArchive) (*imports.ImportReport, *model.AppError) {
			_, report, appErr := th.App.BulkImportWithPathAndOpts(th.Context, strings.NewReader(archive.jsonl(t)), nil, false, false, 1, importDir, model.BulkImportOpts{
				ImportedUsers: model.ImportedUsersInactive,
				RunID:         runID,
			})
			return report, appErr
		}

		user.Avatar.ProfileImage = new("broken.png")
		archive := markerTestArchive(user)
		_, appErr := runInDir(archive)
		require.NotNil(t, appErr, "the undecodable avatar must interrupt the first run after the account is created")

		created, err := th.App.Srv().Store().User().GetByUsername(*user.Username)
		require.NoError(t, err)
		require.NotZero(t, created.DeleteAt, "the account is created deactivated")
		require.Zero(t, created.LastPictureUpdate)
		require.Len(t, importMarkers(t, th), 1)

		archive.user.Avatar.ProfileImage = new("test.png")
		report, appErr := runInDir(archive)
		require.Nil(t, appErr)

		after, err := th.App.Srv().Store().User().Get(th.Context, created.Id)
		require.NoError(t, err)
		assert.NotZero(t, after.LastPictureUpdate, "the retry must apply the avatar")
		assert.NotZero(t, after.DeleteAt, "the account stays deactivated")

		themePrefs, err := th.App.Srv().Store().Preference().GetCategory(created.Id, model.PreferenceCategoryTheme)
		require.NoError(t, err)
		assert.NotEmpty(t, themePrefs, "the retry must apply preferences")

		team, err := th.App.Srv().Store().Team().GetByName(archive.teamName)
		require.NoError(t, err)
		member, err := th.App.Srv().Store().Team().GetMember(th.Context, team.Id, created.Id)
		require.NoError(t, err)
		assert.True(t, member.SchemeAdmin, "the retry must apply the export's team roles")

		assert.Equal(t, []string{"username_not_found/" + string(imports.UnmatchedUserCreatedInactive)}, reportReasons(report, *user.Username))
		assert.Empty(t, importMarkers(t, th), "a completed import deletes its markers")
	})

	t.Run("accounts of a completed import are username collisions", func(t *testing.T) {
		th := setupIdentityTest(t)
		runID := model.NewId() + "_export.zip"

		user := archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId)
		archive := markerTestArchive(user)
		_, appErr := runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.Nil(t, appErr)
		require.Empty(t, importMarkers(t, th), "a completed import deletes its markers")

		before, err := th.App.Srv().Store().User().GetByUsername(*user.Username)
		require.NoError(t, err)

		archive.user.FirstName = new("Changed")
		report, appErr := runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.Nil(t, appErr)

		after, err := th.App.Srv().Store().User().Get(th.Context, before.Id)
		require.NoError(t, err)
		assert.Equal(t, before.FirstName, after.FirstName, "re-importing a completed file leaves the account unchanged")
		assert.Equal(t, []string{"username_matched_existing/" + string(imports.UnmatchedUserLinkedExisting)}, reportReasons(report, *user.Username))
		assert.False(t, cleanupPending(t, th, report.RunMarker))
	})

	t.Run("a failed marker cleanup fails the import and a retry only finishes the cleanup", func(t *testing.T) {
		th := setupIdentityTest(t)
		runID := model.NewId() + "_export.zip"

		archive, created := interruptedMarkerImport(t, th, runID)
		username := *archive.user.Username

		unblock := blockMarkerDeletion(t, th, created.Id)
		report, appErr := runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.NotNil(t, appErr)
		assert.Equal(t, imports.ImportMarkerCleanupErrorID, appErr.Id)
		assert.Equal(t, []string{"username_not_found/" + string(imports.UnmatchedUserCreatedInactive)}, reportReasons(report, username), "the failed run still reports the work it completed")
		require.Len(t, importMarkers(t, th), 1)
		require.True(t, cleanupPending(t, th, report.RunMarker))

		unblock()
		editFirstName(t, th, created.Id, "EditedAfterImport")

		archive.user.FirstName = new("Changed")
		report, appErr = runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.Nil(t, appErr)
		assert.Empty(t, report.UnmatchedUsers.All(), "the cleanup-only retry imports nothing")
		assert.Empty(t, importMarkers(t, th))
		assert.False(t, cleanupPending(t, th, report.RunMarker))

		after, err := th.App.Srv().Store().User().Get(th.Context, created.Id)
		require.NoError(t, err)
		assert.Equal(t, "EditedAfterImport", after.FirstName, "the cleanup-only retry must not update the account")

		report, appErr = runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.Nil(t, appErr)
		assert.Equal(t, []string{"username_matched_existing/" + string(imports.UnmatchedUserLinkedExisting)}, reportReasons(report, username))
	})

	t.Run("a failed save of the pending cleanup still removes the markers", func(t *testing.T) {
		th := setupIdentityTest(t)
		runID := model.NewId() + "_export.zip"

		archive, created := interruptedMarkerImport(t, th, runID)
		username := *archive.user.Username

		unblock := blockCleanupRecord(t, th, runID)
		report, appErr := runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.Nil(t, appErr, "removing the markers completes the import without the pending row")
		assert.Equal(t, []string{"username_not_found/" + string(imports.UnmatchedUserCreatedInactive)}, reportReasons(report, username))
		assert.Empty(t, importMarkers(t, th))
		unblock()
		assert.False(t, cleanupPending(t, th, report.RunMarker))

		editFirstName(t, th, created.Id, "EditedAfterImport")
		archive.user.FirstName = new("Changed")
		report, appErr = runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.Nil(t, appErr)
		assert.Equal(t, []string{"username_matched_existing/" + string(imports.UnmatchedUserLinkedExisting)}, reportReasons(report, username))

		after, err := th.App.Srv().Store().User().Get(th.Context, created.Id)
		require.NoError(t, err)
		assert.Equal(t, "EditedAfterImport", after.FirstName, "a retry after the import completed must not update the account")
	})

	t.Run("a failed save during a cleanup-only retry still deletes the earlier pending row", func(t *testing.T) {
		th := setupIdentityTest(t)
		runID := model.NewId() + "_export.zip"

		archive, created := interruptedMarkerImport(t, th, runID)
		username := *archive.user.Username

		unblockMarkers := blockMarkerDeletion(t, th, created.Id)
		report, appErr := runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.NotNil(t, appErr)
		require.Equal(t, imports.ImportMarkerCleanupErrorID, appErr.Id)
		require.True(t, cleanupPending(t, th, report.RunMarker))
		unblockMarkers()

		unblockRecord := blockCleanupRecord(t, th, runID)
		_, appErr = runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.Nil(t, appErr)
		unblockRecord()
		assert.Empty(t, importMarkers(t, th))
		assert.False(t, cleanupPending(t, th, report.RunMarker), "the earlier row must not keep later runs on the cleanup-only path")

		report, appErr = runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.Nil(t, appErr)
		assert.Equal(t, []string{"username_matched_existing/" + string(imports.UnmatchedUserLinkedExisting)}, reportReasons(report, username))
	})

	t.Run("failing to both save the pending cleanup and remove the markers is reported as unrecorded", func(t *testing.T) {
		th := setupIdentityTest(t)
		runID := model.NewId() + "_export.zip"

		archive, created := interruptedMarkerImport(t, th, runID)
		username := *archive.user.Username

		unblockRecord := blockCleanupRecord(t, th, runID)
		unblockMarkers := blockMarkerDeletion(t, th, created.Id)
		report, appErr := runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.import.bulk_import.import_marker_cleanup_unrecorded.app_error", appErr.Id)
		assert.NotEqual(t, imports.ImportMarkerCleanupErrorID, appErr.Id, "the error must not promise a cleanup-only retry")
		require.Len(t, importMarkers(t, th), 1)
		unblockRecord()
		unblockMarkers()
		assert.False(t, cleanupPending(t, th, report.RunMarker))

		report, appErr = runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), runID)
		require.Nil(t, appErr)
		assert.Equal(t, []string{"username_not_found/" + string(imports.UnmatchedUserCreatedInactive)}, reportReasons(report, username), "with nothing recorded, a retry sets the account up again")
		assert.Empty(t, importMarkers(t, th))
	})

	t.Run("a different run or a changed email is a username collision", func(t *testing.T) {
		for _, tc := range []struct {
			name        string
			retryRunID  func(runID string) string
			changeEmail bool
		}{
			{name: "different run", retryRunID: func(string) string { return model.NewId() + "_export.zip" }},
			{name: "changed email", retryRunID: func(runID string) string { return runID }, changeEmail: true},
		} {
			t.Run(tc.name, func(t *testing.T) {
				th := setupIdentityTest(t)
				runID := model.NewId() + "_export.zip"

				user := archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId)
				archive := markerTestArchive(user)
				archive.postMessage = "interrupted before this"
				archive.postCreate = model.GetMillis()
				jsonl := archive.jsonl(t)
				_, appErr := runMarkerTestImport(t, th, &truncatedErrReader{data: firstNLines(jsonl, 4)}, runID)
				require.NotNil(t, appErr)
				require.Len(t, importMarkers(t, th), 1)

				before, err := th.App.Srv().Store().User().GetByUsername(*user.Username)
				require.NoError(t, err)
				if tc.changeEmail {
					before.Email = "changed-" + model.NewId() + "@example.com"
					_, err = th.App.Srv().Store().User().Update(th.Context, before, true)
					require.NoError(t, err)
					before, err = th.App.Srv().Store().User().Get(th.Context, before.Id)
					require.NoError(t, err)
				}

				archive.user.FirstName = new("Changed")
				report, appErr := runMarkerTestImport(t, th, strings.NewReader(archive.jsonl(t)), tc.retryRunID(runID))
				require.Nil(t, appErr)

				after, err := th.App.Srv().Store().User().Get(th.Context, before.Id)
				require.NoError(t, err)
				assert.Equal(t, before.FirstName, after.FirstName)
				assert.Equal(t, before.Email, after.Email)
				assert.Equal(t, []string{"username_matched_existing/" + string(imports.UnmatchedUserLinkedExisting)}, reportReasons(report, *user.Username))
			})
		}
	})

	t.Run("an account created inactive stays inactive after a retry", func(t *testing.T) {
		th := setupIdentityTest(t)
		runID := model.NewId() + "_export.zip"

		user := archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId)
		user.DeleteAt = new(int64(0))
		archive := markerTestArchive(user)
		archive.postMessage = "interrupted before this"
		archive.postCreate = model.GetMillis()
		jsonl := archive.jsonl(t)

		_, appErr := runMarkerTestImport(t, th, &truncatedErrReader{data: firstNLines(jsonl, 4)}, runID)
		require.NotNil(t, appErr)

		created, err := th.App.Srv().Store().User().GetByUsername(*user.Username)
		require.NoError(t, err)
		require.NotZero(t, created.DeleteAt, "the account is created deactivated")
		assert.Equal(t, "true", created.Props[model.UserPropsKeyImportedInactive])

		_, appErr = runMarkerTestImport(t, th, strings.NewReader(jsonl), runID)
		require.Nil(t, appErr)

		after, err := th.App.Srv().Store().User().Get(th.Context, created.Id)
		require.NoError(t, err)
		assert.Equal(t, created.DeleteAt, after.DeleteAt, "an export delete_at of 0 must not reactivate the account on retry")
	})

	t.Run("a retry updates the import's own bot and leaves an existing bot alone", func(t *testing.T) {
		th := setupIdentityTest(t)
		runID := model.NewId() + "_export.zip"

		destOwner := createIdentityTestUser(t, th, model.SystemUserRoleId)
		destBot, appErr := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "destbot" + model.NewId()[:10],
			Description: "dest bot",
			OwnerId:     destOwner.Id,
		})
		require.Nil(t, appErr)

		ownBotArchive := markerTestArchive(archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId))
		ownBotArchive.bot = &imports.BotImportData{
			Username:    new("importbot" + model.NewId()[:10]),
			Owner:       new(destOwner.Username),
			DisplayName: new("Import Bot"),
			Description: new("first run"),
		}
		ownBotArchive.postMessage = "interrupted before this"
		ownBotArchive.postCreate = model.GetMillis()

		_, appErr = runMarkerTestImport(t, th, &truncatedErrReader{data: firstNLines(ownBotArchive.jsonl(t), 5)}, runID)
		require.NotNil(t, appErr)
		ownBot, err := th.App.Srv().Store().Bot().GetByUsername(*ownBotArchive.bot.Username)
		require.NoError(t, err)
		require.Equal(t, "first run", ownBot.Description)

		ownBotArchive.bot.Description = new("retry")
		_, appErr = runMarkerTestImport(t, th, strings.NewReader(ownBotArchive.jsonl(t)), runID)
		require.Nil(t, appErr)
		ownBot, err = th.App.Srv().Store().Bot().Get(ownBot.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, "retry", ownBot.Description, "the retry must update the bot the import created")

		existingBotArchive := markerTestArchive(archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId))
		existingBotArchive.bot = &imports.BotImportData{
			Username:    new(destBot.Username),
			Owner:       new(destOwner.Username),
			Description: new("archive bot"),
		}
		_, appErr = runMarkerTestImport(t, th, strings.NewReader(existingBotArchive.jsonl(t)), runID)
		require.Nil(t, appErr)
		after, err := th.App.Srv().Store().Bot().Get(destBot.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, destBot.Description, after.Description, "an existing bot without this run's marker must not be updated")
	})

	t.Run("no run ID writes no markers", func(t *testing.T) {
		th := setupIdentityTest(t)

		archive := markerTestArchive(archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId))
		archive.postMessage = "interrupted before this"
		archive.postCreate = model.GetMillis()
		_, appErr := runMarkerTestImport(t, th, &truncatedErrReader{data: firstNLines(archive.jsonl(t), 4)}, "")
		require.NotNil(t, appErr)

		_, err := th.App.Srv().Store().User().GetByUsername(*archive.user.Username)
		require.NoError(t, err)
		assert.Empty(t, importMarkers(t, th))
	})

	t.Run("an unscoped import writes no markers", func(t *testing.T) {
		th := setupIdentityTest(t)

		archive := markerTestArchive(archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId))
		archive.scoped = false
		archive.postMessage = "interrupted before this"
		archive.postCreate = model.GetMillis()
		_, appErr := runMarkerTestImport(t, th, &truncatedErrReader{data: firstNLines(archive.jsonl(t), 4)}, model.NewId())
		require.NotNil(t, appErr)

		_, err := th.App.Srv().Store().User().GetByUsername(*archive.user.Username)
		require.NoError(t, err)
		assert.Empty(t, importMarkers(t, th))
	})
}
