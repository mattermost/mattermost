// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	einterfacesmocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

const scopeTestPluginID = "com.example.scoped"

type scopeFixture struct {
	bot          *model.User
	openTeam     *model.Team
	closedTeam   *model.Team
	triggering   *model.Channel // private, closed team, listed, bot not a member
	extra        *model.Channel // private, open team, listed, bot not a member
	publicOpen   *model.Channel // public, open team, bot not a member
	publicClosed *model.Channel // public, closed team
	memberPriv   *model.Channel // private, bot is a member, not listed
	botDM        *model.Channel // the bot's DM with a user
}

func setTeamOpen(t *testing.T, th *TestHelper, team *model.Team, open bool) *model.Team {
	t.Helper()
	team.AllowOpenInvite = open
	if !open {
		team.Type = model.TeamInvite
	}
	updated, err := th.App.Srv().Store().Team().Update(team)
	require.NoError(t, err)
	return updated
}

func newScopeFixture(t *testing.T, th *TestHelper) *scopeFixture {
	t.Helper()
	f := &scopeFixture{}

	bot := th.CreateBot(t)
	var appErr *model.AppError
	f.bot, appErr = th.App.GetUser(th.Context, bot.UserId)
	require.Nil(t, appErr)

	f.openTeam = setTeamOpen(t, th, th.CreateTeam(t), true)
	f.closedTeam = setTeamOpen(t, th, th.CreateTeam(t), false)

	f.triggering = th.CreatePrivateChannel(t, f.closedTeam)
	f.extra = th.CreatePrivateChannel(t, f.openTeam)
	f.publicOpen = th.CreateChannel(t, f.openTeam)
	f.publicClosed = th.CreateChannel(t, f.closedTeam)

	f.memberPriv = th.CreatePrivateChannel(t, f.openTeam)
	th.LinkUserToTeam(t, f.bot, f.openTeam)
	th.AddUserToChannel(t, f.bot, f.memberPriv)

	f.botDM, appErr = th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, f.bot.Id)
	require.Nil(t, appErr)

	return f
}

func (f *scopeFixture) scope() *model.SessionScope {
	return &model.SessionScope{
		Permissions: []string{model.PermissionReadChannel.Id, model.PermissionReadChannelContent.Id, model.PermissionViewTeam.Id},
		Resources: model.SessionScopeResources{
			ChannelIDs:             []string{f.triggering.Id, f.extra.Id},
			OpenTeamPublicChannels: true,
		},
		OnBehalfOfUserID: model.NewId(),
	}
}

func mintScoped(t *testing.T, th *TestHelper, userID string, scope *model.SessionScope) *model.Session {
	t.Helper()
	session, appErr := th.App.CreateScopedSession(th.Context, scopeTestPluginID, userID, scope, model.GetMillis()+30*60*1000)
	require.Nil(t, appErr)
	return session
}

// forgeScoped builds a scoped session without validation, as if the stored
// scope had been tampered with.
func forgeScoped(t *testing.T, userID string, scope *model.SessionScope) *model.Session {
	t.Helper()
	b, err := json.Marshal(scope)
	require.NoError(t, err)
	return &model.Session{Id: model.NewId(), UserId: userID, Props: model.StringMap{model.SessionPropScope: string(b)}}
}

