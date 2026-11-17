// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
)

// postSyncRecorder stands in for a remote and records every post it is sent.
type postSyncRecorder struct {
	mu       sync.Mutex
	sends    map[string]int
	messages map[string]string
}

func newPostSyncRecorder() *postSyncRecorder {
	return &postSyncRecorder{sends: map[string]int{}, messages: map[string]string{}}
}

func (r *postSyncRecorder) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path == "/api/v4/remotecluster/msg" {
		body, _ := io.ReadAll(req.Body)
		var frame model.RemoteClusterFrame
		var syncMsg model.SyncMsg
		if json.Unmarshal(body, &frame) == nil && frame.Msg.Topic == sharedchannel.TopicSync &&
			json.Unmarshal(frame.Msg.Payload, &syncMsg) == nil {
			r.mu.Lock()
			for _, p := range syncMsg.Posts {
				r.sends[p.Id]++
				r.messages[p.Id] = p.Message
			}
			r.mu.Unlock()
		}
	}
	writeOKResponse(w)
}

func (r *postSyncRecorder) sendCount(postID string) int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.sends[postID]
}

func (r *postSyncRecorder) message(postID string) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.messages[postID]
}

func TestSharedChannelPostSyncSelfReferential(t *testing.T) {
	th := setupSharedChannels(t).InitBasic(t)
	ss := th.App.Srv().Store()

	service, ok := th.App.Srv().GetSharedChannelSyncService().(*sharedchannel.Service)
	require.True(t, ok, "Expected sharedchannel.Service concrete type")
	require.NoError(t, service.Start())
	require.Eventually(t, service.Active, 5*time.Second, 100*time.Millisecond)

	if rcService := th.App.Srv().GetRemoteClusterService(); rcService != nil {
		_ = rcService.Start()
		require.Eventually(t, rcService.Active, 5*time.Second, 100*time.Millisecond)
	}

	const maxPostsPerSync = 5

	// setup shares a new channel with a remote whose post cursor starts now, so only
	// posts made by the test are synced.
	setup := func(t *testing.T) (*postSyncRecorder, *model.Channel) {
		EnsureCleanState(t, th, ss)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ConnectedWorkspacesSettings.MaxPostsPerSync = model.NewPointer(maxPostsPerSync)
		})

		recorder := newPostSyncRecorder()
		testServer := httptest.NewServer(recorder)
		t.Cleanup(testServer.Close)

		channel := th.CreateChannel(t, th.BasicTeam)
		_, err := th.App.ShareChannel(th.Context, &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    th.BasicTeam.Id,
			Home:      true,
			ShareName: "post-sync-test",
			CreatorId: th.BasicUser.Id,
		})
		require.NoError(t, err)

		rc, err := ss.RemoteCluster().Save(&model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		})
		require.NoError(t, err)

		now := model.GetMillis()
		_, err = ss.SharedChannel().SaveRemote(&model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			RemoteId:          rc.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			LastPostCreateAt:  now,
			LastPostUpdateAt:  now,
		})
		require.NoError(t, err)

		return recorder, channel
	}

	createPost := func(t *testing.T, channel *model.Channel, message string) *model.Post {
		post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: channel.Id,
			Message:   message,
		}, channel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		return post
	}

	waitForSyncs := func(t *testing.T, done func() bool, msg string) {
		require.Eventually(t, func() bool {
			return done() && !service.HasPendingTasksForTesting()
		}, 30*time.Second, 100*time.Millisecond, msg)
	}

	t.Run("each new post is sent once across consecutive syncs", func(t *testing.T) {
		recorder, channel := setup(t)

		var posts []*model.Post
		for i := range 4 {
			post := createPost(t, channel, fmt.Sprintf("post %d", i))
			posts = append(posts, post)
			waitForSyncs(t, func() bool { return recorder.sendCount(post.Id) > 0 }, "post was not synced")
		}

		// The last post only marks that every earlier sync has finished; tasks run one at a time.
		for i, post := range posts[:len(posts)-1] {
			assert.Equal(t, 1, recorder.sendCount(post.Id), "post %d", i)
		}
	})

	t.Run("edits behind a full updated page are sent without further activity", func(t *testing.T) {
		recorder, channel := setup(t)

		older := make([]*model.Post, maxPostsPerSync+1)
		for i := range older {
			older[i] = createPost(t, channel, fmt.Sprintf("older %d", i))
		}
		waitForSyncs(t, func() bool { return recorder.sendCount(older[len(older)-1].Id) > 0 }, "older posts were not synced")

		// New posts come first, so their UpdateAt sorts before the edits and the updated-posts
		// page fills up with posts the same sync already fetched as new. Writing to the store
		// skips the change events, so one sync sees all of it.
		for i := range 3 {
			_, err := ss.Post().Save(th.Context, &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: channel.Id,
				Message:   fmt.Sprintf("new %d", i),
			})
			require.NoError(t, err)
		}
		for i, post := range older {
			edited := post.Clone()
			edited.Message = fmt.Sprintf("edited %d", i)
			edited.EditAt = model.GetMillis()
			_, err := ss.Post().Overwrite(th.Context, edited)
			require.NoError(t, err)
		}
		service.NotifyChannelChanged(channel.Id)

		waitForSyncs(t, func() bool {
			for i, post := range older {
				if recorder.message(post.Id) != fmt.Sprintf("edited %d", i) {
					return false
				}
			}
			return true
		}, "edits were not all synced")
	})
}
