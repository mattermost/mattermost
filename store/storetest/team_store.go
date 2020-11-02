// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"errors"
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
	t.Run("GetByNames", func(t *testing.T) { testTeamStoreGetByNames(t, ss) })
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
	t.Run("TestGetMembers", func(t *testing.T) { testGetMembers(t, ss) })
	t.Run("SaveMember", func(t *testing.T) { testTeamSaveMember(t, ss) })
	t.Run("SaveMultipleMembers", func(t *testing.T) { testTeamSaveMultipleMembers(t, ss) })
	t.Run("UpdateMember", func(t *testing.T) { testTeamUpdateMember(t, ss) })
	t.Run("UpdateMultipleMembers", func(t *testing.T) { testTeamUpdateMultipleMembers(t, ss) })
	t.Run("RemoveMember", func(t *testing.T) { testTeamRemoveMember(t, ss) })
	t.Run("RemoveMembers", func(t *testing.T) { testTeamRemoveMembers(t, ss) })
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

func testTeamStoreGetByNames(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN

	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	o2 := model.Team{}
	o2.DisplayName = "DisplayName2"
	o2.Name = "z-z-z" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN

	_, err = ss.Team().Save(&o2)
	require.Nil(t, err)

	t.Run("Get empty list", func(t *testing.T) {
		var teams []*model.Team
		teams, err = ss.Team().GetByNames([]string{})
		require.Nil(t, err)
		require.Empty(t, teams)
	})

	t.Run("Get existing teams", func(t *testing.T) {
		var teams []*model.Team
		teams, err = ss.Team().GetByNames([]string{o1.Name, o2.Name})
		require.Nil(t, err)
		teamsIds := []string{}
		for _, team := range teams {
			teamsIds = append(teamsIds, team.Id)
		}
		assert.Contains(t, teamsIds, o1.Id, "invalid returned team")
		assert.Contains(t, teamsIds, o2.Id, "invalid returned team")
	})

	t.Run("Get existing team and one invalid team name", func(t *testing.T) {
		_, err = ss.Team().GetByNames([]string{o1.Name, ""})
		require.NotNil(t, err)
	})

	t.Run("Get existing team and not existing team", func(t *testing.T) {
		_, err = ss.Team().GetByNames([]string{o1.Name, "not-existing-team-name"})
		require.NotNil(t, err)
	})
	t.Run("Get not existing teams", func(t *testing.T) {
		_, err = ss.Team().GetByNames([]string{"not-existing-team-name", "not-existing-team-name-2"})
		require.NotNil(t, err)
	})
}

