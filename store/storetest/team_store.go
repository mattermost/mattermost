// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestTeamStore(t *testing.T, ss store.Store) {
	createDefaultRoles(t, ss)

	t.Run("Save", func(t *testing.T) { testTeamStoreSave(t, ss) })
	t.Run("Update", func(t *testing.T) { testTeamStoreUpdate(t, ss) })
	t.Run("UpdateDisplayName", func(t *testing.T) { testTeamStoreUpdateDisplayName(t, ss) })
	t.Run("Get", func(t *testing.T) { testTeamStoreGet(t, ss) })
	t.Run("GetByName", func(t *testing.T) { testTeamStoreGetByName(t, ss) })
	t.Run("SearchByName", func(t *testing.T) { testTeamStoreSearchByName(t, ss) })
	t.Run("SearchAll", func(t *testing.T) { testTeamStoreSearchAll(t, ss) })
	t.Run("SearchOpen", func(t *testing.T) { testTeamStoreSearchOpen(t, ss) })
	t.Run("SearchPrivate", func(t *testing.T) { testTeamStoreSearchPrivate(t, ss) })
	t.Run("GetByIniviteId", func(t *testing.T) { testTeamStoreGetByIniviteId(t, ss) })
	t.Run("ByUserId", func(t *testing.T) { testTeamStoreByUserId(t, ss) })
	t.Run("GetAllTeamListing", func(t *testing.T) { testGetAllTeamListing(t, ss) })
	t.Run("GetAllTeamPageListing", func(t *testing.T) { testGetAllTeamPageListing(t, ss) })
	t.Run("GetAllPrivateTeamListing", func(t *testing.T) { testGetAllPrivateTeamListing(t, ss) })
	t.Run("GetAllPrivateTeamPageListing", func(t *testing.T) { testGetAllPrivateTeamPageListing(t, ss) })
	t.Run("Delete", func(t *testing.T) { testDelete(t, ss) })
	t.Run("TeamCount", func(t *testing.T) { testTeamCount(t, ss) })
	t.Run("TeamMembers", func(t *testing.T) { testTeamMembers(t, ss) })
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
}

func testTeamStoreSave(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-ss.Team().Save(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}

	o1.Id = ""
	if err := (<-ss.Team().Save(&o1)).Err; err == nil {
		t.Fatal("should be unique domain")
	}
}

