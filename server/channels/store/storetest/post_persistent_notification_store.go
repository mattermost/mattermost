// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostPersistentNotificationStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("Get", func(t *testing.T) { testPostPersistentNotificationStoreGet(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testPostPersistentNotificationStoreDelete(t, rctx, ss) })
	t.Run("UpdateLastSentAt", func(t *testing.T) { testPostPersistentNotificationStoreUpdateLastSentAt(t, rctx, ss) })
}

func testPostPersistentNotificationStoreGet(t *testing.T, rctx request.CTX, ss store.Store) {
	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestID()
	p1.CreateAt = 10
	p1.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewPointer("important"),
			RequestedAck:            model.NewPointer(false),
			PersistentNotifications: model.NewPointer(true),
		},
	}

	p2 := model.Post{}
	p2.ChannelId = p1.ChannelId
	p2.UserId = model.NewId()
	p2.Message = NewTestID()
	p2.CreateAt = 20
	p2.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewPointer(model.PostPriorityUrgent),
			RequestedAck:            model.NewPointer(true),
			PersistentNotifications: model.NewPointer(true),
		},
	}

	// Invalid - Has no Priority
	p3 := model.Post{}
	p3.ChannelId = p1.ChannelId
	p3.UserId = model.NewId()
	p3.Message = NewTestID()
	p3.CreateAt = 30

	// Invalid - Notification is false
	p4 := model.Post{}
	p4.ChannelId = p1.ChannelId
	p4.UserId = model.NewId()
	p4.Message = NewTestID()
	p4.CreateAt = 40
	p4.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewPointer(model.PostPriorityUrgent),
			RequestedAck:            model.NewPointer(false),
			PersistentNotifications: model.NewPointer(false),
		},
	}

	p5 := model.Post{}
	p5.ChannelId = p1.ChannelId
	p5.UserId = model.NewId()
	p5.Message = NewTestID()
	p5.CreateAt = 50
	p5.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewPointer(model.PostPriorityUrgent),
			RequestedAck:            model.NewPointer(false),
			PersistentNotifications: model.NewPointer(true),
		},
	}

	_, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p1, &p2, &p3, &p4, &p5})
	require.NoError(t, err)
	require.Equal(t, -1, errIdx)

	defer ss.Post().PermanentDeleteByChannel(rctx, p1.ChannelId)
	defer ss.PostPersistentNotification().Delete([]string{p1.Id, p2.Id, p3.Id, p4.Id, p5.Id})

	t.Run("Get Single", func(t *testing.T) {
		pn, err := ss.PostPersistentNotification().GetSingle(p1.Id)
		require.NoError(t, err)
		assert.Equal(t, p1.Id, pn.PostId)

		pn, err = ss.PostPersistentNotification().GetSingle(p2.Id)
		require.NoError(t, err)
		assert.Equal(t, p2.Id, pn.PostId)

		pn, err = ss.PostPersistentNotification().GetSingle(p5.Id)
		require.NoError(t, err)
		assert.Equal(t, p5.Id, pn.PostId)

		pn, err = ss.PostPersistentNotification().GetSingle(p3.Id)
		require.Error(t, err)
		require.Zero(t, pn)

		pn, err = ss.PostPersistentNotification().GetSingle(p4.Id)
		require.Error(t, err)
		require.Zero(t, pn)
	})

	t.Run("Get all before MaxTime", func(t *testing.T) {
		validIDs := []string{p1.Id, p2.Id, p5.Id}
		getIDs := func(posts []*model.PostPersistentNotifications) (ids []string) {
			for _, p := range posts {
				ids = append(ids, p.PostId)
			}
			return
		}

		// p5 is filtered by maxTime
		pn, err := ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxTime:      45,
			MaxSentCount: 60,
			PerPage:      20,
		})
		require.NoError(t, err)
		require.Len(t, pn, 2)
		assert.Contains(t, getIDs(pn), p1.Id)
		assert.Contains(t, getIDs(pn), p2.Id)

		// nothing is filtered out
		pn, err = ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxTime:      100,
			MaxSentCount: 60,
			PerPage:      20,
		})
		require.NoError(t, err)
		require.Len(t, pn, 3)
		assert.ElementsMatch(t, validIDs, getIDs(pn))
	})
}

