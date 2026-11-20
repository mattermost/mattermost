// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
)

func TestEphemeralPostsAreNotScanned(t *testing.T) {
	require.False(t, shouldDetectEntities(&model.Post{
		Id:      "postid00000000000000000000",
		Type:    model.PostTypeEphemeral,
		Message: "FREQ: 243.0",
	}))
	require.False(t, shouldDetectEntities(&model.Post{
		Id:       "postid00000000000000000000",
		Message:  "FREQ: 243.0",
		DeleteAt: 1,
	}))
	require.False(t, shouldDetectEntities(&model.Post{
		Id:      "postid00000000000000000000",
		Type:    "custom_tf_location",
		Message: "at 38.8977,-77.0365",
	}))
}

func TestPostContainsEntityRequiresTheValue(t *testing.T) {
	post := &model.Post{Metadata: &model.PostMetadata{Entities: []*model.PostEntity{{
		TypeIDs: []string{"com.example:mark"},
		Value:   "WX-100",
	}}}}
	require.True(t, postContainsEntity(post, "com.example:mark", "WX-100"))
	require.False(t, postContainsEntity(post, "com.example:mark", "WX-200"))
	require.False(t, postContainsEntity(post, "com.example:other", "WX-100"))
}

func TestProviderEntityCardWithoutAnAnswerIsRefused(t *testing.T) {
	for _, cache := range []string{model.EntityCacheNone, model.EntityCacheShared, model.EntityCacheUser} {
		t.Run(cache, func(t *testing.T) {
			pluginID := "com.example.card." + cache
			typeID := pluginID + ":mark"
			t.Cleanup(func() { entities.RemoveOwner(pluginID) })
			require.NoError(t, entities.AddType(pluginID, &model.EntityType{Name: "mark", DisplayName: "Mark"}))
			require.NoError(t, entities.AddMatcher(pluginID, &model.EntityMatcher{
				Name:    "scan",
				Type:    typeID,
				Pattern: `WX-[0-9]+`,
			}))
			require.NoError(t, entities.AddProvider(pluginID, &model.EntityProvider{
				Name:    "card",
				Types:   []string{typeID},
				HasCard: true,
				Cache:   cache,
			}))

			card, err := entityEnabledApp(nil).GetEntityCard(request.TestContext(t), typeID, "WX-100")
			require.Nil(t, card)
			appErr := model.AsAppError(err)
			require.NotNil(t, appErr)
			require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		})
	}
}

func TestScopedMatcherOnCoreTimeLeavesTheClock(t *testing.T) {
	const pluginID = "com.example.scopedtime"
	t.Cleanup(func() { entities.RemoveOwner(pluginID) })
	require.NoError(t, entities.AddMatcher(pluginID, &model.EntityMatcher{
		Name:    "zone",
		Type:    "mm:time",
		Pattern: `ZXSCOPE-[0-9]{4}`,
		Scope:   []string{"security"},
	}))
	require.NoError(t, entities.AddProvider(pluginID, &model.EntityProvider{
		Name:    "card",
		Types:   []string{"mm:time"},
		HasCard: true,
	}))

	card, err := entityEnabledApp(nil).GetEntityCard(request.TestContext(t), entities.CoreTimeTypeID, "ZXSCOPE-1000")
	require.Nil(t, card)
	appErr := model.AsAppError(err)
	require.NotNil(t, appErr)
	require.Equal(t, "api.context.invalid_url_param.app_error", appErr.Id)
	require.Equal(t, http.StatusBadRequest, appErr.StatusCode)

	clock, clockErr := entityEnabledApp(nil).GetEntityCard(request.TestContext(t), entities.CoreTimeTypeID, "2024-06-01T15:04:05Z")
	require.NoError(t, clockErr)
	require.Equal(t, entities.CoreTimeTypeID, clock.TypeID)
	require.NotZero(t, clock.Instant)
}

