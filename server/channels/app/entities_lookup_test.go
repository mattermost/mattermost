// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
)

const entityLookupPlugin = `
	package main

	import (
		"encoding/json"
		"errors"

		"github.com/mattermost/mattermost/server/public/model"
		"github.com/mattermost/mattermost/server/public/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) OnActivate() error {
		if appErr := p.API.RegisterEntityType(&model.EntityType{Name: "mark", DisplayName: "Mark"}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityMatcher(&model.EntityMatcher{Name: "scan", Type: "mark", Pattern: "MARK-[0-9]+"}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityProvider(&model.EntityProvider{
			Name:    "card",
			Types:   []string{"mark"},
			HasCard: true,
			Cache:   model.EntityCacheNone,
		}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityTerms("mark", []model.EntityTerm{{
			Value: "MLT",
			Title: "Mattermost leadership team",
			URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
		}}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityType(&model.EntityType{Name: "run", DisplayName: "Run"}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityMatcher(&model.EntityMatcher{Name: "run.scan", Type: "run", Pattern: "RUN-[0-9]+"}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityProvider(&model.EntityProvider{
			Name:    "run.card",
			Types:   []string{"run"},
			HasCard: true,
			Cache:   model.EntityCacheShared,
		}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityType(&model.EntityType{Name: "zone", DisplayName: "Zone"}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityMatcher(&model.EntityMatcher{
			Name:    "zone.scan",
			Type:    "zone",
			Pattern: "ZONE-[0-9]+",
			Scope:   []string{"security"},
		}); appErr != nil {
			return appErr
		}
		if appErr := p.API.RegisterEntityProvider(&model.EntityProvider{
			Name:    "zone.card",
			Types:   []string{"zone"},
			HasCard: true,
			Cache:   model.EntityCacheNone,
		}); appErr != nil {
			return appErr
		}
		return nil
	}

	func (p *MyPlugin) EntityLookup(c *plugin.Context, req *model.EntityLookupRequest) (*model.EntityCard, error) {
		raw, err := json.Marshal(req)
		if err != nil {
			return nil, err
		}
		if appErr := p.API.KVSet("lookup-"+req.Value, raw); appErr != nil {
			return nil, appErr
		}
		if req.Value == "MARK-404" || req.Value == "MARK-403" {
			return nil, errors.New("no card")
		}
		return &model.EntityCard{Title: "opened " + req.Value, Summary: "from the plugin"}, nil
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
`