func testTeamStoreUpdate(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	time.Sleep(100 * time.Millisecond)

	if err := (<-ss.Team().Update(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	o1.Id = "missing"
	if err := (<-ss.Team().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have failed because of missing key")
	}

	o1.Id = model.NewId()
	if err := (<-ss.Team().Update(&o1)).Err; err == nil {
		t.Fatal("Update should have faile because id change")
	}
}

func testTeamStoreUpdateDisplayName(t *testing.T, ss store.Store) {
	o1 := &model.Team{}
	o1.DisplayName = "Display Name"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1 = (<-ss.Team().Save(o1)).Data.(*model.Team)

	newDisplayName := "NewDisplayName"

	if err := (<-ss.Team().UpdateDisplayName(newDisplayName, o1.Id)).Err; err != nil {
		t.Fatal(err)
	}

	ro1 := (<-ss.Team().Get(o1.Id)).Data.(*model.Team)
	if ro1.DisplayName != newDisplayName {
		t.Fatal("DisplayName not updated")
	}
}

func testTeamStoreGet(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&o1))

	if r1 := <-ss.Team().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-ss.Team().Get("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testTeamStoreGetByName(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-ss.Team().GetByName(o1.Name); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-ss.Team().GetByName("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testTeamStoreSearchByName(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	var name = "zzz" + model.NewId()
	o1.Name = name + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN

	if err := (<-ss.Team().Save(&o1)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-ss.Team().SearchByName(name); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.([]*model.Team)[0].ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}
}

func testTeamStoreSearchAll(t *testing.T, ss store.Store) {
	o := model.Team{}
	o.DisplayName = "ADisplayName" + model.NewId()
	o.Name = "zzzzzz-" + model.NewId() + "a"
	o.Email = MakeEmail()
	o.Type = model.TEAM_OPEN
	o.AllowOpenInvite = true

	require.Nil(t, (<-ss.Team().Save(&o)).Err)

	p := model.Team{}
	p.DisplayName = "ADisplayName" + model.NewId()
	p.Name = "zzzzzz-" + model.NewId() + "a"
	p.Email = MakeEmail()
	p.Type = model.TEAM_OPEN
	p.AllowOpenInvite = false

	require.Nil(t, (<-ss.Team().Save(&p)).Err)

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
			r1 := <-ss.Team().SearchAll(tc.Term)
			require.Nil(t, r1.Err)
			results := r1.Data.([]*model.Team)
			require.Equal(t, tc.ExpectedLenth, len(results))
			if tc.ExpectedFirstId != "" {
				assert.Equal(t, tc.ExpectedFirstId, results[0].Id)
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

	require.Nil(t, (<-ss.Team().Save(&o)).Err)

	p := model.Team{}
	p.DisplayName = "ADisplayName" + model.NewId()
	p.Name = "zz" + model.NewId() + "a"
	p.Email = MakeEmail()
	p.Type = model.TEAM_OPEN
	p.AllowOpenInvite = false

	require.Nil(t, (<-ss.Team().Save(&p)).Err)

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
			"Search for a private team (expected no results)",
			p.DisplayName,
			0,
			"",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			r1 := <-ss.Team().SearchOpen(tc.Term)
			require.Nil(t, r1.Err)
			results := r1.Data.([]*model.Team)
			require.Equal(t, tc.ExpectedLenth, len(results))
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

	require.Nil(t, (<-ss.Team().Save(&o)).Err)

	p := model.Team{}
	p.DisplayName = "ADisplayName" + model.NewId()
	p.Name = "zz" + model.NewId() + "a"
	p.Email = MakeEmail()
	p.Type = model.TEAM_OPEN
	p.AllowOpenInvite = false

	require.Nil(t, (<-ss.Team().Save(&p)).Err)

	testCases := []struct {
		Name            string
		Term            string
		ExpectedLenth   int
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
			r1 := <-ss.Team().SearchPrivate(tc.Term)
			require.Nil(t, r1.Err)
			results := r1.Data.([]*model.Team)
			require.Equal(t, tc.ExpectedLenth, len(results))
			if tc.ExpectedFirstId != "" {
				assert.Equal(t, tc.ExpectedFirstId, results[0].Id)
			}
		})
	}
}

func testTeamStoreGetByIniviteId(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.InviteId = model.NewId()

	save1 := <-ss.Team().Save(&o1)

	if err := save1.Err; err != nil {
		t.Fatal(err)
	}

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN

	if r1 := <-ss.Team().GetByInviteId(save1.Data.(*model.Team).InviteId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Team).ToJson() != o1.ToJson() {
			t.Fatal("invalid returned team")
		}
	}

	if err := (<-ss.Team().GetByInviteId("")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testTeamStoreByUserId(t *testing.T, ss store.Store) {
	o1 := &model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.InviteId = model.NewId()
	o1 = store.Must(ss.Team().Save(o1)).(*model.Team)

	m1 := &model.TeamMember{TeamId: o1.Id, UserId: model.NewId()}
	store.Must(ss.Team().SaveMember(m1, -1))

	if r1 := <-ss.Team().GetTeamsByUserId(m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)
		if len(teams) == 0 {
			t.Fatal("Should return a team")
		}

		if teams[0].Id != o1.Id {
			t.Fatal("should be a member")
		}

	}
}

func testGetAllTeamListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&o2))

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o3))

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = MakeEmail()
	o4.Type = model.TEAM_INVITE
	store.Must(ss.Team().Save(&o4))

	if r1 := <-ss.Team().GetAllTeamListing(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if !team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as true")
			}
		}

		if len(teams) == 0 {
			t.Fatal("failed team listing")
		}
	}
}

func testGetAllTeamPageListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	o2.AllowOpenInvite = false
	store.Must(ss.Team().Save(&o2))

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o3))

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = MakeEmail()
	o4.Type = model.TEAM_INVITE
	o4.AllowOpenInvite = false
	store.Must(ss.Team().Save(&o4))

	if r1 := <-ss.Team().GetAllTeamPageListing(0, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if !team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as true")
			}
		}

		if len(teams) > 10 {
			t.Fatal("should have returned max of 10 teams")
		}
	}

	o5 := model.Team{}
	o5.DisplayName = "DisplayName"
	o5.Name = "z-z-z" + model.NewId() + "b"
	o5.Email = MakeEmail()
	o5.Type = model.TEAM_OPEN
	o5.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o5))

	if r1 := <-ss.Team().GetAllTeamPageListing(0, 4); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if !team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as true")
			}
		}

		if len(teams) > 4 {
			t.Fatal("should have returned max of 4 teams")
		}
	}

	if r1 := <-ss.Team().GetAllTeamPageListing(1, 1); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if !team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as true")
			}
		}

		if len(teams) > 1 {
			t.Fatal("should have returned max of 1 team")
		}
	}
}

func testGetAllPrivateTeamListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&o2))

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o3))

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = MakeEmail()
	o4.Type = model.TEAM_INVITE
	store.Must(ss.Team().Save(&o4))

	if r1 := <-ss.Team().GetAllPrivateTeamListing(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as false")
			}
		}

		if len(teams) == 0 {
			t.Fatal("failed team listing")
		}
	}
}

func testGetAllPrivateTeamPageListing(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	o2.AllowOpenInvite = false
	store.Must(ss.Team().Save(&o2))

	o3 := model.Team{}
	o3.DisplayName = "DisplayName"
	o3.Name = "z-z-z" + model.NewId() + "b"
	o3.Email = MakeEmail()
	o3.Type = model.TEAM_INVITE
	o3.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o3))

	o4 := model.Team{}
	o4.DisplayName = "DisplayName"
	o4.Name = "zz" + model.NewId() + "b"
	o4.Email = MakeEmail()
	o4.Type = model.TEAM_INVITE
	o4.AllowOpenInvite = false
	store.Must(ss.Team().Save(&o4))

	if r1 := <-ss.Team().GetAllPrivateTeamPageListing(0, 10); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as false")
			}
		}

		if len(teams) > 10 {
			t.Fatal("should have returned max of 10 teams")
		}
	}

	o5 := model.Team{}
	o5.DisplayName = "DisplayName"
	o5.Name = "z-z-z" + model.NewId() + "b"
	o5.Email = MakeEmail()
	o5.Type = model.TEAM_OPEN
	o5.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o5))

	if r1 := <-ss.Team().GetAllPrivateTeamPageListing(0, 4); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as false")
			}
		}

		if len(teams) > 4 {
			t.Fatal("should have returned max of 4 teams")
		}
	}

	if r1 := <-ss.Team().GetAllPrivateTeamPageListing(1, 1); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		teams := r1.Data.([]*model.Team)

		for _, team := range teams {
			if team.AllowOpenInvite {
				t.Fatal("should have returned team with AllowOpenInvite as false")
			}
		}

		if len(teams) > 1 {
			t.Fatal("should have returned max of 1 team")
		}
	}
}

func testDelete(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	o2 := model.Team{}
	o2.DisplayName = "DisplayName"
	o2.Name = "zz" + model.NewId() + "b"
	o2.Email = MakeEmail()
	o2.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&o2))

	if r1 := <-ss.Team().PermanentDelete(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}

func testTeamCount(t *testing.T, ss store.Store) {
	o1 := model.Team{}
	o1.DisplayName = "DisplayName"
	o1.Name = "z-z-z" + model.NewId() + "b"
	o1.Email = MakeEmail()
	o1.Type = model.TEAM_OPEN
	o1.AllowOpenInvite = true
	store.Must(ss.Team().Save(&o1))

	if r1 := <-ss.Team().AnalyticsTeamCount(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) == 0 {
			t.Fatal("should be at least 1 team")
		}
	}
}