func TestSessionScopeChannelReads(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)
	session := mintScoped(t, th, f.bot.Id, f.scope())
	rctx := th.Context.WithSession(session)

	inScope := []*model.Channel{f.triggering, f.extra, f.publicOpen}
	outOfScope := map[string]*model.Channel{
		"public channel on closed team": f.publicClosed,
		"private member channel":        f.memberPriv,
		"bot DM":                        f.botDM,
	}

	check := func(t *testing.T, channel *model.Channel, permission *model.Permission, want bool) {
		t.Helper()
		got, isMember := th.App.SessionHasPermissionToChannel(rctx, *session, channel.Id, permission)
		assert.Equal(t, want, got, "SessionHasPermissionToChannel")
		assert.False(t, isMember)

		if permission.Id == model.PermissionReadChannelContent.Id {
			got, _ = th.App.SessionHasPermissionToReadChannel(rctx, *session, channel)
			assert.Equal(t, want, got, "SessionHasPermissionToReadChannel")

			got, _ = th.App.HasPermissionToReadChannel(rctx, f.bot.Id, channel)
			assert.Equal(t, want, got, "HasPermissionToReadChannel with scoped request")

			post := &model.Post{ChannelId: channel.Id, UserId: th.BasicUser.Id, Message: "m"}
			_, err := th.App.Srv().Store().Post().Save(th.Context, post)
			require.NoError(t, err)
			got, _ = th.App.SessionHasPermissionToReadPost(rctx, *session, post.Id)
			assert.Equal(t, want, got, "SessionHasPermissionToReadPost")
			assert.Equal(t, want, th.App.SessionHasPermissionToChannelByPost(*session, post.Id, permission), "SessionHasPermissionToChannelByPost")
			assert.Equal(t, want, th.App.HasPermissionToChannelByPost(rctx, f.bot.Id, post.Id, permission), "HasPermissionToChannelByPost with scoped request")
		}

		got, _ = th.App.HasPermissionToChannel(rctx, f.bot.Id, channel.Id, permission)
		assert.Equal(t, want, got, "HasPermissionToChannel with scoped request")
	}

	for _, permission := range []*model.Permission{model.PermissionReadChannel, model.PermissionReadChannelContent} {
		for _, channel := range inScope {
			t.Run(permission.Id+" in scope "+channel.Name, func(t *testing.T) {
				check(t, channel, permission, true)
			})
		}
		for name, channel := range outOfScope {
			t.Run(permission.Id+" "+name, func(t *testing.T) {
				check(t, channel, permission, false)
			})
		}
	}

	t.Run("permission outside the scope's subset is denied on in-scope channels", func(t *testing.T) {
		for _, channel := range inScope {
			check(t, channel, model.PermissionReadPublicChannel, false)
			check(t, channel, model.PermissionCreatePost, false)
			check(t, channel, model.PermissionManagePublicChannelProperties, false)
		}
	})

	t.Run("multi-channel check needs every channel in scope", func(t *testing.T) {
		assert.True(t, th.App.SessionHasPermissionToChannels(rctx, *session, []string{f.triggering.Id, f.publicOpen.Id}, model.PermissionReadChannel))
		assert.False(t, th.App.SessionHasPermissionToChannels(rctx, *session, []string{f.triggering.Id, f.botDM.Id}, model.PermissionReadChannel))
	})

	t.Run("user-based checks for other users are unaffected", func(t *testing.T) {
		ok, _ := th.App.HasPermissionToReadChannel(rctx, th.BasicUser.Id, f.botDM)
		assert.True(t, ok)
	})

	t.Run("the same bot unscoped keeps its normal access", func(t *testing.T) {
		unscoped := &model.Session{Id: model.NewId(), UserId: f.bot.Id, Roles: f.bot.Roles}
		ok, _ := th.App.SessionHasPermissionToChannel(th.Context, *unscoped, f.memberPriv.Id, model.PermissionReadChannel)
		assert.True(t, ok)
		ok, _ = th.App.SessionHasPermissionToChannel(th.Context, *unscoped, f.triggering.Id, model.PermissionReadChannel)
		assert.False(t, ok)
	})

	t.Run("listing a DM in a stored scope still denies it", func(t *testing.T) {
		scope := f.scope()
		scope.Resources.ChannelIDs = append(scope.Resources.ChannelIDs, f.botDM.Id)
		forged := forgeScoped(t, f.bot.Id, scope)
		ok, _ := th.App.SessionHasPermissionToChannel(th.Context.WithSession(forged), *forged, f.botDM.Id, model.PermissionReadChannelContent)
		assert.False(t, ok)
	})

	t.Run("policy-enforced channel is denied even when listed", func(t *testing.T) {
		policyChannel := *f.extra
		policyChannel.PolicyEnforced = true
		scoped, allowed := th.App.EvaluateSessionScope(rctx, session, model.PermissionReadChannelContent.Id, SessionScopeTarget{Channel: &policyChannel})
		assert.True(t, scoped)
		assert.False(t, allowed)
	})

	t.Run("archived channel is denied", func(t *testing.T) {
		archived := th.CreateChannel(t, f.openTeam)
		require.Nil(t, th.App.DeleteChannel(th.Context, archived, th.BasicUser.Id))
		ok, _ := th.App.SessionHasPermissionToChannel(rctx, *session, archived.Id, model.PermissionReadChannel)
		assert.False(t, ok)
	})

	t.Run("malformed scope denies everything", func(t *testing.T) {
		malformed := &model.Session{Id: model.NewId(), UserId: f.bot.Id, Props: model.StringMap{model.SessionPropScope: "{"}}
		ok, _ := th.App.SessionHasPermissionToChannel(th.Context, *malformed, f.triggering.Id, model.PermissionReadChannel)
		assert.False(t, ok)
		assert.False(t, th.App.SessionHasPermissionToTeam(*malformed, f.openTeam.Id, model.PermissionViewTeam))
	})
}

