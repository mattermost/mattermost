// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
)

type identityTestArchive struct {
	scoped      bool
	teamName    string
	channelName string
	user        imports.UserImportData
	postMessage string
	postCreate  int64
	// membership, when set, replaces the default team/channel membership of the
	// archive user (Name fields are filled in from teamName/channelName).
	membership *imports.UserTeamImportData
	bot        *imports.BotImportData
}

func (a identityTestArchive) jsonl(t *testing.T) string {
	t.Helper()

	info := &imports.VersionInfoImportData{
		Generator: "mattermost-server",
		Version:   "test",
		Created:   "2026-01-01T00:00:00Z",
	}
	if a.scoped {
		additional, err := json.Marshal(imports.ExportScopeAdditional{TeamName: a.teamName})
		require.NoError(t, err)
		info.Additional = additional
	}

	user := a.user
	membership := imports.UserTeamImportData{
		Channels: &[]imports.UserChannelImportData{{}},
	}
	if a.membership != nil {
		membership = *a.membership
	}
	membership.Name = new(a.teamName)
	for i := range *membership.Channels {
		(*membership.Channels)[i].Name = new(a.channelName)
	}
	user.Teams = &[]imports.UserTeamImportData{membership}

	lines := []imports.LineImportData{
		{Type: "version", Version: new(1), Info: info},
		{Type: "team", Team: &imports.TeamImportData{
			Name:        new(a.teamName),
			DisplayName: new("Identity Test Team"),
			Type:        new(model.TeamOpen),
		}},
		{Type: "channel", Channel: &imports.ChannelImportData{
			Team:        new(a.teamName),
			Name:        new(a.channelName),
			DisplayName: new("Identity Test Channel"),
			Type:        new(model.ChannelTypeOpen),
		}},
		{Type: "user", User: &user},
	}
	if a.bot != nil {
		lines = append(lines, imports.LineImportData{Type: "bot", Bot: a.bot})
	}
	if a.postMessage != "" {
		lines = append(lines, imports.LineImportData{Type: "post", Post: &imports.PostImportData{
			Team:     new(a.teamName),
			Channel:  new(a.channelName),
			User:     user.Username,
			Message:  new(a.postMessage),
			CreateAt: new(a.postCreate),
		}})
	}

	var sb strings.Builder
	for _, line := range lines {
		b, err := json.Marshal(line)
		require.NoError(t, err)
		sb.Write(b)
		sb.WriteString("\n")
	}
	return sb.String()
}

func runIdentityTestImport(t *testing.T, th *TestHelper, archive identityTestArchive) {
	t.Helper()
	_, _, appErr := th.App.BulkImportWithPathAndOpts(th.Context, strings.NewReader(archive.jsonl(t)), nil, false, false, 1, "", model.BulkImportOpts{ImportedUsers: model.ImportedUsersInactive})
	require.Nil(t, appErr)
}

// createIdentityTestUser creates an email/password destination account with
// populated profile fields and the given system roles, and returns the stored
// record as a baseline snapshot.
func createIdentityTestUser(t *testing.T, th *TestHelper, roles string) *model.User {
	t.Helper()
	id := model.NewId()
	user, appErr := th.App.CreateUser(th.Context, &model.User{
		Email:     "victim-" + id + "@example.com",
		Username:  "victim" + id[:10],
		Password:  model.NewTestPassword(),
		FirstName: "DestFirst",
		LastName:  "DestLast",
		Nickname:  "DestNick",
		Position:  "DestPosition",
		Locale:    "en",
	})
	require.Nil(t, appErr)

	if roles != user.Roles {
		_, appErr = th.App.UpdateUserRoles(th.Context, user.Id, roles, false)
		require.Nil(t, appErr)
	}

	stored, err := th.App.Srv().Store().User().Get(th.Context, user.Id)
	require.NoError(t, err)
	return stored
}

