// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func cleanupTeamStore(t *testing.T, ss store.Store) {
	allTeams, err := ss.Team().GetAll()
	for _, team := range allTeams {
		ss.Team().PermanentDelete(team.Id)
	}
	assert.Nil(t, err)
}

func TestTeamStore(t *testing.T, ss store.Store) {
	createDefaultRoles(t, ss)

	t.Run("Save", func(t *testing.T) { testTeamStoreSave(t, ss) })
	t.Run("Update", func(t *testing.T) { testTeamStoreUpdate(t, ss) })
	t.Run("Get", func(t *testing.T) { testTeamStoreGet(t, ss) })
	t.Run("GetByName", func(t *testing.T) { testTeamStoreGetByName(t, ss) })
	t.Run("SearchAll", func(t *testing.T) { testTeamStoreSearchAll(t, ss) })
	t.Run("SearchOpen", func(t *testing.T) { testTeamStoreSearchOpen(t, ss) })
	t.Run("SearchPrivate", func(t *testing.T) { testTeamStoreSearchPrivate(t, ss) })
	t.Run("GetByInviteId", func(t *testing.T) { testTeamStoreGetByInviteId(t, ss) })
	t.Run("ByUserId", func(t *testing.T) { testTeamStoreByUserId(t, ss) })
	t.Run("GetAllTeamListing", func(t *testing.T) { testGetAllTeamListing(t, ss) })
	t.Run("GetAllTeamPageListing", func(t *testing.T) { testGetAllTeamPageListing(t, ss) })
	t.Run("GetAllPrivateTeamListing", func(t *testing.T) { testGetAllPrivateTeamListing(t, ss) })
	t.Run("GetAllPrivateTeamPageListing", func(t *testing.T) { testGetAllPrivateTeamPageListing(t, ss) })
	t.Run("GetAllPublicTeamPageListing", func(t *testing.T) { testGetAllPublicTeamPageListing(t, ss) })
	t.Run("Delete", func(t *testing.T) { testDelete(t, ss) })
	t.Run("TeamCount", func(t *testing.T) { testTeamCount(t, ss) })
	t.Run("TeamPublicCount", func(t *testing.T) { testPublicTeamCount(t, ss) })
	t.Run("TeamPrivateCount", func(t *testing.T) { testPrivateTeamCount(t, ss) })
	t.Run("TeamMembers", func(t *testing.T) { testTeamMembers(t, ss) })
	t.Run("GetMembersOrder", func(t *testing.T) { testGetMembersOrder(t, ss) })
	t.Run("SaveTeamMemberMaxMembers", func(t *testing.T) { testSaveTeamMemberMaxMembers(t, ss) })
	t.Run("GetTeamMember", func(t *testing.T) { testGetTeamMember(t, ss) })
	t.Run("GetTeamMembersByIds", func(t *testing.T) { testGetTeamMembersByIds(t, ss) })
	t.Run("MemberCount", func(t *testing.T) { testTeamStoreMemberCount(t, ss) })
	t.Run("GetChannelUnreadsForAllTeams", func(t *testing.T) { testGetChannelUnreadsForAllTeams(t, ss) })
	t.Run("GetChannelUnreadsForTeam", func(t *testing.T) { testGetChannelUnreadsForTeam(t, ss) })
	t.Run("UpdateLastTeamIconUpdate", func(t *testing.T) { testUpdateLastTeamIconUpdate(t, ss) })
	t.Run("GetTeamsByScheme", func(t *testing.T) { testGetTeamsByScheme(t, ss) })
	t.Run("MigrateTeamMembers", func(t *testing.T) { testTeamStoreMigrateTeamMembers(t, ss) })
	t.Run("ResetAllTeamSchemes", func(t *testing.T) { testResetAllTeamSchemes(t, ss) })
	t.Run("ClearAllCustomRoleAssignments", func(t *testing.T) { testTeamStoreClearAllCustomRoleAssignments(t, ss) })
	t.Run("AnalyticsGetTeamCountForScheme", func(t *testing.T) { testTeamStoreAnalyticsGetTeamCountForScheme(t, ss) })
	t.Run("GetAllForExportAfter", func(t *testing.T) { testTeamStoreGetAllForExportAfter(t, ss) })
	t.Run("GetTeamMembersForExport", func(t *testing.T) { testTeamStoreGetTeamMembersForExport(t, ss) })
	t.Run("GetTeamsForUserWithPagination", func(t *testing.T) { testTeamMembersWithPagination(t, ss) })
	t.Run("GroupSyncedTeamCount", func(t *testing.T) { testGroupSyncedTeamCount(t, ss) })
}

func testTeamStoreSave(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN

	_, err := ss.Team().Save(&o1)
	require.Nil(t, err, "couldn't save item")

	_, err = ss.Team().Save(&o1)
	require.NotNil(t, err, "shouldn't be able to update from save")

	o1.Id = ""
	_, err = ss.Team().Save(&o1)
	require.NotNil(t, err, "should be unique domain")
}

func testTeamStoreUpdate(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	time.Sleep(100 * time.Millisecond)

	_, err = ss.Team().Update(&o1)
	require.Nil(t, err)

	o1.Id = "missing"
	_, err = ss.Team().Update(&o1)
	require.NotNil(t, err, "Update should have failed because of missing key")

	o1.Id = model.NewId()
	_, err = ss.Team().Update(&o1)
	require.NotNil(t, err, "Update should have faile because id change")
}

func testTeamStoreGet(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	r1, err := ss.Team().Get(o1.Id)
	require.Nil(t, err)
	require.Equal(t, r1.ToJson(), o1.ToJson())

	_, err = ss.Team().Get("")
	require.NotNil(t, err, "Missing id should have failed")
}