func testTeamStoreGetByName(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN

	_, err := ss.Team().Save(&o1)
	require.Nil(t, err)

	t.Run("Get existing team", func(t *testing.T) {
		var team *model.Team
		team, err = ss.Team().GetByName(o1.Name)
		require.Nil(t, err)
		require.Equal(t, *team, o1, "invalid returned team")
	})

	t.Run("Get invalid team name", func(t *testing.T) {
		_, err = ss.Team().GetByName("")
		require.NotNil(t, err, "Missing id should have failed")
	})

	t.Run("Get not existing team", func(t *testing.T) {
		_, err = ss.Team().GetByName("not-existing-team-name")
		require.NotNil(t, err, "Missing id should have failed")
	})
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
	p.DisplayName = "BDisplayName" + model.NewId()
	p.Name = "zzzzzz-" + model.NewId() + "a"
	p.Email = MakeEmail()
	p.Type = model.TEAM_OPEN
	p.AllowOpenInvite = false

	_, err = ss.Team().Save(&p)
	require.Nil(t, err)

	g := model.Team{}
	g.DisplayName = "CDisplayName" + model.NewId()
	g.Name = "zzzzzz-" + model.NewId() + "a"
	g.Email = MakeEmail()
	g.Type = model.TEAM_OPEN
	g.AllowOpenInvite = false
	g.GroupConstrained = model.NewBool(true)

	_, err = ss.Team().Save(&g)
	require.Nil(t, err)

	q := model.Team{}
	q.DisplayName = "CHOCOLATE"
	q.Name = "ilovecake"
	q.Email = MakeEmail()
	q.Type = model.TEAM_OPEN
	q.AllowOpenInvite = false

	_, err = ss.Team().Save(&q)
	require.Nil(t, err)

	testCases := []struct {
		Name            string
		Opts            *model.TeamSearch
		ExpectedLenth   int
		ExpectedTeamIds []string
	}{
		{
			"Search chocolate by display name",
			&model.TeamSearch{Term: "ocola"},
			1,
			[]string{q.Id},
		},
		{
			"Search chocolate by display name",
			&model.TeamSearch{Term: "choc"},
			1,
			[]string{q.Id},
		},
		{
			"Search chocolate by display name",
			&model.TeamSearch{Term: "late"},
			1,
			[]string{q.Id},
		},
		{
			"Search chocolate by  name",
			&model.TeamSearch{Term: "ilov"},
			1,
			[]string{q.Id},
		},
		{
			"Search chocolate by  name",
			&model.TeamSearch{Term: "ecake"},
			1,
			[]string{q.Id},
		},
		{
			"Search for open team name",
			&model.TeamSearch{Term: o.Name},
			1,
			[]string{o.Id},
		},
		{
			"Search for open team displayName",
			&model.TeamSearch{Term: o.DisplayName},
			1,
			[]string{o.Id},
		},
		{
			"Search for open team without results",
			&model.TeamSearch{Term: "notexists"},
			0,
			[]string{},
		},
		{
			"Search for private team",
			&model.TeamSearch{Term: p.DisplayName},
			1,
			[]string{p.Id},
		},
		{
			"Search for all 3 z teams",
			&model.TeamSearch{Term: "zzzzzz"},
			3,
			[]string{o.Id, p.Id, g.Id},
		},
		{
			"Search for all 3 teams filter by allow open invite",
			&model.TeamSearch{Term: "zzzzzz", AllowOpenInvite: model.NewBool(true)},
			1,
			[]string{o.Id},
		},
		{
			"Search for all 3 teams filter by allow open invite = false",
			&model.TeamSearch{Term: "zzzzzz", AllowOpenInvite: model.NewBool(false)},
			1,
			[]string{p.Id},
		},
		{
			"Search for all 3 teams filter by group constrained",
			&model.TeamSearch{Term: "zzzzzz", GroupConstrained: model.NewBool(true)},
			1,
			[]string{g.Id},
		},
		{
			"Search for all 3 teams filter by group constrained = false",
			&model.TeamSearch{Term: "zzzzzz", GroupConstrained: model.NewBool(false)},
			2,
			[]string{o.Id, p.Id},
		},
		{
			"Search for all 3 teams filter by allow open invite and include group constrained",
			&model.TeamSearch{Term: "zzzzzz", AllowOpenInvite: model.NewBool(true), GroupConstrained: model.NewBool(true)},
			2,
			[]string{o.Id, g.Id},
		},
		{
			"Search for all 3 teams filter by group constrained and not open invite",
			&model.TeamSearch{Term: "zzzzzz", GroupConstrained: model.NewBool(true), AllowOpenInvite: model.NewBool(false)},
			2,
			[]string{g.Id, p.Id},
		},
		{
			"Search for all 3 teams filter by group constrained false and open invite",
			&model.TeamSearch{Term: "zzzzzz", GroupConstrained: model.NewBool(false), AllowOpenInvite: model.NewBool(true)},
			2,
			[]string{o.Id, p.Id},
		},
		{
			"Search for all 3 teams filter by group constrained false and open invite false",
			&model.TeamSearch{Term: "zzzzzz", GroupConstrained: model.NewBool(false), AllowOpenInvite: model.NewBool(false)},
			2,
			[]string{p.Id, o.Id},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			response, err := ss.Team().SearchAll(tc.Opts.Term, tc.Opts)
			require.Nil(t, err)
			require.Equal(t, tc.ExpectedLenth, len(response))
			responseTeamIds := []string{}
			for _, team := range response {
				responseTeamIds = append(responseTeamIds, team.Id)
			}
			require.ElementsMatch(t, tc.ExpectedTeamIds, responseTeamIds)
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

	q := model.Team{}
	q.DisplayName = "PINEAPPLEPIE"
	q.Name = "ihadsomepineapplepiewithstrawberry"
	q.Email = MakeEmail()
	q.Type = model.TEAM_OPEN
	q.AllowOpenInvite = true

	_, err = ss.Team().Save(&q)
	require.Nil(t, err)

	testCases := []struct {
		Name            string
		Term            string
		ExpectedLength  int
		ExpectedFirstId string
	}{
		{
			"Search PINEAPPLEPIE by display name",
			"neapplep",
			1,
			q.Id,
		},
		{
			"Search PINEAPPLEPIE by display name",
			"pine",
			1,
			q.Id,
		},
		{
			"Search PINEAPPLEPIE by display name",
			"epie",
			1,
			q.Id,
		},
		{
			"Search PINEAPPLEPIE by  name",
			"ihadsome",
			1,
			q.Id,
		},
		{
			"Search PINEAPPLEPIE by  name",
			"pineapplepiewithstrawberry",
			1,
			q.Id,
		},
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
			"notexists",
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

	q := model.Team{}
	q.DisplayName = "FOOBARDISPLAYNAME"
	q.Name = "averylongname"
	q.Email = MakeEmail()
	q.Type = model.TEAM_OPEN
	q.AllowOpenInvite = false

	_, err = ss.Team().Save(&q)
	require.Nil(t, err)

	testCases := []struct {
		Name            string
		Term            string
		ExpectedLength  int
		ExpectedFirstId string
	}{
		{
			"Search FooBar by display name from text in the middle of display name",
			"oobardisplay",
			1,
			q.Id,
		},
		{
			"Search FooBar by display name from text at the beginning of display name",
			"foobar",
			1,
			q.Id,
		},
		{
			"Search FooBar by display name from text at the end of display name",
			"bardisplayname",
			1,
			q.Id,
		},
		{
			"Search FooBar by  name from text at the beginning name",
			"averyl",
			1,
			q.Id,
		},
		{
			"Search FooBar by  name from text at the end of name",
			"ongname",
			1,
			q.Id,
		},
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
			"notexists",
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
	_, nErr := ss.Team().SaveMember(m1, -1)
	require.Nil(t, nErr)

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

func testGetMembers(t *testing.T, ss store.Store) {
	// Each user should have a mention count of exactly 1 in the DB at this point.
	t.Run("Test GetMembers Order By UserID", func(t *testing.T) {
		teamId1 := model.NewId()
		teamId2 := model.NewId()

		m1 := &model.TeamMember{TeamId: teamId1, UserId: "55555555555555555555555555"}
		m2 := &model.TeamMember{TeamId: teamId1, UserId: "11111111111111111111111111"}
		m3 := &model.TeamMember{TeamId: teamId1, UserId: "33333333333333333333333333"}
		m4 := &model.TeamMember{TeamId: teamId1, UserId: "22222222222222222222222222"}
		m5 := &model.TeamMember{TeamId: teamId1, UserId: "44444444444444444444444444"}
		m6 := &model.TeamMember{TeamId: teamId2, UserId: "00000000000000000000000000"}

		_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2, m3, m4, m5, m6}, -1)
		require.Nil(t, nErr)

		// Gets users ordered by UserId
		ms, err := ss.Team().GetMembers(teamId1, 0, 100, nil)
		require.Nil(t, err)
		assert.Len(t, ms, 5)
		assert.Equal(t, "11111111111111111111111111", ms[0].UserId)
		assert.Equal(t, "22222222222222222222222222", ms[1].UserId)
		assert.Equal(t, "33333333333333333333333333", ms[2].UserId)
		assert.Equal(t, "44444444444444444444444444", ms[3].UserId)
		assert.Equal(t, "55555555555555555555555555", ms[4].UserId)
	})

	t.Run("Test GetMembers Order By Username And Exclude Deleted Members", func(t *testing.T) {
		teamId1 := model.NewId()
		teamId2 := model.NewId()

		u1 := &model.User{Username: "a", Email: MakeEmail(), DeleteAt: int64(1)}
		u2 := &model.User{Username: "c", Email: MakeEmail()}
		u3 := &model.User{Username: "b", Email: MakeEmail(), DeleteAt: int64(1)}
		u4 := &model.User{Username: "f", Email: MakeEmail()}
		u5 := &model.User{Username: "e", Email: MakeEmail(), DeleteAt: int64(1)}
		u6 := &model.User{Username: "d", Email: MakeEmail()}

		u1, err := ss.User().Save(u1)
		require.Nil(t, err)
		u2, err = ss.User().Save(u2)
		require.Nil(t, err)
		u3, err = ss.User().Save(u3)
		require.Nil(t, err)
		u4, err = ss.User().Save(u4)
		require.Nil(t, err)
		u5, err = ss.User().Save(u5)
		require.Nil(t, err)
		u6, err = ss.User().Save(u6)
		require.Nil(t, err)

		m1 := &model.TeamMember{TeamId: teamId1, UserId: u1.Id}
		m2 := &model.TeamMember{TeamId: teamId1, UserId: u2.Id}
		m3 := &model.TeamMember{TeamId: teamId1, UserId: u3.Id}
		m4 := &model.TeamMember{TeamId: teamId1, UserId: u4.Id}
		m5 := &model.TeamMember{TeamId: teamId1, UserId: u5.Id}
		m6 := &model.TeamMember{TeamId: teamId2, UserId: u6.Id}

		_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2, m3, m4, m5, m6}, -1)
		require.Nil(t, nErr)

		// Gets users ordered by UserName
		ms, nErr := ss.Team().GetMembers(teamId1, 0, 100, &model.TeamMembersGetOptions{Sort: model.USERNAME})
		require.Nil(t, nErr)
		assert.Len(t, ms, 5)
		assert.Equal(t, u1.Id, ms[0].UserId)
		assert.Equal(t, u3.Id, ms[1].UserId)
		assert.Equal(t, u2.Id, ms[2].UserId)
		assert.Equal(t, u5.Id, ms[3].UserId)
		assert.Equal(t, u4.Id, ms[4].UserId)

		// Gets users ordered by UserName and excludes deleted members
		ms, nErr = ss.Team().GetMembers(teamId1, 0, 100, &model.TeamMembersGetOptions{Sort: model.USERNAME, ExcludeDeletedUsers: true})
		require.Nil(t, nErr)
		assert.Len(t, ms, 2)
		assert.Equal(t, u2.Id, ms[0].UserId)
		assert.Equal(t, u4.Id, ms[1].UserId)
	})

	t.Run("Test GetMembers Excluded Deleted Users", func(t *testing.T) {
		teamId1 := model.NewId()
		teamId2 := model.NewId()

		u1 := &model.User{Email: MakeEmail()}
		u2 := &model.User{Email: MakeEmail(), DeleteAt: int64(1)}
		u3 := &model.User{Email: MakeEmail()}
		u4 := &model.User{Email: MakeEmail(), DeleteAt: int64(3)}
		u5 := &model.User{Email: MakeEmail()}
		u6 := &model.User{Email: MakeEmail(), DeleteAt: int64(5)}

		u1, err := ss.User().Save(u1)
		require.Nil(t, err)
		u2, err = ss.User().Save(u2)
		require.Nil(t, err)
		u3, err = ss.User().Save(u3)
		require.Nil(t, err)
		u4, err = ss.User().Save(u4)
		require.Nil(t, err)
		u5, err = ss.User().Save(u5)
		require.Nil(t, err)
		u6, err = ss.User().Save(u6)
		require.Nil(t, err)

		m1 := &model.TeamMember{TeamId: teamId1, UserId: u1.Id}
		m2 := &model.TeamMember{TeamId: teamId1, UserId: u2.Id}
		m3 := &model.TeamMember{TeamId: teamId1, UserId: u3.Id}
		m4 := &model.TeamMember{TeamId: teamId1, UserId: u4.Id}
		m5 := &model.TeamMember{TeamId: teamId1, UserId: u5.Id}
		m6 := &model.TeamMember{TeamId: teamId2, UserId: u6.Id}

		t1, nErr := ss.Team().SaveMember(m1, -1)
		require.Nil(t, nErr)
		_, nErr = ss.Team().SaveMember(m2, -1)
		require.Nil(t, nErr)
		t3, nErr := ss.Team().SaveMember(m3, -1)
		require.Nil(t, nErr)
		_, nErr = ss.Team().SaveMember(m4, -1)
		require.Nil(t, nErr)
		t5, nErr := ss.Team().SaveMember(m5, -1)
		require.Nil(t, nErr)
		_, nErr = ss.Team().SaveMember(m6, -1)
		require.Nil(t, nErr)

		// Gets users ordered by UserName
		ms, nErr := ss.Team().GetMembers(teamId1, 0, 100, &model.TeamMembersGetOptions{ExcludeDeletedUsers: true})
		require.Nil(t, nErr)
		assert.Len(t, ms, 3)
		require.ElementsMatch(t, ms, [3]*model.TeamMember{t1, t3, t5})
	})
}

func testTeamMembers(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m3 := &model.TeamMember{TeamId: teamId2, UserId: model.NewId()}

	_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2, m3}, -1)
	require.Nil(t, nErr)

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

	_, nErr = ss.Team().SaveMember(m1, -1)
	require.Nil(t, nErr)

	err = ss.Team().RemoveAllMembersByTeam(teamId1)
	require.Nil(t, err)

	ms, err = ss.Team().GetMembers(teamId1, 0, 100, nil)
	require.Nil(t, err)
	require.Empty(t, ms)

	uid := model.NewId()
	m4 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m5 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	_, nErr = ss.Team().SaveMultipleMembers([]*model.TeamMember{m4, m5}, -1)
	require.Nil(t, nErr)

	ms, err = ss.Team().GetTeamsForUser(uid)
	require.Nil(t, err)
	require.Len(t, ms, 2)

	nErr = ss.Team().RemoveAllMembersByUser(uid)
	require.Nil(t, nErr)

	ms, err = ss.Team().GetTeamsForUser(m1.UserId)
	require.Nil(t, err)
	require.Empty(t, ms)
}

