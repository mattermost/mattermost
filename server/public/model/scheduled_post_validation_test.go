// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestScheduledPostBaseIsValidRepeat(t *testing.T) {
	t.Parallel()

	maxSize := PostMessageMaxRunesV2

	t.Run("weekly requires timezone", func(t *testing.T) {
		sp := &ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "hello",
			},
			Id:             NewId(),
			ScheduledAt:    GetMillis() + 60000,
			RepeatType:     ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "",
		}
		err := sp.BaseIsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.scheduled_post.is_valid.repeat_timezone.app_error", err.Id)
	})

	t.Run("weekly with valid timezone", func(t *testing.T) {
		sp := &ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "hello",
			},
			Id:             NewId(),
			ScheduledAt:    GetMillis() + 60000,
			RepeatType:     ScheduledPostRepeatTypeWeekly,
			RepeatTimezone: "Europe/Berlin",
		}
		err := sp.BaseIsValid()
		require.Nil(t, err)
		err = sp.IsValid(maxSize)
		require.Nil(t, err)
	})

	t.Run("invalid repeat type", func(t *testing.T) {
		sp := &ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "hello",
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 60000,
			RepeatType:  "daily",
		}
		err := sp.BaseIsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.scheduled_post.is_valid.repeat_type.app_error", err.Id)
	})
}