func testPostPersistentNotificationStoreUpdateLastSentAt(t *testing.T, rctx request.CTX, ss store.Store) {
	p1 := model.Post{}
	p1.ChannelId = model.NewId()
	p1.UserId = model.NewId()
	p1.Message = NewTestID()
	p1.CreateAt = 10
	p1.Metadata = &model.PostMetadata{
		Priority: &model.PostPriority{
			Priority:                model.NewPointer("important"),
			RequestedAck:            model.NewPointer(false),
			PersistentNotifications: model.NewPointer(true),
		},
	}

	_, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p1})
	require.NoError(t, err)
	require.Equal(t, -1, errIdx)

	defer ss.Post().PermanentDeleteByChannel(rctx, p1.ChannelId)
	defer ss.PostPersistentNotification().Delete([]string{p1.Id})

	// Update from 0 value
	now := model.GetTimeForMillis(model.GetMillis())
	delta := 2 * time.Second
	err = ss.PostPersistentNotification().UpdateLastActivity([]string{p1.Id})
	require.NoError(t, err)

	pn, err := ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
		MaxTime:      model.GetMillisForTime(now.Add(delta)),
		MaxSentCount: 60,
	})
	require.NoError(t, err)
	require.Len(t, pn, 1)
	assert.WithinDuration(t, now, model.GetTimeForMillis(pn[0].LastSentAt), delta)

	time.Sleep(time.Second)

	// Update from non-zero value
	now = model.GetTimeForMillis(model.GetMillis())
	delta = 2 * time.Second
	err = ss.PostPersistentNotification().UpdateLastActivity([]string{p1.Id})
	require.NoError(t, err)

	pn, err = ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
		MaxTime:      model.GetMillisForTime(now.Add(delta)),
		MaxSentCount: 60,
	})
	require.NoError(t, err)
	require.Len(t, pn, 1)
	assert.WithinDuration(t, now, model.GetTimeForMillis(pn[0].LastSentAt), delta)
}

func testPostPersistentNotificationStoreDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Delete", func(t *testing.T) {
		p1 := model.Post{}
		p1.ChannelId = model.NewId()
		p1.UserId = model.NewId()
		p1.Message = NewTestID()
		p1.CreateAt = 10
		p1.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("important"),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p2 := model.Post{}
		p2.ChannelId = p1.ChannelId
		p2.UserId = model.NewId()
		p2.Message = NewTestID()
		p2.CreateAt = 20
		p2.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer(model.PostPriorityUrgent),
				RequestedAck:            model.NewPointer(true),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p3 := model.Post{}
		p3.ChannelId = p1.ChannelId
		p3.UserId = model.NewId()
		p3.Message = NewTestID()
		p3.CreateAt = 30
		p3.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer(model.PostPriorityUrgent),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		_, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p1, &p2, &p3})
		require.NoError(t, err)
		require.Equal(t, -1, errIdx)

		defer ss.Post().PermanentDeleteByChannel(rctx, p1.ChannelId)
		defer ss.PostPersistentNotification().Delete([]string{p1.Id, p2.Id, p3.Id})

		err = ss.PostPersistentNotification().Delete([]string{p1.Id, p3.Id})
		require.NoError(t, err)

		pn, err := ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxTime:      100,
			MaxSentCount: 6,
			PerPage:      20,
		})
		require.NoError(t, err)
		require.Len(t, pn, 1)
		assert.Equal(t, p2.Id, pn[0].PostId)
	})

	t.Run("Delete By Channel", func(t *testing.T) {
		p1 := model.Post{}
		p1.ChannelId = model.NewId()
		p1.UserId = model.NewId()
		p1.Message = NewTestID()
		p1.CreateAt = 10
		p1.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("important"),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p2 := model.Post{}
		p2.ChannelId = p1.ChannelId
		p2.UserId = model.NewId()
		p2.Message = NewTestID()
		p2.CreateAt = 20
		p2.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer(model.PostPriorityUrgent),
				RequestedAck:            model.NewPointer(true),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p3 := model.Post{}
		p3.ChannelId = p1.ChannelId
		p3.UserId = model.NewId()
		p3.Message = NewTestID()
		p3.CreateAt = 30
		p3.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer(model.PostPriorityUrgent),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p4 := model.Post{}
		p4.ChannelId = model.NewId()
		p4.UserId = model.NewId()
		p4.Message = NewTestID()
		p4.CreateAt = 40
		p4.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("important"),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p5 := model.Post{}
		p5.ChannelId = p4.ChannelId
		p5.UserId = model.NewId()
		p5.Message = NewTestID()
		p5.CreateAt = 50
		p5.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("important"),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		_, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p1, &p2, &p3, &p4, &p5})
		require.NoError(t, err)
		require.Equal(t, -1, errIdx)

		defer ss.Post().PermanentDeleteByChannel(rctx, p1.ChannelId)
		defer ss.Post().PermanentDeleteByChannel(rctx, p4.ChannelId)
		defer ss.PostPersistentNotification().Delete([]string{p1.Id, p2.Id, p3.Id, p4.Id, p5.Id})

		err = ss.PostPersistentNotification().DeleteByChannel([]string{p1.ChannelId})
		require.NoError(t, err)

		pn, err := ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxTime:      100,
			MaxSentCount: 6,
			PerPage:      20,
		})
		require.NoError(t, err)
		require.Len(t, pn, 2)
		assert.ElementsMatch(t, []string{p4.Id, p5.Id}, []string{pn[0].PostId, pn[1].PostId})
	})

	t.Run("Delete By Team", func(t *testing.T) {
		t1 := &model.Team{DisplayName: "t1", Name: NewTestID(), Email: MakeEmail(), Type: model.TeamOpen}
		_, err := ss.Team().Save(t1)
		require.NoError(t, err)
		t2 := &model.Team{DisplayName: "t2", Name: NewTestID(), Email: MakeEmail(), Type: model.TeamOpen}
		_, err = ss.Team().Save(t2)
		require.NoError(t, err)

		c1 := &model.Channel{TeamId: t1.Id, Name: model.NewId(), DisplayName: "c1", Type: model.ChannelTypeOpen}
		_, err = ss.Channel().Save(rctx, c1, -1)
		require.NoError(t, err)
		c2 := &model.Channel{TeamId: t1.Id, Name: model.NewId(), DisplayName: "c2", Type: model.ChannelTypeOpen}
		_, err = ss.Channel().Save(rctx, c2, -1)
		require.NoError(t, err)
		c3 := &model.Channel{TeamId: t2.Id, Name: model.NewId(), DisplayName: "c1", Type: model.ChannelTypeOpen}
		_, err = ss.Channel().Save(rctx, c3, -1)
		require.NoError(t, err)

		p1 := model.Post{}
		p1.ChannelId = c1.Id
		p1.UserId = model.NewId()
		p1.Message = NewTestID()
		p1.CreateAt = 10
		p1.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("important"),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p2 := model.Post{}
		p2.ChannelId = p1.ChannelId
		p2.UserId = model.NewId()
		p2.Message = NewTestID()
		p2.CreateAt = 20
		p2.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer(model.PostPriorityUrgent),
				RequestedAck:            model.NewPointer(true),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p3 := model.Post{}
		p3.ChannelId = c2.Id
		p3.UserId = model.NewId()
		p3.Message = NewTestID()
		p3.CreateAt = 30
		p3.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer(model.PostPriorityUrgent),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p4 := model.Post{}
		p4.ChannelId = c3.Id
		p4.UserId = model.NewId()
		p4.Message = NewTestID()
		p4.CreateAt = 40
		p4.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("important"),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		p5 := model.Post{}
		p5.ChannelId = p4.ChannelId
		p5.UserId = model.NewId()
		p5.Message = NewTestID()
		p5.CreateAt = 50
		p5.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{
				Priority:                model.NewPointer("important"),
				RequestedAck:            model.NewPointer(false),
				PersistentNotifications: model.NewPointer(true),
			},
		}

		_, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p1, &p2, &p3, &p4, &p5})
		require.NoError(t, err)
		require.Equal(t, -1, errIdx)

		defer ss.Post().PermanentDeleteByChannel(rctx, c1.Id)
		defer ss.Post().PermanentDeleteByChannel(rctx, c2.Id)
		defer ss.Post().PermanentDeleteByChannel(rctx, c3.Id)
		defer ss.Channel().PermanentDeleteByTeam(t1.Id)
		defer ss.Channel().PermanentDeleteByTeam(t2.Id)
		defer ss.Team().PermanentDelete(t1.Id)
		defer ss.Team().PermanentDelete(t2.Id)
		defer ss.PostPersistentNotification().Delete([]string{p1.Id, p2.Id, p3.Id, p4.Id, p5.Id})

		err = ss.PostPersistentNotification().DeleteByTeam([]string{t1.Id})
		require.NoError(t, err)

		pn, err := ss.PostPersistentNotification().Get(model.GetPersistentNotificationsPostsParams{
			MaxTime:      100,
			MaxSentCount: 6,
			PerPage:      20,
		})
		require.NoError(t, err)
		require.Len(t, pn, 2)
		assert.ElementsMatch(t, []string{p4.Id, p5.Id}, []string{pn[0].PostId, pn[1].PostId})
	})
}
