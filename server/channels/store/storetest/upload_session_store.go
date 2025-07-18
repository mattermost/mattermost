// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestUploadSessionStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("UploadSessionStoreSaveGet", func(t *testing.T) { testUploadSessionStoreSaveGet(t, rctx, ss) })
	t.Run("UploadSessionStoreUpdate", func(t *testing.T) { testUploadSessionStoreUpdate(t, rctx, ss) })
	t.Run("UploadSessionStoreGetForUser", func(t *testing.T) { testUploadSessionStoreGetForUser(t, rctx, ss) })
	t.Run("UploadSessionStoreDelete", func(t *testing.T) { testUploadSessionStoreDelete(t, rctx, ss) })
}

func testUploadSessionStoreSaveGet(t *testing.T, rctx request.CTX, ss store.Store) {
	var session *model.UploadSession

	t.Run("saving nil session should fail", func(t *testing.T) {
		us, err := ss.UploadSession().Save(nil)
		require.Error(t, err)
		require.Nil(t, us)
	})

	t.Run("saving empty session should fail", func(t *testing.T) {
		session = &model.UploadSession{}
		us, err := ss.UploadSession().Save(session)
		require.Error(t, err)
		require.Nil(t, us)
	})

	t.Run("saving valid session should succeed", func(t *testing.T) {
		session = &model.UploadSession{
			Type:      model.UploadTypeAttachment,
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Filename:  "test",
			FileSize:  1024,
			Path:      "/tmp/test",
		}
		us, err := ss.UploadSession().Save(session)
		require.NoError(t, err)
		require.NotNil(t, us)
		require.NotEmpty(t, us)
	})

	t.Run("getting non-existing session should fail", func(t *testing.T) {
		us, err := ss.UploadSession().Get(rctx, "fake")
		require.Error(t, err)
		require.Nil(t, us)
	})

	t.Run("getting existing session should succeed", func(t *testing.T) {
		us, err := ss.UploadSession().Get(rctx, session.Id)
		require.NoError(t, err)
		require.NotNil(t, us)
		require.Equal(t, session, us)
	})
}

func testUploadSessionStoreUpdate(t *testing.T, rctx request.CTX, ss store.Store) {
	session := &model.UploadSession{
		Type:      model.UploadTypeAttachment,
		UserId:    model.NewId(),
		ChannelId: model.NewId(),
		Filename:  "test",
		FileSize:  1024,
		Path:      "/tmp/test",
	}

	t.Run("updating nil session should fail", func(t *testing.T) {
		err := ss.UploadSession().Update(nil)
		require.Error(t, err)
	})

	t.Run("updating invalid session should fail", func(t *testing.T) {
		err := ss.UploadSession().Update(&model.UploadSession{})
		require.Error(t, err)
	})

	t.Run("updating non-existing session should fail", func(t *testing.T) {
		err := ss.UploadSession().Update(&model.UploadSession{})
		require.Error(t, err)
	})

	t.Run("updating existing session should succeed", func(t *testing.T) {
		us, err := ss.UploadSession().Save(session)
		require.NoError(t, err)
		require.NotNil(t, us)
		require.NotEmpty(t, us)

		us.FileOffset = 512
		err = ss.UploadSession().Update(us)
		require.NoError(t, err)

		updated, err := ss.UploadSession().Get(rctx, us.Id)
		require.NoError(t, err)
		require.NotNil(t, us)
		require.Equal(t, us, updated)
	})
}

func testUploadSessionStoreGetForUser(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()

	sessions := []*model.UploadSession{
		{
			Type:      model.UploadTypeAttachment,
			UserId:    userId,
			ChannelId: model.NewId(),
			Filename:  "test0",
			FileSize:  1024,
			Path:      "/tmp/test0",
		},
		{
			Type:      model.UploadTypeAttachment,
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Filename:  "test1",
			FileSize:  1024,
			Path:      "/tmp/test1",
		},
		{
			Type:      model.UploadTypeAttachment,
			UserId:    userId,
			ChannelId: model.NewId(),
			Filename:  "test2",
			FileSize:  1024,
			Path:      "/tmp/test2",
		},
		{
			Type:      model.UploadTypeAttachment,
			UserId:    userId,
			ChannelId: model.NewId(),
			Filename:  "test3",
			FileSize:  1024,
			Path:      "/tmp/test3",
		},
	}

	t.Run("should return no sessions", func(t *testing.T) {
		us, err := ss.UploadSession().GetForUser(userId)
		require.NoError(t, err)
		require.NotNil(t, us)
		require.Empty(t, us)
	})

	for i := range sessions {
		us, err := ss.UploadSession().Save(sessions[i])
		require.NoError(t, err)
		require.NotNil(t, us)
		require.NotEmpty(t, us)
		// We need this to make sure the ordering is consistent.
		time.Sleep(2 * time.Millisecond)
	}

	t.Run("should return existing sessions", func(t *testing.T) {
		us, err := ss.UploadSession().GetForUser(userId)
		require.NoError(t, err)
		require.NotNil(t, us)
		require.NotEmpty(t, us)
		require.Len(t, us, 3)

		require.Equal(t, sessions[0], us[0])
		require.Equal(t, sessions[2], us[1])
		require.Equal(t, sessions[3], us[2])
	})
}

func testUploadSessionStoreDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	session := &model.UploadSession{
		Id:        model.NewId(),
		Type:      model.UploadTypeAttachment,
		UserId:    model.NewId(),
		ChannelId: model.NewId(),
		Filename:  "test",
		FileSize:  1024,
		Path:      "/tmp/test",
	}

	t.Run("deleting invalid id should fail", func(t *testing.T) {
		err := ss.UploadSession().Delete("invalidId")
		require.Error(t, err)
	})

	t.Run("deleting existing session should succeed", func(t *testing.T) {
		us, err := ss.UploadSession().Save(session)
		require.NoError(t, err)
		require.NotNil(t, us)
		require.NotEmpty(t, us)

		err = ss.UploadSession().Delete(session.Id)
		require.NoError(t, err)

		us, err = ss.UploadSession().Get(rctx, us.Id)
		require.Error(t, err)
		require.Nil(t, us)
		require.IsType(t, &store.ErrNotFound{}, err)
	})
}