func TestSessionScopeComplianceDisablesOpenTeamGrant(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)
	session := mintScoped(t, th, f.bot.Id, f.scope())
	rctx := th.Context.WithSession(session)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ComplianceSettings.Enable = true })
	defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ComplianceSettings.Enable = false })

	ok, _ := th.App.SessionHasPermissionToChannel(rctx, *session, f.publicOpen.Id, model.PermissionReadChannel)
	assert.False(t, ok, "open-team public channel")
	ok, _ = th.App.SessionHasPermissionToChannel(rctx, *session, f.triggering.Id, model.PermissionReadChannel)
	assert.True(t, ok, "listed channel")
}

func TestSessionScopeTeamAndSystemChecks(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)
	session := mintScoped(t, th, f.bot.Id, f.scope())

	assert.True(t, th.App.SessionHasPermissionToTeam(*session, f.openTeam.Id, model.PermissionViewTeam))
	assert.False(t, th.App.SessionHasPermissionToTeam(*session, f.closedTeam.Id, model.PermissionViewTeam), "closed team")
	assert.False(t, th.App.SessionHasPermissionToTeam(*session, f.openTeam.Id, model.PermissionListTeamChannels), "permission not in this scope")
	assert.False(t, th.App.SessionHasPermissionToTeam(*session, f.openTeam.Id, model.PermissionReadPublicChannel), "channel permission at team level")
	assert.False(t, th.App.SessionHasPermissionToTeam(*session, f.openTeam.Id, model.PermissionManageTeam))
	assert.True(t, th.App.SessionHasPermissionToTeams(th.Context, *session, []string{f.openTeam.Id}, model.PermissionViewTeam))
	assert.False(t, th.App.SessionHasPermissionToTeams(th.Context, *session, []string{f.openTeam.Id, f.closedTeam.Id}, model.PermissionViewTeam))

	for _, permission := range []*model.Permission{model.PermissionManageSystem, model.PermissionCreatePostPublic, model.PermissionViewMembers, model.PermissionReadChannelContent} {
		assert.False(t, th.App.SessionHasPermissionTo(*session, permission), permission.Id)
		assert.False(t, th.App.SessionHasPermissionToAndNotRestrictedAdmin(*session, permission), permission.Id)
	}
	assert.False(t, th.App.SessionHasPermissionToUser(th.Context, *session, f.bot.Id), "not even itself")
	assert.False(t, th.App.SessionHasPermissionToUserOrBot(th.Context, *session, f.bot.Id))
	assert.NotNil(t, th.App.SessionHasPermissionToManageBot(th.Context, *session, f.bot.Id))
	assert.False(t, th.App.SessionHasPermissionToGroup(*session, model.NewId(), model.PermissionReadChannel))
}

func TestSessionScopeAdminAndPostAllBot(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)

	_, appErr := th.App.UpdateUserRoles(th.Context, f.bot.Id, model.SystemUserRoleId+" "+model.SystemPostAllRoleId, false)
	require.Nil(t, appErr)
	session := mintScoped(t, th, f.bot.Id, f.scope())
	rctx := th.Context.WithSession(session)

	t.Run("system_post_all bot cannot post", func(t *testing.T) {
		assert.False(t, th.App.SessionHasPermissionTo(*session, model.PermissionCreatePost))
		for _, channel := range []*model.Channel{f.triggering, f.publicOpen, f.memberPriv} {
			ok, _ := th.App.SessionHasPermissionToChannel(rctx, *session, channel.Id, model.PermissionCreatePost)
			assert.False(t, ok)
		}
	})

	t.Run("system admin scoped session gets nothing from its roles", func(t *testing.T) {
		adminSession := mintScoped(t, th, th.SystemAdminUser.Id, f.scope())
		adminDM, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.SystemAdminUser.Id)
		require.Nil(t, appErr)

		assert.False(t, th.App.SessionHasPermissionTo(*adminSession, model.PermissionManageSystem))
		ok, _ := th.App.SessionHasPermissionToChannel(th.Context, *adminSession, adminDM.Id, model.PermissionReadChannel)
		assert.False(t, ok)
		ok, _ = th.App.SessionHasPermissionToChannel(th.Context, *adminSession, f.publicClosed.Id, model.PermissionReadChannel)
		assert.False(t, ok)
	})

	t.Run("scoped session is never unrestricted", func(t *testing.T) {
		local := session.DeepCopy()
		local.Local = true
		assert.False(t, local.IsUnrestricted())
		assert.False(t, th.App.SessionHasPermissionTo(*local, model.PermissionManageSystem))
		ok, _ := th.App.SessionHasPermissionToChannel(th.Context, *local, f.botDM.Id, model.PermissionReadChannel)
		assert.False(t, ok)
	})
}

