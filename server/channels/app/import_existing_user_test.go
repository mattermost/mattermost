// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
)

func userPasswordHash(t *testing.T, th *TestHelper, username string) string {
	t.Helper()
	var h string
	require.NoError(t, th.GetSqlStore().GetMaster().Get(&h,
		"SELECT Password FROM Users WHERE Username=$1", username))
	return h
}

// TestScopedImportPreservesExistingUserPassword guards against a scoped import
// resetting the password of a pre-existing destination account that merely shares
// a username with someone in the export. Exports carry no password, so importUser
// would otherwise generate a random one and call UpdatePassword on the existing
// account, locking out the real user.
func TestScopedImportPreservesExistingUserPassword(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const teamName, chanName = "pwd-team", "pwd-chan"
	const username = "devon.pwd"

	// Pre-existing destination account with a real password.
	createUserInDB(t, th, username)
	hashBefore := userPasswordHash(t, th, username)
	require.NotEmpty(t, hashBefore)

	// Scoped import that includes the same username (no password in the export)
	// and a post authored by them.
	reader := channelScopedJSONL(t, teamName, chanName, []string{username}, []string{username})
	_, appErr := scopedBulkImport(t, th.App, th.Context, reader, model.ImportedUsersInactive)
	require.Nil(t, appErr)

	hashAfter := userPasswordHash(t, th, username)
	require.Equal(t, hashBefore, hashAfter,
		"a pre-existing destination user's password must not be reset by a scoped import sharing their username")
}

// identityArchive is the JSONL for one existing destination account plus a team,
// channel, membership, and a single post authored by that username.
type identityArchive struct {
	scoped       bool
	teamName     string
	chanName     string
	username     string
	email        string
	roles        string
	firstName    string
	lastName     string
	nickname     string
	position     string
	deleteAt     int64
	message      string
	lineUsername string
	emptyAuth    bool
}

func identityArchiveJSONL(t *testing.T, a identityArchive) string {
	t.Helper()

	var sb strings.Builder
	enc := json.NewEncoder(&sb)

	version := 1
	info := &imports.VersionInfoImportData{
		Generator: "test",
		Version:   "1.0",
		Created:   "2024-01-01T00:00:00Z",
	}
	if a.scoped {
		scope, err := json.Marshal(imports.ExportScopeAdditional{TeamName: a.teamName})
		require.NoError(t, err)
		info.Additional = scope
	}
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "version", Version: &version, Info: info}))
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{
			Name:        model.NewPointer(a.teamName),
			DisplayName: model.NewPointer("Identity Team"),
			Type:        model.NewPointer("O"),
		},
	}))
	chanType := model.ChannelTypeOpen
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "channel",
		Channel: &imports.ChannelImportData{
			Team:        model.NewPointer(a.teamName),
			Name:        model.NewPointer(a.chanName),
			DisplayName: model.NewPointer("Identity Channel"),
			Type:        &chanType,
		},
	}))

	lineUsername := a.username
	if a.lineUsername != "" {
		lineUsername = a.lineUsername
	}
	user := &imports.UserImportData{
		Username:  model.NewPointer(lineUsername),
		Email:     model.NewPointer(a.email),
		Roles:     model.NewPointer(a.roles),
		FirstName: model.NewPointer(a.firstName),
		LastName:  model.NewPointer(a.lastName),
		Nickname:  model.NewPointer(a.nickname),
		Position:  model.NewPointer(a.position),
		Teams: &[]imports.UserTeamImportData{{
			Name:     model.NewPointer(a.teamName),
			Channels: &[]imports.UserChannelImportData{{Name: model.NewPointer(a.chanName)}},
		}},
	}
	if a.emptyAuth {
		// Present-but-empty auth fields are the same email/password record as omitted ones.
		empty := ""
		user.AuthService = &empty
		user.AuthData = &empty
	}
	if a.deleteAt != 0 {
		user.DeleteAt = model.NewPointer(a.deleteAt)
	}
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "user", User: user}))

	createAt := int64(1700000000000)
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "post",
		Post: &imports.PostImportData{
			Team:     model.NewPointer(a.teamName),
			Channel:  model.NewPointer(a.chanName),
			User:     model.NewPointer(a.username),
			Message:  model.NewPointer(a.message),
			CreateAt: &createAt,
		},
	}))
	return sb.String()
}

func setDestinationProfile(t *testing.T, th *TestHelper, userID string) {
	t.Helper()
	u, appErr := th.App.GetUser(th.Context, userID)
	require.Nil(t, appErr)
	u.FirstName = "Ada"
	u.LastName = "Lovelace"
	u.Nickname = "ada"
	u.Position = "analyst"
	_, appErr = th.App.UpdateUser(th.Context, u, false)
	require.Nil(t, appErr)
}

func setDestinationEmailVerified(t *testing.T, th *TestHelper, userID string, verified bool) {
	t.Helper()
	_, err := th.GetSqlStore().GetMaster().Exec(
		"UPDATE Users SET EmailVerified = $1 WHERE Id = $2", verified, userID)
	require.NoError(t, err)
	th.App.InvalidateCacheForUser(userID)
}