func testTeamMembers(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m3 := &model.TeamMember{TeamId: teamId2, UserId: model.NewId()}

	if r1 := <-ss.Team().SaveMember(m1, -1); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	store.Must(ss.Team().SaveMember(m2, -1))
	store.Must(ss.Team().SaveMember(m3, -1))

	if r1 := <-ss.Team().GetMembers(teamId1, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)
		require.Len(t, ms, 2)
	}

	if r1 := <-ss.Team().GetMembers(teamId2, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		require.Len(t, ms, 1)
		require.Equal(t, m3.UserId, ms[0].UserId)
	}

	if r1 := <-ss.Team().GetTeamsForUser(m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		require.Len(t, ms, 1)
		require.Equal(t, m1.TeamId, ms[0].TeamId)
	}

	if r1 := <-ss.Team().RemoveMember(teamId1, m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-ss.Team().GetMembers(teamId1, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		require.Len(t, ms, 1)
		require.Equal(t, m2.UserId, ms[0].UserId)
	}

	store.Must(ss.Team().SaveMember(m1, -1))

	if r1 := <-ss.Team().RemoveAllMembersByTeam(teamId1); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-ss.Team().GetMembers(teamId1, 0, 100); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		require.Len(t, ms, 0)
	}

	uid := model.NewId()
	m4 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m5 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	store.Must(ss.Team().SaveMember(m4, -1))
	store.Must(ss.Team().SaveMember(m5, -1))

	if r1 := <-ss.Team().GetTeamsForUser(uid); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		require.Len(t, ms, 2)
	}

	if r1 := <-ss.Team().RemoveAllMembersByUser(uid); r1.Err != nil {
		t.Fatal(r1.Err)
	}

	if r1 := <-ss.Team().GetTeamsForUser(m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.TeamMember)

		require.Len(t, ms, 0)
	}
}

func testTeamMembersWithPagination(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	m3 := &model.TeamMember{TeamId: teamId2, UserId: model.NewId()}

	r1 := <-ss.Team().SaveMember(m1, -1)
	require.Nil(t, r1.Err)

	store.Must(ss.Team().SaveMember(m2, -1))
	store.Must(ss.Team().SaveMember(m3, -1))

	r1 = <-ss.Team().GetTeamsForUserWithPagination(m1.UserId, 0, 1)
	require.Nil(t, r1.Err)
	ms := r1.Data.([]*model.TeamMember)

	require.Len(t, ms, 1)
	require.Equal(t, m1.TeamId, ms[0].TeamId)

	r1 = <-ss.Team().RemoveMember(teamId1, m1.UserId)
	require.Nil(t, r1.Err)

	r1 = <-ss.Team().GetMembers(teamId1, 0, 100)
	require.Nil(t, r1.Err)

	ms = r1.Data.([]*model.TeamMember)
	require.Len(t, ms, 1)
	require.Equal(t, m2.UserId, ms[0].UserId)

	store.Must(ss.Team().SaveMember(m1, -1))

	r1 = <-ss.Team().RemoveAllMembersByTeam(teamId1)
	require.Nil(t, r1.Err)

	uid := model.NewId()
	m4 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m5 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	store.Must(ss.Team().SaveMember(m4, -1))
	store.Must(ss.Team().SaveMember(m5, -1))

	r1 = <-ss.Team().GetTeamsForUserWithPagination(uid, 0, 1)
	require.Nil(t, r1.Err)
	ms = r1.Data.([]*model.TeamMember)
	require.Len(t, ms, 1)

	r1 = <-ss.Team().RemoveAllMembersByUser(uid)
	require.Nil(t, r1.Err)

	r1 = <-ss.Team().GetTeamsForUserWithPagination(uid, 1, 1)
	require.Nil(t, r1.Err)
	ms = r1.Data.([]*model.TeamMember)
	require.Len(t, ms, 0)
}

