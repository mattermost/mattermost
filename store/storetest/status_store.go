// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func TestStatusStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testStatusStore(t, ss) })
	t.Run("ActiveUserCount", func(t *testing.T) { testActiveUserCount(t, ss) })
}

func testStatusStore(t *testing.T, ss store.Store) {
	status := &model.Status{UserId: model.NewId(), Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.NoError(t, ss.Status().SaveOrUpdate(status))

	status.LastActivityAt = 10

	_, err := ss.Status().Get(status.UserId)
	require.NoError(t, err)

	status2 := &model.Status{UserId: model.NewId(), Status: model.STATUS_AWAY, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.NoError(t, ss.Status().SaveOrUpdate(status2))

	status3 := &model.Status{UserId: model.NewId(), Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.NoError(t, ss.Status().SaveOrUpdate(status3))

	statuses, err := ss.Status().GetByIds([]string{status.UserId, "junk"})
	require.NoError(t, err)
	require.Len(t, statuses, 1, "should only have 1 status")

	err = ss.Status().ResetAll()
	require.NoError(t, err)

	statusParameter, err := ss.Status().Get(status.UserId)
	require.NoError(t, err)
	require.Equal(t, statusParameter.Status, model.STATUS_OFFLINE, "should be offline")

	err = ss.Status().UpdateLastActivityAt(status.UserId, 10)
	require.NoError(t, err)
}

func testActiveUserCount(t *testing.T, ss store.Store) {
	status := &model.Status{UserId: model.NewId(), Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	require.NoError(t, ss.Status().SaveOrUpdate(status))

	count, err := ss.Status().GetTotalActiveUsersCount()
	require.NoError(t, err)
	require.True(t, count > 0, "expected count > 0, got %d", count)
}

type ByUserId []*model.Status

func (s ByUserId) Len() int           { return len(s) }
func (s ByUserId) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s ByUserId) Less(i, j int) bool { return s[i].UserId < s[j].UserId }