func testTeamStoreGetByName(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN

	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	team, err := ss.Team().GetByName(o1.Name)
	require.Nil(t, err)
	require.Equal(t, *team, o1, "invalid returned team")

	_, err = ss.Team().GetByName("")
	require.NotNil(t, err, "Missing id should have failed")
}

func testTeamStoreSearchAll(t *testing.T, ss store.Store) {
	o := model.Team{}
	o.DisplayName = "ADisplayName" + model.NewId()
	o.Name = "zzzzzz-" + model.NewId() + "a"
	o.Email = MakeEmail()
	o.Type = model.TEAM_OPEN
	o.AllowOpenInvite = true

	_, err := ss.Team().Save(&o)
	require.Nil(t, err)

	p := model.Team{}
	p.DisplayName = "ADisplayName" + model.NewId()
	p.Name = "zzzzzz-" + model.NewId() + "a"
	p.Email = MakeEmail()
	p.Type = model.TEAM_OPEN
	p.AllowOpenInvite = false

	_, err = ss.Team().Save(&p)
	require.Nil(t, err)

	testCases := []struct {
		Name            string
		Term            string
		ExpectedLenth   int
		ExpectedFirstId string
	}{
		{
			"Search for open team name",
			o.Name,
			1,
			o.Id,
		},
		{
			"Search for open team displayName",
			o.DisplayName,
			1,
			o.Id,
		},
		{
			"Search for open team without results",
			"junk",
			0,
			"",
		},
		{
			"Search for private team",
			p.DisplayName,
			1,
			p.Id,
		},
		{
			"Search for both teams",
			"zzzzzz",
			2,
			"",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			r1, err := ss.Team().SearchAll(tc.Term)
			require.Nil(t, err)
			require.Equal(t, tc.ExpectedLenth, len(r1))
			if tc.ExpectedFirstId != "" {
				assert.Equal(t, tc.ExpectedFirstId, r1[0].Id)
			}
		})
	}
}

func testTeamStoreSearchOpen(t *testing.T, ss store.Store) {
	o := model.Team{}
	o.DisplayName = "ADisplayName" + model.NewId()
	o.Name = "zz" + model.NewId() + "a"
	o.Email = MakeEmail()
	o.Type = model.TEAM_OPEN
	o.AllowOpenInvite = true

	_, err := ss.Team().Save(&o)
	require.Nil(t, err)

	p := model.Team{}
	p.DisplayName = "ADisplayName" + model.NewId()
	p.Name = "zz" + model.NewId() + "a"
	p.Email = MakeEmail()
	p.Type = model.TEAM_OPEN
	p.AllowOpenInvite = false

	_, err = ss.Team().Save(&p)
	require.Nil(t, err)

	testCases := []struct {
		Name            string
		Term            string
		ExpectedLength  int
		ExpectedFirstId string
	}{
		{
			"Search for open team name",
			o.Name,
			1,
			o.Id,
		},
		{
			"Search for open team displayName",
			o.DisplayName,
			1,
			o.Id,
		},
		{
			"Search for open team without results",
			"junk",
			0,
			"",
		},
		{
			"Search for a private team (expected no results)",
			p.DisplayName,
			0,
			"",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			r1, err := ss.Team().SearchOpen(tc.Term)
			require.Nil(t, err)
			results := r1
			require.Equal(t, tc.ExpectedLength, len(results))
			if tc.ExpectedFirstId != "" {
				assert.Equal(t, tc.ExpectedFirstId, results[0].Id)
			}
		})
	}
}

func testTeamStoreSearchPrivate(t *testing.T, ss store.Store) {
	o := model.Team{}
	o.DisplayName = "ADisplayName" + model.NewId()
	o.Name = "zz" + model.NewId() + "a"
	o.Email = MakeEmail()
	o.Type = model.TEAM_OPEN
	o.AllowOpenInvite = true

	_, err := ss.Team().Save(&o)
	require.Nil(t, err)

	p := model.Team{}
	p.DisplayName = "ADisplayName" + model.NewId()
	p.Name = "zz" + model.NewId() + "a"
	p.Email = MakeEmail()
	p.Type = model.TEAM_OPEN
	p.AllowOpenInvite = false

	_, err = ss.Team().Save(&p)
	require.Nil(t, err)

	testCases := []struct {
		Name            string
		Term            string
		ExpectedLength  int
		ExpectedFirstId string
	}{
		{
			"Search for private team name",
			p.Name,
			1,
			p.Id,
		},
		{
			"Search for private team displayName",
			p.DisplayName,
			1,
			p.Id,
		},
		{
			"Search for private team without results",
			"junk",
			0,
			"",
		},
		{
			"Search for a open team (expected no results)",
			o.DisplayName,
			0,
			"",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			r1, err := ss.Team().SearchPrivate(tc.Term)
			require.Nil(t, err)
			results := r1
			require.Equal(t, tc.ExpectedLength, len(results))
			if tc.ExpectedFirstId != "" {
				assert.Equal(t, tc.ExpectedFirstId, results[0].Id)
			}
		})
	}
}

func testTeamStoreGetByInviteId(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.InviteId = model.NewId()

	save1, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN

	r1, err := ss.Team().GetByInviteId(save1.InviteId)
	require.Nil(t, err)
	require.Equal(t, *r1, o1, "invalid returned team")

	_, err = ss.Team().GetByInviteId("")
	require.NotNil(t, err, "Missing id should have failed")
}

func testTeamStoreByUserId(t *testing.T, ss store.Store) {
	o1 := &model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.InviteId = model.NewId()
	o1, err := ss.Team().Save(o1)
	require.Nil(t, err)

	m1 := &model.TeamMember{TeamId: o1.Id, UserId: model.NewId()}
	_, err = ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)

	teams, err := ss.Team().GetTeamsByUserId(m1.UserId)
	require.Nil(t, err)
	require.Len(t, teams, 1, "Should return a team")
	require.Equal(t, teams[0].Id, o1.Id, "should be a member")
}

func testGetAllTeamListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	_, err = ss.Team().Save(&o2)
	require.Nil(t, err)

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	_, err = ss.Team().Save(&o3)
	require.Nil(t, err)

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = MakeEmail()
	o4.Type = model.TEAM_INVITE
	_, err = ss.Team().Save(&o4)
	require.Nil(t, err)

	teams, err := ss.Team().GetAllTeamListing()
	require.Nil(t, err)
	for _, team := range teams {
		require.True(t, team.AllowOpenInvite, "should have returned team with AllowOpenInvite as true")
	}

	require.NotEmpty(t, teams, "failed team listing")
}

func testGetAllTeamPageListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	o2.AllowOpenInvite = false
	_, err = ss.Team().Save(&o2)
	require.Nil(t, err)

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	_, err = ss.Team().Save(&o3)
	require.Nil(t, err)

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = MakeEmail()
	o4.Type = model.TEAM_INVITE
	o4.AllowOpenInvite = false
	_, err = ss.Team().Save(&o4)
	require.Nil(t, err)

	teams, err := ss.Team().GetAllTeamPageListing(0, 10)
	require.Nil(t, err)

	for _, team := range teams {
		require.True(t, team.AllowOpenInvite, "should have returned team with AllowOpenInvite as true")
	}

	require.LessOrEqual(t, len(teams), 10, "should have returned max of 10 teams")

	o5 := model.Team{}
	o5.DisplayName = "DisplayName"
	o5.Name = "z-z-z" + model.NewId() + "b"
	o5.Email = MakeEmail()
	o5.Type = model.TEAM_OPEN
	o5.AllowOpenInvite = true
	_, err = ss.Team().Save(&o5)
	require.Nil(t, err)

	teams, err = ss.Team().GetAllTeamPageListing(0, 4)
	require.Nil(t, err)

	for _, team := range teams {
		require.True(t, team.AllowOpenInvite, "should have returned team with AllowOpenInvite as true")
	}

	require.LessOrEqual(t, len(teams), 4, "should have returned max of 4 teams")

	teams, err = ss.Team().GetAllTeamPageListing(1, 1)
	require.Nil(t, err)

	for _, team := range teams {
		require.True(t, team.AllowOpenInvite, "should have returned team with AllowOpenInvite as true")
	}

	require.LessOrEqual(t, len(teams), 1, "should have returned max of 1 team")
}

func testGetAllPrivateTeamListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	_, err = ss.Team().Save(&o2)
	require.Nil(t, err)

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	_, err = ss.Team().Save(&o3)
	require.Nil(t, err)

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = MakeEmail()
	o4.Type = model.TEAM_INVITE
	_, err = ss.Team().Save(&o4)
	require.Nil(t, err)

	teams, err := ss.Team().GetAllPrivateTeamListing()
	require.Nil(t, err)
	require.NotEmpty(t, teams, "failed team listing")

	for _, team := range teams {
		require.False(t, team.AllowOpenInvite, "should have returned team with AllowOpenInvite as false")
	}
}

func testGetAllPrivateTeamPageListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	o2.AllowOpenInvite = false
	_, err = ss.Team().Save(&o2)
	require.Nil(t, err)

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	_, err = ss.Team().Save(&o3)
	require.Nil(t, err)

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = MakeEmail()
	o4.Type = model.TEAM_INVITE
	o4.AllowOpenInvite = false
	_, err = ss.Team().Save(&o4)
	require.Nil(t, err)

	teams, listErr := ss.Team().GetAllPrivateTeamPageListing(0, 10)
	require.Nil(t, listErr)
	for _, team := range teams {
		require.False(t, team.AllowOpenInvite, "should have returned team with AllowOpenInvite as false")
	}

	require.LessOrEqual(t, len(teams), 10, "should have returned max of 10 teams")

	o5 := model.Team{}
	o5.DisplayName = "DisplayName"
	o5.Name = "z-z-z" + model.NewId() + "b"
	o5.Email = MakeEmail()
	o5.Type = model.TEAM_OPEN
	o5.AllowOpenInvite = true
	_, err = ss.Team().Save(&o5)
	require.Nil(t, err)

	teams, listErr = ss.Team().GetAllPrivateTeamPageListing(0, 4)
	require.Nil(t, listErr)
	for _, team := range teams {
		require.False(t, team.AllowOpenInvite, "should have returned team with AllowOpenInvite as false")
	}

	require.LessOrEqual(t, len(teams), 4, "should have returned max of 4 teams")

	teams, listErr = ss.Team().GetAllPrivateTeamPageListing(1, 1)
	require.Nil(t, listErr)
	for _, team := range teams {
		require.False(t, team.AllowOpenInvite, "should have returned team with AllowOpenInvite as false")
	}

	require.LessOrEqual(t, len(teams), 1, "should have returned max of 1 team")
}

func testGetAllPublicTeamPageListing(t *testing.T, ss store.Store) {
	cleanupTeamStore(t, ss)

	o1 := model.Team{}
	o1.DisplayName = "DisplayName1"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	t1, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName2"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	o2.AllowOpenInvite = false
	_, err = ss.Team().Save(&o2)
	require.Nil(t, err)

	o3 := model.Team{}
	o3.DisplayName = "DisplayName3"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	t3, err := ss.Team().Save(&o3)
	require.Nil(t, err)

	o4 := model.Team{}
	o4.DisplayName = "DisplayName4"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = MakeEmail()
	o4.Type = model.TEAM_INVITE
	o4.AllowOpenInvite = false
	_, err = ss.Team().Save(&o4)
	require.Nil(t, err)

	teams, err := ss.Team().GetAllPublicTeamPageListing(0, 10)
	assert.Nil(t, err)
	assert.Equal(t, []*model.Team{t1, t3}, teams)

	o5 := model.Team{}
	o5.DisplayName = "DisplayName5"
	o5.Name = "z-z-z" + model.NewId() + "b"
	o5.Email = MakeEmail()
	o5.Type = model.TEAM_OPEN
	o5.AllowOpenInvite = true
	t5, err := ss.Team().Save(&o5)
	require.Nil(t, err)

	teams, err = ss.Team().GetAllPublicTeamPageListing(0, 4)
	assert.Nil(t, err)
	assert.Equal(t, []*model.Team{t1, t3, t5}, teams)

	_, err = ss.Team().GetAllPublicTeamPageListing(1, 1)
	assert.Nil(t, err)
}

