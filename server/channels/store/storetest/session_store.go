// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	TenMinutes = 600000
)

func TestSessionStore(t *testing.T, rctx request.CTX, ss store.Store) {
	// Run serially to prevent interfering with other tests
	testSessionCleanup(t, rctx, ss)

	t.Run("Save", func(t *testing.T) { testSessionStoreSave(t, rctx, ss) })
	t.Run("SessionGet", func(t *testing.T) { testSessionGet(t, rctx, ss) })
	t.Run("SessionGetWithDeviceId", func(t *testing.T) { testSessionGetWithDeviceId(t, rctx, ss) })
	t.Run("SessionRemove", func(t *testing.T) { testSessionRemove(t, rctx, ss) })
	t.Run("SessionRemoveAll", func(t *testing.T) { testSessionRemoveAll(t, rctx, ss) })
	t.Run("SessionRemoveByUser", func(t *testing.T) { testSessionRemoveByUser(t, rctx, ss) })
	t.Run("SessionRemoveToken", func(t *testing.T) { testSessionRemoveToken(t, rctx, ss) })
	t.Run("SessionUpdateDeviceId", func(t *testing.T) { testSessionUpdateDeviceId(t, rctx, ss) })
	t.Run("SessionUpdateDeviceId2", func(t *testing.T) { testSessionUpdateDeviceId2(t, rctx, ss) })
	t.Run("UpdateExpiresAt", func(t *testing.T) { testSessionStoreUpdateExpiresAt(t, rctx, ss) })
	t.Run("UpdateLastActivityAt", func(t *testing.T) { testSessionStoreUpdateLastActivityAt(t, rctx, ss) })
	t.Run("SessionCount", func(t *testing.T) { testSessionCount(t, rctx, ss) })
	t.Run("GetSessionsExpired", func(t *testing.T) { testGetSessionsExpired(t, rctx, ss) })
	t.Run("UpdateExpiredNotify", func(t *testing.T) { testUpdateExpiredNotify(t, rctx, ss) })
	t.Run("GetLRUSessions", func(t *testing.T) { testGetLRUSessions(t, rctx, ss) })
}

func testSessionStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	_, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)
}

func testSessionGet(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	s2 := &model.Session{}
	s2.UserId = s1.UserId

	_, err = ss.Session().Save(rctx, s2)
	require.NoError(t, err)

	s3 := &model.Session{}
	s3.UserId = s1.UserId
	s3.ExpiresAt = 1

	_, err = ss.Session().Save(rctx, s3)
	require.NoError(t, err)

	session, err := ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.Equal(t, session.Id, s1.Id, "should match")

	session.Props[model.SessionPropOs] = "linux"
	session.Props[model.SessionPropBrowser] = "Chrome"
	err = ss.Session().UpdateProps(session)
	require.NoError(t, err)

	session2, err := ss.Session().Get(rctx, session.Id)
	require.NoError(t, err)
	require.Equal(t, session.Props, session2.Props, "should match")

	data, err := ss.Session().GetSessions(rctx, s1.UserId)
	require.NoError(t, err)
	require.Len(t, data, 3, "should match len")
}

func testSessionGetWithDeviceId(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()
	s1.ExpiresAt = model.GetMillis() + 10000

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	s2 := &model.Session{}
	s2.UserId = s1.UserId
	s2.DeviceId = model.NewId()
	s2.ExpiresAt = model.GetMillis() + 10000

	_, err = ss.Session().Save(rctx, s2)
	require.NoError(t, err)

	s3 := &model.Session{}
	s3.UserId = s1.UserId
	s3.ExpiresAt = 1
	s3.DeviceId = model.NewId()

	_, err = ss.Session().Save(rctx, s3)
	require.NoError(t, err)

	data, err := ss.Session().GetSessionsWithActiveDeviceIds(s1.UserId)
	require.NoError(t, err)
	require.Len(t, data, 1, "should match len")
}

func testSessionRemove(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	session, err := ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.Equal(t, session.Id, s1.Id, "should match")

	removeErr := ss.Session().Remove(s1.Id)
	require.NoError(t, removeErr)

	_, err = ss.Session().Get(rctx, s1.Id)
	require.Error(t, err, "should have been removed")
}

func testSessionRemoveAll(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	session, err := ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.Equal(t, session.Id, s1.Id, "should match")

	removeErr := ss.Session().RemoveAllSessions()
	require.NoError(t, removeErr)

	_, err = ss.Session().Get(rctx, s1.Id)
	require.Error(t, err, "should have been removed")
}

