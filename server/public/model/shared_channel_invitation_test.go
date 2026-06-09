// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/stretchr/testify/require"
)

func TestSharedChannelInvitationIsValid(t *testing.T) {
	base := func() *SharedChannelInvitation {
		return &SharedChannelInvitation{
			Id:        NewId(),
			ChannelId: NewId(),
			RemoteId:  NewId(),
			Direction: SharedChannelInvitationDirectionSent,
			Status:    SharedChannelInvitationStatusPending,
			CreatorId: NewId(),
			CreateAt:  GetMillis(),
			UpdateAt:  GetMillis(),
		}
	}

	t.Run("valid", func(t *testing.T) {
		inv := base()
		require.Nil(t, inv.IsValid())
	})

	t.Run("invalid id", func(t *testing.T) {
		inv := base()
		inv.Id = "bad"
		require.NotNil(t, inv.IsValid())
	})

	t.Run("invalid direction", func(t *testing.T) {
		inv := base()
		inv.Direction = "other"
		require.NotNil(t, inv.IsValid())
	})

	t.Run("invalid status", func(t *testing.T) {
		inv := base()
		inv.Status = "done"
		require.NotNil(t, inv.IsValid())
	})

	t.Run("err msg too long", func(t *testing.T) {
		inv := base()
		inv.ErrMsg = strings.Repeat("é", SharedChannelInvitationErrMsgMaxRunes+1)
		require.Equal(t, SharedChannelInvitationErrMsgMaxRunes+1, utf8.RuneCountInString(inv.ErrMsg))
		require.NotNil(t, inv.IsValid())
	})
}

func TestSharedChannelInvitationPreSave(t *testing.T) {
	inv := &SharedChannelInvitation{
		ChannelId: NewId(),
		RemoteId:  NewId(),
		Direction: SharedChannelInvitationDirectionReceived,
		CreatorId: NewId(),
	}
	inv.PreSave()
	require.NotEmpty(t, inv.Id)
	require.NotZero(t, inv.CreateAt)
	require.NotZero(t, inv.UpdateAt)
	require.Equal(t, SharedChannelInvitationStatusPending, inv.Status)
	require.Nil(t, inv.IsValid())
}
