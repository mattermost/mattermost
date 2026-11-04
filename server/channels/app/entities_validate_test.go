// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/entities"
)

func TestEntityValidateCacheKeepsThePostTime(t *testing.T) {
	t.Cleanup(func() {
		validateMu.Lock()
		validateCache = map[string]validateHit{}
		validateMu.Unlock()
	})

	generation := entities.PatternGeneration()
	rememberAccept("com.example", "com.example.dtg", "311200Z", 1_700_000_000_000, generation, true)
	ok, hit := cachedAccept("com.example", "com.example.dtg", "311200Z", 1_700_000_000_000, generation)
	require.True(t, hit)
	require.True(t, ok)

	_, otherMonth := cachedAccept("com.example", "com.example.dtg", "311200Z", 1_697_000_000_000, generation)
	require.False(t, otherMonth)

	_, otherGeneration := cachedAccept("com.example", "com.example.dtg", "311200Z", 1_700_000_000_000, generation+"x")
	require.False(t, otherGeneration)
}

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
}

func TestPostContainsEntityRequiresTheValue(t *testing.T) {
	post := &model.Post{Metadata: &model.PostMetadata{Entities: []*model.PostEntity{{
		TypeIDs: []string{"com.example.mark"},
		Value:   "WX-100",
	}}}}
	require.True(t, postContainsEntity(post, "com.example.mark", "WX-100"))
	require.False(t, postContainsEntity(post, "com.example.mark", "WX-200"))
	require.False(t, postContainsEntity(post, "com.example.other", "WX-100"))
}

func TestPrivateEntityCardNeedsAPost(t *testing.T) {
	t.Setenv("MM_ENTITIES", "1")
	const pluginID = "com.example.privatecard"
	typeID := pluginID + ".mark"
	t.Cleanup(func() { entities.RemovePlugin(pluginID) })
	require.NoError(t, entities.AddType(pluginID, &model.EntityType{ID: typeID, DisplayName: "Mark"}))
	require.NoError(t, entities.AddMatcher(pluginID, &model.EntityMatcher{
		ID:      typeID + ".scan",
		TypeID:  typeID,
		Pattern: `WX-[0-9]+`,
	}))
	require.NoError(t, entities.AddProvider(pluginID, &model.EntityProvider{
		ID:      typeID + ".card",
		TypeIDs: []string{typeID},
		HasCard: true,
		Cache:   model.EntityCacheNone,
	}))

	card, appErr := (&App{}).GetEntityCard(request.TestContext(t), typeID, "WX-100")
	require.Nil(t, card)
	require.NotNil(t, appErr)
	require.Equal(t, http.StatusForbidden, appErr.StatusCode)
}
