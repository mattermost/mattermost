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

	if err := (<-ss.Status().SaveOrUpdate(status)).Err; err != nil {
		t.Fatal(err)
	}

	status.LastActivityAt = 10

	if err := (<-ss.Status().SaveOrUpdate(status)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-ss.Status().Get(status.UserId)).Err; err != nil {
		t.Fatal(err)
	}

	status2 := &model.Status{UserId: model.NewId(), Status: model.STATUS_AWAY, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	if err := (<-ss.Status().SaveOrUpdate(status2)).Err; err != nil {
		t.Fatal(err)
	}

	status3 := &model.Status{UserId: model.NewId(), Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	if err := (<-ss.Status().SaveOrUpdate(status3)).Err; err != nil {
		t.Fatal(err)
	}

	if result := <-ss.Status().GetOnlineAway(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		statuses := result.Data.([]*model.Status)
		for _, status := range statuses {
			if status.Status == model.STATUS_OFFLINE {
				t.Fatal("should not have returned offline statuses")
			}
		}
	}

	if result := <-ss.Status().GetOnline(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		statuses := result.Data.([]*model.Status)
		for _, status := range statuses {
			if status.Status != model.STATUS_ONLINE {
				t.Fatal("should not have returned offline statuses")
			}
		}
	}

	if result := <-ss.Status().GetByIds([]string{status.UserId, "junk"}); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		statuses := result.Data.([]*model.Status)
		if len(statuses) != 1 {
			t.Fatal("should only have 1 status")
		}
	}

	if err := (<-ss.Status().ResetAll()).Err; err != nil {
		t.Fatal(err)
	}

	if result := <-ss.Status().Get(status.UserId); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		status := result.Data.(*model.Status)
		if status.Status != model.STATUS_OFFLINE {
			t.Fatal("should be offline")
		}
	}

	if result := <-ss.Status().UpdateLastActivityAt(status.UserId, 10); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func testActiveUserCount(t *testing.T, ss store.Store) {
	status := &model.Status{UserId: model.NewId(), Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	store.Must(ss.Status().SaveOrUpdate(status))

	if result := <-ss.Status().GetTotalActiveUsersCount(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		count := result.Data.(int64)
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
	team1.Name = model.NewId()
	team1.Email = MakeEmail()
	team1.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&team1)).Err; err != nil {
		t.Fatal("couldn't save team", err)
	}

	team2 := model.Team{}
	team2.DisplayName = model.NewId()
	team2.Name = model.NewId()
	team2.Email = MakeEmail()
	team2.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&team2)).Err; err != nil {
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
	if err := (<-ss.Status().SaveOrUpdate(team1Member1Status)).Err; err != nil {
		t.Fatal(err)
	}
	team1Member2Status := &model.Status{UserId: team1Member2.UserId, Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	if err := (<-ss.Status().SaveOrUpdate(team1Member2Status)).Err; err != nil {
		t.Fatal(err)
	}
	team2Member1Status := &model.Status{UserId: team2Member1.UserId, Status: model.STATUS_ONLINE, Manual: true, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	if err := (<-ss.Status().SaveOrUpdate(team2Member1Status)).Err; err != nil {
		t.Fatal(err)
	}
	team2Member2Status := &model.Status{UserId: team2Member2.UserId, Status: model.STATUS_OFFLINE, Manual: true, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
	if err := (<-ss.Status().SaveOrUpdate(team2Member2Status)).Err; err != nil {
		t.Fatal(err)
	}

	if result := <-ss.Status().GetAllFromTeam(team1.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		assertStatuses([]*model.Status{
			team1Member1Status,
			team1Member2Status,
		}, result.Data.([]*model.Status))
	}

	if result := <-ss.Status().GetAllFromTeam(team2.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		assertStatuses([]*model.Status{
			team2Member1Status,
			team2Member2Status,
		}, result.Data.([]*model.Status))
	}
}