func testSaveTeamMemberMaxMembers(t *testing.T, ss store.Store) {
	maxUsersPerTeam := 5

	team := store.Must(ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "z-z-z" + model.NewId() + "b",
		Type:        model.TEAM_OPEN,
	})).(*model.Team)
	defer func() {
		<-ss.Team().PermanentDelete(team.Id)
	}()

	userIds := make([]string, maxUsersPerTeam)

	for i := 0; i < maxUsersPerTeam; i++ {
		userIds[i] = store.Must(ss.User().Save(&model.User{
			Username: model.NewId(),
			Email:    MakeEmail(),
		})).(*model.User).Id

		defer func(userId string) {
			<-ss.User().PermanentDelete(userId)
		}(userIds[i])

		store.Must(ss.Team().SaveMember(&model.TeamMember{
			TeamId: team.Id,
			UserId: userIds[i],
		}, maxUsersPerTeam))

		defer func(userId string) {
			<-ss.Team().RemoveMember(team.Id, userId)
		}(userIds[i])
	}

	if result := <-ss.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != maxUsersPerTeam {
		t.Fatalf("should start with 5 team members, had %v instead", count)
	}

	newUserId := store.Must(ss.User().Save(&model.User{
		Username: model.NewId(),
		Email:    MakeEmail(),
	})).(*model.User).Id
	defer func() {
		<-ss.User().PermanentDelete(newUserId)
	}()

	if result := <-ss.Team().SaveMember(&model.TeamMember{
		TeamId: team.Id,
		UserId: newUserId,
	}, maxUsersPerTeam); result.Err == nil {
		t.Fatal("shouldn't be able to save member when at maximum members per team")
	}

	if result := <-ss.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != maxUsersPerTeam {
		t.Fatalf("should still have 5 team members, had %v instead", count)
	}

	// Leaving the team from the UI sets DeleteAt instead of using TeamStore.RemoveMember
	store.Must(ss.Team().UpdateMember(&model.TeamMember{
		TeamId:   team.Id,
		UserId:   userIds[0],
		DeleteAt: 1234,
	}))

	if result := <-ss.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != maxUsersPerTeam-1 {
		t.Fatalf("should now only have 4 team members, had %v instead", count)
	}

	if result := <-ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId}, maxUsersPerTeam); result.Err != nil {
		t.Fatal("should've been able to save new member after deleting one", result.Err)
	} else {
		defer func(userId string) {
			<-ss.Team().RemoveMember(team.Id, userId)
		}(newUserId)
	}

	if result := <-ss.Team().GetTotalMemberCount(team.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if count := result.Data.(int64); int(count) != maxUsersPerTeam {
		t.Fatalf("should have 5 team members again, had %v instead", count)
	}

	// Deactivating a user should make them stop counting against max members
	user2 := store.Must(ss.User().Get(userIds[1])).(*model.User)
	user2.DeleteAt = 1234
	store.Must(ss.User().Update(user2, true))

	newUserId2 := store.Must(ss.User().Save(&model.User{
		Username: model.NewId(),
		Email:    MakeEmail(),
	})).(*model.User).Id
	if result := <-ss.Team().SaveMember(&model.TeamMember{TeamId: team.Id, UserId: newUserId2}, maxUsersPerTeam); result.Err != nil {
		t.Fatal("should've been able to save new member after deleting one", result.Err)
	} else {
		defer func(userId string) {
			<-ss.Team().RemoveMember(team.Id, userId)
		}(newUserId2)
	}
}

func testGetTeamMember(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	store.Must(ss.Team().SaveMember(m1, -1))

	if r := <-ss.Team().GetMember(m1.TeamId, m1.UserId); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm1 := r.Data.(*model.TeamMember)

		if rm1.TeamId != m1.TeamId {
			t.Fatal("bad team id")
		}

		if rm1.UserId != m1.UserId {
			t.Fatal("bad user id")
		}
	}

	if r := <-ss.Team().GetMember(m1.TeamId, ""); r.Err == nil {
		t.Fatal("empty user id - should have failed")
	}

	if r := <-ss.Team().GetMember("", m1.UserId); r.Err == nil {
		t.Fatal("empty team id - should have failed")
	}

	// Test with a custom team scheme.
	s2 := &model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}
	s2 = (<-ss.Scheme().Save(s2)).Data.(*model.Scheme)
	t.Log(s2)

	t2 := store.Must(ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "z-z-z" + model.NewId() + "b",
		Type:        model.TEAM_OPEN,
		SchemeId:    &s2.Id,
	})).(*model.Team)

	defer func() {
		<-ss.Team().PermanentDelete(t2.Id)
	}()

	m2 := &model.TeamMember{TeamId: t2.Id, UserId: model.NewId(), SchemeUser: true}
	store.Must(ss.Team().SaveMember(m2, -1))

	r2 := <-ss.Team().GetMember(m2.TeamId, m2.UserId)
	require.Nil(t, r2.Err)
	m3 := r2.Data.(*model.TeamMember)
	t.Log(m3)

	assert.Equal(t, s2.DefaultTeamUserRole, m3.Roles)
}

func testGetTeamMembersByIds(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	m1 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	store.Must(ss.Team().SaveMember(m1, -1))

	if r := <-ss.Team().GetMembersByIds(m1.TeamId, []string{m1.UserId}); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm1 := r.Data.([]*model.TeamMember)[0]

		if rm1.TeamId != m1.TeamId {
			t.Fatal("bad team id")
		}

		if rm1.UserId != m1.UserId {
			t.Fatal("bad user id")
		}
	}

	m2 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	store.Must(ss.Team().SaveMember(m2, -1))

	if r := <-ss.Team().GetMembersByIds(m1.TeamId, []string{m1.UserId, m2.UserId, model.NewId()}); r.Err != nil {
		t.Fatal(r.Err)
	} else {
		rm := r.Data.([]*model.TeamMember)

		if len(rm) != 2 {
			t.Fatal("return wrong number of results")
		}
	}

	if r := <-ss.Team().GetMembersByIds(m1.TeamId, []string{}); r.Err == nil {
		t.Fatal("empty user ids - should have failed")
	}
}

