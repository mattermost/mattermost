// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestDraftStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("SaveDraft", func(t *testing.T) { testSaveDraft(t, ss) })
	t.Run("UpdateDraft", func(t *testing.T) { testUpdateDraft(t, ss) })
	t.Run("DeleteDraft", func(t *testing.T) { testDeleteDraft(t, ss) })
	t.Run("GetDraft", func(t *testing.T) { testGetDraft(t, ss) })
	t.Run("GetDraftsForUser", func(t *testing.T) { testGetDraftsForUser(t, ss) })
}

func testSaveDraft(t *testing.T, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}
	channel2 := &model.Channel{
		Id: model.NewId(),
	}

	member1 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	member2 := &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(member1)
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(member2)
	require.NoError(t, err)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UpdateAt:  00005,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	t.Run("save drafts", func(t *testing.T) {
		draftResp, err := ss.Draft().Upsert(draft1)
		assert.NoError(t, err)

		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

		draftResp, err = ss.Draft().Upsert(draft2)
		assert.NoError(t, err)

		assert.Equal(t, draft2.Message, draftResp.Message)
		assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)

		drafts, err := ss.Draft().GetDraftsForUser(user.Id, "")
		assert.NoError(t, err)
		assert.Len(t, drafts, 2)
	})
}

func testUpdateDraft(t *testing.T, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}

	member := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(member)
	require.NoError(t, err)

	t.Run("update drafts", func(t *testing.T) {
		draft := &model.Draft{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "draft",
		}
		_, err := ss.Draft().Upsert(draft)
		assert.NoError(t, err)

		drafts, err := ss.Draft().GetDraftsForUser(user.Id, "")
		assert.NoError(t, err)
		assert.Len(t, drafts, 1)
		draft1 := drafts[0]

		assert.Greater(t, draft1.CreateAt, int64(0))
		assert.Equal(t, draft1.UpdateAt, draft1.CreateAt)
		assert.Equal(t, channel.Id, draft1.ChannelId)
		assert.Equal(t, "draft", draft1.Message)

		updatedDraft := &model.Draft{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "updatedDraft",
		}
		_, err = ss.Draft().Upsert(updatedDraft)
		assert.NoError(t, err)

		drafts, err = ss.Draft().GetDraftsForUser(user.Id, "")
		assert.NoError(t, err)
		assert.Len(t, drafts, 1)
		draft2 := drafts[0]

		assert.Greater(t, draft2.CreateAt, int64(0))
		assert.Equal(t, "updatedDraft", draft2.Message)
		assert.Equal(t, channel.Id, draft2.ChannelId)
		assert.Equal(t, draft1.CreateAt, draft2.CreateAt)
	})
}

func testDeleteDraft(t *testing.T, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}
	channel2 := &model.Channel{
		Id: model.NewId(),
	}

	member1 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	member2 := &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(member1)
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(member2)
	require.NoError(t, err)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UpdateAt:  00005,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, err = ss.Draft().Upsert(draft1)
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(draft2)
	require.NoError(t, err)

	t.Run("delete drafts", func(t *testing.T) {
		err := ss.Draft().Delete(user.Id, channel.Id, "")
		assert.NoError(t, err)

		err = ss.Draft().Delete(user.Id, channel2.Id, "")
		assert.NoError(t, err)

		_, err = ss.Draft().Get(user.Id, channel.Id, "", false)
		require.Error(t, err)
		assert.IsType(t, &store.ErrNotFound{}, err)

		_, err = ss.Draft().Get(user.Id, channel2.Id, "", false)
		assert.Error(t, err)
		assert.IsType(t, &store.ErrNotFound{}, err)
	})
}

func testGetDraft(t *testing.T, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}
	channel2 := &model.Channel{
		Id: model.NewId(),
	}

	member1 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	member2 := &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(member1)
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(member2)
	require.NoError(t, err)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UpdateAt:  00005,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, err = ss.Draft().Upsert(draft1)
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(draft2)
	require.NoError(t, err)

	t.Run("get drafts", func(t *testing.T) {
		draftResp, err := ss.Draft().Get(user.Id, channel.Id, "", false)
		assert.NoError(t, err)
		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

		draftResp, err = ss.Draft().Get(user.Id, channel2.Id, "", false)
		assert.NoError(t, err)
		assert.Equal(t, draft2.Message, draftResp.Message)
		assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)
	})
}

func testGetDraftsForUser(t *testing.T, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}
	channel2 := &model.Channel{
		Id: model.NewId(),
	}

	member1 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	member2 := &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(member1)
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(member2)
	require.NoError(t, err)

	draft1 := &model.Draft{
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, err = ss.Draft().Upsert(draft1)
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(draft2)
	require.NoError(t, err)

	t.Run("get drafts", func(t *testing.T) {
		draftResp, err := ss.Draft().GetDraftsForUser(user.Id, "")
		assert.NoError(t, err)
		assert.Len(t, draftResp, 2)

		assert.ElementsMatch(t, []*model.Draft{draft1, draft2}, draftResp)
	})
}
