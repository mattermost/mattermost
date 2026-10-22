// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

const scopedSessionErrorID = "api.context.scoped_session_out_of_scope.app_error"

// scopedSessionAllowedRoutes is every route a scoped session may reach. Adding a
// route here needs a reviewer to confirm its permission checks go through the
// session scope (see App.EvaluateSessionScope).
var scopedSessionAllowedRoutes = []string{
	"GET /api/v4/channels/{channel_id}",
	"GET /api/v4/channels/{channel_id}/posts",
	"GET /api/v4/files/{file_id}",
	"HEAD /api/v4/files/{file_id}",
	"GET /api/v4/files/{file_id}/info",
	"GET /api/v4/posts/{post_id}",
	"GET /api/v4/posts/{post_id}/files/info",
	"GET /api/v4/posts/{post_id}/thread",
	"GET /api/v4/teams/{team_id}",
	"GET /api/v4/users/{user_id}",
	"POST /api/v4/users/ids",
	"POST /api/v4/users/usernames",
	"GET /api/v4/users/username/{username}",
}

type scopedAPIFixture struct {
	bot        *model.User
	openTeam   *model.Team
	closedTeam *model.Team
	triggering *model.Channel // private, closed team, listed, bot not a member
	publicOpen *model.Channel // public, open team, bot not a member
	memberPriv *model.Channel // private, open team, bot is a member, not listed
	botDM      *model.Channel
	dmPost     *model.Post
	session    *model.Session
	client     *model.Client4
}

func setupScopedAPIFixture(t *testing.T, th *TestHelper) *scopedAPIFixture {
	t.Helper()
	f := &scopedAPIFixture{}

	bot, appErr := th.App.CreateBot(th.Context, &model.Bot{Username: "scopedbot" + model.NewId()[:8], OwnerId: th.BasicUser.Id})
	require.Nil(t, appErr)
	f.bot, appErr = th.App.GetUser(th.Context, bot.UserId)
	require.Nil(t, appErr)

	f.openTeam = th.CreateTeam(t)
	f.openTeam.AllowOpenInvite = true
	_, err := th.App.Srv().Store().Team().Update(f.openTeam)
	require.NoError(t, err)

	f.closedTeam = th.CreateTeam(t)
	f.closedTeam.AllowOpenInvite = false
	f.closedTeam.Type = model.TeamInvite
	_, err = th.App.Srv().Store().Team().Update(f.closedTeam)
	require.NoError(t, err)

	th.LinkUserToTeam(t, th.BasicUser, f.openTeam)
	th.LinkUserToTeam(t, th.BasicUser, f.closedTeam)
	f.triggering = th.CreateChannelWithClientAndTeam(t, th.Client, model.ChannelTypePrivate, f.closedTeam.Id)
	f.publicOpen = th.CreateChannelWithClientAndTeam(t, th.Client, model.ChannelTypeOpen, f.openTeam.Id)
	f.memberPriv = th.CreateChannelWithClientAndTeam(t, th.Client, model.ChannelTypePrivate, f.openTeam.Id)
	th.LinkUserToTeam(t, f.bot, f.openTeam)
	th.AddUserToChannel(t, f.bot, f.memberPriv)

	f.botDM, appErr = th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, f.bot.Id)
	require.Nil(t, appErr)
	f.dmPost, _, err = th.Client.CreatePost(context.Background(), &model.Post{ChannelId: f.botDM.Id, Message: "dmsecret" + model.NewId()})
	require.NoError(t, err)

	f.session, appErr = th.App.CreateScopedSession(th.Context, "com.example.scoped", f.bot.Id, &model.SessionScope{
		Permissions: model.ScopeReadPermissions,
		Resources: model.SessionScopeResources{
			ChannelIDs:             []string{f.triggering.Id},
			OpenTeamPublicChannels: true,
		},
		OnBehalfOfUserID: th.BasicUser.Id,
	}, model.GetMillis()+30*60*1000)
	require.Nil(t, appErr)

	f.client = th.CreateClient()
	f.client.SetToken(f.session.Token)
	return f
}