func testTeamStoreMemberCount(t *testing.T, ss store.Store) {
	u1 := &model.User{}
	u1.Email = MakeEmail()
	store.Must(ss.User().Save(u1))

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.DeleteAt = 1
	store.Must(ss.User().Save(u2))

	teamId1 := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: u1.Id}
	store.Must(ss.Team().SaveMember(m1, -1))

	m2 := &model.TeamMember{TeamId: teamId1, UserId: u2.Id}
	store.Must(ss.Team().SaveMember(m2, -1))

	if result := <-ss.Team().GetTotalMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 2 {
			t.Fatal("wrong count")
		}
	}

	if result := <-ss.Team().GetActiveMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 1 {
			t.Fatal("wrong count")
		}
	}

	m3 := &model.TeamMember{TeamId: teamId1, UserId: model.NewId()}
	store.Must(ss.Team().SaveMember(m3, -1))

	if result := <-ss.Team().GetTotalMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 2 {
			t.Fatal("wrong count")
		}
	}

	if result := <-ss.Team().GetActiveMemberCount(teamId1); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(int64) != 1 {
			t.Fatal("wrong count")
		}
	}
}

func testGetChannelUnreadsForAllTeams(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()
	teamId2 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	m2 := &model.TeamMember{TeamId: teamId2, UserId: uid}
	store.Must(ss.Team().SaveMember(m1, -1))
	store.Must(ss.Team().SaveMember(m2, -1))

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c1, -1))
	c2 := &model.Channel{TeamId: m2.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c2, -1))

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	store.Must(ss.Channel().SaveMember(cm1))
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m2.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	store.Must(ss.Channel().SaveMember(cm2))

	if r1 := <-ss.Team().GetChannelUnreadsForAllTeams("", uid); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.ChannelUnread)
		membersMap := make(map[string]bool)
		for i := range ms {
			id := ms[i].TeamId
			if _, ok := membersMap[id]; !ok {
				membersMap[id] = true
			}
		}
		if len(membersMap) != 2 {
			t.Fatal("Should be the unreads for all the teams")
		}

		if ms[0].MsgCount != 10 {
			t.Fatal("subtraction failed")
		}
	}

	if r2 := <-ss.Team().GetChannelUnreadsForAllTeams(teamId1, uid); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		ms := r2.Data.([]*model.ChannelUnread)
		membersMap := make(map[string]bool)
		for i := range ms {
			id := ms[i].TeamId
			if _, ok := membersMap[id]; !ok {
				membersMap[id] = true
			}
		}

		if len(membersMap) != 1 {
			t.Fatal("Should be the unreads for just one team")
		}

		if ms[0].MsgCount != 10 {
			t.Fatal("subtraction failed")
		}
	}

	if r1 := <-ss.Team().RemoveAllMembersByUser(uid); r1.Err != nil {
		t.Fatal(r1.Err)
	}
}