func testDelete(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	_, err = ss.Team().Save(&o2)
	require.Nil(t, err)

	r1 := ss.Team().PermanentDelete(o1.Id)
	require.Nil(t, r1)
}

func testPublicTeamCount(t *testing.T, ss store.Store) {
	cleanupTeamStore(t, ss)

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "z-z-z" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	o2.AllowOpenInvite = false
	_, err = ss.Team().Save(&o2)
	require.Nil(t, err)

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_OPEN
	o3.AllowOpenInvite = true
	_, err = ss.Team().Save(&o3)
	require.Nil(t, err)

	teamCount, err := ss.Team().AnalyticsPublicTeamCount()
	require.Nil(t, err)
	require.Equal(t, int64(2), teamCount, "should only be 1 team")
}

func testPrivateTeamCount(t *testing.T, ss store.Store) {
	cleanupTeamStore(t, ss)

	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = false
	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "z-z-z" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	o2.AllowOpenInvite = true
	_, err = ss.Team().Save(&o2)
	require.Nil(t, err)

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_OPEN
	o3.AllowOpenInvite = false
	_, err = ss.Team().Save(&o3)
	require.Nil(t, err)

	teamCount, err := ss.Team().AnalyticsPrivateTeamCount()
	require.Nil(t, err)
	require.Equal(t, int64(2), teamCount, "should only be 1 team")
}

func testTeamCount(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	team, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	// not including deleted teams
	teamCount, err := ss.Team().AnalyticsTeamCount(false)
	require.Nil(t, err)
	require.NotEqual(t, 0, int(teamCount), "should be at least 1 team")

	// delete the team for the next check
	team.DeleteAt = model.GetMillis()
	_, err = ss.Team().Update(team)
	require.Nil(t, err)

	// get the count of teams not including deleted
	countNotIncludingDeleted, err := ss.Team().AnalyticsTeamCount(false)
	require.Nil(t, err)

	// get the count of teams including deleted
	countIncludingDeleted, err := ss.Team().AnalyticsTeamCount(true)
	require.Nil(t, err)

	// count including deleted should be one greater than not including deleted
	require.Equal(t, countNotIncludingDeleted+1, countIncludingDeleted)
}

func testGetMembersOrder(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: "55555555555555555555555555"}
	m2 := &model.TeamMember{TeamId: teamId1, UserId: "11111111111111111111111111"}
	m3 := &model.TeamMember{TeamId: teamId1, UserId: "33333333333333333333333333"}
	m4 := &model.TeamMember{TeamId: teamId1, UserId: "22222222222222222222222222"}
	m5 := &model.TeamMember{TeamId: teamId1, UserId: "44444444444444444444444444"}
	m6 := &model.TeamMember{TeamId: teamId2, UserId: "00000000000000000000000000"}

	_, err := ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m2, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m3, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m4, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m5, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m6, -1)
	require.Nil(t, err)

	ms, err := ss.Team().GetMembers(teamId1, 0, 100, nil)
	require.Nil(t, err)
	assert.Len(t, ms, 5)
	assert.Equal(t, "11111111111111111111111111", ms[0].UserId)
	assert.Equal(t, "22222222222222222222222222", ms[1].UserId)
	assert.Equal(t, "33333333333333333333333333", ms[2].UserId)
	assert.Equal(t, "44444444444444444444444444", ms[3].UserId)
	assert.Equal(t, "55555555555555555555555555", ms[4].UserId)
}

func testTeamMembers(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m3 := &model.TeamMember{TeamId: teamId2, UserId: model.NewId()}

	_, err := ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m2, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m3, -1)
	require.Nil(t, err)

	ms, err := ss.Team().GetMembers(teamId1, 0, 100, nil)
	require.Nil(t, err)
	assert.Len(t, ms, 2)

	ms, err = ss.Team().GetMembers(teamId2, 0, 100, nil)
	require.Nil(t, err)
	require.Len(t, ms, 1)
	require.Equal(t, m3.UserId, ms[0].UserId)

	ms, err = ss.Team().GetTeamsForUser(m1.UserId)
	require.Nil(t, err)
	require.Len(t, ms, 1)
	require.Equal(t, m1.TeamId, ms[0].TeamId)

	err = ss.Team().RemoveMember(teamId1, m1.UserId)
	require.Nil(t, err)

	ms, err = ss.Team().GetMembers(teamId1, 0, 100, nil)
	require.Nil(t, err)
	require.Len(t, ms, 1)
	require.Equal(t, m2.UserId, ms[0].UserId)

	_, err = ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)

	err = ss.Team().RemoveAllMembersByTeam(teamId1)
	require.Nil(t, err)

	ms, err = ss.Team().GetMembers(teamId1, 0, 100, nil)
	require.Nil(t, err)
	require.Empty(t, ms)

	uid := model.NewId()
	m4 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m5 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	_, err = ss.Team().SaveMember(m4, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m5, -1)
	require.Nil(t, err)

	ms, err = ss.Team().GetTeamsForUser(uid)
	require.Nil(t, err)
	require.Len(t, ms, 2)

	err = ss.Team().RemoveAllMembersByUser(uid)
	require.Nil(t, err)

	ms, err = ss.Team().GetTeamsForUser(m1.UserId)
	require.Nil(t, err)
	require.Empty(t, ms)
}

