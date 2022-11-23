// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/storetest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDraftStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestDraftStore)
}

func TestSaveDraft(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
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
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "draft1",
		}

		draft2 := &model.Draft{
			CreateAt:  00005,
			UpdateAt:  00005,
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel2.Id,
			Message:   "draft2",
		}

		t.Run("save drafts", func(t *testing.T) {
			draftResp, err := ss.Draft().Save(draft1)
			assert.NoError(t, err)

			assert.Equal(t, draft1.Message, draftResp.Message)
			assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

			draftResp, err = ss.Draft().Save(draft2)
			assert.NoError(t, err)

			assert.Equal(t, draft2.Message, draftResp.Message)
			assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)
		})
	})
}

func TestUpdateDraft(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
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
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "draft1",
		}

		draft2 := &model.Draft{
			CreateAt:  00005,
			UpdateAt:  00005,
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel2.Id,
			Message:   "draft2",
		}

		t.Run("update drafts", func(t *testing.T) {
			draftResp, err := ss.Draft().Update(draft1)
			assert.NoError(t, err)

			assert.Equal(t, draft1.Message, draftResp.Message)
			assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

			draftResp, err = ss.Draft().Update(draft2)
			assert.NoError(t, err)

			assert.Equal(t, draft2.Message, draftResp.Message)
			assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)
		})
	})
}

func TestDeleteDraft(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
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
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "draft1",
		}

		draft2 := &model.Draft{
			CreateAt:  00005,
			UpdateAt:  00005,
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel2.Id,
			Message:   "draft2",
		}

		_, err = ss.Draft().Save(draft1)
		require.NoError(t, err)

		_, err = ss.Draft().Save(draft2)
		require.NoError(t, err)

		t.Run("delete drafts", func(t *testing.T) {
			err := ss.Draft().Delete(user.Id, channel.Id, "")
			assert.NoError(t, err)

			err = ss.Draft().Delete(user.Id, channel2.Id, "")
			assert.NoError(t, err)
		})
	})
}

func TestGetDraft(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
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
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "draft1",
		}

		draft2 := &model.Draft{
			CreateAt:  00005,
			UpdateAt:  00005,
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel2.Id,
			Message:   "draft2",
		}

		_, err = ss.Draft().Save(draft1)
		require.NoError(t, err)

		_, err = ss.Draft().Save(draft2)
		require.NoError(t, err)

		t.Run("get drafts", func(t *testing.T) {
			draftResp, err := ss.Draft().Get(user.Id, channel.Id, "")
			assert.NoError(t, err)
			assert.Equal(t, draft1.Message, draftResp.Message)
			assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

			draftResp, err = ss.Draft().Get(user.Id, channel2.Id, "")
			assert.NoError(t, err)
			assert.Equal(t, draft2.Message, draftResp.Message)
			assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)
		})
	})
}

func TestGetDraftsForUser(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
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
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "draft1",
		}

		draft2 := &model.Draft{
			CreateAt:  00005,
			UpdateAt:  00005,
			DeleteAt:  0,
			UserId:    user.Id,
			ChannelId: channel2.Id,
			Message:   "draft2",
		}

		_, err = ss.Draft().Save(draft1)
		require.NoError(t, err)

		_, err = ss.Draft().Save(draft2)
		require.NoError(t, err)

		t.Run("get drafts", func(t *testing.T) {
			draftResp, err := ss.Draft().GetDraftsForUser(user.Id, "")
			assert.NoError(t, err)

			assert.Equal(t, draft2.Message, draftResp[0].Message)
			assert.Equal(t, draft2.ChannelId, draftResp[0].ChannelId)

			assert.Equal(t, draft1.Message, draftResp[1].Message)
			assert.Equal(t, draft1.ChannelId, draftResp[1].ChannelId)
		})
	})
}
