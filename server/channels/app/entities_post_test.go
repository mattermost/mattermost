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

func TestPrivateEntityCardNeedsAPost(t *testing.T) {
	const pluginID = "com.example.privatecard"
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
		Cache:   model.EntityCacheNone,
	}))

	card, appErr := entityEnabledApp(nil).GetEntityCard(request.TestContext(t), typeID, "WX-100")
	require.Nil(t, card)
	require.NotNil(t, appErr)
	require.Equal(t, http.StatusForbidden, appErr.StatusCode)
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
