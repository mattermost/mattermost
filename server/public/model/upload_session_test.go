// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUploadSessionIsValid(t *testing.T) {
	var session UploadSession

	t.Run("empty session should fail", func(t *testing.T) {
		appErr := session.IsValid()
		require.NotNil(t, appErr)
	})

	t.Run("valid session should succeed", func(t *testing.T) {
		session = UploadSession{
			Id:         NewId(),
			Type:       UploadTypeAttachment,
			CreateAt:   GetMillis(),
			UserId:     NewId(),
			ChannelId:  NewId(),
			Filename:   "test",
			Path:       "/tmp/test",
			FileSize:   1024,
			FileOffset: 0,
		}
		appErr := session.IsValid()
		require.Nil(t, appErr)
	})

	t.Run("invalid Id should fail", func(t *testing.T) {
		us := session
		us.Id = "invalid"
		appErr := us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.id.app_error", appErr.Id)
	})

	t.Run("invalid type should fail", func(t *testing.T) {
		us := session
		us.Type = "invalid"
		appErr := us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.type.app_error", appErr.Id)
	})

	t.Run("invalid CreateAt should fail", func(t *testing.T) {
		us := session
		us.CreateAt = 0
		appErr := us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.create_at.app_error", appErr.Id)
	})

	t.Run("invalid UserId should fail", func(t *testing.T) {
		us := session
		us.UserId = "invalid"
		appErr := us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.user_id.app_error", appErr.Id)
	})

	t.Run("invalid ChannelId should fail", func(t *testing.T) {
		us := session
		us.ChannelId = "invalid"
		appErr := us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.channel_id.app_error", appErr.Id)
	})

	t.Run("ChannelId is not validated if type is not attachment", func(t *testing.T) {
		us := session
		us.ChannelId = ""
		us.Type = UploadTypeImport
		appErr := us.IsValid()
		require.Nil(t, appErr)
	})

	t.Run("invalid Filename should fail", func(t *testing.T) {
		us := session
		us.Filename = ""
		appErr := us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.filename.app_error", appErr.Id)
	})

	t.Run("invalid Path should fail", func(t *testing.T) {
		us := session
		us.Path = ""
		appErr := us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.path.app_error", appErr.Id)
	})

	t.Run("invalid FileSize should fail", func(t *testing.T) {
		us := session
		us.FileSize = 0
		appErr := us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.file_size.app_error", appErr.Id)

		us.FileSize = -1
		appErr = us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.file_size.app_error", appErr.Id)
	})

	t.Run("invalid FileOffset should fail", func(t *testing.T) {
		us := session
		us.FileOffset = us.FileSize + 1
		appErr := us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.file_offset.app_error", appErr.Id)

		us.FileOffset = -1
		appErr = us.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.upload_session.is_valid.file_offset.app_error", appErr.Id)
	})
}