func testTeamSaveMember(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u2, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)

	t.Run("not valid team member", func(t *testing.T) {
		member := &model.TeamMember{TeamId: "wrong", UserId: u1.Id}
		_, nErr := ss.Team().SaveMember(member, -1)
		require.NotNil(t, nErr)
		require.Equal(t, "TeamMember.IsValid: model.team_member.is_valid.team_id.app_error, ", nErr.Error())
	})

	t.Run("too many members", func(t *testing.T) {
		member := &model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}
		_, nErr := ss.Team().SaveMember(member, 0)
		require.NotNil(t, nErr)
		require.Equal(t, "limit exceeded: what: TeamMember count: 1 metadata: team members limit exceeded", nErr.Error())
	})

	t.Run("too many members because previous existing members", func(t *testing.T) {
		teamID := model.NewId()

		m1 := &model.TeamMember{TeamId: teamID, UserId: u1.Id}
		_, nErr := ss.Team().SaveMember(m1, 1)
		m2 := &model.TeamMember{TeamId: teamID, UserId: u2.Id}
		_, nErr = ss.Team().SaveMember(m2, 1)
		require.NotNil(t, nErr)
		require.Equal(t, "limit exceeded: what: TeamMember count: 2 metadata: team members limit exceeded", nErr.Error())
	})

	t.Run("duplicated entries should fail", func(t *testing.T) {
		teamID1 := model.NewId()
		m1 := &model.TeamMember{TeamId: teamID1, UserId: u1.Id}
		_, nErr := ss.Team().SaveMember(m1, -1)
		require.Nil(t, nErr)
		m2 := &model.TeamMember{TeamId: teamID1, UserId: u1.Id}
		_, nErr = ss.Team().SaveMember(m2, -1)
		require.NotNil(t, nErr)
		require.IsType(t, &store.ErrConflict{}, nErr)
	})

	t.Run("insert member correctly (in team without scheme)", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Name",
			Name:        "zz" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TEAM_OPEN,
		}

		team, nErr := ss.Team().Save(team)
		require.Nil(t, nErr)

		testCases := []struct {
			Name                  string
			SchemeGuest           bool
			SchemeUser            bool
			SchemeAdmin           bool
			ExplicitRoles         string
			ExpectedRoles         string
			ExpectedExplicitRoles string
			ExpectedSchemeGuest   bool
			ExpectedSchemeUser    bool
			ExpectedSchemeAdmin   bool
		}{
			{
				Name:               "team user implicit",
				SchemeUser:         true,
				ExpectedRoles:      "team_user",
				ExpectedSchemeUser: true,
			},
			{
				Name:               "team user explicit",
				ExplicitRoles:      "team_user",
				ExpectedRoles:      "team_user",
				ExpectedSchemeUser: true,
			},
			{
				Name:                "team guest implicit",
				SchemeGuest:         true,
				ExpectedRoles:       "team_guest",
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team guest explicit",
				ExplicitRoles:       "team_guest",
				ExpectedRoles:       "team_guest",
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team admin implicit",
				SchemeUser:          true,
				SchemeAdmin:         true,
				ExpectedRoles:       "team_user team_admin",
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                "team admin explicit",
				ExplicitRoles:       "team_user team_admin",
				ExpectedRoles:       "team_user team_admin",
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                  "team user implicit and explicit custom role",
				SchemeUser:            true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_user",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team user explicit and explicit custom role",
				ExplicitRoles:         "team_user test",
				ExpectedRoles:         "test team_user",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team guest implicit and explicit custom role",
				SchemeGuest:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_guest",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team guest explicit and explicit custom role",
				ExplicitRoles:         "team_guest test",
				ExpectedRoles:         "test team_guest",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team admin implicit and explicit custom role",
				SchemeUser:            true,
				SchemeAdmin:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_user team_admin",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team admin explicit and explicit custom role",
				ExplicitRoles:         "team_user team_admin test",
				ExpectedRoles:         "test team_user team_admin",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team member with only explicit custom roles",
				ExplicitRoles:         "test test2",
				ExpectedRoles:         "test test2",
				ExpectedExplicitRoles: "test test2",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				member := &model.TeamMember{
					TeamId:        team.Id,
					UserId:        u1.Id,
					SchemeGuest:   tc.SchemeGuest,
					SchemeUser:    tc.SchemeUser,
					SchemeAdmin:   tc.SchemeAdmin,
					ExplicitRoles: tc.ExplicitRoles,
				}
				member, nErr := ss.Team().SaveMember(member, -1)
				require.Nil(t, nErr)
				defer ss.Team().RemoveMember(team.Id, u1.Id)

				assert.Equal(t, tc.ExpectedRoles, member.Roles)
				assert.Equal(t, tc.ExpectedExplicitRoles, member.ExplicitRoles)
				assert.Equal(t, tc.ExpectedSchemeGuest, member.SchemeGuest)
				assert.Equal(t, tc.ExpectedSchemeUser, member.SchemeUser)
				assert.Equal(t, tc.ExpectedSchemeAdmin, member.SchemeAdmin)
			})
		}
	})

	t.Run("insert member correctly (in team with scheme)", func(t *testing.T) {
		ts := &model.Scheme{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Scope:       model.SCHEME_SCOPE_TEAM,
		}
		ts, nErr := ss.Scheme().Save(ts)
		require.Nil(t, nErr)

		team := &model.Team{
			DisplayName: "Name",
			Name:        "zz" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TEAM_OPEN,
			SchemeId:    &ts.Id,
		}

		team, nErr = ss.Team().Save(team)
		require.Nil(t, nErr)

		testCases := []struct {
			Name                  string
			SchemeGuest           bool
			SchemeUser            bool
			SchemeAdmin           bool
			ExplicitRoles         string
			ExpectedRoles         string
			ExpectedExplicitRoles string
			ExpectedSchemeGuest   bool
			ExpectedSchemeUser    bool
			ExpectedSchemeAdmin   bool
		}{
			{
				Name:               "team user implicit",
				SchemeUser:         true,
				ExpectedRoles:      ts.DefaultTeamUserRole,
				ExpectedSchemeUser: true,
			},
			{
				Name:               "team user explicit",
				ExplicitRoles:      "team_user",
				ExpectedRoles:      ts.DefaultTeamUserRole,
				ExpectedSchemeUser: true,
			},
			{
				Name:                "team guest implicit",
				SchemeGuest:         true,
				ExpectedRoles:       ts.DefaultTeamGuestRole,
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team guest explicit",
				ExplicitRoles:       "team_guest",
				ExpectedRoles:       ts.DefaultTeamGuestRole,
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team admin implicit",
				SchemeUser:          true,
				SchemeAdmin:         true,
				ExpectedRoles:       ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                "team admin explicit",
				ExplicitRoles:       "team_user team_admin",
				ExpectedRoles:       ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                  "team user implicit and explicit custom role",
				SchemeUser:            true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team user explicit and explicit custom role",
				ExplicitRoles:         "team_user test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team guest implicit and explicit custom role",
				SchemeGuest:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamGuestRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team guest explicit and explicit custom role",
				ExplicitRoles:         "team_guest test",
				ExpectedRoles:         "test " + ts.DefaultTeamGuestRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team admin implicit and explicit custom role",
				SchemeUser:            true,
				SchemeAdmin:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team admin explicit and explicit custom role",
				ExplicitRoles:         "team_user team_admin test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team member with only explicit custom roles",
				ExplicitRoles:         "test test2",
				ExpectedRoles:         "test test2",
				ExpectedExplicitRoles: "test test2",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				member := &model.TeamMember{
					TeamId:        team.Id,
					UserId:        u1.Id,
					SchemeGuest:   tc.SchemeGuest,
					SchemeUser:    tc.SchemeUser,
					SchemeAdmin:   tc.SchemeAdmin,
					ExplicitRoles: tc.ExplicitRoles,
				}
				member, nErr := ss.Team().SaveMember(member, -1)
				require.Nil(t, nErr)
				defer ss.Team().RemoveMember(team.Id, u1.Id)

				assert.Equal(t, tc.ExpectedRoles, member.Roles)
				assert.Equal(t, tc.ExpectedExplicitRoles, member.ExplicitRoles)
				assert.Equal(t, tc.ExpectedSchemeGuest, member.SchemeGuest)
				assert.Equal(t, tc.ExpectedSchemeUser, member.SchemeUser)
				assert.Equal(t, tc.ExpectedSchemeAdmin, member.SchemeAdmin)
			})
		}
	})
}