func testTeamMembersWithPagination(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m3 := &model.TeamMember{TeamId: teamId2, UserId: model.NewId()}

	_, err := ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)

	_, err = ss.Team().SaveMember(m2, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m3, -1)
	require.Nil(t, err)

	ms, errTeam := ss.Team().GetTeamsForUserWithPagination(m1.UserId, 0, 1)
	require.Nil(t, errTeam)

	require.Len(t, ms, 1)
	require.Equal(t, m1.TeamId, ms[0].TeamId)

	e := ss.Team().RemoveMember(teamId1, m1.UserId)
	require.Nil(t, e)

	ms, err = ss.Team().GetMembers(teamId1, 0, 100, nil)
	require.Nil(t, err)

	require.Len(t, ms, 1)
	require.Equal(t, m2.UserId, ms[0].UserId)

	_, err = ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)

	err = ss.Team().RemoveAllMembersByTeam(teamId1)
	require.Nil(t, err)

	uid := model.NewId()
	m4 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m5 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	_, err = ss.Team().SaveMember(m4, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m5, -1)
	require.Nil(t, err)

	result, err := ss.Team().GetTeamsForUserWithPagination(uid, 0, 1)
	require.Nil(t, err)
	require.Len(t, result, 1)

	err = ss.Team().RemoveAllMembersByUser(uid)
	require.Nil(t, err)

	result, err = ss.Team().GetTeamsForUserWithPagination(uid, 1, 1)
	require.Nil(t, err)
	require.Empty(t, result)
}

func testSaveTeamMemberMaxMembers(t *testing.T, ss store.Store) {
	maxUsersPerTeam := 5

	team, errSave := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "z-z-z" + model.NewId() + "b",
		Type:        model.TEAM_OPEN,
	})
	require.Nil(t, errSave)
	defer func() {
		ss.Team().PermanentDelete(team.Id)
	}()

	userIds := make([]string, maxUsersPerTeam)

	for i := 0; i < maxUsersPerTeam; i++ {
		user, err := ss.User().Save(&model.User{
			Username: model.NewId(),
			Email:    MakeEmail(),
		})
		require.Nil(t, err)
		userIds[i] = user.Id

		defer func(userId string) {
			ss.User().PermanentDelete(userId)
		}(userIds[i])

		_, err = ss.Team().SaveMember(&model.TeamMember{
			TeamId: team.Id,
			UserId: userIds[i],
		}, maxUsersPerTeam)
		require.Nil(t, err)

		defer func(userId string) {
			ss.Team().RemoveMember(team.Id, userId)
		}(userIds[i])
	}

	totalMemberCount, err := ss.Team().GetTotalMemberCount(team.Id, nil)
	require.Nil(t, err)
	require.Equal(t, int(totalMemberCount), maxUsersPerTeam, "should start with 5 team members, had %v instead", totalMemberCount)

	user, err := ss.User().Save(&model.User{
		Username: model.NewId(),
		Email:    MakeEmail(),
	})
	require.Nil(t, err)
	newUserId := user.Id
	defer func() {
		ss.User().PermanentDelete(newUserId)
	}()

	_, err = ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: newUserId,
	}, maxUsersPerTeam)
	require.NotNil(t, err, "shouldn't be able to save member when at maximum members per team")

	totalMemberCount, teamErr := ss.Team().GetTotalMemberCount(team.Id, nil)
	require.Nil(t, teamErr)
	require.Equal(t, maxUsersPerTeam, int(totalMemberCount), "should still have 5 team members, had %v instead", totalMemberCount)

	// Leaving the team from the UI sets DeleteAt instead of using TeamStore.RemoveMember
	_, teamErr = ss.Team().UpdateMember(&model.TeamMember{
		TeamId:   team.Id,
		UserId:   userIds[0],
		DeleteAt: 1234,
	})
	require.Nil(t, teamErr)

	totalMemberCount, teamErr = ss.Team().GetTotalMemberCount(team.Id, nil)
	require.Nil(t, teamErr)
	require.Equal(t, maxUsersPerTeam-1, int(totalMemberCount), "should now only have 4 team members, had %v instead", totalMemberCount)

	_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId}, maxUsersPerTeam)
	require.Nil(t, err, "should've been able to save new member after deleting one")

	defer ss.Team().RemoveMember(team.Id, newUserId)

	totalMemberCount, teamErr = ss.Team().GetTotalMemberCount(team.Id, nil)
	require.Nil(t, teamErr)
	require.Equal(t, maxUsersPerTeam, int(totalMemberCount), "should have 5 team members again, had %v instead", totalMemberCount)

	// Deactivating a user should make them stop counting against max members
	user2, err := ss.User().Get(userIds[1])
	require.Nil(t, err)
	user2.DeleteAt = 1234
	_, err = ss.User().Update(user2, true)
	require.Nil(t, err)

	user, err = ss.User().Save(&model.User{
		Username: model.NewId(),
		Email:    MakeEmail(),
	})
	require.Nil(t, err)
	newUserId2 := user.Id
	_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId2}, maxUsersPerTeam)
	require.Nil(t, err, "should've been able to save new member after deleting one")

	defer ss.Team().RemoveMember(team.Id, newUserId2)
}