// setupIdentityTest returns a fresh helper whose first account (which the server
// promotes to system admin automatically) already exists, so test accounts get
// exactly the roles they ask for.
func setupIdentityTest(t *testing.T) *TestHelper {
	t.Helper()
	th := Setup(t)
	bootstrap := th.CreateUser(t)
	require.True(t, bootstrap.IsSystemAdmin())
	return th
}

func archiveUserFor(username string, roles string) imports.UserImportData {
	return imports.UserImportData{
		Username:  new(username),
		Email:     new("archive-" + model.NewId() + "@example.com"),
		Roles:     new(roles),
		FirstName: new("ArchiveFirst"),
		LastName:  new("ArchiveLast"),
		Nickname:  new("ArchiveNick"),
		Position:  new("ArchivePosition"),
		Locale:    new("fr"),
		Theme:     new(`{"type":"Onyx"}`),
		NotifyProps: &imports.UserNotifyPropsImportData{
			Desktop: new(model.UserNotifyNone),
			Email:   new("false"),
		},
	}
}

func assertIdentityUnchanged(t *testing.T, th *TestHelper, before *model.User, archiveEmail string) {
	t.Helper()

	after, err := th.App.Srv().Store().User().Get(th.Context, before.Id)
	require.NoError(t, err)

	assert.Equal(t, before.Email, after.Email, "scoped import must not replace the email of an existing account matched only by username")
	assert.Equal(t, before.EmailVerified, after.EmailVerified, "scoped import must not change EmailVerified of an existing account")
	assert.Equal(t, before.Roles, after.Roles, "scoped import must not change system roles of an existing account")
	assert.Equal(t, before.Password, after.Password, "scoped import must not change the password of an existing account")
	assert.Equal(t, before.AuthService, after.AuthService, "scoped import must not change auth service of an existing account")
	assert.Equal(t, before.AuthData, after.AuthData, "scoped import must not change auth data of an existing account")
	assert.Equal(t, before.DeleteAt, after.DeleteAt, "scoped import must not change DeleteAt of an existing account")
	assert.Equal(t, before.FirstName, after.FirstName, "scoped import must not change FirstName of an existing account")
	assert.Equal(t, before.LastName, after.LastName, "scoped import must not change LastName of an existing account")
	assert.Equal(t, before.Nickname, after.Nickname, "scoped import must not change Nickname of an existing account")
	assert.Equal(t, before.Position, after.Position, "scoped import must not change Position of an existing account")
	assert.Equal(t, before.Locale, after.Locale, "scoped import must not change Locale of an existing account")
	assert.Equal(t, before.NotifyProps, after.NotifyProps, "scoped import must not change notify props of an existing account")

	themePrefs, err := th.App.Srv().Store().Preference().GetCategory(before.Id, model.PreferenceCategoryTheme)
	require.NoError(t, err)
	assert.Empty(t, themePrefs, "scoped import must not write preferences for an existing account")

	byEmail, err := th.App.Srv().Store().User().GetByEmail(archiveEmail)
	if err == nil {
		assert.NotEqual(t, before.Id, byEmail.Id, "archive email must not resolve to the existing destination account")
	}
}