func testTeamSaveMultipleMembers(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u2, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u3, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u4, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)

	t.Run("any not valid team member", func(t *testing.T) {
		m1 := &model.TeamMember{TeamId: "wrong", UserId: u1.Id}
		m2 := &model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}
		_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2}, -1)
		require.NotNil(t, nErr)
		require.Equal(t, "TeamMember.IsValid: model.team_member.is_valid.team_id.app_error, ", nErr.Error())
	})

	t.Run("too many members in one team", func(t *testing.T) {
		teamID := model.NewId()
		m1 := &model.TeamMember{TeamId: teamID, UserId: u1.Id}
		m2 := &model.TeamMember{TeamId: teamID, UserId: u2.Id}
		_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2}, 0)
		require.NotNil(t, nErr)
		require.Equal(t, "limit exceeded: what: TeamMember count: 2 metadata: team members limit exceeded", nErr.Error())
	})

	t.Run("too many members in one team because previous existing members", func(t *testing.T) {
		teamID := model.NewId()
		m1 := &model.TeamMember{TeamId: teamID, UserId: u1.Id}
		m2 := &model.TeamMember{TeamId: teamID, UserId: u2.Id}
		m3 := &model.TeamMember{TeamId: teamID, UserId: u3.Id}
		m4 := &model.TeamMember{TeamId: teamID, UserId: u4.Id}
		_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2}, 3)
		require.Nil(t, nErr)

		_, nErr = ss.Team().SaveMultipleMembers([]*model.TeamMember{m3, m4}, 3)
		require.NotNil(t, nErr)
		require.Equal(t, "limit exceeded: what: TeamMember count: 4 metadata: team members limit exceeded", nErr.Error())
	})

	t.Run("too many members, but in different teams", func(t *testing.T) {
		teamID1 := model.NewId()
		teamID2 := model.NewId()
		m1 := &model.TeamMember{TeamId: teamID1, UserId: u1.Id}
		m2 := &model.TeamMember{TeamId: teamID1, UserId: u2.Id}
		m3 := &model.TeamMember{TeamId: teamID1, UserId: u3.Id}
		m4 := &model.TeamMember{TeamId: teamID2, UserId: u1.Id}
		m5 := &model.TeamMember{TeamId: teamID2, UserId: u2.Id}
		_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2, m3, m4, m5}, 2)
		require.NotNil(t, nErr)
		require.Equal(t, "limit exceeded: what: TeamMember count: 3 metadata: team members limit exceeded", nErr.Error())
	})

	t.Run("duplicated entries should fail", func(t *testing.T) {
		teamID1 := model.NewId()
		m1 := &model.TeamMember{TeamId: teamID1, UserId: u1.Id}
		m2 := &model.TeamMember{TeamId: teamID1, UserId: u1.Id}
		_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2}, 10)
		require.NotNil(t, nErr)
		require.IsType(t, &store.ErrConflict{}, nErr)
	})

	t.Run("insert members correctly (in team without scheme)", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Name",
			Name:        "zz" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TEAM_OPEN,
		}

		team, nErr := ss.Team().Save(team)
		require.Nil(t, nErr)

		testCases := []struct {
			Name                  string
			SchemeGuest           bool
			SchemeUser            bool
			SchemeAdmin           bool
			ExplicitRoles         string
			ExpectedRoles         string
			ExpectedExplicitRoles string
			ExpectedSchemeGuest   bool
			ExpectedSchemeUser    bool
			ExpectedSchemeAdmin   bool
		}{
			{
				Name:               "team user implicit",
				SchemeUser:         true,
				ExpectedRoles:      "team_user",
				ExpectedSchemeUser: true,
			},
			{
				Name:               "team user explicit",
				ExplicitRoles:      "team_user",
				ExpectedRoles:      "team_user",
				ExpectedSchemeUser: true,
			},
			{
				Name:                "team guest implicit",
				SchemeGuest:         true,
				ExpectedRoles:       "team_guest",
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team guest explicit",
				ExplicitRoles:       "team_guest",
				ExpectedRoles:       "team_guest",
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team admin implicit",
				SchemeUser:          true,
				SchemeAdmin:         true,
				ExpectedRoles:       "team_user team_admin",
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                "team admin explicit",
				ExplicitRoles:       "team_user team_admin",
				ExpectedRoles:       "team_user team_admin",
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                  "team user implicit and explicit custom role",
				SchemeUser:            true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_user",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team user explicit and explicit custom role",
				ExplicitRoles:         "team_user test",
				ExpectedRoles:         "test team_user",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team guest implicit and explicit custom role",
				SchemeGuest:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_guest",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team guest explicit and explicit custom role",
				ExplicitRoles:         "team_guest test",
				ExpectedRoles:         "test team_guest",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team admin implicit and explicit custom role",
				SchemeUser:            true,
				SchemeAdmin:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_user team_admin",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team admin explicit and explicit custom role",
				ExplicitRoles:         "team_user team_admin test",
				ExpectedRoles:         "test team_user team_admin",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team member with only explicit custom roles",
				ExplicitRoles:         "test test2",
				ExpectedRoles:         "test test2",
				ExpectedExplicitRoles: "test test2",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				member := &model.TeamMember{
					TeamId:        team.Id,
					UserId:        u1.Id,
					SchemeGuest:   tc.SchemeGuest,
					SchemeUser:    tc.SchemeUser,
					SchemeAdmin:   tc.SchemeAdmin,
					ExplicitRoles: tc.ExplicitRoles,
				}
				otherMember := &model.TeamMember{
					TeamId:        team.Id,
					UserId:        u2.Id,
					SchemeGuest:   tc.SchemeGuest,
					SchemeUser:    tc.SchemeUser,
					SchemeAdmin:   tc.SchemeAdmin,
					ExplicitRoles: tc.ExplicitRoles,
				}
				var members []*model.TeamMember
				members, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{member, otherMember}, -1)
				require.Nil(t, nErr)
				require.Len(t, members, 2)
				member = members[0]
				defer ss.Team().RemoveMember(team.Id, u1.Id)
				defer ss.Team().RemoveMember(team.Id, u2.Id)

				assert.Equal(t, tc.ExpectedRoles, member.Roles)
				assert.Equal(t, tc.ExpectedExplicitRoles, member.ExplicitRoles)
				assert.Equal(t, tc.ExpectedSchemeGuest, member.SchemeGuest)
				assert.Equal(t, tc.ExpectedSchemeUser, member.SchemeUser)
				assert.Equal(t, tc.ExpectedSchemeAdmin, member.SchemeAdmin)
			})
		}
	})

	t.Run("insert members correctly (in team with scheme)", func(t *testing.T) {
		ts := &model.Scheme{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Scope:       model.SCHEME_SCOPE_TEAM,
		}
		ts, nErr := ss.Scheme().Save(ts)
		require.Nil(t, nErr)

		team := &model.Team{
			DisplayName: "Name",
			Name:        "zz" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TEAM_OPEN,
			SchemeId:    &ts.Id,
		}

		team, nErr = ss.Team().Save(team)
		require.Nil(t, nErr)

		testCases := []struct {
			Name                  string
			SchemeGuest           bool
			SchemeUser            bool
			SchemeAdmin           bool
			ExplicitRoles         string
			ExpectedRoles         string
			ExpectedExplicitRoles string
			ExpectedSchemeGuest   bool
			ExpectedSchemeUser    bool
			ExpectedSchemeAdmin   bool
		}{
			{
				Name:               "team user implicit",
				SchemeUser:         true,
				ExpectedRoles:      ts.DefaultTeamUserRole,
				ExpectedSchemeUser: true,
			},
			{
				Name:               "team user explicit",
				ExplicitRoles:      "team_user",
				ExpectedRoles:      ts.DefaultTeamUserRole,
				ExpectedSchemeUser: true,
			},
			{
				Name:                "team guest implicit",
				SchemeGuest:         true,
				ExpectedRoles:       ts.DefaultTeamGuestRole,
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team guest explicit",
				ExplicitRoles:       "team_guest",
				ExpectedRoles:       ts.DefaultTeamGuestRole,
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team admin implicit",
				SchemeUser:          true,
				SchemeAdmin:         true,
				ExpectedRoles:       ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                "team admin explicit",
				ExplicitRoles:       "team_user team_admin",
				ExpectedRoles:       ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                  "team user implicit and explicit custom role",
				SchemeUser:            true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team user explicit and explicit custom role",
				ExplicitRoles:         "team_user test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team guest implicit and explicit custom role",
				SchemeGuest:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamGuestRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team guest explicit and explicit custom role",
				ExplicitRoles:         "team_guest test",
				ExpectedRoles:         "test " + ts.DefaultTeamGuestRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team admin implicit and explicit custom role",
				SchemeUser:            true,
				SchemeAdmin:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team admin explicit and explicit custom role",
				ExplicitRoles:         "team_user team_admin test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team member with only explicit custom roles",
				ExplicitRoles:         "test test2",
				ExpectedRoles:         "test test2",
				ExpectedExplicitRoles: "test test2",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				member := &model.TeamMember{
					TeamId:        team.Id,
					UserId:        u1.Id,
					SchemeGuest:   tc.SchemeGuest,
					SchemeUser:    tc.SchemeUser,
					SchemeAdmin:   tc.SchemeAdmin,
					ExplicitRoles: tc.ExplicitRoles,
				}
				otherMember := &model.TeamMember{
					TeamId:        team.Id,
					UserId:        u2.Id,
					SchemeGuest:   tc.SchemeGuest,
					SchemeUser:    tc.SchemeUser,
					SchemeAdmin:   tc.SchemeAdmin,
					ExplicitRoles: tc.ExplicitRoles,
				}
				members, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{member, otherMember}, -1)
				require.Nil(t, nErr)
				require.Len(t, members, 2)
				member = members[0]
				defer ss.Team().RemoveMember(team.Id, u1.Id)
				defer ss.Team().RemoveMember(team.Id, u2.Id)

				assert.Equal(t, tc.ExpectedRoles, member.Roles)
				assert.Equal(t, tc.ExpectedExplicitRoles, member.ExplicitRoles)
				assert.Equal(t, tc.ExpectedSchemeGuest, member.SchemeGuest)
				assert.Equal(t, tc.ExpectedSchemeUser, member.SchemeUser)
				assert.Equal(t, tc.ExpectedSchemeAdmin, member.SchemeAdmin)
			})
		}
	})
}