func hasPermalinkEmbed(post *model.Post) bool {
	if post.Metadata == nil {
		return false
	}
	return slices.ContainsFunc(post.Metadata.Embeds, func(e *model.PostEmbed) bool { return e.Type == model.PostEmbedPermalink })
}

func requireScopeError(t *testing.T, resp *model.Response, err error) {
	t.Helper()
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	CheckErrorID(t, err, scopedSessionErrorID)
}

var routeVarRe = regexp.MustCompile(`\{([^{}:]+)(?::((?:[^{}]|\{[^{}]*\})*))?\}`)

func normalizeRouteTemplate(template string) string {
	return routeVarRe.ReplaceAllString(template, "{$1}")
}

// concretePath fills a route template with values its variable patterns accept.
func concretePath(template string) string {
	candidates := []string{model.NewId(), "abc", "1", "a.png", "x/y"}
	return routeVarRe.ReplaceAllStringFunc(template, func(v string) string {
		m := routeVarRe.FindStringSubmatch(v)
		if m[2] == "" {
			return candidates[0]
		}
		re := regexp.MustCompile("^(?:" + m[2] + ")$")
		for _, c := range candidates {
			if re.MatchString(c) {
				return c
			}
		}
		return candidates[0]
	})
}

func TestScopedSessionRouteAllowlist(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = true })
	f := setupScopedAPIFixture(t, th)

	for _, route := range scopedSessionAllowedRoutes {
		_, template, _ := strings.Cut(route, " ")
		assert.False(t, web.IsScopedSessionHardDeniedPath(template), "allowlisted route %s is on the hard-deny list", route)
	}

	type routeCase struct {
		method   string
		template string
		path     string
	}
	var cases []routeCase
	seen := map[string]bool{}
	router := th.Server.RootRouter
	err := router.Walk(func(route *mux.Route, _ *mux.Router, _ []*mux.Route) error {
		template, err := route.GetPathTemplate()
		if err != nil || !strings.HasPrefix(template, model.APIURLSuffix+"/") || route.GetHandler() == nil {
			return nil
		}
		if template == model.APIURLSuffix+"/{anything:.*}" {
			// The API's 404 handler, which reads no session.
			return nil
		}
		methods, err := route.GetMethods()
		if err != nil {
			methods = []string{http.MethodGet}
		}
		path := concretePath(template)
		for _, method := range methods {
			req := httptest.NewRequest(method, path, nil)
			var match mux.RouteMatch
			if !router.Match(req, &match) || match.Route != route {
				// Shadowed by an earlier route with the same shape; that route is tested instead.
				continue
			}
			key := method + " " + normalizeRouteTemplate(template)
			if seen[key] {
				continue
			}
			seen[key] = true
			cases = append(cases, routeCase{method: method, template: normalizeRouteTemplate(template), path: path})
		}
		return nil
	})
	require.NoError(t, err)
	require.Greater(t, len(cases), 500, "route walk found too few API routes")

	for _, route := range scopedSessionAllowedRoutes {
		assert.True(t, seen[route], "allowlisted route %s is not registered", route)
	}

	httpClient := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	baseURL := fmt.Sprintf("http://localhost:%v", th.App.Srv().ListenAddr.Port)
	var reachable []string
	for _, c := range cases {
		req, err := http.NewRequest(c.method, baseURL+c.path, strings.NewReader("{}"))
		require.NoError(t, err)
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+f.session.Token)
		resp, err := httpClient.Do(req)
		require.NoError(t, err, c.method+" "+c.template)
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var appErr model.AppError
		routeDenied := resp.StatusCode == http.StatusForbidden &&
			json.Unmarshal(body, &appErr) == nil &&
			appErr.Id == scopedSessionErrorID &&
			appErr.DetailedError == web.ScopedSessionRouteDeniedDetail
		if c.method == http.MethodHead {
			// HEAD responses have no body to identify the error by.
			routeDenied = resp.StatusCode == http.StatusForbidden
		}
		if !routeDenied {
			reachable = append(reachable, c.method+" "+c.template)
		}
	}

	slices.Sort(reachable)
	expected := slices.Clone(scopedSessionAllowedRoutes)
	slices.Sort(expected)
	assert.Equal(t, expected, reachable, "routes reachable by a scoped session must match the allowlist exactly")
}