func TestEntityLookupHook(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.Entities = true
	}).InitBasic(t)

	tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{entityLookupPlugin}, th.App, th.NewPluginAPI)
	t.Cleanup(tearDown)
	require.Len(t, pluginIDs, 1)
	require.NoError(t, activationErrors[0])
	pluginID := pluginIDs[0]
	t.Cleanup(func() { entities.RemoveOwner(pluginID) })

	typeID := pluginID + ":mark"
	reader := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id, Roles: model.SystemUserRoleId})

	recorded := func(t *testing.T, value string) *model.EntityLookupRequest {
		t.Helper()
		raw, appErr := th.App.GetPluginKey(pluginID, "lookup-"+value)
		require.Nil(t, appErr)
		require.NotEmpty(t, raw)
		var req model.EntityLookupRequest
		require.NoError(t, json.Unmarshal(raw, &req))
		return &req
	}

	t.Run("a matching post asks the plugin", func(t *testing.T) {
		post := th.CreateMessagePost(t, th.BasicChannel, "see MARK-100 today")
		card, err := th.App.GetEntityCardFromPost(reader, post.Id, typeID, "MARK-100")
		require.NoError(t, err)
		require.Equal(t, "opened MARK-100", card.Title)
		require.Equal(t, "from the plugin", card.Summary)
		require.Equal(t, typeID, card.TypeID)
		require.Equal(t, "MARK-100", card.Value)

		req := recorded(t, "MARK-100")
		require.Equal(t, "card", req.Provider)
		require.Equal(t, "mark", req.Type)
		require.Equal(t, "MARK-100", req.Value)
		require.Equal(t, th.BasicUser.Id, req.UserID)
		require.Equal(t, post.Id, req.PostID)
		require.Equal(t, post.CreateAt, req.CreateAt)
	})

	t.Run("a lookup error does not return the provider card", func(t *testing.T) {
		post := th.CreateMessagePost(t, th.BasicChannel, "see MARK-404 today")
		card, err := th.App.GetEntityCardFromPost(reader, post.Id, typeID, "MARK-404")
		require.NoError(t, err)
		require.Equal(t, "MARK-404", card.Title)
		require.Empty(t, card.Summary)

		req := recorded(t, "MARK-404")
		require.Equal(t, "MARK-404", req.Value)
		require.Equal(t, post.Id, req.PostID)
	})

	t.Run("a shared provider is told the caller when there is no post", func(t *testing.T) {
		post := th.CreateMessagePost(t, th.BasicChannel, "see RUN-1 today")
		card, err := th.App.GetEntityCardFromPost(reader, post.Id, pluginID+":run", "RUN-1")
		require.NoError(t, err)
		require.Equal(t, "opened RUN-1", card.Title)
		fromPost := recorded(t, "RUN-1")
		require.Equal(t, th.BasicUser.Id, fromPost.UserID)
		require.Equal(t, post.Id, fromPost.PostID)

		card, err = th.App.GetEntityCard(reader, pluginID+":run", "RUN-2")
		require.NoError(t, err)
		require.Equal(t, "opened RUN-2", card.Title)
		bare := recorded(t, "RUN-2")
		require.Equal(t, th.BasicUser.Id, bare.UserID)
		require.Empty(t, bare.PostID)
	})

	t.Run("a glossary term is not asked when there is no post", func(t *testing.T) {
		card, err := th.App.GetEntityCard(reader, typeID, "MLT")
		require.Nil(t, card)
		appErr := model.AsAppError(err)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		require.NotContains(t, appErr.Id+appErr.Message+appErr.DetailedError, "Mattermost leadership team")

		raw, keyErr := th.App.GetPluginKey(pluginID, "lookup-MLT")
		require.Nil(t, keyErr)
		require.Empty(t, raw)

		unknown, err := th.App.GetEntityCard(reader, typeID, "ZZZ")
		require.Nil(t, unknown)
		unknownErr := model.AsAppError(err)
		require.NotNil(t, unknownErr)
		require.Equal(t, appErr.Id, unknownErr.Id)
		require.Equal(t, appErr.StatusCode, unknownErr.StatusCode)
	})

	t.Run("a lookup with no post asks the plugin about this user", func(t *testing.T) {
		card, err := th.App.GetEntityCard(reader, typeID, "MARK-200")
		require.NoError(t, err)
		require.Equal(t, "opened MARK-200", card.Title)
		require.Equal(t, "from the plugin", card.Summary)

		req := recorded(t, "MARK-200")
		require.Equal(t, th.BasicUser.Id, req.UserID)
		require.Empty(t, req.PostID)
		require.Zero(t, req.CreateAt)
	})

	t.Run("a scoped matcher is not asked when there is no post", func(t *testing.T) {
		require.NotEqual(t, "security", th.BasicTeam.Name)
		zoneID := pluginID + ":zone"
		post := th.CreateMessagePost(t, th.BasicChannel, "see ZONE-100 today")
		fromPost, err := th.App.GetEntityCardFromPost(reader, post.Id, zoneID, "ZONE-100")
		require.Nil(t, fromPost)
		postErr := model.AsAppError(err)
		require.NotNil(t, postErr)
		require.Equal(t, http.StatusNotFound, postErr.StatusCode)

		card, err := th.App.GetEntityCard(reader, zoneID, "ZONE-100")
		require.Nil(t, card)
		appErr := model.AsAppError(err)
		require.NotNil(t, appErr)
		require.Equal(t, "api.context.permissions.app_error", appErr.Id)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		raw, keyErr := th.App.GetPluginKey(pluginID, "lookup-ZONE-100")
		require.Nil(t, keyErr)
		require.Empty(t, raw)

		require.NoError(t, th.App.RegisterPluginEntityMatcher(pluginID, &model.EntityMatcher{
			Name:    "zone.open",
			Type:    "zone",
			Pattern: "ZONE-[0-9]+",
		}))
		t.Cleanup(func() {
			_ = th.App.UnregisterPluginEntityMatcher(pluginID, "zone.open")
		})
		card, err = th.App.GetEntityCard(reader, zoneID, "ZONE-200")
		require.NoError(t, err)
		require.Equal(t, "opened ZONE-200", card.Title)
		req := recorded(t, "ZONE-200")
		require.Equal(t, th.BasicUser.Id, req.UserID)
		require.Empty(t, req.PostID)
	})

	t.Run("the plugin can refuse a lookup that has no post", func(t *testing.T) {
		card, err := th.App.GetEntityCard(reader, typeID, "MARK-403")
		require.Nil(t, card)
		appErr := model.AsAppError(err)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		require.NotContains(t, appErr.Id+appErr.Message+appErr.DetailedError, "opened MARK-403")

		req := recorded(t, "MARK-403")
		require.Equal(t, th.BasicUser.Id, req.UserID)
		require.Empty(t, req.PostID)
	})
}