func testTeamUpdateMember(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)

	t.Run("not valid team member", func(t *testing.T) {
		member := &model.TeamMember{TeamId: "wrong", UserId: u1.Id}
		_, nErr := ss.Team().UpdateMember(member)
		require.NotNil(t, nErr)
		var appErr *model.AppError
		require.True(t, errors.As(nErr, &appErr))
		require.Equal(t, "model.team_member.is_valid.team_id.app_error", appErr.Id)
	})

	t.Run("insert member correctly (in team without scheme)", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Name",
			Name:        "zz" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TEAM_OPEN,
		}

		team, nErr := ss.Team().Save(team)
		require.Nil(t, nErr)

		member := &model.TeamMember{TeamId: team.Id, UserId: u1.Id}
		member, nErr = ss.Team().SaveMember(member, -1)
		require.Nil(t, nErr)

		testCases := []struct {
			Name                  string
			SchemeGuest           bool
			SchemeUser            bool
			SchemeAdmin           bool
			ExplicitRoles         string
			ExpectedRoles         string
			ExpectedExplicitRoles string
			ExpectedSchemeGuest   bool
			ExpectedSchemeUser    bool
			ExpectedSchemeAdmin   bool
		}{
			{
				Name:               "team user implicit",
				SchemeUser:         true,
				ExpectedRoles:      "team_user",
				ExpectedSchemeUser: true,
			},
			{
				Name:               "team user explicit",
				ExplicitRoles:      "team_user",
				ExpectedRoles:      "team_user",
				ExpectedSchemeUser: true,
			},
			{
				Name:                "team guest implicit",
				SchemeGuest:         true,
				ExpectedRoles:       "team_guest",
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team guest explicit",
				ExplicitRoles:       "team_guest",
				ExpectedRoles:       "team_guest",
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team admin implicit",
				SchemeUser:          true,
				SchemeAdmin:         true,
				ExpectedRoles:       "team_user team_admin",
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                "team admin explicit",
				ExplicitRoles:       "team_user team_admin",
				ExpectedRoles:       "team_user team_admin",
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                  "team user implicit and explicit custom role",
				SchemeUser:            true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_user",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team user explicit and explicit custom role",
				ExplicitRoles:         "team_user test",
				ExpectedRoles:         "test team_user",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team guest implicit and explicit custom role",
				SchemeGuest:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_guest",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team guest explicit and explicit custom role",
				ExplicitRoles:         "team_guest test",
				ExpectedRoles:         "test team_guest",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team admin implicit and explicit custom role",
				SchemeUser:            true,
				SchemeAdmin:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_user team_admin",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team admin explicit and explicit custom role",
				ExplicitRoles:         "team_user team_admin test",
				ExpectedRoles:         "test team_user team_admin",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team member with only explicit custom roles",
				ExplicitRoles:         "test test2",
				ExpectedRoles:         "test test2",
				ExpectedExplicitRoles: "test test2",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				member.SchemeGuest = tc.SchemeGuest
				member.SchemeUser = tc.SchemeUser
				member.SchemeAdmin = tc.SchemeAdmin
				member.ExplicitRoles = tc.ExplicitRoles

				member, nErr = ss.Team().UpdateMember(member)
				require.Nil(t, nErr)

				assert.Equal(t, tc.ExpectedRoles, member.Roles)
				assert.Equal(t, tc.ExpectedExplicitRoles, member.ExplicitRoles)
				assert.Equal(t, tc.ExpectedSchemeGuest, member.SchemeGuest)
				assert.Equal(t, tc.ExpectedSchemeUser, member.SchemeUser)
				assert.Equal(t, tc.ExpectedSchemeAdmin, member.SchemeAdmin)
			})
		}
	})

	t.Run("insert member correctly (in team with scheme)", func(t *testing.T) {
		ts := &model.Scheme{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Scope:       model.SCHEME_SCOPE_TEAM,
		}
		ts, nErr := ss.Scheme().Save(ts)
		require.Nil(t, nErr)

		team := &model.Team{
			DisplayName: "Name",
			Name:        "zz" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TEAM_OPEN,
			SchemeId:    &ts.Id,
		}

		team, nErr = ss.Team().Save(team)
		require.Nil(t, nErr)

		member := &model.TeamMember{TeamId: team.Id, UserId: u1.Id}
		member, nErr = ss.Team().SaveMember(member, -1)
		require.Nil(t, nErr)

		testCases := []struct {
			Name                  string
			SchemeGuest           bool
			SchemeUser            bool
			SchemeAdmin           bool
			ExplicitRoles         string
			ExpectedRoles         string
			ExpectedExplicitRoles string
			ExpectedSchemeGuest   bool
			ExpectedSchemeUser    bool
			ExpectedSchemeAdmin   bool
		}{
			{
				Name:               "team user implicit",
				SchemeUser:         true,
				ExpectedRoles:      ts.DefaultTeamUserRole,
				ExpectedSchemeUser: true,
			},
			{
				Name:               "team user explicit",
				ExplicitRoles:      "team_user",
				ExpectedRoles:      ts.DefaultTeamUserRole,
				ExpectedSchemeUser: true,
			},
			{
				Name:                "team guest implicit",
				SchemeGuest:         true,
				ExpectedRoles:       ts.DefaultTeamGuestRole,
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team guest explicit",
				ExplicitRoles:       "team_guest",
				ExpectedRoles:       ts.DefaultTeamGuestRole,
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team admin implicit",
				SchemeUser:          true,
				SchemeAdmin:         true,
				ExpectedRoles:       ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                "team admin explicit",
				ExplicitRoles:       "team_user team_admin",
				ExpectedRoles:       ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                  "team user implicit and explicit custom role",
				SchemeUser:            true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team user explicit and explicit custom role",
				ExplicitRoles:         "team_user test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team guest implicit and explicit custom role",
				SchemeGuest:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamGuestRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team guest explicit and explicit custom role",
				ExplicitRoles:         "team_guest test",
				ExpectedRoles:         "test " + ts.DefaultTeamGuestRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team admin implicit and explicit custom role",
				SchemeUser:            true,
				SchemeAdmin:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team admin explicit and explicit custom role",
				ExplicitRoles:         "team_user team_admin test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team member with only explicit custom roles",
				ExplicitRoles:         "test test2",
				ExpectedRoles:         "test test2",
				ExpectedExplicitRoles: "test test2",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				member.SchemeGuest = tc.SchemeGuest
				member.SchemeUser = tc.SchemeUser
				member.SchemeAdmin = tc.SchemeAdmin
				member.ExplicitRoles = tc.ExplicitRoles

				member, nErr = ss.Team().UpdateMember(member)
				require.Nil(t, nErr)

				assert.Equal(t, tc.ExpectedRoles, member.Roles)
				assert.Equal(t, tc.ExpectedExplicitRoles, member.ExplicitRoles)
				assert.Equal(t, tc.ExpectedSchemeGuest, member.SchemeGuest)
				assert.Equal(t, tc.ExpectedSchemeUser, member.SchemeUser)
				assert.Equal(t, tc.ExpectedSchemeAdmin, member.SchemeAdmin)
			})
		}
	})
}