func testSessionRemoveByUser(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	session, err := ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.Equal(t, session.Id, s1.Id, "should match")

	deleteErr := ss.Session().PermanentDeleteSessionsByUser(s1.UserId)
	require.NoError(t, deleteErr)

	_, err = ss.Session().Get(rctx, s1.Id)
	require.Error(t, err, "should have been removed")
}

func testSessionRemoveToken(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	session, err := ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.Equal(t, session.Id, s1.Id, "should match")

	removeErr := ss.Session().Remove(s1.Token)
	require.NoError(t, removeErr)

	_, err = ss.Session().Get(rctx, s1.Id)
	require.Error(t, err, "should have been removed")

	data, err := ss.Session().GetSessions(rctx, s1.UserId)
	require.NoError(t, err)
	require.Empty(t, data, "should match len")
}

func testSessionUpdateDeviceId(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	_, err = ss.Session().UpdateDeviceId(s1.Id, model.PushNotifyApple+":1234567890", s1.ExpiresAt)
	require.NoError(t, err)

	s2 := &model.Session{}
	s2.UserId = model.NewId()

	s2, err = ss.Session().Save(rctx, s2)
	require.NoError(t, err)

	_, err = ss.Session().UpdateDeviceId(s2.Id, model.PushNotifyApple+":1234567890", s1.ExpiresAt)
	require.NoError(t, err)
}

func testSessionUpdateDeviceId2(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	_, err = ss.Session().UpdateDeviceId(s1.Id, model.PushNotifyAppleReactNative+":1234567890", s1.ExpiresAt)
	require.NoError(t, err)

	s2 := &model.Session{}
	s2.UserId = model.NewId()

	s2, err = ss.Session().Save(rctx, s2)
	require.NoError(t, err)

	_, err = ss.Session().UpdateDeviceId(s2.Id, model.PushNotifyAppleReactNative+":1234567890", s1.ExpiresAt)
	require.NoError(t, err)
}

func testSessionStoreUpdateExpiresAt(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	err = ss.Session().UpdateExpiresAt(s1.Id, 1234567890)
	require.NoError(t, err)

	session, err := ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.EqualValues(t, session.ExpiresAt, 1234567890, "ExpiresAt not updated correctly")
}

func testSessionStoreUpdateLastActivityAt(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	err = ss.Session().UpdateLastActivityAt(s1.Id, 1234567890)
	require.NoError(t, err)

	session, err := ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.EqualValues(t, session.LastActivityAt, 1234567890, "LastActivityAt not updated correctly")
}

func testSessionCount(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()
	s1.ExpiresAt = model.GetMillis() + 100000

	_, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	count, err := ss.Session().AnalyticsSessionCount()
	require.NoError(t, err)
	require.NotZero(t, count, "should have at least 1 session")
}

func testSessionCleanup(t *testing.T, rctx request.CTX, ss store.Store) {
	now := model.GetMillis()

	s1 := &model.Session{}
	s1.UserId = model.NewId()
	s1.ExpiresAt = 0 // never expires

	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	s2 := &model.Session{}
	s2.UserId = s1.UserId
	s2.ExpiresAt = now + 1000000 // expires in the future

	s2, err = ss.Session().Save(rctx, s2)
	require.NoError(t, err)

	s3 := &model.Session{}
	s3.UserId = model.NewId()
	s3.ExpiresAt = 1 // expired

	s3, err = ss.Session().Save(rctx, s3)
	require.NoError(t, err)

	s4 := &model.Session{}
	s4.UserId = model.NewId()
	s4.ExpiresAt = 2 // expired

	s4, err = ss.Session().Save(rctx, s4)
	require.NoError(t, err)

	err = ss.Session().Cleanup(now, 1)
	require.NoError(t, err)

	_, err = ss.Session().Get(rctx, s1.Id)
	assert.NoError(t, err)

	_, err = ss.Session().Get(rctx, s2.Id)
	assert.NoError(t, err)

	_, err = ss.Session().Get(rctx, s3.Id)
	assert.Error(t, err)

	_, err = ss.Session().Get(rctx, s4.Id)
	assert.Error(t, err)

	removeErr := ss.Session().Remove(s1.Id)
	require.NoError(t, removeErr)

	removeErr = ss.Session().Remove(s2.Id)
	require.NoError(t, removeErr)
}

