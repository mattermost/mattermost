// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestStatusStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testStatusStore(t, ss) })
	t.Run("ActiveUserCount", func(t *testing.T) { testActiveUserCount(t, ss) })
	t.Run("GetAllFromTeam", func(t *testing.T) { testGetAllFromTeam(t, ss) })
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

	if statuses, err := ss.Status().GetOnlineAway(); err != nil {
		t.Fatal(err)
	} else {
		for _, status := range statuses {
			if status.Status == model.STATUS_OFFLINE {
				t.Fatal("should not have returned offline statuses")
			}
		}
	}

	if statuses, err := ss.Status().GetOnline(); err != nil {
		t.Fatal(err)
	} else {
		for _, status := range statuses {
			if status.Status != model.STATUS_ONLINE {
				t.Fatal("should not have returned offline statuses")
			}
		}
	}

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

func testGetAllFromTeam(t *testing.T, ss store.Store) {
	assertStatuses := func(expected, actual []*model.Status) {
		sort.Sort(ByUserId(expected))
		sort.Sort(ByUserId(actual))
		assert.Equal(t, expected, actual)
	}

	team1 := model.Team{}
	team1.DisplayName = model.NewId()
	team1.Name = "zz" + model.NewId()
	team1.Email = MakeEmail()
	team1.Type = model.TEAM_OPEN

	if _, err := ss.Team().Save(&team1); err != nil {
		t.Fatal("couldn't save team", err)
	}

	team2 := model.Team{}
	team2.DisplayName = model.NewId()
	team2.Name = "zz" + model.NewId()
	team2.Email = MakeEmail()
	team2.Type = model.TEAM_OPEN

	if _, err := ss.Team().Save(&team2); err != nil {
		t.Fatal("couldn't save team", err)
	}

	team1Member1 := &model.TeamMember{TeamId: team1.Id, UserId: model.NewId()}
	if response := <-ss.Team().SaveMember(team1Member1, -1); response.Err != nil {
		t.Fatal(response.Err)
	}
	team1Member2 := &model.TeamMember{TeamId: team1.Id, UserId: model.NewId()}
	if response := <-ss.Team().SaveMember(team1Member2, -1); response.Err != nil {
		t.Fatal(response.Err)
	}
	team2Member1 := &model.TeamMember{TeamId: team2.Id, UserId: model.NewId()}
	if response := <-ss.Team().SaveMember(team2Member1, -1); response.Err != nil {
		t.Fatal(response.Err)
	}
	team2Member2 := &model.TeamMember{TeamId: team2.Id, UserId: model.NewId()}
	if response := <-ss.Team().SaveMember(team2Member2, -1); response.Err != nil {
		t.Fatal(response.Err)
	}

	team1Member1Status := &model.Status{UserId: team1Member1.UserId, Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	require.Nil(t, ss.Status().SaveOrUpdate(team1Member1Status))

	team1Member2Status := &model.Status{UserId: team1Member2.UserId, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	require.Nil(t, ss.Status().SaveOrUpdate(team1Member2Status))

	team2Member1Status := &model.Status{UserId: team2Member1.UserId, Status: model.STATUS_ONLINE, Manual: true, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	require.Nil(t, ss.Status().SaveOrUpdate(team2Member1Status))

	team2Member2Status := &model.Status{UserId: team2Member2.UserId, Status: model.STATUS_OFFLINE, Manual: true, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	require.Nil(t, ss.Status().SaveOrUpdate(team2Member2Status))

	if statuses, err := ss.Status().GetAllFromTeam(team1.Id); err != nil {
		t.Fatal(err)
	} else {
		assertStatuses([]*model.Status{
			team1Member1Status,
			team1Member2Status,
		}, statuses)
	}

	if statuses, err := ss.Status().GetAllFromTeam(team2.Id); err != nil {
		t.Fatal(err)
	} else {
		assertStatuses([]*model.Status{
			team2Member1Status,
			team2Member2Status,
		}, statuses)
	}
}
