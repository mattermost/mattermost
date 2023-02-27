// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostPriorityStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("GetForPost", func(t *testing.T) { testPostPriorityStoreGetForPost(t, ss) })
}

func testPostPriorityStoreGetForPost(t *testing.T, ss store.Store) {

	t.Run("Save post priority when in post's metadata", func(t *testing.T) {
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
				Priority:                model.NewString(model.PostPriorityUrgent),
				RequestedAck:            model.NewBool(false),
				PersistentNotifications: model.NewBool(true),
			},
		}

		p3 := model.Post{}
		p3.ChannelId = model.NewId()
		p3.UserId = model.NewId()
		p3.Message = NewTestId()

		_, errIdx, err := ss.Post().SaveMultiple([]*model.Post{&p1, &p2, &p3})
		require.NoError(t, err)
		require.Equal(t, -1, errIdx)

		pp1, err := ss.PostPriority().GetForPost(p1.Id)
		require.NoError(t, err)
		assert.Equal(t, "important", *pp1.Priority)
		assert.Equal(t, true, *pp1.RequestedAck)
		assert.Equal(t, false, *pp1.PersistentNotifications)

		pp2, err := ss.PostPriority().GetForPost(p2.Id)
		require.NoError(t, err)
		assert.Equal(t, model.PostPriorityUrgent, *pp2.Priority)
		assert.Equal(t, false, *pp2.RequestedAck)
		assert.Equal(t, true, *pp2.PersistentNotifications)

		_, err = ss.PostPriority().GetForPost(p3.Id)
		assert.True(t, errors.Is(err, sql.ErrNoRows))
	})
}