func TestScopedSessionHardDenyList(t *testing.T) {
	for _, path := range []string{
		"/api/v4/users/me/tokens",
		"/api/v4/users/" + model.NewId() + "/tokens",
		"/api/v4/users/tokens/search",
		"/api/v4/users/me/sessions",
		"/api/v4/users/sessions/revoke/all",
		"/api/v4/users/login",
		"/api/v4/users/logout",
		"/api/v4/users/me/mfa",
		"/api/v4/users/me/password",
		"/api/v4/users/me/roles",
		"/api/v4/oauth/apps",
		"/api/v4/system/ping",
		"/api/v4/config",
		"/api/v4/license",
		"/api/v4/plugins",
		"/api/v4/ldap/sync",
		"/api/v4/saml/certificate/public",
		"/api/v4/access_control_policies",
		"/api/v4/websocket",
		"/subpath/api/v4/users/me/tokens",
	} {
		assert.True(t, web.IsScopedSessionHardDeniedPath(path), path)
	}
	for _, path := range []string{
		"/api/v4/users/me",
		"/api/v4/users/ids",
		"/api/v4/users/username/tokens",
		"/api/v4/channels/" + model.NewId() + "/posts",
		"/plugins/com.example/api",
	} {
		assert.False(t, web.IsScopedSessionHardDeniedPath(path), path)
	}

	t.Run("hard-deny list overrides the route flag", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		f := setupScopedAPIFixture(t, th)

		called := false
		handler := &web.Handler{
			Srv:                th.Server,
			HandleFunc:         func(*Context, http.ResponseWriter, *http.Request) { called = true },
			RequireSession:     true,
			AllowScopedSession: true,
		}

		req := httptest.NewRequest(http.MethodGet, "/api/v4/users/me/tokens", nil)
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+f.session.Token)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		assert.False(t, called)
		assert.Equal(t, http.StatusForbidden, rec.Code)
		assert.Contains(t, rec.Body.String(), scopedSessionErrorID)

		req = httptest.NewRequest(http.MethodGet, "/api/v4/users/me", nil)
		req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+f.session.Token)
		handler.ServeHTTP(httptest.NewRecorder(), req)
		assert.True(t, called)
	})
}