func TestSessionScopeIsFinalThroughAccessEvaluation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)
	session := mintScoped(t, th, f.bot.Id, f.scope())
	rctx := th.Context.WithSession(session)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	})

	mockACS := &einterfacesmocks.AccessControlServiceInterface{}
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))
	original := th.App.Srv().Channels().AccessControl
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })

	download := model.AccessControlPolicyActionDownloadFileAttachment
	assert.False(t, th.App.HasPermissionToChannelAction(rctx, f.bot.Id, f.bot.Roles, f.botDM.Id, download), "ABAC allow cannot override scope denial")
	assert.False(t, th.App.HasPermissionToChannelAction(rctx, f.bot.Id, f.bot.Roles, f.memberPriv.Id, download))
	assert.False(t, th.App.HasPermissionToChannelAction(rctx, f.bot.Id, f.bot.Roles, f.triggering.Id, model.AccessControlPolicyActionUploadFileAttachment), "writes are denied")
	assert.True(t, th.App.HasPermissionToChannelAction(rctx, f.bot.Id, f.bot.Roles, f.triggering.Id, download))

	mockDeny := &einterfacesmocks.AccessControlServiceInterface{}
	mockDeny.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))
	th.App.Srv().Channels().AccessControl = mockDeny
	assert.False(t, th.App.HasPermissionToChannelAction(rctx, f.bot.Id, f.bot.Roles, f.triggering.Id, download), "ABAC can still deny in-scope channels")

	th.App.Srv().Channels().AccessControl = nil
	assert.False(t, th.App.HasPermissionToChannelAction(rctx, f.bot.Id, f.bot.Roles, f.botDM.Id, download), "scope applies without ABAC")
}

func TestCreateScopedSession(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)
	expiresAt := model.GetMillis() + 30*60*1000

	t.Run("success", func(t *testing.T) {
		scope := f.scope()
		scope.CreatedByPluginID = "forged"
		session, appErr := th.App.CreateScopedSession(th.Context, scopeTestPluginID, f.bot.Id, scope, expiresAt)
		require.Nil(t, appErr)
		assert.NotEmpty(t, session.Token)
		assert.Equal(t, expiresAt, session.ExpiresAt)
		assert.False(t, session.Local)
		assert.True(t, session.IsBotUser())

		stored, appErr := th.App.GetSession(session.Token)
		require.Nil(t, appErr)
		got, scoped := stored.Scope()
		require.True(t, scoped)
		assert.Equal(t, scopeTestPluginID, got.CreatedByPluginID, "server sets the plugin ID")
		assert.Equal(t, scope.Resources, got.Resources)
		assert.Equal(t, scope.OnBehalfOfUserID, got.OnBehalfOfUserID)
		assert.Equal(t, "forged", scope.CreatedByPluginID, "caller's scope is not mutated")
	})

	for name, tc := range map[string]struct {
		pluginID  string
		userID    string
		scope     func() *model.SessionScope
		expiresAt int64
	}{
		"no plugin": {"", f.bot.Id, f.scope, expiresAt},
		"nil scope": {scopeTestPluginID, f.bot.Id, func() *model.SessionScope { return nil }, expiresAt},
		"write permission": {scopeTestPluginID, f.bot.Id, func() *model.SessionScope {
			s := f.scope()
			s.Permissions = append(s.Permissions, model.PermissionCreatePost.Id)
			return s
		}, expiresAt},
		"no permissions": {scopeTestPluginID, f.bot.Id, func() *model.SessionScope { s := f.scope(); s.Permissions = nil; return s }, expiresAt},
		"DM channel":     {scopeTestPluginID, f.bot.Id, func() *model.SessionScope { s := f.scope(); s.Resources.ChannelIDs = []string{f.botDM.Id}; return s }, expiresAt},
		"GM channel": {scopeTestPluginID, f.bot.Id, func() *model.SessionScope {
			s := f.scope()
			s.Resources.ChannelIDs = []string{th.CreateGroupChannel(t, th.BasicUser2, f.bot).Id}
			return s
		}, expiresAt},
		"missing channel":   {scopeTestPluginID, f.bot.Id, func() *model.SessionScope { s := f.scope(); s.Resources.ChannelIDs = []string{model.NewId()}; return s }, expiresAt},
		"expired":           {scopeTestPluginID, f.bot.Id, f.scope, model.GetMillis() - 1},
		"beyond 24h":        {scopeTestPluginID, f.bot.Id, f.scope, model.GetMillis() + model.SessionScopeMaxLifetimeMillis + 60*1000},
		"missing user":      {scopeTestPluginID, model.NewId(), f.scope, expiresAt},
		"invalid behalf of": {scopeTestPluginID, f.bot.Id, func() *model.SessionScope { s := f.scope(); s.OnBehalfOfUserID = "x"; return s }, expiresAt},
	} {
		t.Run(name, func(t *testing.T) {
			session, appErr := th.App.CreateScopedSession(th.Context, tc.pluginID, tc.userID, tc.scope(), tc.expiresAt)
			require.NotNil(t, appErr)
			assert.Nil(t, session)
		})
	}

	t.Run("deactivated user", func(t *testing.T) {
		user := th.CreateUser(t)
		_, appErr := th.App.UpdateActive(th.Context, user, false)
		require.Nil(t, appErr)
		_, appErr = th.App.CreateScopedSession(th.Context, scopeTestPluginID, user.Id, f.scope(), expiresAt)
		require.NotNil(t, appErr)
	})

	t.Run("CreateSession rejects a scope prop", func(t *testing.T) {
		session := &model.Session{UserId: f.bot.Id, Props: model.StringMap{model.SessionPropScope: `{"permissions":["read_channel"],"created_by_plugin_id":"x"}`}}
		_, appErr := th.App.CreateSession(th.Context, session)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.session.create.scope_prop.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("activity does not extend a scoped session", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExtendSessionLengthWithActivity = true })
		session := mintScoped(t, th, f.bot.Id, f.scope())
		assert.False(t, th.App.ExtendSessionExpiryIfNeeded(th.Context, session))
	})
}