func TestTermCardNeedsAPost(t *testing.T) {
	const pluginID = "com.example.glossary"
	typeID := pluginID + ":acronym"
	t.Cleanup(func() { entities.RemoveOwner(pluginID) })
	require.NoError(t, entities.AddType(pluginID, &model.EntityType{Name: "acronym", DisplayName: "Acronym"}))
	_, _, err := entities.ReplaceTerms(pluginID, typeID, []model.EntityTerm{{
		Value: "MLT",
		Title: "Mattermost leadership team",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.NoError(t, err)

	app := entityEnabledApp(nil)
	for _, value := range []string{"MLT", "ZZZ"} {
		card, cardErr := app.GetEntityCard(request.TestContext(t), typeID, value)
		require.Nil(t, card)
		appErr := model.AsAppError(cardErr)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		require.Equal(t, "api.context.permissions.app_error", appErr.Id)
	}

	clock, err := app.GetEntityCard(request.TestContext(t), "mm:time", "2024-06-01T15:04:05Z")
	require.NoError(t, err)
	require.Equal(t, "mm:time", clock.TypeID)
	require.NotZero(t, clock.Instant)
}

func TestEntityCardLinksAreQualifiedByTheProvider(t *testing.T) {
	card := &model.EntityCard{Related: []model.EntityCardLink{
		{Label: "own", TypeID: "vuln"},
		{Label: "core", TypeID: "mm:time"},
		{Label: "bad", TypeID: "Not Valid"},
		{Label: "plain"},
	}}
	qualifyEntityCardLinks("com.example.security", card)
	assert.Equal(t, "com.example.security:vuln", card.Related[0].TypeID)
	assert.Equal(t, "mm:time", card.Related[1].TypeID)
	assert.Empty(t, card.Related[2].TypeID)
	assert.Empty(t, card.Related[3].TypeID)
}

func TestRelatedTermTakesItsStoredLink(t *testing.T) {
	const pluginID = "com.example.glossary"
	typeID := pluginID + ":acronym"
	t.Cleanup(func() { entities.RemoveOwner(pluginID) })
	require.NoError(t, entities.AddType(pluginID, &model.EntityType{Name: "acronym", DisplayName: "Acronym"}))
	_, _, err := entities.ReplaceTerms(pluginID, typeID, []model.EntityTerm{{
		Value: "MLT",
		Title: "Mattermost leadership team",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.NoError(t, err)

	card := &model.EntityCard{Related: []model.EntityCardLink{
		{Label: "Glossary", Text: "MLT", TypeID: "acronym"},
		{Text: "MLT", TypeID: typeID},
		{Label: "Kept", Text: "MLT", TypeID: typeID, URL: "https://example.com/kept"},
		{Label: "When", Text: "16:30 CET", TypeID: "mm:time"},
	}}
	qualifyEntityCardLinks(pluginID, card)

	assert.Equal(t, typeID, card.Related[0].TypeID)
	assert.Equal(t, "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz", card.Related[0].URL)
	assert.Equal(t, "Glossary", card.Related[0].Label)
	assert.Equal(t, "Mattermost leadership team", card.Related[1].Label)
	assert.Equal(t, card.Related[0].URL, card.Related[1].URL)
	assert.Equal(t, "https://example.com/kept", card.Related[2].URL)
	assert.Empty(t, card.Related[3].URL)
}

func TestLocalizeEntityCardTranslatesCoreTime(t *testing.T) {
	rctx := request.TestContext(t).WithT(func(id string, _ ...any) string { return "t:" + id })

	card := &model.EntityCard{TypeID: entities.CoreTimeTypeID, Value: "2024-06-01T15:04:05Z", Title: "Timestamp", Instant: 1717254245000}
	localizeEntityCard(rctx, card)
	assert.Equal(t, "t:app.entities.core.timestamp_title", card.Title)
	assert.Contains(t, string(card.Blocks), "t:app.entities.core.timestamp_utc")

	other := &model.EntityCard{TypeID: "com.example:ticket", Title: "Ticket"}
	localizeEntityCard(rctx, other)
	assert.Equal(t, "Ticket", other.Title)
}