func testGetChannelUnreadsForTeam(t *testing.T, ss store.Store) {
	teamId1 := model.NewId()

	uid := model.NewId()
	m1 := &model.TeamMember{TeamId: teamId1, UserId: uid}
	store.Must(ss.Team().SaveMember(m1, -1))

	c1 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c1, -1))
	c2 := &model.Channel{TeamId: m1.TeamId, Name: model.NewId(), DisplayName: "Town Square", Type: model.CHANNEL_OPEN, TotalMsgCount: 100}
	store.Must(ss.Channel().Save(c2, -1))

	cm1 := &model.ChannelMember{ChannelId: c1.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	store.Must(ss.Channel().SaveMember(cm1))
	cm2 := &model.ChannelMember{ChannelId: c2.Id, UserId: m1.UserId, NotifyProps: model.GetDefaultChannelNotifyProps(), MsgCount: 90}
	store.Must(ss.Channel().SaveMember(cm2))

	if r1 := <-ss.Team().GetChannelUnreadsForTeam(m1.TeamId, m1.UserId); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		ms := r1.Data.([]*model.ChannelUnread)
		if len(ms) != 2 {
			t.Fatal("wrong length")
		}

		if ms[0].MsgCount != 10 {
			t.Fatal("subtraction failed")
		}
	}
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
	o1 = (<-ss.Team().Save(o1)).Data.(*model.Team)

	curTime := model.GetMillis()

	if err := (<-ss.Team().UpdateLastTeamIconUpdate(o1.Id, curTime)).Err; err != nil {
		t.Fatal(err)
	}

	ro1 := (<-ss.Team().Get(o1.Id)).Data.(*model.Team)
	if ro1.LastTeamIconUpdate <= lastTeamIconUpdateInitial {
		t.Fatal("LastTeamIconUpdate not updated")
	}
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

	s1 = (<-ss.Scheme().Save(s1)).Data.(*model.Scheme)
	s2 = (<-ss.Scheme().Save(s2)).Data.(*model.Scheme)

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

	_ = (<-ss.Team().Save(t1)).Data.(*model.Team)
	_ = (<-ss.Team().Save(t2)).Data.(*model.Team)
	_ = (<-ss.Team().Save(t3)).Data.(*model.Team)

	// Get the teams by a valid Scheme ID.
	res1 := <-ss.Team().GetTeamsByScheme(s1.Id, 0, 100)
	assert.Nil(t, res1.Err)
	d1 := res1.Data.([]*model.Team)
	assert.Len(t, d1, 2)

	// Get the teams by a valid Scheme ID where there aren't any matching Teams.
	res2 := <-ss.Team().GetTeamsByScheme(s2.Id, 0, 100)
	assert.Nil(t, res2.Err)
	d2 := res2.Data.([]*model.Team)
	assert.Len(t, d2, 0)

	// Get the teams by an invalid Scheme ID.
	res3 := <-ss.Team().GetTeamsByScheme(model.NewId(), 0, 100)
	assert.Nil(t, res3.Err)
	d3 := res3.Data.([]*model.Team)
	assert.Len(t, d3, 0)
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
	t1 = store.Must(ss.Team().Save(t1)).(*model.Team)

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

	tm1 = (<-ss.Team().SaveMember(tm1, -1)).Data.(*model.TeamMember)
	tm2 = (<-ss.Team().SaveMember(tm2, -1)).Data.(*model.TeamMember)
	tm3 = (<-ss.Team().SaveMember(tm3, -1)).Data.(*model.TeamMember)

	lastDoneTeamId := strings.Repeat("0", 26)
	lastDoneUserId := strings.Repeat("0", 26)

	for {
		res := <-ss.Team().MigrateTeamMembers(lastDoneTeamId, lastDoneUserId)
		if assert.Nil(t, res.Err) {
			if res.Data == nil {
				break
			}
			data := res.Data.(map[string]string)
			lastDoneTeamId = data["TeamId"]
			lastDoneUserId = data["UserId"]
		}
	}

	res1 := <-ss.Team().GetMember(tm1.TeamId, tm1.UserId)
	assert.Nil(t, res1.Err)
	tm1b := res1.Data.(*model.TeamMember)
	assert.Equal(t, "", tm1b.ExplicitRoles)
	assert.True(t, tm1b.SchemeUser)
	assert.True(t, tm1b.SchemeAdmin)

	res2 := <-ss.Team().GetMember(tm2.TeamId, tm2.UserId)
	assert.Nil(t, res2.Err)
	tm2b := res2.Data.(*model.TeamMember)
	assert.Equal(t, "", tm2b.ExplicitRoles)
	assert.True(t, tm2b.SchemeUser)
	assert.False(t, tm2b.SchemeAdmin)

	res3 := <-ss.Team().GetMember(tm3.TeamId, tm3.UserId)
	assert.Nil(t, res3.Err)
	tm3b := res3.Data.(*model.TeamMember)
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
	s1 = (<-ss.Scheme().Save(s1)).Data.(*model.Scheme)

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

	t1 = (<-ss.Team().Save(t1)).Data.(*model.Team)
	t2 = (<-ss.Team().Save(t2)).Data.(*model.Team)

	assert.Equal(t, s1.Id, *t1.SchemeId)
	assert.Equal(t, s1.Id, *t2.SchemeId)

	res := <-ss.Team().ResetAllTeamSchemes()
	assert.Nil(t, res.Err)

	t1 = (<-ss.Team().Get(t1.Id)).Data.(*model.Team)
	t2 = (<-ss.Team().Get(t2.Id)).Data.(*model.Team)

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

	store.Must(ss.Team().SaveMember(m1, -1))
	store.Must(ss.Team().SaveMember(m2, -1))
	store.Must(ss.Team().SaveMember(m3, -1))
	store.Must(ss.Team().SaveMember(m4, -1))

	require.Nil(t, (<-ss.Team().ClearAllCustomRoleAssignments()).Err)

	r1 := <-ss.Team().GetMember(m1.TeamId, m1.UserId)
	require.Nil(t, r1.Err)
	assert.Equal(t, m1.ExplicitRoles, r1.Data.(*model.TeamMember).Roles)

	r2 := <-ss.Team().GetMember(m2.TeamId, m2.UserId)
	require.Nil(t, r2.Err)
	assert.Equal(t, "team_user team_admin", r2.Data.(*model.TeamMember).Roles)

	r3 := <-ss.Team().GetMember(m3.TeamId, m3.UserId)
	require.Nil(t, r3.Err)
	assert.Equal(t, m3.ExplicitRoles, r3.Data.(*model.TeamMember).Roles)

	r4 := <-ss.Team().GetMember(m4.TeamId, m4.UserId)
	require.Nil(t, r4.Err)
	assert.Equal(t, "", r4.Data.(*model.TeamMember).Roles)
}

