// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostPersistentNotificationStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("Get", func(t *testing.T) { testPostPersistentNotificationStoreGet(t, ss) })
}

func testPostPersistentNotificationStoreGet(t *testing.T, ss store.Store) {
	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestId()
	p1.CreateAt = 10
	p1.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewString("important"),
			RequestedAck:            model.NewBool(false),
			PersistentNotifications: model.NewBool(true),
		},
	}

	p2 := model.Post{}
	p2.ChannelId = model.NewId()
	p2.UserId = model.NewId()
	p2.Message = NewTestId()
	p2.CreateAt = 20
	p2.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewString(model.PostPriorityUrgent),
			RequestedAck:            model.NewBool(true),
			PersistentNotifications: model.NewBool(true),
		},
	}

	// Invalid - Has no Priority
	p3 := model.Post{}
	p3.ChannelId = model.NewId()
	p3.UserId = model.NewId()
	p3.Message = NewTestId()
	p3.CreateAt = 30

	// Invalid - Notification is false
	p4 := model.Post{}
	p4.ChannelId = model.NewId()
	p4.UserId = model.NewId()
	p4.Message = NewTestId()
	p4.CreateAt = 40
	p4.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewString(model.PostPriorityUrgent),
			RequestedAck:            model.NewBool(false),
			PersistentNotifications: model.NewBool(false),
		},
	}

	p5 := model.Post{}
	p5.ChannelId = model.NewId()
	p5.UserId = model.NewId()
	p5.Message = NewTestId()
	p5.CreateAt = 50
	p5.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewString(model.PostPriorityUrgent),
			RequestedAck:            model.NewBool(false),
			PersistentNotifications: model.NewBool(true),
		},
	}

	_, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p1, &p2, &p3, &p4, &p5})
	require.NoError(t, err)
	require.Equal(t, -1, errIdx)

	t.Run("Get Single", func(t *testing.T) {
		pn, _, err := ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{PostID: p1.Id})
		require.NoError(t, err)
		require.Len(t, pn, 1)
		assert.Equal(t, p1.Id, pn[0].PostId)
		assert.Equal(t, p1.CreateAt, pn[0].CreateAt)
		assert.Zero(t, pn[0].DeleteAt)

		pn, _, err = ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{PostID: p3.Id})
		require.NoError(t, err)
		require.Empty(t, pn)

		pn, _, err = ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{PostID: p4.Id})
		require.NoError(t, err)
		require.Empty(t, pn)
	})

	t.Run("Get all before MaxCreateAt", func(t *testing.T) {
		pn, hasNext, err := ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxCreateAt: 45,
			Pagination: model.CursorPagination{
				Direction: "down",
				PerPage:   2,
			},
		})
		require.NoError(t, err)
		require.Len(t, pn, 2)
		assert.False(t, hasNext)
		assert.Equal(t, p1.Id, pn[0].PostId)
		assert.Equal(t, p2.Id, pn[1].PostId)

		pn, hasNext, err = ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxCreateAt: 100,
			Pagination: model.CursorPagination{
				Direction: "down",
				PerPage:   20,
			},
		})
		require.NoError(t, err)
		require.Len(t, pn, 3)
		assert.False(t, hasNext)
		assert.Equal(t, p1.Id, pn[0].PostId)
		assert.Equal(t, p2.Id, pn[1].PostId)
		assert.Equal(t, p5.Id, pn[2].PostId)

		pn, hasNext, err = ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxCreateAt: 100,
			Pagination: model.CursorPagination{
				Direction: "down",
				PerPage:   2,
			},
		})
		require.NoError(t, err)
		require.Len(t, pn, 2)
		assert.True(t, hasNext)
		assert.Equal(t, p1.Id, pn[0].PostId)
		assert.Equal(t, p2.Id, pn[1].PostId)

		pn, hasNext, err = ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxCreateAt: 100,
			Pagination: model.CursorPagination{
				Direction:    "down",
				PerPage:      2,
				FromID:       p2.Id,
				FromCreateAt: p2.CreateAt,
			},
		})
		require.NoError(t, err)
		require.Len(t, pn, 1)
		assert.False(t, hasNext)
		assert.Equal(t, p5.Id, pn[0].PostId)
	})

	t.Run("Delete", func(t *testing.T) {
		err = ss.PostPersistentNotification().Delete([]string{p1.Id, p5.Id})
		require.NoError(t, err)

		pn, _, err := ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxCreateAt: 100,
			Pagination: model.CursorPagination{
				Direction: "down",
				PerPage:   20,
			},
		})
		require.NoError(t, err)
		require.Len(t, pn, 1)
		assert.Equal(t, p2.Id, pn[0].PostId)
	})
}