func testGetSessionsExpired(t *testing.T, rctx request.CTX, ss store.Store) {
	now := model.GetMillis()

	// Clear existing sessions.
	err := ss.Session().RemoveAllSessions()
	require.NoError(t, err)

	s1 := &model.Session{}
	s1.UserId = model.NewId()
	s1.DeviceId = model.NewId()
	s1.ExpiresAt = 0 // never expires
	_, err = ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	s2 := &model.Session{}
	s2.UserId = model.NewId()
	s2.DeviceId = model.NewId()
	s2.ExpiresAt = now - TenMinutes // expired within threshold
	s2, err = ss.Session().Save(rctx, s2)
	require.NoError(t, err)

	s3 := &model.Session{}
	s3.UserId = model.NewId()
	s3.DeviceId = model.NewId()
	s3.ExpiresAt = now - (TenMinutes * 100) // expired outside threshold
	_, err = ss.Session().Save(rctx, s3)
	require.NoError(t, err)

	s4 := &model.Session{}
	s4.UserId = model.NewId()
	s4.ExpiresAt = now - TenMinutes // expired within threshold, but not mobile
	s4, err = ss.Session().Save(rctx, s4)
	require.NoError(t, err)

	s5 := &model.Session{}
	s5.UserId = model.NewId()
	s5.DeviceId = model.NewId()
	s5.ExpiresAt = now + (TenMinutes * 100000) // not expired
	_, err = ss.Session().Save(rctx, s5)
	require.NoError(t, err)

	sessions, err := ss.Session().GetSessionsExpired(TenMinutes*2, true, true) // mobile only
	require.NoError(t, err)
	require.Len(t, sessions, 1)
	require.Equal(t, s2.Id, sessions[0].Id)

	sessions, err = ss.Session().GetSessionsExpired(TenMinutes*2, false, true) // all client types
	require.NoError(t, err)
	require.Len(t, sessions, 2)
	expected := []string{s2.Id, s4.Id}
	for _, sess := range sessions {
		require.Contains(t, expected, sess.Id)
	}
}

func testUpdateExpiredNotify(t *testing.T, rctx request.CTX, ss store.Store) {
	s1 := &model.Session{}
	s1.UserId = model.NewId()
	s1.DeviceId = model.NewId()
	s1.ExpiresAt = model.GetMillis() + TenMinutes
	s1, err := ss.Session().Save(rctx, s1)
	require.NoError(t, err)

	session, err := ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.False(t, session.ExpiredNotify)

	err = ss.Session().UpdateExpiredNotify(session.Id, true)
	require.NoError(t, err)
	session, err = ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.True(t, session.ExpiredNotify)

	err = ss.Session().UpdateExpiredNotify(session.Id, false)
	require.NoError(t, err)
	session, err = ss.Session().Get(rctx, s1.Id)
	require.NoError(t, err)
	require.False(t, session.ExpiredNotify)
}

func testGetLRUSessions(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()

	// Clear existing sessions.
	err := ss.Session().RemoveAllSessions()
	require.NoError(t, err)

	s1 := &model.Session{}
	s1.UserId = userId
	s1.DeviceId = model.NewId()
	_, err = ss.Session().Save(rctx, s1)
	require.NoError(t, err)
	time.Sleep(1 * time.Millisecond)

	s2 := &model.Session{}
	s2.UserId = userId
	s2.DeviceId = model.NewId()
	s2, err = ss.Session().Save(rctx, s2)
	require.NoError(t, err)
	time.Sleep(1 * time.Millisecond)

	s3 := &model.Session{}
	s3.UserId = userId
	s3.DeviceId = model.NewId()
	s3, err = ss.Session().Save(rctx, s3)
	require.NoError(t, err)

	sessions, err := ss.Session().GetLRUSessions(rctx, userId, 3, 3)
	require.NoError(t, err)
	require.Len(t, sessions, 0)

	sessions, err = ss.Session().GetLRUSessions(rctx, userId, 3, 2)
	require.NoError(t, err)
	require.Len(t, sessions, 1)
	require.Equal(t, s1.Id, sessions[0].Id)

	sessions, err = ss.Session().GetLRUSessions(rctx, userId, 3, 1)
	require.NoError(t, err)
	require.Len(t, sessions, 2)
	require.Equal(t, s2.Id, sessions[0].Id)
	require.Equal(t, s1.Id, sessions[1].Id)

	sessions, err = ss.Session().GetLRUSessions(rctx, userId, 3, 0)
	require.NoError(t, err)
	require.Len(t, sessions, 3)
	require.Equal(t, s3.Id, sessions[0].Id)
	require.Equal(t, s2.Id, sessions[1].Id)
	require.Equal(t, s1.Id, sessions[2].Id)
}