func testTeamUpdateMultipleMembers(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u2, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)

	t.Run("any not valid team member", func(t *testing.T) {
		m1 := &model.TeamMember{TeamId: "wrong", UserId: u1.Id}
		m2 := &model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}
		_, nErr := ss.Team().UpdateMultipleMembers([]*model.TeamMember{m1, m2})
		require.NotNil(t, nErr)
		var appErr *model.AppError
		require.True(t, errors.As(nErr, &appErr))
		require.Equal(t, "model.team_member.is_valid.team_id.app_error", appErr.Id)
	})

	t.Run("update members correctly (in team without scheme)", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "Name",
			Name:        "zz" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TEAM_OPEN,
		}

		team, nErr := ss.Team().Save(team)
		require.Nil(t, nErr)

		member := &model.TeamMember{TeamId: team.Id, UserId: u1.Id}
		otherMember := &model.TeamMember{TeamId: team.Id, UserId: u2.Id}
		var members []*model.TeamMember
		members, nErr = ss.Team().SaveMultipleMembers([]*model.TeamMember{member, otherMember}, -1)
		require.Nil(t, nErr)
		require.Len(t, members, 2)
		member = members[0]
		otherMember = members[1]

		testCases := []struct {
			Name                  string
			SchemeGuest           bool
			SchemeUser            bool
			SchemeAdmin           bool
			ExplicitRoles         string
			ExpectedRoles         string
			ExpectedExplicitRoles string
			ExpectedSchemeGuest   bool
			ExpectedSchemeUser    bool
			ExpectedSchemeAdmin   bool
		}{
			{
				Name:               "team user implicit",
				SchemeUser:         true,
				ExpectedRoles:      "team_user",
				ExpectedSchemeUser: true,
			},
			{
				Name:               "team user explicit",
				ExplicitRoles:      "team_user",
				ExpectedRoles:      "team_user",
				ExpectedSchemeUser: true,
			},
			{
				Name:                "team guest implicit",
				SchemeGuest:         true,
				ExpectedRoles:       "team_guest",
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team guest explicit",
				ExplicitRoles:       "team_guest",
				ExpectedRoles:       "team_guest",
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team admin implicit",
				SchemeUser:          true,
				SchemeAdmin:         true,
				ExpectedRoles:       "team_user team_admin",
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                "team admin explicit",
				ExplicitRoles:       "team_user team_admin",
				ExpectedRoles:       "team_user team_admin",
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                  "team user implicit and explicit custom role",
				SchemeUser:            true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_user",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team user explicit and explicit custom role",
				ExplicitRoles:         "team_user test",
				ExpectedRoles:         "test team_user",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team guest implicit and explicit custom role",
				SchemeGuest:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_guest",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team guest explicit and explicit custom role",
				ExplicitRoles:         "team_guest test",
				ExpectedRoles:         "test team_guest",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team admin implicit and explicit custom role",
				SchemeUser:            true,
				SchemeAdmin:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test team_user team_admin",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team admin explicit and explicit custom role",
				ExplicitRoles:         "team_user team_admin test",
				ExpectedRoles:         "test team_user team_admin",
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team member with only explicit custom roles",
				ExplicitRoles:         "test test2",
				ExpectedRoles:         "test test2",
				ExpectedExplicitRoles: "test test2",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				member.SchemeGuest = tc.SchemeGuest
				member.SchemeUser = tc.SchemeUser
				member.SchemeAdmin = tc.SchemeAdmin
				member.ExplicitRoles = tc.ExplicitRoles

				var members []*model.TeamMember
				members, nErr = ss.Team().UpdateMultipleMembers([]*model.TeamMember{member, otherMember})
				require.Nil(t, nErr)
				require.Len(t, members, 2)
				member = members[0]

				assert.Equal(t, tc.ExpectedRoles, member.Roles)
				assert.Equal(t, tc.ExpectedExplicitRoles, member.ExplicitRoles)
				assert.Equal(t, tc.ExpectedSchemeGuest, member.SchemeGuest)
				assert.Equal(t, tc.ExpectedSchemeUser, member.SchemeUser)
				assert.Equal(t, tc.ExpectedSchemeAdmin, member.SchemeAdmin)
			})
		}
	})

	t.Run("insert members correctly (in team with scheme)", func(t *testing.T) {
		ts := &model.Scheme{
			Name:        model.NewId(),
			DisplayName: model.NewId(),
			Description: model.NewId(),
			Scope:       model.SCHEME_SCOPE_TEAM,
		}
		ts, nErr := ss.Scheme().Save(ts)
		require.Nil(t, nErr)

		team := &model.Team{
			DisplayName: "Name",
			Name:        "zz" + model.NewId(),
			Email:       MakeEmail(),
			Type:        model.TEAM_OPEN,
			SchemeId:    &ts.Id,
		}

		team, nErr = ss.Team().Save(team)
		require.Nil(t, nErr)

		member := &model.TeamMember{TeamId: team.Id, UserId: u1.Id}
		otherMember := &model.TeamMember{TeamId: team.Id, UserId: u2.Id}
		members, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{member, otherMember}, -1)
		require.Nil(t, nErr)
		require.Len(t, members, 2)
		member = members[0]
		otherMember = members[1]

		testCases := []struct {
			Name                  string
			SchemeGuest           bool
			SchemeUser            bool
			SchemeAdmin           bool
			ExplicitRoles         string
			ExpectedRoles         string
			ExpectedExplicitRoles string
			ExpectedSchemeGuest   bool
			ExpectedSchemeUser    bool
			ExpectedSchemeAdmin   bool
		}{
			{
				Name:               "team user implicit",
				SchemeUser:         true,
				ExpectedRoles:      ts.DefaultTeamUserRole,
				ExpectedSchemeUser: true,
			},
			{
				Name:               "team user explicit",
				ExplicitRoles:      "team_user",
				ExpectedRoles:      ts.DefaultTeamUserRole,
				ExpectedSchemeUser: true,
			},
			{
				Name:                "team guest implicit",
				SchemeGuest:         true,
				ExpectedRoles:       ts.DefaultTeamGuestRole,
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team guest explicit",
				ExplicitRoles:       "team_guest",
				ExpectedRoles:       ts.DefaultTeamGuestRole,
				ExpectedSchemeGuest: true,
			},
			{
				Name:                "team admin implicit",
				SchemeUser:          true,
				SchemeAdmin:         true,
				ExpectedRoles:       ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                "team admin explicit",
				ExplicitRoles:       "team_user team_admin",
				ExpectedRoles:       ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedSchemeUser:  true,
				ExpectedSchemeAdmin: true,
			},
			{
				Name:                  "team user implicit and explicit custom role",
				SchemeUser:            true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team user explicit and explicit custom role",
				ExplicitRoles:         "team_user test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
			},
			{
				Name:                  "team guest implicit and explicit custom role",
				SchemeGuest:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamGuestRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team guest explicit and explicit custom role",
				ExplicitRoles:         "team_guest test",
				ExpectedRoles:         "test " + ts.DefaultTeamGuestRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeGuest:   true,
			},
			{
				Name:                  "team admin implicit and explicit custom role",
				SchemeUser:            true,
				SchemeAdmin:           true,
				ExplicitRoles:         "test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team admin explicit and explicit custom role",
				ExplicitRoles:         "team_user team_admin test",
				ExpectedRoles:         "test " + ts.DefaultTeamUserRole + " " + ts.DefaultTeamAdminRole,
				ExpectedExplicitRoles: "test",
				ExpectedSchemeUser:    true,
				ExpectedSchemeAdmin:   true,
			},
			{
				Name:                  "team member with only explicit custom roles",
				ExplicitRoles:         "test test2",
				ExpectedRoles:         "test test2",
				ExpectedExplicitRoles: "test test2",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				member.SchemeGuest = tc.SchemeGuest
				member.SchemeUser = tc.SchemeUser
				member.SchemeAdmin = tc.SchemeAdmin
				member.ExplicitRoles = tc.ExplicitRoles

				members, err := ss.Team().UpdateMultipleMembers([]*model.TeamMember{member, otherMember})
				require.Nil(t, err)
				require.Len(t, members, 2)
				member = members[0]

				assert.Equal(t, tc.ExpectedRoles, member.Roles)
				assert.Equal(t, tc.ExpectedExplicitRoles, member.ExplicitRoles)
				assert.Equal(t, tc.ExpectedSchemeGuest, member.SchemeGuest)
				assert.Equal(t, tc.ExpectedSchemeUser, member.SchemeUser)
				assert.Equal(t, tc.ExpectedSchemeAdmin, member.SchemeAdmin)
			})
		}
	})
}