func postAuthorByMessage(t *testing.T, th *TestHelper, teamName, chanName, message string) string {
	t.Helper()
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr)
	ch, appErr := th.App.GetChannelByName(th.Context, chanName, team.Id, false)
	require.Nil(t, appErr)
	list, err := th.App.Srv().Store().Post().GetPosts(th.Context, model.GetPostsOptions{
		ChannelId: ch.Id,
		Page:      0,
		PerPage:   100,
	}, false, map[string]bool{})
	require.NoError(t, err)
	for _, p := range list.Posts {
		if p.Message == message {
			return p.UserId
		}
	}
	return ""
}

// TestScopedImportPreservesExistingUserIdentity checks a scoped import that finds
// an existing email/password account by username. The account keeps its email,
// verification, roles, DeleteAt, and profile, the report records the match, and
// the same account is used for team membership and post attribution.
func TestScopedImportPreservesExistingUserIdentity(t *testing.T) {
	mainHelper.Parallel(t)

	const (
		archiveFirst    = "Pat"
		archiveLast     = "Smith"
		archiveNick     = "pat"
		archivePosition = "imported"
		archiveDeleteAt = int64(1600000000000)
		matchReason     = "username_matched_existing"
	)
	matchAction := imports.UnmatchedUserAction("linked_existing")
	adminRoles := model.SystemUserRoleId + " " + model.SystemAdminRoleId

	cases := []struct {
		name              string
		soleAdmin         bool
		destAdmin         bool
		unverified        bool
		sameEmail         bool
		deactivated       bool
		upperUsername     bool
		emptyAuth         bool
		posture           model.ImportedUsersPosture
		archiveRoles      string
		assertEmailLookup bool
	}{
		{
			name:         "email and verification",
			unverified:   true,
			archiveRoles: adminRoles,
		},
		{
			name:         "system admin with another admin present",
			destAdmin:    true,
			sameEmail:    true,
			archiveRoles: model.SystemUserRoleId,
		},
		{
			name:         "system user roles",
			sameEmail:    true,
			archiveRoles: adminRoles,
		},
		{
			name:         "only system admin",
			soleAdmin:    true,
			unverified:   true,
			archiveRoles: model.SystemUserRoleId,
		},
		{
			name:              "archive email lookup",
			unverified:        true,
			archiveRoles:      adminRoles,
			assertEmailLookup: true,
		},
		{
			name:         "active imported users posture",
			unverified:   true,
			archiveRoles: adminRoles,
			posture:      model.ImportedUsersActive,
		},
		{
			name:         "deactivated destination account",
			unverified:   true,
			deactivated:  true,
			archiveRoles: adminRoles,
		},
		{
			name:          "username letter case",
			unverified:    true,
			upperUsername: true,
			archiveRoles:  adminRoles,
		},
		{
			name:         "empty auth service and auth data",
			unverified:   true,
			emptyAuth:    true,
			archiveRoles: adminRoles,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			var dest *model.User
			if tc.soleAdmin {
				dest = th.SystemAdminUser
			} else {
				dest = createUserInDB(t, th, model.NewUsername())
			}
			setDestinationProfile(t, th, dest.Id)
			if tc.destAdmin {
				_, appErr := th.App.UpdateUserRoles(th.Context, dest.Id, adminRoles, false)
				require.Nil(t, appErr)
			}
			// Accounts from createUserInDB start unverified. Each row sets the
			// verification state the assertions compare against.
			setDestinationEmailVerified(t, th, dest.Id, !tc.unverified)
			if tc.deactivated {
				fresh, appErr := th.App.GetUser(th.Context, dest.Id)
				require.Nil(t, appErr)
				_, appErr = th.App.UpdateActive(th.Context, fresh, false)
				require.Nil(t, appErr)
			}

			before := fetchUser(t, th, dest.Username)
			require.Equal(t, !tc.unverified, before.EmailVerified, "destination email verification")
			if tc.destAdmin || tc.soleAdmin {
				require.Contains(t, before.Roles, model.SystemAdminRoleId, "destination account starts as a system admin")
			}

			teamName := model.NewRandomTeamName()
			chanName := model.NewId()
			message := "note from " + before.Username
			archiveEmail := model.NewId() + "@archive.example.com"
			if tc.sameEmail {
				archiveEmail = before.Email
			}
			lineUsername := ""
			reportedUsername := before.Username
			if tc.upperUsername {
				lineUsername = strings.ToUpper(before.Username)
				reportedUsername = lineUsername
			}
			posture := tc.posture
			if posture == "" {
				posture = model.ImportedUsersInactive
			}

			jsonl := identityArchiveJSONL(t, identityArchive{
				scoped:       true,
				teamName:     teamName,
				chanName:     chanName,
				username:     before.Username,
				lineUsername: lineUsername,
				emptyAuth:    tc.emptyAuth,
				email:        archiveEmail,
				roles:        tc.archiveRoles,
				firstName:    archiveFirst,
				lastName:     archiveLast,
				nickname:     archiveNick,
				position:     archivePosition,
				deleteAt:     archiveDeleteAt,
				message:      message,
			})
			_, report, appErr := th.App.BulkImportWithPathAndOpts(
				th.Context, strings.NewReader(jsonl), nil, false, true, 1, "",
				model.BulkImportOpts{ImportedUsers: posture},
			)
			require.Nil(t, appErr)
			require.NotNil(t, report)

			after := fetchUser(t, th, before.Username)

			// Email, verification, roles, DeleteAt, and profile are checked before membership and posts.
			if tc.assertEmailLookup {
				lookedUp, lookupErr := th.App.GetUserByEmail(archiveEmail)
				require.False(t, lookupErr == nil && lookedUp != nil && lookedUp.Id == before.Id,
					"lookup by archive email returned the destination account")
			}
			require.Equal(t, before.Email, after.Email, "email")
			require.Equal(t, before.EmailVerified, after.EmailVerified, "email verification")
			require.Equal(t, before.Roles, after.Roles, "roles")
			require.Equal(t, before.DeleteAt, after.DeleteAt, "DeleteAt")
			require.Equal(t, before.FirstName, after.FirstName, "first name")
			require.Equal(t, before.LastName, after.LastName, "last name")
			require.Equal(t, before.Nickname, after.Nickname, "nickname")
			require.Equal(t, before.Position, after.Position, "position")

			var matched *imports.UnmatchedUser
			for _, entry := range report.UnmatchedUsers.All() {
				if entry.Username == reportedUsername && entry.Reason == matchReason {
					e := entry
					matched = &e
					break
				}
			}
			require.NotNil(t, matched, "report entry for the username match")
			require.Equal(t, matchAction, matched.Action, "report action")

			team, teamErr := th.App.GetTeamByName(teamName)
			require.Nil(t, teamErr)
			member, memberErr := th.App.GetTeamMember(th.Context, team.Id, before.Id)
			require.Nil(t, memberErr, "team membership")
			require.Equal(t, before.Id, member.UserId, "team membership")
			channel, chanErr := th.App.GetChannelByName(th.Context, chanName, team.Id, false)
			require.Nil(t, chanErr)
			chanMember, chanMemberErr := th.App.GetChannelMember(th.Context, channel.Id, before.Id)
			require.Nil(t, chanMemberErr, "channel membership")
			require.Equal(t, before.Id, chanMember.UserId, "channel membership")
			require.Equal(t, before.Id, postAuthorByMessage(t, th, teamName, chanName, message), "post attribution")
		})
	}
}