func TestRevokeScopedSessionsForPlugin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)
	expiresAt := model.GetMillis() + 30*60*1000

	mine, appErr := th.App.CreateScopedSession(th.Context, scopeTestPluginID, f.bot.Id, f.scope(), expiresAt)
	require.Nil(t, appErr)
	theirs, appErr := th.App.CreateScopedSession(th.Context, "com.example.other", f.bot.Id, f.scope(), expiresAt)
	require.Nil(t, appErr)
	unscoped, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: f.bot.Id})
	require.Nil(t, appErr)

	require.Nil(t, th.App.RevokeScopedSessionsForPlugin(th.Context, scopeTestPluginID))

	_, appErr = th.App.GetSession(mine.Token)
	assert.NotNil(t, appErr, "the plugin's scoped session is revoked")
	_, appErr = th.App.GetSession(theirs.Token)
	assert.Nil(t, appErr, "another plugin's scoped session survives")
	_, appErr = th.App.GetSession(unscoped.Token)
	assert.Nil(t, appErr, "unscoped sessions survive")
}

func TestScopedSessionIsUnauthenticatedOnPluginRoutes(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	f := newScopeFixture(t, th)
	session := mintScoped(t, th, f.bot.Id, f.scope())

	for name, setAuth := range map[string]func(r *http.Request){
		"bearer header": func(r *http.Request) { r.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+session.Token) },
		"cookie":        func(r *http.Request) { r.AddCookie(&http.Cookie{Name: model.SessionCookieToken, Value: session.Token}) },
		"query":         func(r *http.Request) { r.URL.RawQuery = "access_token=" + session.Token },
	} {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/plugins/testplugin/endpoint", nil)
			req = mux.SetURLVars(req, map[string]string{"plugin_id": "testplugin"})
			setAuth(req)

			handlerCalled := false
			th.App.ch.servePluginRequest(httptest.NewRecorder(), req, func(ctx *plugin.Context, w http.ResponseWriter, r *http.Request) {
				handlerCalled = true
				assert.Empty(t, r.Header.Get("Mattermost-User-Id"))
				assert.Empty(t, ctx.SessionId)
				assert.Empty(t, r.Header.Get(model.HeaderAuth), "the token is not forwarded to the plugin")
				assert.Empty(t, r.URL.Query().Get("access_token"))
			})
			require.True(t, handlerCalled)
		})
	}
}