func TestScopedImportPreservesExistingUserIdentity(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("roles and email", func(t *testing.T) {
		testCases := []struct {
			name         string
			destRoles    string
			archiveRoles string
			soleAdmin    bool
		}{
			{
				name:         "email of user matched by username is not replaced",
				destRoles:    model.SystemUserRoleId,
				archiveRoles: model.SystemUserRoleId,
			},
			{
				name:         "system admin is not demoted when another admin exists",
				destRoles:    model.SystemAdminRoleId + " " + model.SystemUserRoleId,
				archiveRoles: model.SystemUserRoleId,
			},
			{
				name:         "system user is not promoted to system admin",
				destRoles:    model.SystemUserRoleId,
				archiveRoles: model.SystemAdminRoleId + " " + model.SystemUserRoleId,
			},
			{
				name:         "sole system admin keeps email and roles",
				destRoles:    model.SystemAdminRoleId + " " + model.SystemUserRoleId,
				archiveRoles: model.SystemUserRoleId,
				soleAdmin:    true,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				th := setupIdentityTest(t)

				victim := createIdentityTestUser(t, th, tc.destRoles)

				if tc.soleAdmin {
					admins, err := th.App.Srv().Store().User().GetSystemAdminProfiles()
					require.NoError(t, err)
					for id := range admins {
						if id == victim.Id {
							continue
						}
						_, appErr := th.App.UpdateUserRoles(th.Context, id, model.SystemUserRoleId, false)
						require.Nil(t, appErr)
					}
					count, err := th.App.Srv().Store().User().Count(model.UserCountOptions{Roles: []string{model.SystemAdminRoleId}})
					require.NoError(t, err)
					require.EqualValues(t, 1, count, "victim must be the only system admin")
				} else if victim.IsSystemAdmin() {
					createIdentityTestUser(t, th, model.SystemAdminRoleId+" "+model.SystemUserRoleId)
				}

				// Re-read after any role adjustments to other users.
				victim, err := th.App.Srv().Store().User().Get(th.Context, victim.Id)
				require.NoError(t, err)

				archiveUser := archiveUserFor(victim.Username, tc.archiveRoles)
				runIdentityTestImport(t, th, identityTestArchive{
					scoped:      true,
					teamName:    model.NewRandomTeamName(),
					channelName: model.NewId(),
					user:        archiveUser,
				})

				assertIdentityUnchanged(t, th, victim, *archiveUser.Email)
			})
		}
	})

	t.Run("profile and DeleteAt preserved while membership and post attribution still apply", func(t *testing.T) {
		th := setupIdentityTest(t)

		victim := createIdentityTestUser(t, th, model.SystemUserRoleId)

		teamName := model.NewRandomTeamName()
		channelName := model.NewId()
		createAt := model.GetMillis()
		archiveUser := archiveUserFor(victim.Username, model.SystemUserRoleId)
		archiveUser.DeleteAt = new(int64(1700000000000))

		runIdentityTestImport(t, th, identityTestArchive{
			scoped:      true,
			teamName:    teamName,
			channelName: channelName,
			user:        archiveUser,
			postMessage: "post from archive user",
			postCreate:  createAt,
		})

		assertIdentityUnchanged(t, th, victim, *archiveUser.Email)

		team, err := th.App.Srv().Store().Team().GetByName(teamName)
		require.NoError(t, err)
		member, err := th.App.Srv().Store().Team().GetMember(th.Context, team.Id, victim.Id)
		require.NoError(t, err, "existing account must still receive the archive's team membership")
		assert.Zero(t, member.DeleteAt)

		channel, err := th.App.Srv().Store().Channel().GetByName(team.Id, channelName, false)
		require.NoError(t, err)
		_, err = th.App.Srv().Store().Channel().GetMember(th.Context, channel.Id, victim.Id)
		require.NoError(t, err, "existing account must still receive the archive's channel membership")

		posts, err := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, createAt)
		require.NoError(t, err)
		require.Len(t, posts, 1, "archive post should have been imported")
		assert.Equal(t, victim.Id, posts[0].UserId, "archive post must be attributed to the existing account")
	})

	t.Run("archive team and channel admin roles and preferences are not applied to a new membership", func(t *testing.T) {
		th := setupIdentityTest(t)

		victim := createIdentityTestUser(t, th, model.SystemUserRoleId)
		teamName := model.NewRandomTeamName()
		channelName := model.NewId()

		archiveUser := archiveUserFor(victim.Username, model.SystemUserRoleId)
		runIdentityTestImport(t, th, identityTestArchive{
			scoped:      true,
			teamName:    teamName,
			channelName: channelName,
			user:        archiveUser,
			membership: &imports.UserTeamImportData{
				Roles: new(model.TeamUserRoleId + " " + model.TeamAdminRoleId),
				Theme: new(`{"type":"Onyx"}`),
				Channels: &[]imports.UserChannelImportData{{
					Roles:    new(model.ChannelUserRoleId + " " + model.ChannelAdminRoleId),
					Favorite: new(true),
					NotifyProps: &imports.UserChannelNotifyPropsImportData{
						Desktop: new(model.ChannelNotifyNone),
					},
				}},
			},
		})

		team, err := th.App.Srv().Store().Team().GetByName(teamName)
		require.NoError(t, err)
		teamMember, err := th.App.Srv().Store().Team().GetMember(th.Context, team.Id, victim.Id)
		require.NoError(t, err, "existing account must still receive the archive's team membership")
		assert.False(t, teamMember.SchemeAdmin, "scoped import must not grant the archive's team admin role to an account matched only by username")
		assert.Empty(t, teamMember.ExplicitRoles, "scoped import must not grant the archive's explicit team roles to an account matched only by username")

		channel, err := th.App.Srv().Store().Channel().GetByName(team.Id, channelName, false)
		require.NoError(t, err)
		channelMember, err := th.App.Srv().Store().Channel().GetMember(th.Context, channel.Id, victim.Id)
		require.NoError(t, err, "existing account must still receive the archive's channel membership")
		assert.False(t, channelMember.SchemeAdmin, "scoped import must not grant the archive's channel admin role to an account matched only by username")
		assert.Equal(t, model.GetDefaultChannelNotifyProps()[model.DesktopNotifyProp], channelMember.NotifyProps[model.DesktopNotifyProp],
			"scoped import must not apply the archive's channel notify props to an account matched only by username")

		themePrefs, err := th.App.Srv().Store().Preference().GetCategory(victim.Id, model.PreferenceCategoryTheme)
		require.NoError(t, err)
		assert.Empty(t, themePrefs, "scoped import must not write the archive's team theme preference for an account matched only by username")
		favoritePrefs, err := th.App.Srv().Store().Preference().GetCategory(victim.Id, model.PreferenceCategoryFavoriteChannel)
		require.NoError(t, err)
		assert.Empty(t, favoritePrefs, "scoped import must not write the archive's favorite channel preference for an account matched only by username")
	})

	t.Run("new memberships of a username-matched account are visible to its cached session and channel members", func(t *testing.T) {
		th := setupIdentityTest(t)

		victim := createIdentityTestUser(t, th, model.SystemUserRoleId)
		team, appErr := th.App.CreateTeam(th.Context, &model.Team{
			Name:        model.NewRandomTeamName(),
			DisplayName: "Existing Destination Team",
			Email:       "team-" + model.NewId() + "@example.com",
			Type:        model.TeamOpen,
		})
		require.Nil(t, appErr)
		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      team.Id,
			Name:        model.NewId(),
			DisplayName: "Existing Destination Channel",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, appErr)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: victim.Id})
		require.Nil(t, appErr)
		cached, appErr := th.App.GetSession(session.Token)
		require.Nil(t, appErr)
		require.Nil(t, cached.GetTeamByTeamId(team.Id))
		cachedChannels, err := th.App.Srv().Store().Channel().GetAllChannelMembersForUser(th.Context, victim.Id, true, false)
		require.NoError(t, err)
		require.NotContains(t, cachedChannels, channel.Id)

		runIdentityTestImport(t, th, identityTestArchive{
			scoped:      true,
			teamName:    team.Name,
			channelName: channel.Name,
			user:        archiveUserFor(victim.Username, model.SystemUserRoleId),
		})

		refreshed, appErr := th.App.GetSession(session.Token)
		require.Nil(t, appErr)
		assert.NotNil(t, refreshed.GetTeamByTeamId(team.Id), "the session cache must reflect the imported team membership")
		channels, err := th.App.Srv().Store().Channel().GetAllChannelMembersForUser(th.Context, victim.Id, true, false)
		require.NoError(t, err)
		assert.Contains(t, channels, channel.Id, "the channel member cache must reflect the imported channel membership")
	})

	t.Run("existing team and channel memberships of a username-matched account are not demoted or overwritten", func(t *testing.T) {
		th := setupIdentityTest(t)

		victim := createIdentityTestUser(t, th, model.SystemUserRoleId)

		team, appErr := th.App.CreateTeam(th.Context, &model.Team{
			Name:        model.NewRandomTeamName(),
			DisplayName: "Existing Destination Team",
			Email:       "team-" + model.NewId() + "@example.com",
			Type:        model.TeamOpen,
		})
		require.Nil(t, appErr)
		_, appErr = th.App.AddTeamMember(th.Context, team.Id, victim.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.UpdateTeamMemberSchemeRoles(th.Context, team.Id, victim.Id, false, true, true)
		require.Nil(t, appErr)

		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      team.Id,
			Name:        model.NewId(),
			DisplayName: "Existing Destination Channel",
			Type:        model.ChannelTypeOpen,
			CreatorId:   victim.Id,
		}, false)
		require.Nil(t, appErr)
		_, appErr = th.App.AddChannelMember(th.Context, victim.Id, channel, ChannelMemberOpts{})
		require.Nil(t, appErr)
		_, appErr = th.App.UpdateChannelMemberSchemeRoles(th.Context, channel.Id, victim.Id, false, true, true)
		require.Nil(t, appErr)
		_, appErr = th.App.UpdateChannelMemberNotifyProps(th.Context, map[string]string{
			model.DesktopNotifyProp:    model.ChannelNotifyAll,
			model.MarkUnreadNotifyProp: model.ChannelMarkUnreadAll,
		}, channel.Id, victim.Id)
		require.Nil(t, appErr)

		beforeTeamMember, err := th.App.Srv().Store().Team().GetMember(th.Context, team.Id, victim.Id)
		require.NoError(t, err)
		require.True(t, beforeTeamMember.SchemeAdmin)
		beforeChannelMember, err := th.App.Srv().Store().Channel().GetMember(th.Context, channel.Id, victim.Id)
		require.NoError(t, err)
		require.True(t, beforeChannelMember.SchemeAdmin)

		archiveUser := archiveUserFor(victim.Username, model.SystemUserRoleId)
		runIdentityTestImport(t, th, identityTestArchive{
			scoped:      true,
			teamName:    team.Name,
			channelName: channel.Name,
			user:        archiveUser,
			membership: &imports.UserTeamImportData{
				Roles: new(model.TeamUserRoleId),
				Channels: &[]imports.UserChannelImportData{{
					Roles: new(model.ChannelUserRoleId),
					NotifyProps: &imports.UserChannelNotifyPropsImportData{
						Desktop:    new(model.ChannelNotifyNone),
						MarkUnread: new(model.ChannelMarkUnreadMention),
					},
					LastViewedAt: new(int64(1)),
				}},
			},
		})

		afterTeamMember, err := th.App.Srv().Store().Team().GetMember(th.Context, team.Id, victim.Id)
		require.NoError(t, err)
		assert.True(t, afterTeamMember.SchemeAdmin, "scoped import must not demote an existing team admin matched only by username")

		afterChannelMember, err := th.App.Srv().Store().Channel().GetMember(th.Context, channel.Id, victim.Id)
		require.NoError(t, err)
		assert.True(t, afterChannelMember.SchemeAdmin, "scoped import must not demote an existing channel admin matched only by username")
		assert.Equal(t, beforeChannelMember.NotifyProps, afterChannelMember.NotifyProps,
			"scoped import must not overwrite the channel notify props of an existing membership matched only by username")
		assert.Equal(t, beforeChannelMember.LastViewedAt, afterChannelMember.LastViewedAt,
			"scoped import must not overwrite the read state of an existing membership matched only by username")
	})

	t.Run("bot line does not convert a username-matched human account into a bot", func(t *testing.T) {
		th := setupIdentityTest(t)

		victim := createIdentityTestUser(t, th, model.SystemAdminRoleId+" "+model.SystemUserRoleId)
		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: victim.Id, Roles: victim.Roles})
		require.Nil(t, appErr)

		archiveOwner := archiveUserFor("owner"+model.NewId()[:10], model.SystemUserRoleId)
		runIdentityTestImport(t, th, identityTestArchive{
			scoped:      true,
			teamName:    model.NewRandomTeamName(),
			channelName: model.NewId(),
			user:        archiveOwner,
			bot: &imports.BotImportData{
				Username:    new(victim.Username),
				Owner:       archiveOwner.Username,
				DisplayName: new("Archive Bot"),
				Description: new("archive bot"),
			},
		})

		_, err := th.App.Srv().Store().Bot().Get(victim.Id, true)
		assert.Error(t, err, "scoped import must not attach a bot record to an existing human account matched only by username")

		after, err := th.App.Srv().Store().User().Get(th.Context, victim.Id)
		require.NoError(t, err)
		assert.False(t, after.IsBot, "scoped import must not turn an existing human account into a bot")
		assert.Equal(t, victim.FirstName, after.FirstName, "scoped import must not apply the archive bot's display name to an existing human account")

		_, appErr = th.App.GetSession(session.Token)
		assert.Nil(t, appErr, "scoped import must not revoke the sessions of an existing human account matched only by username")
	})

	t.Run("bot line does not take over an existing destination bot matched by username", func(t *testing.T) {
		th := setupIdentityTest(t)

		destOwner := createIdentityTestUser(t, th, model.SystemUserRoleId)
		otherDestUser := createIdentityTestUser(t, th, model.SystemUserRoleId)
		destBot, appErr := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "destbot" + model.NewId()[:10],
			DisplayName: "Dest Bot",
			Description: "dest bot",
			OwnerId:     destOwner.Id,
		})
		require.Nil(t, appErr)

		archiveUser := archiveUserFor("archive"+model.NewId()[:10], model.SystemUserRoleId)
		runIdentityTestImport(t, th, identityTestArchive{
			scoped:      true,
			teamName:    model.NewRandomTeamName(),
			channelName: model.NewId(),
			user:        archiveUser,
			bot: &imports.BotImportData{
				Username:    new(destBot.Username),
				Owner:       new(otherDestUser.Username),
				DisplayName: new("Archive Bot"),
				Description: new("archive bot"),
			},
		})

		after, err := th.App.Srv().Store().Bot().Get(destBot.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, destOwner.Id, after.OwnerId, "scoped import must not reassign the owner of an existing destination bot matched only by username")
		assert.Equal(t, destBot.Description, after.Description, "scoped import must not change the description of an existing destination bot")
		assert.Equal(t, destBot.DisplayName, after.DisplayName, "scoped import must not change the display name of an existing destination bot")
	})
}

func TestImportExistingUserIdentityBaseline(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupIdentityTest(t)

	existing := createIdentityTestUser(t, th, model.SystemUserRoleId)
	newRoles := model.SystemAdminRoleId + " " + model.SystemUserRoleId
	archiveUser := archiveUserFor(existing.Username, newRoles)

	runIdentityTestImport(t, th, identityTestArchive{
		scoped:      false,
		teamName:    model.NewRandomTeamName(),
		channelName: model.NewId(),
		user:        archiveUser,
	})

	after, err := th.App.Srv().Store().User().Get(th.Context, existing.Id)
	require.NoError(t, err)
	assert.Equal(t, *archiveUser.Email, after.Email, "full import should update the existing user's email")
	assert.True(t, after.EmailVerified, "full import marks imported emails as verified")
	assert.Equal(t, newRoles, after.Roles, "full import should update the existing user's roles")
	assert.Equal(t, *archiveUser.FirstName, after.FirstName, "full import should update profile fields")
	assert.Equal(t, *archiveUser.Position, after.Position, "full import should update profile fields")

	byEmail, err := th.App.Srv().Store().User().GetByEmail(*archiveUser.Email)
	require.NoError(t, err)
	assert.Equal(t, existing.Id, byEmail.Id)
}