func TestScopedSessionReads(t *testing.T) {
	th := Setup(t).InitBasic(t)
	f := setupScopedAPIFixture(t, th)
	ctx := context.Background()

	t.Run("in-scope reads work without membership", func(t *testing.T) {
		me, _, err := f.client.GetMe(ctx, "")
		require.NoError(t, err)
		assert.Equal(t, f.bot.Id, me.Id)

		post, _, err := th.Client.CreatePost(ctx, &model.Post{ChannelId: f.triggering.Id, Message: "triggering"})
		require.NoError(t, err)

		_, _, err = f.client.GetChannel(ctx, f.triggering.Id)
		require.NoError(t, err)
		list, _, err := f.client.GetPostsForChannel(ctx, f.triggering.Id, 0, 10, "", false, false)
		require.NoError(t, err)
		assert.Contains(t, list.Posts, post.Id)
		_, _, err = f.client.GetPost(ctx, post.Id, "")
		require.NoError(t, err)
		_, _, err = f.client.GetPostThread(ctx, post.Id, "", false)
		require.NoError(t, err)

		_, _, err = f.client.GetChannel(ctx, f.publicOpen.Id)
		require.NoError(t, err, "public channel on an open team the bot has not joined")
		_, _, err = f.client.GetPostsForChannel(ctx, f.publicOpen.Id, 0, 10, "", false, false)
		require.NoError(t, err)

		_, _, err = f.client.GetTeam(ctx, f.openTeam.Id, "")
		require.NoError(t, err)
		_, _, err = f.client.GetUser(ctx, th.BasicUser.Id, "")
		require.NoError(t, err)
	})

	t.Run("an invite-only team is visible when it holds a listed channel", func(t *testing.T) {
		_, _, err := f.client.GetTeam(ctx, f.closedTeam.Id, "")
		require.NoError(t, err)

		otherPrivate := th.CreateChannelWithClientAndTeam(t, th.Client, model.ChannelTypePrivate, f.closedTeam.Id)
		otherPublic := th.CreateChannelWithClientAndTeam(t, th.Client, model.ChannelTypeOpen, f.closedTeam.Id)
		for _, channel := range []*model.Channel{otherPrivate, otherPublic} {
			_, resp, err := f.client.GetChannel(ctx, channel.Id)
			requireScopeError(t, resp, err)
			_, resp, err = f.client.GetPostsForChannel(ctx, channel.Id, 0, 10, "", false, false)
			requireScopeError(t, resp, err)
		}
	})

	t.Run("out-of-scope reads get the scope error", func(t *testing.T) {
		unlistedClosed := th.CreateTeam(t)
		unlistedClosed.AllowOpenInvite = false
		unlistedClosed.Type = model.TeamInvite
		_, err := th.App.Srv().Store().Team().Update(unlistedClosed)
		require.NoError(t, err)
		_, resp, err := f.client.GetTeam(ctx, unlistedClosed.Id, "")
		requireScopeError(t, resp, err)
		_, resp, err = f.client.GetChannel(ctx, f.memberPriv.Id)
		requireScopeError(t, resp, err)
		_, resp, err = f.client.GetPostsForChannel(ctx, f.memberPriv.Id, 0, 10, "", false, false)
		requireScopeError(t, resp, err)
	})

	t.Run("files", func(t *testing.T) {
		inScope := &model.FileInfo{CreatorId: th.BasicUser.Id, ChannelId: f.triggering.Id, Path: "scoped/" + model.NewId() + "/in.txt", Name: "in.txt", Size: 8}
		_, appErr := th.App.WriteFile(strings.NewReader("in scope"), inScope.Path)
		require.Nil(t, appErr)
		inScope, err := th.App.Srv().Store().FileInfo().Save(th.Context, inScope)
		require.NoError(t, err)
		_, _, err = f.client.GetFileInfo(ctx, inScope.Id)
		require.NoError(t, err)
		_, _, err = f.client.GetFile(ctx, inScope.Id)
		require.NoError(t, err)

		botsOwn := &model.FileInfo{CreatorId: f.bot.Id, ChannelId: f.botDM.Id, Path: "x/y.txt", Name: "y.txt"}
		botsOwn, err = th.App.Srv().Store().FileInfo().Save(th.Context, botsOwn)
		require.NoError(t, err)
		_, resp, err := f.client.GetFileInfo(ctx, botsOwn.Id)
		requireScopeError(t, resp, err)
		_, resp, err = f.client.GetFile(ctx, botsOwn.Id)
		requireScopeError(t, resp, err)
	})

	t.Run("writes are denied", func(t *testing.T) {
		_, resp, err := f.client.CreatePost(ctx, &model.Post{ChannelId: f.triggering.Id, Message: "nope"})
		requireScopeError(t, resp, err)
		_, resp, err = f.client.AddChannelMember(ctx, f.publicOpen.Id, f.bot.Id)
		requireScopeError(t, resp, err)
		_, resp, err = f.client.CreateUserAccessToken(ctx, f.bot.Id, "x", 0)
		requireScopeError(t, resp, err)
	})
}