func testGetTeamMember(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	_, err := ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)

	var rm1 *model.TeamMember
	rm1, err = ss.Team().GetMember(m1.TeamId, m1.UserId)
	require.Nil(t, err)

	require.Equal(t, rm1.TeamId, m1.TeamId, "bad team id")

	require.Equal(t, rm1.UserId, m1.UserId, "bad user id")

	_, err = ss.Team().GetMember(m1.TeamId, "")
	require.NotNil(t, err, "empty user id - should have failed")

	_, err = ss.Team().GetMember("", m1.UserId)
	require.NotNil(t, err, "empty team id - should have failed")

	// Test with a custom team scheme.
	s2 := &model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}
	s2, err = ss.Scheme().Save(s2)
	require.Nil(t, err)
	t.Log(s2)

	t2, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "z-z-z" + model.NewId() + "b",
		Type:        model.TEAM_OPEN,
		SchemeId:    &s2.Id,
	})
	require.Nil(t, err)

	defer func() {
		ss.Team().PermanentDelete(t2.Id)
	}()

	m2 := &model.TeamMember{TeamId: t2.Id, UserId: model.NewId(), SchemeUser: true}
	_, err = ss.Team().SaveMember(m2, -1)
	require.Nil(t, err)

	m3, err := ss.Team().GetMember(m2.TeamId, m2.UserId)
	require.Nil(t, err)
	t.Log(m3)

	assert.Equal(t, s2.DefaultTeamUserRole, m3.Roles)

	m4 := &model.TeamMember{TeamId: t2.Id, UserId: model.NewId(), SchemeGuest: true}
	_, err = ss.Team().SaveMember(m4, -1)
	require.Nil(t, err)

	m5, err := ss.Team().GetMember(m4.TeamId, m4.UserId)
	require.Nil(t, err)

	assert.Equal(t, s2.DefaultTeamGuestRole, m5.Roles)
}

func testGetTeamMembersByIds(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	_, err := ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)

	var r []*model.TeamMember
	r, err = ss.Team().GetMembersByIds(m1.TeamId, []string{m1.UserId}, nil)
	require.Nil(t, err)
	rm1 := r[0]

	require.Equal(t, rm1.TeamId, m1.TeamId, "bad team id")
	require.Equal(t, rm1.UserId, m1.UserId, "bad user id")

	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	_, err = ss.Team().SaveMember(m2, -1)
	require.Nil(t, err)

	rm, err := ss.Team().GetMembersByIds(m1.TeamId, []string{m1.UserId, m2.UserId, model.NewId()}, nil)
	require.Nil(t, err)

	require.Len(t, rm, 2, "return wrong number of results")

	_, err = ss.Team().GetMembersByIds(m1.TeamId, []string{}, nil)
	require.NotNil(t, err, "empty user ids - should have failed")
}

func testTeamStoreMemberCount(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = MakeEmail()
	_, err := ss.User().Save(u1)
	require.Nil(t, err)

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.DeleteAt = 1
	_, err = ss.User().Save(u2)
	require.Nil(t, err)

	teamId1 := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: u1.Id}
	_, err = ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)

	m2 := &model.TeamMember{TeamId: teamId1, UserId: u2.Id}
	_, err = ss.Team().SaveMember(m2, -1)
	require.Nil(t, err)

	var totalMemberCount int64
	totalMemberCount, err = ss.Team().GetTotalMemberCount(teamId1, nil)
	require.Nil(t, err)
	require.Equal(t, int(totalMemberCount), 2, "wrong count")

	var result int64
	result, err = ss.Team().GetActiveMemberCount(teamId1, nil)
	require.Nil(t, err)
	require.Equal(t, 1, int(result), "wrong count")

	m3 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	_, err = ss.Team().SaveMember(m3, -1)
	require.Nil(t, err)

	totalMemberCount, err = ss.Team().GetTotalMemberCount(teamId1, nil)
	require.Nil(t, err)
	require.Equal(t, 2, int(totalMemberCount), "wrong count")

	result, err = ss.Team().GetActiveMemberCount(teamId1, nil)
	require.Nil(t, err)
	require.Equal(t, 1, int(result), "wrong count")
}

func testGetChannelUnreadsForAllTeams(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m2 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	_, err := ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m2, -1)
	require.Nil(t, err)

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	_, err = ss.Channel().Save(c1, -1)
	require.Nil(t, err)

	c2 := &model.Channel{TeamId: m2.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	_, err = ss.Channel().Save(c2, -1)
	require.Nil(t, err)

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	_, err = ss.Channel().SaveMember(cm1)
	require.Nil(t, err)
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m2.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	_, err = ss.Channel().SaveMember(cm2)
	require.Nil(t, err)

	ms1, err := ss.Team().GetChannelUnreadsForAllTeams("", uid)
	require.Nil(t, err)
	membersMap := make(map[string]bool)
	for i := range ms1 {
		id := ms1[i].TeamId
		if _, ok := membersMap[id]; !ok {
			membersMap[id] = true
		}
	}
	require.Len(t, membersMap, 2, "Should be the unreads for all the teams")

	require.Equal(t, 10, int(ms1[0].MsgCount), "subtraction failed")

	ms2, err := ss.Team().GetChannelUnreadsForAllTeams(teamId1, uid)
	require.Nil(t, err)
	membersMap = make(map[string]bool)
	for i := range ms2 {
		id := ms2[i].TeamId
		if _, ok := membersMap[id]; !ok {
			membersMap[id] = true
		}
	}

	require.Len(t, membersMap, 1, "Should be the unreads for just one team")

	require.Equal(t, 10, int(ms2[0].MsgCount), "subtraction failed")

	err = ss.Team().RemoveAllMembersByUser(uid)
	require.Nil(t, err)
}

