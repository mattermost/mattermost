// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// Entity API tests use t.Setenv("MM_ENTITIES"), which cannot be combined with
// t.Parallel (Go forbids Setenv after Parallel and vice versa).

func TestGetEntityCardRequiresSession(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "1")

	client := th.CreateClient()
	resp, err := client.DoAPIGet(context.Background(), "/entities/card?type_id=mm.time&value="+url.QueryEscape("2024-06-01T15:04:05Z"), "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, model.BuildResponse(resp))
}

func TestGetEntityCardFeatureOff(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "0")
	th.App.UpdateConfig(func(cfg *model.Config) {
		if cfg.FeatureFlags == nil {
			cfg.FeatureFlags = &model.FeatureFlags{}
		}
		cfg.FeatureFlags.Entities = false
	})

	resp, err := th.Client.DoAPIGet(context.Background(), "/entities/card?type_id=mm.time&value="+url.QueryEscape("2024-06-01T15:04:05Z"), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, model.BuildResponse(resp))
}

func TestGetEntityCardHappyPath(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "1")

	value := "2024-06-01T15:04:05Z"
	resp, err := th.Client.DoAPIGet(context.Background(), "/entities/card?type_id=mm.time&value="+url.QueryEscape(value), "")
	require.NoError(t, err)
	CheckOKStatus(t, model.BuildResponse(resp))
	defer resp.Body.Close()

	var card model.EntityCard
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&card))
	require.Equal(t, "mm.time", card.TypeID)
	require.Equal(t, value, card.Value)
	require.NotZero(t, card.Instant)
}

func TestGetEntityCardFromPostRequiresReadAccess(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "1")

	post := th.CreatePost(t)
	other := th.CreateClient()
	th.LoginBasic2WithClient(t, other)

	private := th.CreatePrivateChannel(t)
	privatePost, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: private.Id,
		Message:   "shipped at 2024-06-01T15:04:05Z",
	})
	require.NoError(t, err)

	resp, err := other.DoAPIGet(context.Background(), "/entities/card?post_id="+privatePost.Id+"&type_id=mm.time&value="+url.QueryEscape("2024-06-01T15:04:05Z"), "")
	require.Error(t, err)
	require.True(t, resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound)

	resp, err = th.Client.DoAPIGet(context.Background(), "/entities/card?post_id="+post.Id+"&type_id=mm.time&value="+url.QueryEscape("2024-06-01T15:04:05Z"), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, model.BuildResponse(resp))
}

func TestGetEntityCardForOccurrence(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "1")

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
	resp, err := th.Client.DoAPIGet(context.Background(), "/entities/card?post_id="+created.Id+"&id="+url.QueryEscape(entity.ID)+"&type_id=mm.time", "")
	require.NoError(t, err)
	CheckOKStatus(t, model.BuildResponse(resp))
	defer resp.Body.Close()

	var card model.EntityCard
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&card))
	require.Equal(t, "mm.time", card.TypeID)
	require.Equal(t, entity.Value, card.Value)
}

func TestGetEntityPostsRequiresSession(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "1")

	client := th.CreateClient()
	resp, err := client.DoAPIPost(context.Background(), "/entities/posts", `{"post_ids":["`+model.NewId()+`"]}`)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, model.BuildResponse(resp))
}

func TestGetEntityPostsFeatureOff(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "0")
	th.App.UpdateConfig(func(cfg *model.Config) {
		if cfg.FeatureFlags == nil {
			cfg.FeatureFlags = &model.FeatureFlags{}
		}
		cfg.FeatureFlags.Entities = false
	})

	resp, err := th.Client.DoAPIPost(context.Background(), "/entities/posts", `{"post_ids":["`+th.BasicPost.Id+`"]}`)
	require.Error(t, err)
	CheckNotFoundStatus(t, model.BuildResponse(resp))
}

func TestGetEntityPostsRejectsOversizedBody(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "1")

	ids := make([]string, 201)
	for i := range ids {
		ids[i] = model.NewId()
	}
	body, err := json.Marshal(map[string]any{"post_ids": ids})
	require.NoError(t, err)

	resp, err := th.Client.DoAPIPost(context.Background(), "/entities/posts", string(body))
	require.Error(t, err)
	CheckBadRequestStatus(t, model.BuildResponse(resp))
}

func TestGetEntityPostsHappyPathAndSkipsUnread(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "1")

	created, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "deadline 2024-06-01T15:04:05Z",
	})
	require.NoError(t, err)

	private := th.CreatePrivateChannel(t)
	hidden, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: private.Id,
		Message:   "hidden 2024-06-01T15:04:05Z",
	})
	require.NoError(t, err)

	other := th.CreateClient()
	th.LoginBasic2WithClient(t, other)

	body, err := json.Marshal(map[string]any{"post_ids": []string{created.Id, hidden.Id, model.NewId()}})
	require.NoError(t, err)
	resp, err := other.DoAPIPost(context.Background(), "/entities/posts", string(body))
	require.NoError(t, err)
	CheckOKStatus(t, model.BuildResponse(resp))
	defer resp.Body.Close()

	var payload struct {
		Posts map[string][]*model.PostEntity `json:"posts"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))
	require.Contains(t, payload.Posts, created.Id)
	require.NotEmpty(t, payload.Posts[created.Id])
	_, hasHidden := payload.Posts[hidden.Id]
	require.False(t, hasHidden)
}

func TestGetPostIncludesEntityEtag(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Setenv("MM_ENTITIES", "1")

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
	require.Contains(t, etag, ".")

	_, resp, err = th.Client.GetPost(context.Background(), created.Id, etag)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotModified, resp.StatusCode)
}