// TestScopedImportReportsDuplicateUsernameMatchOnce checks that repeated user lines
// for one existing account produce a single linked_existing report entry.
func TestScopedImportReportsDuplicateUsernameMatchOnce(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	dest := createUserInDB(t, th, model.NewUsername())
	reader := channelScopedJSONL(t, model.NewRandomTeamName(), model.NewId(), nil,
		[]string{dest.Username, dest.Username, strings.ToUpper(dest.Username)})

	_, report, appErr := th.App.BulkImportWithPathAndOpts(
		th.Context, reader, nil, false, true, 1, "",
		model.BulkImportOpts{ImportedUsers: model.ImportedUsersInactive},
	)
	require.Nil(t, appErr)
	require.NotNil(t, report)

	require.Equal(t, 1, report.UnmatchedUsers.CountAction(imports.UnmatchedUserLinkedExisting))
	var sb strings.Builder
	rows, err := report.WriteUnmatchedUsersCSV(&sb)
	require.NoError(t, err)
	require.Equal(t, 1, rows)
}

// TestImportExistingUserIdentityBaseline checks that a full import still applies
// the archive email and roles to an existing account found by username.
func TestImportExistingUserIdentityBaseline(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	dest := createUserInDB(t, th, model.NewUsername())
	before := fetchUser(t, th, dest.Username)
	require.Equal(t, model.SystemUserRoleId, before.Roles)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()
	archiveEmail := model.NewId() + "@archive.example.com"
	archiveRoles := model.SystemUserRoleId + " " + model.SystemAdminRoleId

	jsonl := identityArchiveJSONL(t, identityArchive{
		scoped:    false,
		teamName:  teamName,
		chanName:  chanName,
		username:  before.Username,
		email:     archiveEmail,
		roles:     archiveRoles,
		firstName: before.FirstName,
		lastName:  before.LastName,
		nickname:  before.Nickname,
		position:  before.Position,
		message:   "note from " + before.Username,
	})
	_, _, appErr := th.App.BulkImportWithPathAndOpts(
		th.Context, strings.NewReader(jsonl), nil, false, true, 1, "",
		model.BulkImportOpts{},
	)
	require.Nil(t, appErr)

	after := fetchUser(t, th, before.Username)
	require.Equal(t, before.Id, after.Id, "username match updates the existing account")
	require.Equal(t, archiveEmail, after.Email, "email")
	require.Equal(t, archiveRoles, after.Roles, "roles")
}
