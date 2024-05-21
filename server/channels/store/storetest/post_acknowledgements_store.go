// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestPostAcknowledgementsStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testPostAcknowledgementsStoreSave(t, rctx, ss) })
	t.Run("GetForPost", func(t *testing.T) { testPostAcknowledgementsStoreGetForPost(t, rctx, ss) })
	t.Run("GetForPosts", func(t *testing.T) { testPostAcknowledgementsStoreGetForPosts(t, rctx, ss) })
}

func testPostAcknowledgementsStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	userId1 := model.NewId()

	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestId()
	p1.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewString("important"),
			RequestedAck:            model.NewBool(true),
			PersistentNotifications: model.NewBool(false),
		},
	}
	post, err := ss.Post().Save(rctx, &p1)
	require.NoError(t, err)

	t.Run("consecutive saves should just update the acknowledged at", func(t *testing.T) {
		_, err := ss.PostAcknowledgement().Save(post.Id, userId1, 0)
		require.NoError(t, err)

		_, err = ss.PostAcknowledgement().Save(post.Id, userId1, 0)
		require.NoError(t, err)

		ack1, err := ss.PostAcknowledgement().Save(post.Id, userId1, 0)
		require.NoError(t, err)

		acknowledgements, err := ss.PostAcknowledgement().GetForPost(post.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack1})
	})

	t.Run("saving should update the update at of the post", func(t *testing.T) {
		oldUpdateAt := post.UpdateAt
		_, err := ss.PostAcknowledgement().Save(post.Id, userId1, 0)
		require.NoError(t, err)

		post, err = ss.Post().GetSingle(post.Id, false)
		require.NoError(t, err)
		require.Greater(t, post.UpdateAt, oldUpdateAt)
	})
}

func testPostAcknowledgementsStoreGetForPost(t *testing.T, rctx request.CTX, ss store.Store) {
	userId1 := model.NewId()
	userId2 := model.NewId()
	userId3 := model.NewId()

	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestId()
	p1.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewString("important"),
			RequestedAck:            model.NewBool(true),
			PersistentNotifications: model.NewBool(false),
		},
	}
	_, err := ss.Post().Save(rctx, &p1)
	require.NoError(t, err)

	t.Run("get acknowledgements for post", func(t *testing.T) {
		ack1, err := ss.PostAcknowledgement().Save(p1.Id, userId1, 0)
		require.NoError(t, err)
		ack2, err := ss.PostAcknowledgement().Save(p1.Id, userId2, 0)
		require.NoError(t, err)
		ack3, err := ss.PostAcknowledgement().Save(p1.Id, userId3, 0)
		require.NoError(t, err)

		acknowledgements, err := ss.PostAcknowledgement().GetForPost(p1.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack1, ack2, ack3})

		err = ss.PostAcknowledgement().Delete(ack1)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPost(p1.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack2, ack3})

		err = ss.PostAcknowledgement().Delete(ack2)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPost(p1.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack3})

		err = ss.PostAcknowledgement().Delete(ack3)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPost(p1.Id)
		require.NoError(t, err)
		require.Empty(t, acknowledgements)
	})
}

func testPostAcknowledgementsStoreGetForPosts(t *testing.T, rctx request.CTX, ss store.Store) {
	userId1 := model.NewId()
	userId2 := model.NewId()
	userId3 := model.NewId()

	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestId()
	p1.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewString("important"),
			RequestedAck:            model.NewBool(true),
			PersistentNotifications: model.NewBool(false),
		},
	}
	p2 := model.Post{}
	p2.ChannelId = model.NewId()
	p2.UserId = model.NewId()
	p2.Message = NewTestId()
	p2.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewString(""),
			RequestedAck:            model.NewBool(true),
			PersistentNotifications: model.NewBool(false),
		},
	}
	_, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p1, &p2})
	require.NoError(t, err)
	require.Equal(t, -1, errIdx)

	t.Run("get acknowledgements for post", func(t *testing.T) {
		ack1, err := ss.PostAcknowledgement().Save(p1.Id, userId1, 0)
		require.NoError(t, err)
		ack2, err := ss.PostAcknowledgement().Save(p1.Id, userId2, 0)
		require.NoError(t, err)
		ack3, err := ss.PostAcknowledgement().Save(p2.Id, userId2, 0)
		require.NoError(t, err)
		ack4, err := ss.PostAcknowledgement().Save(p2.Id, userId3, 0)
		require.NoError(t, err)

		acknowledgements, err := ss.PostAcknowledgement().GetForPosts([]string{p1.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack1, ack2})

		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack3, ack4})

		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack1, ack2, ack3, ack4})

		err = ss.PostAcknowledgement().Delete(ack1)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack2, ack3, ack4})

		err = ss.PostAcknowledgement().Delete(ack2)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack3, ack4})

		err = ss.PostAcknowledgement().Delete(ack3)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.ElementsMatch(t, acknowledgements, []*model.PostAcknowledgement{ack4})

		err = ss.PostAcknowledgement().Delete(ack4)
		require.NoError(t, err)
		acknowledgements, err = ss.PostAcknowledgement().GetForPosts([]string{p1.Id, p2.Id})
		require.NoError(t, err)
		require.Empty(t, acknowledgements)
	})
}
