// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	sq "github.com/mattermost/squirrel"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestStatusStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("", func(t *testing.T) { testStatusStore(t, rctx, ss) })
	t.Run("ActiveUserCount", func(t *testing.T) { testActiveUserCount(t, rctx, ss) })
	t.Run("UpdateExpiredDNDStatuses", func(t *testing.T) { testUpdateExpiredDNDStatuses(t, rctx, ss) })
	t.Run("Get", func(t *testing.T) { testStatusGet(t, rctx, ss, s) })
	t.Run("GetByIds", func(t *testing.T) { testStatusGetByIds(t, rctx, ss, s) })
}

func testStatusStore(t *testing.T, _ request.CTX, ss store.Store) {
	status := &model.Status{UserId: model.NewId(), Status: model.StatusOnline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.NoError(t, ss.Status().SaveOrUpdate(status))

	status.LastActivityAt = 10

	_, err := ss.Status().Get(status.UserId)
	require.NoError(t, err)

	status2 := &model.Status{UserId: model.NewId(), Status: model.StatusAway, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.NoError(t, ss.Status().SaveOrUpdate(status2))

	status3 := &model.Status{UserId: model.NewId(), Status: model.StatusOffline, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.NoError(t, ss.Status().SaveOrUpdate(status3))

	statuses, err := ss.Status().GetByIds([]string{status.UserId, "junk"})
	require.NoError(t, err)
	require.Len(t, statuses, 1, "should only have 1 status")

	err = ss.Status().ResetAll()
	require.NoError(t, err)

	statusParameter, err := ss.Status().Get(status.UserId)
	require.NoError(t, err)
	require.Equal(t, statusParameter.Status, model.StatusOffline, "should be offline")

	err = ss.Status().UpdateLastActivityAt(status.UserId, 10)
	require.NoError(t, err)
}

func testActiveUserCount(t *testing.T, rctx request.CTX, ss store.Store) {
	status1 := &model.Status{UserId: model.NewId(), Status: model.StatusOnline, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	require.NoError(t, ss.Status().SaveOrUpdate(status1))

	count1, err := ss.Status().GetTotalActiveUsersCount()
	require.NoError(t, err)
	assert.Greater(t, count1, int64(0))

	status2 := &model.Status{UserId: model.NewId(), Status: model.StatusOnline, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	require.NoError(t, ss.Status().SaveOrUpdate(status2))

	count2, err := ss.Status().GetTotalActiveUsersCount()
	require.NoError(t, err)
	assert.Equal(t, count1+1, count2)
}

type ByUserId []*model.Status

func (s ByUserId) Len() int           { return len(s) }
func (s ByUserId) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s ByUserId) Less(i, j int) bool { return s[i].UserId < s[j].UserId }

func testUpdateExpiredDNDStatuses(t *testing.T, rctx request.CTX, ss store.Store) {
	userID := NewTestID()

	status := &model.Status{
		UserId:         userID,
		Status:         model.StatusDnd,
		Manual:         true,
		LastActivityAt: time.Now().Unix(),
		ActiveChannel:  "channel-id",
		DNDEndTime:     time.Now().Add(5 * time.Second).Unix(),
		PrevStatus:     model.StatusOnline,
	}
	require.NoError(t, ss.Status().SaveOrUpdate(status))

	time.Sleep(2 * time.Second)

	// after 2 seconds no statuses should be expired
	statuses, err := ss.Status().UpdateExpiredDNDStatuses()
	require.NoError(t, err)
	require.Len(t, statuses, 0)

	time.Sleep(3 * time.Second)

	// after 3 more seconds test status should be updated
	statuses, err = ss.Status().UpdateExpiredDNDStatuses()
	require.NoError(t, err)
	require.Len(t, statuses, 1)

	updatedStatus := *statuses[0]
	assert.Equal(t, updatedStatus.UserId, userID)
	assert.Equal(t, updatedStatus.Status, model.StatusOnline)
	assert.Equal(t, updatedStatus.Manual, false)
	assert.Equal(t, updatedStatus.LastActivityAt, updatedStatus.LastActivityAt)
	assert.Empty(t, updatedStatus.ActiveChannel)
	assert.Equal(t, updatedStatus.DNDEndTime, int64(0))
	assert.Equal(t, updatedStatus.PrevStatus, model.StatusDnd)
}

func insertNullStatus(t *testing.T, ss store.Store, s SqlStore) string {
	userId := model.NewId()
	db := ss.GetInternalMasterDB()

	// Insert status with explicit NULL values
	builder := sq.StatementBuilder.PlaceholderFormat(s.GetQueryPlaceholder()).
		Insert("Status").
		Columns("UserId", "Status", quoteColumnName(s.DriverName(), "Manual"), "LastActivityAt", "DNDEndTime", "PrevStatus").
		Values(userId, nil, nil, nil, nil, nil)

	query, args, err := builder.ToSql()
	require.NoError(t, err)

	_, err = db.Exec(query, args...)
	require.NoError(t, err)

	return userId
}

func testStatusGet(t *testing.T, _ request.CTX, ss store.Store, s SqlStore) {
	t.Run("null columns", func(t *testing.T) {
		userId := insertNullStatus(t, ss, s)

		received, err := ss.Status().Get(userId)
		require.NoError(t, err)
		assert.Equal(t, userId, received.UserId)
		assert.Empty(t, received.Status)
		assert.False(t, received.Manual)
		assert.Equal(t, int64(0), received.LastActivityAt)
		assert.Empty(t, received.ActiveChannel)
		assert.Equal(t, int64(0), received.DNDEndTime)
		assert.Empty(t, received.PrevStatus)
	})

	t.Run("status1", func(t *testing.T) {
		status1 := &model.Status{
			UserId:         model.NewId(),
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: 1234,
			ActiveChannel:  "channel-id",
			DNDEndTime:     model.GetMillis(),
			PrevStatus:     model.StatusOnline,
		}
		require.NoError(t, ss.Status().SaveOrUpdate(status1))

		received, err := ss.Status().Get(status1.UserId)
		require.NoError(t, err)
		assert.Equal(t, status1.UserId, received.UserId)
		assert.Equal(t, status1.Status, received.Status)
		assert.Equal(t, status1.Manual, received.Manual)
		assert.Equal(t, status1.LastActivityAt, received.LastActivityAt)
		assert.Empty(t, received.ActiveChannel)
		assert.Equal(t, status1.DNDEndTime, received.DNDEndTime)
		assert.Equal(t, status1.PrevStatus, received.PrevStatus)
	})

	t.Run("status2", func(t *testing.T) {
		status2 := &model.Status{
			UserId:         model.NewId(),
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: 12345,
			ActiveChannel:  "channel-id2",
			DNDEndTime:     model.GetMillis(),
			PrevStatus:     model.StatusAway,
		}
		require.NoError(t, ss.Status().SaveOrUpdate(status2))

		received, err := ss.Status().Get(status2.UserId)
		require.NoError(t, err)
		assert.Equal(t, status2.UserId, received.UserId)
		assert.Equal(t, status2.Status, received.Status)
		assert.Equal(t, status2.Manual, received.Manual)
		assert.Equal(t, status2.LastActivityAt, received.LastActivityAt)
		assert.Empty(t, received.ActiveChannel)
		assert.Equal(t, status2.DNDEndTime, received.DNDEndTime)
		assert.Equal(t, status2.PrevStatus, received.PrevStatus)
	})
}

func testStatusGetByIds(t *testing.T, _ request.CTX, ss store.Store, s SqlStore) {
	t.Run("null columns, single user", func(t *testing.T) {
		userId := insertNullStatus(t, ss, s)

		received, err := ss.Status().GetByIds([]string{userId})
		require.NoError(t, err)
		require.Len(t, received, 1)
		assert.Equal(t, userId, received[0].UserId)
		assert.Empty(t, received[0].Status)
		assert.False(t, received[0].Manual)
		assert.Equal(t, int64(0), received[0].LastActivityAt)
		assert.Empty(t, received[0].ActiveChannel)
		assert.Equal(t, int64(0), received[0].DNDEndTime)
		assert.Empty(t, received[0].PrevStatus)
	})

	t.Run("single user", func(t *testing.T) {
		status1 := &model.Status{
			UserId:         model.NewId(),
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: 1234,
			ActiveChannel:  "channel-id",
			DNDEndTime:     model.GetMillis(),
			PrevStatus:     model.StatusOnline,
		}
		require.NoError(t, ss.Status().SaveOrUpdate(status1))

		received, err := ss.Status().GetByIds([]string{status1.UserId})
		require.NoError(t, err)
		require.Len(t, received, 1)
		assert.Equal(t, status1.UserId, received[0].UserId)
		assert.Equal(t, status1.Status, received[0].Status)
		assert.Equal(t, status1.Manual, received[0].Manual)
		assert.Equal(t, status1.LastActivityAt, received[0].LastActivityAt)
		assert.Empty(t, received[0].ActiveChannel)
		assert.Equal(t, status1.DNDEndTime, received[0].DNDEndTime)
		assert.Equal(t, status1.PrevStatus, received[0].PrevStatus)
	})

	t.Run("multiple users", func(t *testing.T) {
		status1 := &model.Status{
			UserId:         model.NewId(),
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: 1234,
			ActiveChannel:  "channel-id",
			DNDEndTime:     model.GetMillis(),
			PrevStatus:     model.StatusOnline,
		}
		require.NoError(t, ss.Status().SaveOrUpdate(status1))

		status2 := &model.Status{
			UserId:         model.NewId(),
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: 12345,
			ActiveChannel:  "channel-id2",
			DNDEndTime:     model.GetMillis(),
			PrevStatus:     model.StatusAway,
		}
		require.NoError(t, ss.Status().SaveOrUpdate(status2))

		received, err := ss.Status().GetByIds([]string{status1.UserId, status2.UserId})
		require.NoError(t, err)
		require.Len(t, received, 2)

		for _, status := range received {
			if status.UserId == status1.UserId {
				assert.Equal(t, status1.UserId, status.UserId)
				assert.Equal(t, status1.Status, status.Status)
				assert.Equal(t, status1.Manual, status.Manual)
				assert.Equal(t, status1.LastActivityAt, status.LastActivityAt)
				assert.Empty(t, status.ActiveChannel)
				assert.Equal(t, status1.DNDEndTime, status.DNDEndTime)
				assert.Equal(t, status1.PrevStatus, status.PrevStatus)
			} else {
				assert.Equal(t, status2.UserId, status.UserId)
				assert.Equal(t, status2.Status, status.Status)
				assert.Equal(t, status2.Manual, status.Manual)
				assert.Equal(t, status2.LastActivityAt, status.LastActivityAt)
				assert.Empty(t, status.ActiveChannel)
				assert.Equal(t, status2.DNDEndTime, status.DNDEndTime)
				assert.Equal(t, status2.PrevStatus, status.PrevStatus)
			}
		}
	})
}