func testGetChannelUnreadsForTeam(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	_, err := ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	_, err = ss.Channel().Save(c1, -1)
	require.Nil(t, err)

	c2 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	_, err = ss.Channel().Save(c2, -1)
	require.Nil(t, err)

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	_, err = ss.Channel().SaveMember(cm1)
	require.Nil(t, err)
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	_, err = ss.Channel().SaveMember(cm2)
	require.Nil(t, err)

	ms, err := ss.Team().GetChannelUnreadsForTeam(m1.TeamId, m1.UserId)
	require.Nil(t, err)
	require.Len(t, ms, 2, "wrong length")

	require.Equal(t, 10, int(ms[0].MsgCount), "subtraction failed")
}

func testUpdateLastTeamIconUpdate(t *testing.T, ss store.Store) {

	// team icon initially updated a second ago
	lastTeamIconUpdateInitial := model.GetMillis() - 1000

	o1 := &model.Team{}
	o1.DisplayName = "Display Name"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.LastTeamIconUpdate = lastTeamIconUpdateInitial
	o1, err := ss.Team().Save(o1)
	require.Nil(t, err)

	curTime := model.GetMillis()

	err = ss.Team().UpdateLastTeamIconUpdate(o1.Id, curTime)
	require.Nil(t, err)

	ro1, err := ss.Team().Get(o1.Id)
	require.Nil(t, err)

	require.Greater(t, ro1.LastTeamIconUpdate, lastTeamIconUpdateInitial, "LastTeamIconUpdate not updated")
}

func testGetTeamsByScheme(t *testing.T, ss store.Store) {
	// Create some schemes.
	s1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	s2 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}

	s1, err := ss.Scheme().Save(s1)
	require.Nil(t, err)
	s2, err = ss.Scheme().Save(s2)
	require.Nil(t, err)

	// Create and save some teams.
	t1 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}

	t2 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}

	t3 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
	}

	_, err = ss.Team().Save(t1)
	require.Nil(t, err)

	_, err = ss.Team().Save(t2)
	require.Nil(t, err)

	_, err = ss.Team().Save(t3)
	require.Nil(t, err)

	// Get the teams by a valid Scheme ID.
	d, err := ss.Team().GetTeamsByScheme(s1.Id, 0, 100)
	assert.Nil(t, err)
	assert.Len(t, d, 2)

	// Get the teams by a valid Scheme ID where there aren't any matching Teams.
	d, err = ss.Team().GetTeamsByScheme(s2.Id, 0, 100)
	assert.Nil(t, err)
	assert.Empty(t, d)

	// Get the teams by an invalid Scheme ID.
	d, err = ss.Team().GetTeamsByScheme(model.NewId(), 0, 100)
	assert.Nil(t, err)
	assert.Empty(t, d)
}

func testTeamStoreMigrateTeamMembers(t *testing.T, ss store.Store) {
	s1 := model.NewId()
	t1 := &model.Team{
		DisplayName: "Name",
		Name:        "z-z-z" + model.NewId() + "b",
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		InviteId:    model.NewId(),
		SchemeId:    &s1,
	}
	t1, err := ss.Team().Save(t1)
	require.Nil(t, err)

	tm1 := &model.TeamMember{
		TeamId:        t1.Id,
		UserId:        model.NewId(),
		ExplicitRoles: "team_admin team_user",
	}
	tm2 := &model.TeamMember{
		TeamId:        t1.Id,
		UserId:        model.NewId(),
		ExplicitRoles: "team_user",
	}
	tm3 := &model.TeamMember{
		TeamId:        t1.Id,
		UserId:        model.NewId(),
		ExplicitRoles: "something_else",
	}

	tm1, err = ss.Team().SaveMember(tm1, -1)
	require.Nil(t, err)
	tm2, err = ss.Team().SaveMember(tm2, -1)
	require.Nil(t, err)
	tm3, err = ss.Team().SaveMember(tm3, -1)
	require.Nil(t, err)

	lastDoneTeamId := strings.Repeat("0", 26)
	lastDoneUserId := strings.Repeat("0", 26)

	for {
		res, e := ss.Team().MigrateTeamMembers(lastDoneTeamId, lastDoneUserId)
		if assert.Nil(t, e) {
			if res == nil {
				break
			}
			lastDoneTeamId = res["TeamId"]
			lastDoneUserId = res["UserId"]
		}
	}

	tm1b, err := ss.Team().GetMember(tm1.TeamId, tm1.UserId)
	assert.Nil(t, err)
	assert.Equal(t, "", tm1b.ExplicitRoles)
	assert.True(t, tm1b.SchemeUser)
	assert.True(t, tm1b.SchemeAdmin)

	tm2b, err := ss.Team().GetMember(tm2.TeamId, tm2.UserId)
	assert.Nil(t, err)
	assert.Equal(t, "", tm2b.ExplicitRoles)
	assert.True(t, tm2b.SchemeUser)
	assert.False(t, tm2b.SchemeAdmin)

	tm3b, err := ss.Team().GetMember(tm3.TeamId, tm3.UserId)
	assert.Nil(t, err)
	assert.Equal(t, "something_else", tm3b.ExplicitRoles)
	assert.False(t, tm3b.SchemeUser)
	assert.False(t, tm3b.SchemeAdmin)
}

func testResetAllTeamSchemes(t *testing.T, ss store.Store) {
	s1 := &model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}
	s1, err := ss.Scheme().Save(s1)
	require.Nil(t, err)

	t1 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}

	t2 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}

	t1, err = ss.Team().Save(t1)
	require.Nil(t, err)
	t2, err = ss.Team().Save(t2)
	require.Nil(t, err)

	assert.Equal(t, s1.Id, *t1.SchemeId)
	assert.Equal(t, s1.Id, *t2.SchemeId)

	res := ss.Team().ResetAllTeamSchemes()
	assert.Nil(t, res)

	t1, err = ss.Team().Get(t1.Id)
	require.Nil(t, err)

	t2, err = ss.Team().Get(t2.Id)
	require.Nil(t, err)

	assert.Equal(t, "", *t1.SchemeId)
	assert.Equal(t, "", *t2.SchemeId)
}

