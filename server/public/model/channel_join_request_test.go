// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func validRequest() *ChannelJoinRequest {
	return &ChannelJoinRequest{
		Id:        NewId(),
		ChannelId: NewId(),
		UserId:    NewId(),
		Status:    ChannelJoinRequestStatusPending,
		CreateAt:  GetMillis(),
		UpdateAt:  GetMillis(),
	}
}

func TestChannelJoinRequestPreSaveDefaults(t *testing.T) {
	r := &ChannelJoinRequest{
		ChannelId: NewId(),
		UserId:    NewId(),
	}
	r.PreSave()

	assert.NotEmpty(t, r.Id, "PreSave must assign an Id when missing")
	assert.Equal(t, ChannelJoinRequestStatusPending, r.Status, "PreSave must default Status to pending")
	assert.NotZero(t, r.CreateAt)
	assert.Equal(t, r.CreateAt, r.UpdateAt, "PreSave must align UpdateAt with CreateAt")
}

func TestChannelJoinRequestPreUpdateAdvancesUpdateAt(t *testing.T) {
	r := validRequest()
	originalCreate := r.CreateAt
	// Seed UpdateAt to a known-old value so we can prove PreUpdate actually
	// advanced it (the validRequest factory sets UpdateAt = GetMillis(), so
	// a no-op PreUpdate could otherwise still pass a GreaterOrEqual check).
	r.UpdateAt = 1
	r.PreUpdate()

	assert.Greater(t, r.UpdateAt, int64(1))
	assert.Equal(t, originalCreate, r.CreateAt, "PreUpdate must not mutate CreateAt")
}

func TestChannelJoinRequestIsValid(t *testing.T) {
	t.Run("happy path pending", func(t *testing.T) {
		require.Nil(t, validRequest().IsValid())
	})

	t.Run("invalid id", func(t *testing.T) {
		r := validRequest()
		r.Id = "not-an-id"
		err := r.IsValid()
		require.NotNil(t, err)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("rejects unknown status", func(t *testing.T) {
		r := validRequest()
		r.Status = "weird"
		require.NotNil(t, r.IsValid())
	})

	t.Run("rejects message over rune limit", func(t *testing.T) {
		r := validRequest()
		r.Message = strings.Repeat("a", ChannelJoinRequestMessageMaxRunes+1)
		require.NotNil(t, r.IsValid())
	})

	t.Run("rejects denial reason on non-denied request", func(t *testing.T) {
		r := validRequest()
		r.Status = ChannelJoinRequestStatusApproved
		r.ReviewedBy = NewId()
		r.ReviewedAt = GetMillis()
		r.DenialReason = "nope"
		require.NotNil(t, r.IsValid(), "denial reason must only be set on denied rows")
	})

	t.Run("requires reviewer info for terminal review", func(t *testing.T) {
		r := validRequest()
		r.Status = ChannelJoinRequestStatusApproved
		require.NotNil(t, r.IsValid(), "approved without reviewer must be invalid")

		r.ReviewedBy = NewId()
		r.ReviewedAt = GetMillis()
		require.Nil(t, r.IsValid())
	})

	t.Run("withdrawn does not require reviewer", func(t *testing.T) {
		r := validRequest()
		r.Status = ChannelJoinRequestStatusWithdrawn
		require.Nil(t, r.IsValid(), "withdrawn is a self-service action, not a review")
	})
}

func TestIsValidChannelJoinRequestStatus(t *testing.T) {
	for _, s := range []string{
		ChannelJoinRequestStatusPending,
		ChannelJoinRequestStatusApproved,
		ChannelJoinRequestStatusDenied,
		ChannelJoinRequestStatusWithdrawn,
	} {
		assert.True(t, IsValidChannelJoinRequestStatus(s), "%q should be a valid status", s)
	}
	assert.False(t, IsValidChannelJoinRequestStatus(""))
	assert.False(t, IsValidChannelJoinRequestStatus("approved "))
}
