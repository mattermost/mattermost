// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestStatusStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testStatusStore(t, ss) })
	t.Run("ActiveUserCount", func(t *testing.T) { testActiveUserCount(t, ss) })
}

func testStatusStore(t *testing.T, ss store.Store) {
	status := &model.Status{UserId: model.NewId(), Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.Nil(t, ss.Status().SaveOrUpdate(status))

	status.LastActivityAt = 10

	if _, err := ss.Status().Get(status.UserId); err != nil {
		t.Fatal(err)
	}

	status2 := &model.Status{UserId: model.NewId(), Status: model.STATUS_AWAY, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.Nil(t, ss.Status().SaveOrUpdate(status2))

	status3 := &model.Status{UserId: model.NewId(), Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.Nil(t, ss.Status().SaveOrUpdate(status3))

	if statuses, err := ss.Status().GetByIds([]string{status.UserId, "junk"}); err != nil {
		t.Fatal(err)
	} else {
		if len(statuses) != 1 {
			t.Fatal("should only have 1 status")
		}
	}

	if err := ss.Status().ResetAll(); err != nil {
		t.Fatal(err)
	}

	if statusParameter, err := ss.Status().Get(status.UserId); err != nil {
		t.Fatal(err)
	} else {
		if statusParameter.Status != model.STATUS_OFFLINE {
			t.Fatal("should be offline")
		}
	}

	if err := ss.Status().UpdateLastActivityAt(status.UserId, 10); err != nil {
		t.Fatal(err)
	}
}

func testActiveUserCount(t *testing.T, ss store.Store) {
	status := &model.Status{UserId: model.NewId(), Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	require.Nil(t, ss.Status().SaveOrUpdate(status))

	if count, err := ss.Status().GetTotalActiveUsersCount(); err != nil {
		t.Fatal(err)
	} else {
		require.True(t, count > 0, "expected count > 0, got %d", count)
	}
}

type ByUserId []*model.Status

func (s ByUserId) Len() int           { return len(s) }
func (s ByUserId) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s ByUserId) Less(i, j int) bool { return s[i].UserId < s[j].UserId }