func testTeamStoreClearAllCustomRoleAssignments(t *testing.T, ss store.Store) {
	m1 := &model.TeamMember{
		TeamId:        model.NewId(),
		UserId:        model.NewId(),
		ExplicitRoles: "team_user team_admin team_post_all_public",
	}
	m2 := &model.TeamMember{
		TeamId:        model.NewId(),
		UserId:        model.NewId(),
		ExplicitRoles: "team_user custom_role team_admin another_custom_role",
	}
	m3 := &model.TeamMember{
		TeamId:        model.NewId(),
		UserId:        model.NewId(),
		ExplicitRoles: "team_user",
	}
	m4 := &model.TeamMember{
		TeamId:        model.NewId(),
		UserId:        model.NewId(),
		ExplicitRoles: "custom_only",
	}

	_, err := ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m2, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m3, -1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(m4, -1)
	require.Nil(t, err)

	require.Nil(t, (ss.Team().ClearAllCustomRoleAssignments()))

	r1, err := ss.Team().GetMember(m1.TeamId, m1.UserId)
	require.Nil(t, err)
	assert.Equal(t, m1.ExplicitRoles, r1.Roles)

	r2, err := ss.Team().GetMember(m2.TeamId, m2.UserId)
	require.Nil(t, err)
	assert.Equal(t, "team_user team_admin", r2.Roles)

	r3, err := ss.Team().GetMember(m3.TeamId, m3.UserId)
	require.Nil(t, err)
	assert.Equal(t, m3.ExplicitRoles, r3.Roles)

	r4, err := ss.Team().GetMember(m4.TeamId, m4.UserId)
	require.Nil(t, err)
	assert.Equal(t, "", r4.Roles)
}

func testTeamStoreAnalyticsGetTeamCountForScheme(t *testing.T, ss store.Store) {
	s1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}
	s1, err := ss.Scheme().Save(s1)
	require.Nil(t, err)

	count1, err := ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)
	assert.Nil(t, err)
	assert.Equal(t, int64(0), count1)

	t1 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}
	_, err = ss.Team().Save(t1)
	require.Nil(t, err)

	count2, err := ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)
	assert.Nil(t, err)
	assert.Equal(t, int64(1), count2)

	t2 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}
	_, err = ss.Team().Save(t2)
	require.Nil(t, err)

	count3, err := ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)
	assert.Nil(t, err)
	assert.Equal(t, int64(2), count3)

	t3 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
	}
	_, err = ss.Team().Save(t3)
	require.Nil(t, err)

	count4, err := ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)
	assert.Nil(t, err)
	assert.Equal(t, int64(2), count4)

	t4 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
		DeleteAt:    model.GetMillis(),
	}
	_, err = ss.Team().Save(t4)
	require.Nil(t, err)

	count5, err := ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)
	assert.Nil(t, err)
	assert.Equal(t, int64(2), count5)
}

func testTeamStoreGetAllForExportAfter(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = "zz" + model.NewId()
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	_, err := ss.Team().Save(&t1)
	require.Nil(t, err)

	d1, err := ss.Team().GetAllForExportAfter(10000, strings.Repeat("0", 26))
	assert.Nil(t, err)

	found := false
	for _, team := range d1 {
		if team.Id == t1.Id {
			found = true
			assert.Equal(t, t1.Id, team.Id)
			assert.Nil(t, team.SchemeId)
			assert.Equal(t, t1.Name, team.Name)
		}
	}
	assert.True(t, found)
}

func testTeamStoreGetTeamMembersForExport(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = "zz" + model.NewId()
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	_, err := ss.Team().Save(&t1)
	require.Nil(t, err)

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err = ss.User().Save(&u1)
	require.Nil(t, err)

	u2 := model.User{}
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	_, err = ss.User().Save(&u2)
	require.Nil(t, err)

	m1 := &model.TeamMember{TeamId: t1.Id, UserId: u1.Id}
	_, err = ss.Team().SaveMember(m1, -1)
	require.Nil(t, err)

	m2 := &model.TeamMember{TeamId: t1.Id, UserId: u2.Id}
	_, err = ss.Team().SaveMember(m2, -1)
	require.Nil(t, err)

	d1, err := ss.Team().GetTeamMembersForExport(u1.Id)
	assert.Nil(t, err)

	assert.Len(t, d1, 1)

	tmfe1 := d1[0]
	assert.Equal(t, t1.Id, tmfe1.TeamId)
	assert.Equal(t, u1.Id, tmfe1.UserId)
	assert.Equal(t, t1.Name, tmfe1.TeamName)
}

func testGroupSyncedTeamCount(t *testing.T, ss store.Store) {
	team1, err := ss.Team().Save(&model.Team{
		DisplayName:      model.NewId(),
		Name:             model.NewId(),
		Email:            MakeEmail(),
		Type:             model.TEAM_INVITE,
		GroupConstrained: model.NewBool(true),
	})
	require.Nil(t, err)
	require.True(t, team1.IsGroupConstrained())
	defer ss.Team().PermanentDelete(team1.Id)

	team2, err := ss.Team().Save(&model.Team{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_INVITE,
	})
	require.Nil(t, err)
	require.False(t, team2.IsGroupConstrained())
	defer ss.Team().PermanentDelete(team2.Id)

	count, err := ss.Team().GroupSyncedTeamCount()
	require.Nil(t, err)
	require.GreaterOrEqual(t, count, int64(1))

	team2.GroupConstrained = model.NewBool(true)
	team2, err = ss.Team().Update(team2)
	require.Nil(t, err)
	require.True(t, team2.IsGroupConstrained())

	countAfter, err := ss.Team().GroupSyncedTeamCount()
	require.Nil(t, err)
	require.GreaterOrEqual(t, countAfter, count+1)
}