func TestScopedSessionDMIsolation(t *testing.T) {
	th := Setup(t).InitBasic(t)
	f := setupScopedAPIFixture(t, th)
	ctx := context.Background()

	_, resp, err := f.client.GetPostsForChannel(ctx, f.botDM.Id, 0, 10, "", false, false)
	requireScopeError(t, resp, err)
	_, resp, err = f.client.GetChannel(ctx, f.botDM.Id)
	requireScopeError(t, resp, err)
	_, resp, err = f.client.GetPost(ctx, f.dmPost.Id, "")
	requireScopeError(t, resp, err)
	_, resp, err = f.client.GetPostThread(ctx, f.dmPost.Id, "", false)
	requireScopeError(t, resp, err)
	_, resp, err = f.client.GetFileInfosForPost(ctx, f.dmPost.Id, "")
	requireScopeError(t, resp, err)
	_, resp, err = f.client.CreatePost(ctx, &model.Post{ChannelId: f.botDM.Id, Message: "nope"})
	requireScopeError(t, resp, err)
	_, resp, err = f.client.SearchPosts(ctx, f.openTeam.Id, f.dmPost.Message, false)
	requireScopeError(t, resp, err)

	t.Run("a permalink to the DM in an in-scope post does not expose it", func(t *testing.T) {
		siteURL := fmt.Sprintf("http://localhost:%v", th.App.Srv().ListenAddr.Port)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = siteURL
			*cfg.ServiceSettings.EnablePermalinkPreviews = true
		})
		permalink := fmt.Sprintf("%s/%s/pl/%s", siteURL, f.openTeam.Name, f.dmPost.Id)
		post, _, err := th.Client.CreatePost(ctx, &model.Post{ChannelId: f.triggering.Id, Message: permalink})
		require.NoError(t, err)

		asMember, _, err := th.Client.GetPost(ctx, post.Id, "")
		require.NoError(t, err)
		require.True(t, hasPermalinkEmbed(asMember), "a DM member sees the preview")

		got, _, err := f.client.GetPost(ctx, post.Id, "")
		require.NoError(t, err)
		assert.False(t, hasPermalinkEmbed(got), "DM permalink preview must be stripped for the scoped session")
	})
}

func TestScopedSessionWebSocket(t *testing.T) {
	th := Setup(t).InitBasic(t)
	f := setupScopedAPIFixture(t, th)

	wsURL := fmt.Sprintf("ws://localhost:%v%s/websocket", th.App.Srv().ListenAddr.Port, model.APIURLSuffix)
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, http.Header{model.HeaderAuth: []string{model.HeaderBearer + " " + f.session.Token}})
	require.Error(t, err, "websocket upgrade with a scoped session is rejected")
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	resp.Body.Close()

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer conn.Close()
	require.NoError(t, conn.WriteJSON(map[string]any{
		"seq":    1,
		"action": model.WebsocketAuthenticationChallenge,
		"data":   map[string]any{"token": f.session.Token},
	}))
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(5*time.Second)))
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		assert.NotContains(t, string(msg), `"status":"OK"`, "auth challenge with a scoped token must not succeed")
		assert.NotContains(t, string(msg), model.WebsocketEventHello)
	}
}

func TestScopedSessionAuditMeta(t *testing.T) {
	th := Setup(t).InitBasic(t)
	f := setupScopedAPIFixture(t, th)

	c := &Context{App: th.App, AppContext: th.Context.WithSession(f.session)}
	rec := c.MakeAuditRecord(model.AuditEventGetPost, model.AuditStatusSuccess)
	assert.Equal(t, th.BasicUser.Id, rec.Meta[model.AuditKeyOnBehalfOfUserID])
	assert.Equal(t, "com.example.scoped", rec.Meta[model.AuditKeyCreatedByPluginID])
	assert.Equal(t, f.bot.Id, rec.Actor.UserId)

	unscoped := &Context{App: th.App, AppContext: th.Context.WithSession(&model.Session{UserId: f.bot.Id})}
	rec = unscoped.MakeAuditRecord(model.AuditEventGetPost, model.AuditStatusSuccess)
	assert.NotContains(t, rec.Meta, model.AuditKeyOnBehalfOfUserID)
	assert.NotContains(t, rec.Meta, model.AuditKeyCreatedByPluginID)
}