func testTeamStoreAnalyticsGetTeamCountForScheme(t *testing.T, ss store.Store) {
	s1 := &model.Scheme{
		DisplayName: model.NewId(),
		Name:        model.NewId(),
		Description: model.NewId(),
		Scope:       model.SCHEME_SCOPE_TEAM,
	}
	s1 = (<-ss.Scheme().Save(s1)).Data.(*model.Scheme)

	count1 := (<-ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)).Data.(int64)
	assert.Equal(t, int64(0), count1)

	t1 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}
	_ = (<-ss.Team().Save(t1)).Data.(*model.Team)

	count2 := (<-ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)).Data.(int64)
	assert.Equal(t, int64(1), count2)

	t2 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
	}
	_ = (<-ss.Team().Save(t2)).Data.(*model.Team)

	count3 := (<-ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)).Data.(int64)
	assert.Equal(t, int64(2), count3)

	t3 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
	}
	_ = (<-ss.Team().Save(t3)).Data.(*model.Team)

	count4 := (<-ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)).Data.(int64)
	assert.Equal(t, int64(2), count4)

	t4 := &model.Team{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TEAM_OPEN,
		SchemeId:    &s1.Id,
		DeleteAt:    model.GetMillis(),
	}
	_ = (<-ss.Team().Save(t4)).Data.(*model.Team)

	count5 := (<-ss.Team().AnalyticsGetTeamCountForScheme(s1.Id)).Data.(int64)
	assert.Equal(t, int64(2), count5)
}

func testTeamStoreGetAllForExportAfter(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = model.NewId()
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&t1))

	r1 := <-ss.Team().GetAllForExportAfter(10000, strings.Repeat("0", 26))
	assert.Nil(t, r1.Err)
	d1 := r1.Data.([]*model.TeamForExport)

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
	t1.Name = model.NewId()
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	store.Must(ss.Team().Save(&t1))

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	store.Must(ss.User().Save(&u1))

	u2 := model.User{}
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	store.Must(ss.User().Save(&u2))

	m1 := &model.TeamMember{TeamId: t1.Id, UserId: u1.Id}
	store.Must(ss.Team().SaveMember(m1, -1))

	m2 := &model.TeamMember{TeamId: t1.Id, UserId: u2.Id}
	store.Must(ss.Team().SaveMember(m2, -1))

	r1 := <-ss.Team().GetTeamMembersForExport(u1.Id)
	assert.Nil(t, r1.Err)

	d1 := r1.Data.([]*model.TeamMemberForExport)
	assert.Len(t, d1, 1)

	tmfe1 := d1[0]
	assert.Equal(t, t1.Id, tmfe1.TeamId)
	assert.Equal(t, u1.Id, tmfe1.UserId)
	assert.Equal(t, t1.Name, tmfe1.TeamName)
}
