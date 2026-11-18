// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func enableEntities(cfg *model.Config) {
	if cfg.FeatureFlags == nil {
		cfg.FeatureFlags = &model.FeatureFlags{}
	}
	cfg.FeatureFlags.Entities = true
}

func TestGetEntityCardRequiresSession(t *testing.T) {
	th := SetupConfig(t, enableEntities).InitBasic(t)

	client := th.CreateClient()
	resp, err := client.DoAPIGet(context.Background(), "/entities/card?type_id=mm:time&value="+url.QueryEscape("2024-06-01T15:04:05Z"), "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, model.BuildResponse(resp))
}

func TestGetEntityCardFeatureOff(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		if cfg.FeatureFlags == nil {
			cfg.FeatureFlags = &model.FeatureFlags{}
		}
		cfg.FeatureFlags.Entities = false
	})

	resp, err := th.Client.DoAPIGet(context.Background(), "/entities/card?type_id=mm:time&value="+url.QueryEscape("2024-06-01T15:04:05Z"), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, model.BuildResponse(resp))
}

func TestGetEntityCardHappyPath(t *testing.T) {
	th := SetupConfig(t, enableEntities).InitBasic(t)

	value := "2024-06-01T15:04:05Z"
	resp, err := th.Client.DoAPIGet(context.Background(), "/entities/card?type_id=mm:time&value="+url.QueryEscape(value), "")
	require.NoError(t, err)
	CheckOKStatus(t, model.BuildResponse(resp))
	defer resp.Body.Close()

	var card model.EntityCard
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&card))
	require.Equal(t, "mm:time", card.TypeID)
	require.Equal(t, value, card.Value)
	require.NotZero(t, card.Instant)
}

func TestGetEntityCardFromPostRequiresReadAccess(t *testing.T) {
	th := SetupConfig(t, enableEntities).InitBasic(t)

	post := th.CreatePost(t)
	other := th.CreateClient()
	th.LoginBasic2WithClient(t, other)

	private := th.CreatePrivateChannel(t)
	privatePost, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: private.Id,
		Message:   "shipped at 2024-06-01T15:04:05Z",
	})
	require.NoError(t, err)

	resp, err := other.DoAPIGet(context.Background(), "/entities/card?post_id="+privatePost.Id+"&type_id=mm:time&value="+url.QueryEscape("2024-06-01T15:04:05Z"), "")
	require.Error(t, err)
	require.True(t, resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound)

	resp, err = th.Client.DoAPIGet(context.Background(), "/entities/card?post_id="+post.Id+"&type_id=mm:time&value="+url.QueryEscape("2024-06-01T15:04:05Z"), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, model.BuildResponse(resp))
}

func TestGetEntityCardForOccurrence(t *testing.T) {
	th := SetupConfig(t, enableEntities).InitBasic(t)

	created, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "shipped at 2024-06-01T15:04:05Z today",
	})
	require.NoError(t, err)

	got, _, err := th.Client.GetPost(context.Background(), created.Id, "")
	require.NoError(t, err)
	require.NotNil(t, got.Metadata)
	require.NotEmpty(t, got.Metadata.Entities)

	entity := got.Metadata.Entities[0]
	resp, err := th.Client.DoAPIGet(context.Background(), "/entities/card?post_id="+created.Id+"&id="+url.QueryEscape(entity.ID)+"&type_id=mm:time", "")
	require.NoError(t, err)
	CheckOKStatus(t, model.BuildResponse(resp))
	defer resp.Body.Close()

	var card model.EntityCard
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&card))
	require.Equal(t, "mm:time", card.TypeID)
	require.Equal(t, entity.Value, card.Value)
}

func TestGetEntityCardUsesThePostDate(t *testing.T) {
	th := SetupConfig(t, enableEntities).InitBasic(t)

	posted := time.Date(2020, time.March, 15, 12, 0, 0, 0, time.UTC)
	clock := "16:30 CET"
	rfc3339 := "2024-06-01T15:04:05Z"
	created, _, err := th.SystemAdminClient.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "meet at " + clock + " and shipped " + rfc3339,
		CreateAt:  posted.UnixMilli(),
	})
	require.NoError(t, err)
	require.Equal(t, posted.UnixMilli(), created.CreateAt)

	got, _, err := th.Client.GetPost(context.Background(), created.Id, "")
	require.NoError(t, err)
	require.NotNil(t, got.Metadata)

	var clockID string
	for _, entity := range got.Metadata.Entities {
		if entity.Value == clock {
			clockID = entity.ID
		}
	}
	require.NotEmpty(t, clockID)

	fetch := func(value, occurrence string) model.EntityCard {
		t.Helper()
		path := "/entities/card?post_id=" + created.Id + "&type_id=mm:time"
		if value != "" {
			path += "&value=" + url.QueryEscape(value)
		}
		if occurrence != "" {
			path += "&id=" + url.QueryEscape(occurrence)
		}
		resp, fetchErr := th.Client.DoAPIGet(context.Background(), path, "")
		require.NoError(t, fetchErr)
		CheckOKStatus(t, model.BuildResponse(resp))
		defer resp.Body.Close()
		var card model.EntityCard
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&card))
		return card
	}

	fromValue := fetch(clock, "")
	require.Equal(t, time.Date(2020, time.March, 15, 15, 30, 0, 0, time.UTC).UnixMilli(), fromValue.Instant)

	fromOccurrence := fetch("", clockID)
	require.Equal(t, fromValue.Instant, fromOccurrence.Instant)

	rfc := fetch(rfc3339, "")
	require.Equal(t, time.Date(2024, time.June, 1, 15, 4, 5, 0, time.UTC).UnixMilli(), rfc.Instant)
}

func TestGetPostIncludesEntityEtag(t *testing.T) {
	th := SetupConfig(t, enableEntities).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	created, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "check etag 2024-06-01T15:04:05Z",
	})
	require.NoError(t, err)

	got, resp, err := th.Client.GetPost(context.Background(), created.Id, "")
	require.NoError(t, err)
	require.NotNil(t, got.Metadata)
	require.NotEmpty(t, got.Metadata.Entities)
	etag := resp.Header.Get(model.HeaderEtagServer)
	require.NotEmpty(t, etag)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Entities = false
	})
	_, respOff, err := th.Client.GetPost(context.Background(), created.Id, "")
	require.NoError(t, err)
	etagOff := respOff.Header.Get(model.HeaderEtagServer)
	require.NotEmpty(t, etagOff)
	require.NotEqual(t, etagOff, etag)
	require.True(t, strings.HasPrefix(etag, etagOff+"."))

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.Entities = true
	})
	_, resp, err = th.Client.GetPost(context.Background(), created.Id, etag)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotModified, resp.StatusCode)
}