func testTeamRemoveMember(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u2, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u3, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u4, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	teamID := model.NewId()
	m1 := &model.TeamMember{TeamId: teamID, UserId: u1.Id}
	m2 := &model.TeamMember{TeamId: teamID, UserId: u2.Id}
	m3 := &model.TeamMember{TeamId: teamID, UserId: u3.Id}
	m4 := &model.TeamMember{TeamId: teamID, UserId: u4.Id}
	_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2, m3, m4}, -1)
	require.Nil(t, nErr)

	t.Run("remove member from not existing team", func(t *testing.T) {
		nErr = ss.Team().RemoveMember("not-existing-team", u1.Id)
		require.Nil(t, nErr)
		var membersOtherTeam []*model.TeamMember
		membersOtherTeam, nErr = ss.Team().GetMembers(teamID, 0, 100, nil)
		require.Nil(t, nErr)
		require.Len(t, membersOtherTeam, 4)
	})

	t.Run("remove not existing member from an existing team", func(t *testing.T) {
		nErr = ss.Team().RemoveMember(teamID, model.NewId())
		require.Nil(t, nErr)
		var membersOtherTeam []*model.TeamMember
		membersOtherTeam, nErr = ss.Team().GetMembers(teamID, 0, 100, nil)
		require.Nil(t, nErr)
		require.Len(t, membersOtherTeam, 4)
	})

	t.Run("remove existing member from an existing team", func(t *testing.T) {
		nErr = ss.Team().RemoveMember(teamID, u1.Id)
		require.Nil(t, nErr)
		defer ss.Team().SaveMember(m1, -1)
		var membersOtherTeam []*model.TeamMember
		membersOtherTeam, nErr = ss.Team().GetMembers(teamID, 0, 100, nil)
		require.Nil(t, nErr)
		require.Len(t, membersOtherTeam, 3)
	})
}

func testTeamRemoveMembers(t *testing.T, ss store.Store) {
	u1, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u2, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u3, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	u4, err := ss.User().Save(&model.User{Username: model.NewId(), Email: MakeEmail()})
	require.Nil(t, err)
	teamID := model.NewId()
	m1 := &model.TeamMember{TeamId: teamID, UserId: u1.Id}
	m2 := &model.TeamMember{TeamId: teamID, UserId: u2.Id}
	m3 := &model.TeamMember{TeamId: teamID, UserId: u3.Id}
	m4 := &model.TeamMember{TeamId: teamID, UserId: u4.Id}
	_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2, m3, m4}, -1)
	require.Nil(t, nErr)

	t.Run("remove members from not existing team", func(t *testing.T) {
		nErr = ss.Team().RemoveMembers("not-existing-team", []string{u1.Id, u2.Id, u3.Id, u4.Id})
		require.Nil(t, nErr)
		var membersOtherTeam []*model.TeamMember
		membersOtherTeam, nErr = ss.Team().GetMembers(teamID, 0, 100, nil)
		require.Nil(t, nErr)
		require.Len(t, membersOtherTeam, 4)
	})

	t.Run("remove not existing members from an existing team", func(t *testing.T) {
		nErr = ss.Team().RemoveMembers(teamID, []string{model.NewId(), model.NewId()})
		require.Nil(t, nErr)
		var membersOtherTeam []*model.TeamMember
		membersOtherTeam, nErr = ss.Team().GetMembers(teamID, 0, 100, nil)
		require.Nil(t, nErr)
		require.Len(t, membersOtherTeam, 4)
	})

	t.Run("remove not existing and not existing members from an existing team", func(t *testing.T) {
		nErr = ss.Team().RemoveMembers(teamID, []string{u1.Id, u2.Id, model.NewId(), model.NewId()})
		require.Nil(t, nErr)
		defer ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2}, -1)
		var membersOtherTeam []*model.TeamMember
		membersOtherTeam, nErr = ss.Team().GetMembers(teamID, 0, 100, nil)
		require.Nil(t, nErr)
		require.Len(t, membersOtherTeam, 2)
	})
	t.Run("remove existing members from an existing team", func(t *testing.T) {
		nErr = ss.Team().RemoveMembers(teamID, []string{u1.Id, u2.Id, u3.Id})
		require.Nil(t, nErr)
		defer ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2, m3}, -1)
		var membersOtherTeam []*model.TeamMember
		membersOtherTeam, nErr = ss.Team().GetMembers(teamID, 0, 100, nil)
		require.Nil(t, nErr)
		require.Len(t, membersOtherTeam, 1)
	})
}

func testTeamMembersWithPagination(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m3 := &model.TeamMember{TeamId: teamId2, UserId: model.NewId()}

	_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2, m3}, -1)
	require.Nil(t, nErr)

	ms, errTeam := ss.Team().GetTeamsForUserWithPagination(m1.UserId, 0, 1)
	require.Nil(t, errTeam)

	require.Len(t, ms, 1)
	require.Equal(t, m1.TeamId, ms[0].TeamId)

	e := ss.Team().RemoveMember(teamId1, m1.UserId)
	require.Nil(t, e)

	ms, err := ss.Team().GetMembers(teamId1, 0, 100, nil)
	require.Nil(t, err)

	require.Len(t, ms, 1)
	require.Equal(t, m2.UserId, ms[0].UserId)

	_, nErr = ss.Team().SaveMember(m1, -1)
	require.Nil(t, nErr)

	err = ss.Team().RemoveAllMembersByTeam(teamId1)
	require.Nil(t, err)

	uid := model.NewId()
	m4 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m5 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	_, nErr = ss.Team().SaveMultipleMembers([]*model.TeamMember{m4, m5}, -1)
	require.Nil(t, nErr)

	result, err := ss.Team().GetTeamsForUserWithPagination(uid, 0, 1)
	require.Nil(t, err)
	require.Len(t, result, 1)

	nErr = ss.Team().RemoveAllMembersByUser(uid)
	require.Nil(t, nErr)

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

		_, nErr := ss.Team().SaveMember(&model.TeamMember{
			TeamId: team.Id,
			UserId: userIds[i],
		}, maxUsersPerTeam)
		require.Nil(t, nErr)

		defer func(userId string) {
			ss.Team().RemoveMember(team.Id, userId)
		}(userIds[i])
	}

	totalMemberCount, err := ss.Team().GetTotalMemberCount(team.Id, nil)
	require.Nil(t, err)
	require.Equal(t, int(totalMemberCount), maxUsersPerTeam, "should start with 5 team members, had %v instead", totalMemberCount)

	user, nErr := ss.User().Save(&model.User{
		Username: model.NewId(),
		Email:    MakeEmail(),
	})
	require.Nil(t, nErr)
	newUserId := user.Id
	defer func() {
		ss.User().PermanentDelete(newUserId)
	}()

	_, nErr = ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: newUserId,
	}, maxUsersPerTeam)
	require.NotNil(t, nErr, "shouldn't be able to save member when at maximum members per team")

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

	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId}, maxUsersPerTeam)
	require.Nil(t, nErr, "should've been able to save new member after deleting one")

	defer ss.Team().RemoveMember(team.Id, newUserId)

	totalMemberCount, teamErr = ss.Team().GetTotalMemberCount(team.Id, nil)
	require.Nil(t, teamErr)
	require.Equal(t, maxUsersPerTeam, int(totalMemberCount), "should have 5 team members again, had %v instead", totalMemberCount)

	// Deactivating a user should make them stop counting against max members
	user2, nErr := ss.User().Get(userIds[1])
	require.Nil(t, nErr)
	user2.DeleteAt = 1234
	_, nErr = ss.User().Update(user2, true)
	require.Nil(t, nErr)

	user, nErr = ss.User().Save(&model.User{
		Username: model.NewId(),
		Email:    MakeEmail(),
	})
	require.Nil(t, nErr)
	newUserId2 := user.Id
	_, nErr = ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId2}, maxUsersPerTeam)
	require.Nil(t, nErr, "should've been able to save new member after deleting one")

	defer ss.Team().RemoveMember(team.Id, newUserId2)
}

