// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelLink_IsValid(t *testing.T) {
	t.Run("should be invalid with empty source ID", func(t *testing.T) {
		cl := &ChannelLink{
			SourceID:      "",
			SourceType:    ChannelLinkSourceTypeChannel,
			DestinationID: NewId(),
			CreateAt:      GetMillis(),
		}
		require.NotNil(t, cl.IsValid())
	})

	t.Run("should be invalid with empty destination ID", func(t *testing.T) {
		cl := &ChannelLink{
			SourceID:      NewId(),
			SourceType:    ChannelLinkSourceTypeChannel,
			DestinationID: "",
			CreateAt:      GetMillis(),
		}
		require.NotNil(t, cl.IsValid())
	})

	t.Run("should be invalid with invalid source ID", func(t *testing.T) {
		cl := &ChannelLink{
			SourceID:      "invalid",
			SourceType:    ChannelLinkSourceTypeChannel,
			DestinationID: NewId(),
			CreateAt:      GetMillis(),
		}
		require.NotNil(t, cl.IsValid())
	})

	t.Run("should be invalid with invalid destination ID", func(t *testing.T) {
		cl := &ChannelLink{
			SourceID:      NewId(),
			SourceType:    ChannelLinkSourceTypeChannel,
			DestinationID: "invalid",
			CreateAt:      GetMillis(),
		}
		require.NotNil(t, cl.IsValid())
	})

	t.Run("should be invalid when source and destination are the same", func(t *testing.T) {
		id := NewId()
		cl := &ChannelLink{
			SourceID:      id,
			SourceType:    ChannelLinkSourceTypeChannel,
			DestinationID: id,
			CreateAt:      GetMillis(),
		}
		err := cl.IsValid()
		require.NotNil(t, err)
		require.Contains(t, err.DetailedError, "cannot link channel to itself")
	})

	t.Run("should be invalid with invalid source type", func(t *testing.T) {
		cl := &ChannelLink{
			SourceID:      NewId(),
			SourceType:    "invalid",
			DestinationID: NewId(),
			CreateAt:      GetMillis(),
		}
		err := cl.IsValid()
		require.NotNil(t, err)
		require.Contains(t, err.DetailedError, "source_type must be")
	})

	t.Run("should be invalid with zero CreateAt", func(t *testing.T) {
		cl := &ChannelLink{
			SourceID:      NewId(),
			SourceType:    ChannelLinkSourceTypeChannel,
			DestinationID: NewId(),
			CreateAt:      0,
		}
		require.NotNil(t, cl.IsValid())
	})

	t.Run("should be valid with channel source type", func(t *testing.T) {
		cl := &ChannelLink{
			SourceID:      NewId(),
			SourceType:    ChannelLinkSourceTypeChannel,
			DestinationID: NewId(),
			CreateAt:      GetMillis(),
		}
		require.Nil(t, cl.IsValid())
	})

	t.Run("should be valid with group source type", func(t *testing.T) {
		cl := &ChannelLink{
			SourceID:      NewId(),
			SourceType:    ChannelLinkSourceTypeGroup,
			DestinationID: NewId(),
			CreateAt:      GetMillis(),
		}
		require.Nil(t, cl.IsValid())
	})
}

func TestChannelLink_PreSave(t *testing.T) {
	t.Run("should set CreateAt if zero", func(t *testing.T) {
		cl := &ChannelLink{
			SourceID:      NewId(),
			SourceType:    ChannelLinkSourceTypeChannel,
			DestinationID: NewId(),
			CreateAt:      0,
		}
		cl.PreSave()
		require.NotZero(t, cl.CreateAt)
	})

	t.Run("should not modify CreateAt if already set", func(t *testing.T) {
		originalCreateAt := int64(1234567890000)
		cl := &ChannelLink{
			SourceID:      NewId(),
			SourceType:    ChannelLinkSourceTypeChannel,
			DestinationID: NewId(),
			CreateAt:      originalCreateAt,
		}
		cl.PreSave()
		require.Equal(t, originalCreateAt, cl.CreateAt)
	})
}