func testGetTeamMember(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	_, nErr := ss.Team().SaveMember(m1, -1)
	require.Nil(t, nErr)

	var rm1 *model.TeamMember
	rm1, err := ss.Team().GetMember(m1.TeamId, m1.UserId)
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
	s2, nErr = ss.Scheme().Save(s2)
	require.Nil(t, nErr)
	t.Log(s2)

	t2, nErr := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "z-z-z" + model.NewId() + "b",
		Type:        model.TEAM_OPEN,
		SchemeId:    &s2.Id,
	})
	require.Nil(t, nErr)

	defer func() {
		ss.Team().PermanentDelete(t2.Id)
	}()

	m2 := &model.TeamMember{TeamId: t2.Id, UserId: model.NewId(), SchemeUser: true}
	_, nErr = ss.Team().SaveMember(m2, -1)
	require.Nil(t, nErr)

	m3, err := ss.Team().GetMember(m2.TeamId, m2.UserId)
	require.Nil(t, err)
	t.Log(m3)

	assert.Equal(t, s2.DefaultTeamUserRole, m3.Roles)

	m4 := &model.TeamMember{TeamId: t2.Id, UserId: model.NewId(), SchemeGuest: true}
	_, nErr = ss.Team().SaveMember(m4, -1)
	require.Nil(t, nErr)

	m5, err := ss.Team().GetMember(m4.TeamId, m4.UserId)
	require.Nil(t, err)

	assert.Equal(t, s2.DefaultTeamGuestRole, m5.Roles)
}

func testGetTeamMembersByIds(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	_, nErr := ss.Team().SaveMember(m1, -1)
	require.Nil(t, nErr)

	var r []*model.TeamMember
	r, err := ss.Team().GetMembersByIds(m1.TeamId, []string{m1.UserId}, nil)
	require.Nil(t, err)
	rm1 := r[0]

	require.Equal(t, rm1.TeamId, m1.TeamId, "bad team id")
	require.Equal(t, rm1.UserId, m1.UserId, "bad user id")

	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	_, nErr = ss.Team().SaveMember(m2, -1)
	require.Nil(t, nErr)

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
	_, nErr := ss.Team().SaveMember(m1, -1)
	require.Nil(t, nErr)

	m2 := &model.TeamMember{TeamId: teamId1, UserId: u2.Id}
	_, nErr = ss.Team().SaveMember(m2, -1)
	require.Nil(t, nErr)

	var totalMemberCount int64
	totalMemberCount, nErr = ss.Team().GetTotalMemberCount(teamId1, nil)
	require.Nil(t, nErr)
	require.Equal(t, int(totalMemberCount), 2, "wrong count")

	var result int64
	result, nErr = ss.Team().GetActiveMemberCount(teamId1, nil)
	require.Nil(t, nErr)
	require.Equal(t, 1, int(result), "wrong count")

	m3 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	_, nErr = ss.Team().SaveMember(m3, -1)
	require.Nil(t, nErr)

	totalMemberCount, nErr = ss.Team().GetTotalMemberCount(teamId1, nil)
	require.Nil(t, nErr)
	require.Equal(t, 2, int(totalMemberCount), "wrong count")

	result, nErr = ss.Team().GetActiveMemberCount(teamId1, nil)
	require.Nil(t, nErr)
	require.Equal(t, 1, int(result), "wrong count")
}

func testGetChannelUnreadsForAllTeams(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m2 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	_, nErr := ss.Team().SaveMember(m1, -1)
	require.Nil(t, nErr)
	_, nErr = ss.Team().SaveMember(m2, -1)
	require.Nil(t, nErr)

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	_, nErr = ss.Channel().Save(c1, -1)
	require.Nil(t, nErr)

	c2 := &model.Channel{TeamId: m2.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	_, nErr = ss.Channel().Save(c2, -1)
	require.Nil(t, nErr)

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	_, err := ss.Channel().SaveMember(cm1)
	require.Nil(t, err)
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m2.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	_, err = ss.Channel().SaveMember(cm2)
	require.Nil(t, err)

	ms1, nErr := ss.Team().GetChannelUnreadsForAllTeams("", uid)
	require.Nil(t, nErr)
	membersMap := make(map[string]bool)
	for i := range ms1 {
		id := ms1[i].TeamId
		if _, ok := membersMap[id]; !ok {
			membersMap[id] = true
		}
	}
	require.Len(t, membersMap, 2, "Should be the unreads for all the teams")

	require.Equal(t, 10, int(ms1[0].MsgCount), "subtraction failed")

	ms2, nErr := ss.Team().GetChannelUnreadsForAllTeams(teamId1, uid)
	require.Nil(t, nErr)
	membersMap = make(map[string]bool)
	for i := range ms2 {
		id := ms2[i].TeamId
		if _, ok := membersMap[id]; !ok {
			membersMap[id] = true
		}
	}

	require.Len(t, membersMap, 1, "Should be the unreads for just one team")

	require.Equal(t, 10, int(ms2[0].MsgCount), "subtraction failed")

	nErr = ss.Team().RemoveAllMembersByUser(uid)
	require.Nil(t, nErr)
}

func testGetChannelUnreadsForTeam(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	_, nErr := ss.Team().SaveMember(m1, -1)
	require.Nil(t, nErr)

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	_, nErr = ss.Channel().Save(c1, -1)
	require.Nil(t, nErr)

	c2 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	_, nErr = ss.Channel().Save(c2, -1)
	require.Nil(t, nErr)

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	_, nErr = ss.Channel().SaveMember(cm1)
	require.Nil(t, nErr)
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	_, nErr = ss.Channel().SaveMember(cm2)
	require.Nil(t, nErr)

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
		Name:        "zz" + model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}

	t2 := &model.Team{
		Name:        "zz" + model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}

	t3 := &model.Team{
		Name:        "zz" + model.NewId(),
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

	memberships, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{tm1, tm2, tm3}, -1)
	require.Nil(t, nErr)
	require.Len(t, memberships, 3)
	tm1 = memberships[0]
	tm2 = memberships[1]
	tm3 = memberships[2]

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
		Name:        "zz" + model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}

	t2 := &model.Team{
		Name:        "zz" + model.NewId(),
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
		ExplicitRoles: "team_post_all_public team_user team_admin",
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

	_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2, m3, m4}, -1)
	require.Nil(t, nErr)

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
		Name:        "zz" + model.NewId(),
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
		Name:        "zz" + model.NewId(),
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
		Name:        "zz" + model.NewId(),
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
		Name:        "zz" + model.NewId(),
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
	m2 := &model.TeamMember{TeamId: t1.Id, UserId: u2.Id}
	_, nErr := ss.Team().SaveMultipleMembers([]*model.TeamMember{m1, m2}, -1)
	require.Nil(t, nErr)

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
		Name:             "zz" + model.NewId(),
		Email:            MakeEmail(),
		Type:             model.TEAM_INVITE,
		GroupConstrained: model.NewBool(true),
	})
	require.Nil(t, err)
	require.True(t, team1.IsGroupConstrained())
	defer ss.Team().PermanentDelete(team1.Id)

	team2, err := ss.Team().Save(&model.Team{
		DisplayName: model.NewId(),
		Name:        "zz" + model.NewId(),
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
