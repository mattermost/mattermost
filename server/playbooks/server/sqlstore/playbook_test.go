// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"sort"
	"strconv"
	"testing"

	"gopkg.in/guregu/null.v4"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost/server/v8/playbooks/server/sqlstore/mocks"
)

func membersFromIds(ids []string) []app.PlaybookMember {
	members := []app.PlaybookMember{}
	for _, id := range ids {
		members = append(members, app.PlaybookMember{
			UserID:      id,
			Roles:       []string{},
			SchemeRoles: []string{},
		})
	}

	return members
}

func newUserInfo() userInfo {
	id := model.NewId()
	return userInfo{
		ID:   id,
		Name: id,
	}
}

func multipleUserInfo(n int) []userInfo {
	list := make([]userInfo, 0, n)
	for i := 0; i < n; i++ {
		list = append(list, newUserInfo())
	}
	return list
}

func cleanMetricsIDs(metrics []app.PlaybookMetricConfig) {
	for i := range metrics {
		metrics[i].ID = ""
		metrics[i].PlaybookID = ""
	}
}

func metricsFromNames(names []string) []app.PlaybookMetricConfig {
	metrics := make([]app.PlaybookMetricConfig, len(names))
	types := []string{app.MetricTypeCurrency, app.MetricTypeDuration, app.MetricTypeInteger}

	for i := range names {
		metrics[i] = app.PlaybookMetricConfig{
			Title:       names[i],
			Description: "description: " + strconv.Itoa(i),
			Type:        types[i%len(types)],
			Target:      null.IntFrom(int64(i)),
		}
	}
	return metrics
}

func TestGetPlaybook(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()
	team3id := model.NewId()

	jon := userInfo{
		ID:   model.NewId(),
		Name: "jon",
	}

	andrew := userInfo{
		ID:   model.NewId(),
		Name: "Andrew",
	}

	matt := userInfo{
		ID:   model.NewId(),
		Name: "Matt",
	}

	lucia := userInfo{
		ID:   model.NewId(),
		Name: "Lucía",
	}

	desmond := userInfo{
		ID:   model.NewId(),
		Name: "Desmond",
	}

	pb01 := NewPBBuilder().
		WithTitle("playbook 1").
		WithDescription("this is a description, not very long, but it can be up to 4096 bytes").
		WithTeamID(team1id).
		WithCreateAt(500).
		WithChecklists([]int{1, 2}).
		WithMembers([]userInfo{jon, andrew, matt}).
		ToPlaybook()

	pb02 := NewPBBuilder().
		WithTitle("playbook 2").
		WithTeamID(team1id).
		WithCreateAt(600).
		WithCreatePublic(true).
		WithChecklists([]int{1, 4, 6, 7, 1}). // 19
		WithMembers([]userInfo{andrew, matt}).
		WithMetrics([]string{"name11", "name12"}).
		ToPlaybook()

	pb03 := NewPBBuilder().
		WithTitle("playbook 3").
		WithTeamID(team1id).
		WithChecklists([]int{1, 2, 3}).
		WithCreateAt(700).
		WithMembers([]userInfo{jon, matt, lucia}).
		WithMetrics([]string{"name14", "name12", "name13", "name11"}).
		ToPlaybook()

	pb04 := NewPBBuilder().
		WithTitle("playbook 4").
		WithDescription("this is a description, not very long, but it can be up to 2048 bytes").
		WithTeamID(team1id).
		WithCreateAt(800).
		WithChecklists([]int{20}).
		WithMembers([]userInfo{matt}).
		WithMetrics([]string{"name17"}).
		ToPlaybook()

	pb05 := NewPBBuilder().
		WithTitle("playbook 5").
		WithTeamID(team2id).
		WithCreateAt(1000).
		WithChecklists([]int{1}).
		WithMembers([]userInfo{jon, andrew}).
		WithMetrics([]string{"name21", "name22", "name20", "name24"}).
		ToPlaybook()

	pb06 := NewPBBuilder().
		WithTitle("playbook 6").
		WithTeamID(team2id).
		WithCreateAt(1100).
		WithChecklists([]int{1, 2, 3}).
		WithMembers([]userInfo{matt}).
		WithMetrics([]string{"name27", "name29"}).
		ToPlaybook()

	pb07 := NewPBBuilder().
		WithTitle("playbook 7").
		WithTeamID(team3id).
		WithCreateAt(1200).
		WithChecklists([]int{1}).
		WithMembers([]userInfo{andrew}).
		WithChannelNameTemplate("playbook XX").
		ToPlaybook()

	pb08 := NewPBBuilder().
		WithTitle("playbook 8 -- so many members, but should have Desmond and Lucy").
		WithTeamID(team3id).
		WithCreateAt(1300).
		WithChecklists([]int{1}).
		WithMembers(append(multipleUserInfo(100), desmond, lucia)).
		WithKeywords([]string{"keyword"}).
		WithChannelNameTemplate("playbook YY").
		ToPlaybook()

	playbooks := []app.Playbook{pb01, pb02, pb03, pb04, pb05, pb06, pb07, pb08}

	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookStore := setupPlaybookStore(t, db)

	t.Run(driverName+" - id empty", func(t *testing.T) {
		actual, err := playbookStore.Get("")
		require.Error(t, err)
		require.EqualError(t, err, "ID cannot be empty")
		require.Equal(t, app.Playbook{}, actual)
	})

	t.Run(driverName+" - create and retrieve playbook", func(t *testing.T) {
		id, err := playbookStore.Create(pb02)
		require.NoError(t, err)
		expected := pb02.Clone()
		expected.ID = id

		actual, err := playbookStore.Get(id)
		require.NoError(t, err)

		//check if playbookID was set correctly
		for _, m := range actual.Metrics {
			require.Equal(t, m.PlaybookID, id)
		}
		cleanMetricsIDs(actual.Metrics)
		require.Equal(t, expected, actual)
	})

	t.Run(driverName+" - create and retrieve all playbooks", func(t *testing.T) {
		var inserted []app.Playbook
		for _, p := range playbooks {
			id, err := playbookStore.Create(p)
			require.NoError(t, err)

			tmp := p.Clone()
			tmp.ID = id
			inserted = append(inserted, tmp)
		}

		for _, p := range inserted {
			got, err := playbookStore.Get(p.ID)
			cleanMetricsIDs(got.Metrics)
			require.NoError(t, err)
			require.Equal(t, p, got)
		}
		require.Equal(t, len(playbooks), len(inserted))
	})

	t.Run(driverName+" - create but retrieve non-existing playbook", func(t *testing.T) {
		_, err := playbookStore.Create(pb02)
		require.NoError(t, err)

		actual, err := playbookStore.Get("nonexisting")
		cleanMetricsIDs(actual.Metrics)
		require.Error(t, err)
		require.EqualError(t, err, "playbook does not exist for id 'nonexisting': not found")
		require.Equal(t, app.Playbook{}, actual)
	})

	t.Run(driverName+" - set and retrieve playbook with no members and no checklists", func(t *testing.T) {
		pb10 := NewPBBuilder().
			WithTitle("playbook 10").
			WithTeamID(team1id).
			WithCreateAt(800).
			ToPlaybook()
		id, err := playbookStore.Create(pb10)
		require.NoError(t, err)
		expected := pb10.Clone()
		expected.ID = id

		actual, err := playbookStore.Get(id)
		require.NoError(t, err)
		require.Equal(t, expected, actual)
	})
}

func TestGetPlaybooksForTeam(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()
	team3id := model.NewId()

	lucy := userInfo{
		ID:   model.NewId(),
		Name: "Lucy",
	}

	jon := userInfo{
		ID:   model.NewId(),
		Name: "jon",
	}

	andrew := userInfo{
		ID:   model.NewId(),
		Name: "Andrew",
	}

	matt := userInfo{
		ID:   model.NewId(),
		Name: "Matt",
	}

	lucia := userInfo{
		ID:   model.NewId(),
		Name: "Lucía",
	}

	bill := userInfo{
		ID:   model.NewId(),
		Name: "Bill",
	}

	jen := userInfo{
		ID:   model.NewId(),
		Name: "Jen",
	}

	desmond := userInfo{
		ID:   model.NewId(),
		Name: "Desmond",
	}

	jack := userInfo{
		ID:   model.NewId(),
		Name: "Jack",
	}

	users := []userInfo{jon, andrew, matt, lucia, bill, jen, desmond, jack}

	pb01 := NewPBBuilder().
		WithTitle("playbook 01").
		WithDescription("this is a description, not very long, but it can be up to 4096 bytes").
		WithTeamID(team1id).
		WithCreateAt(500).
		WithUpdateAt(0).
		WithChecklists([]int{1, 2}).
		WithMembers([]userInfo{jon, andrew, matt}).
		WithMetrics([]string{"name4", "name1", "name3"}).
		ToPlaybook()

	pb02 := NewPBBuilder().
		WithTitle("playbook 02").
		WithTeamID(team1id).
		WithCreateAt(600).
		WithUpdateAt(0).
		WithCreatePublic(true).
		WithChecklists([]int{1, 4, 6, 7, 1}). // 19
		WithMembers([]userInfo{andrew, matt}).
		WithMetrics([]string{"name4", "name1", "name3", "name5"}).
		ToPlaybook()

	pb03 := NewPBBuilder().
		WithTitle("playbook 03").
		WithTeamID(team1id).
		WithChecklists([]int{1, 2, 3}).
		WithCreateAt(700).
		WithUpdateAt(0).
		WithMembers([]userInfo{jon, matt, lucia}).
		WithMetrics([]string{"name3"}).
		ToPlaybook()

	pb04 := NewPBBuilder().
		WithTitle("playbook 04").
		WithDescription("this is a description, not very long, but it can be up to 2048 bytes").
		WithTeamID(team1id).
		WithCreateAt(800).
		WithUpdateAt(0).
		WithChecklists([]int{20}).
		WithMembers([]userInfo{matt}).
		ToPlaybook()

	pb05 := NewPBBuilder().
		WithTitle("playbook 05").
		WithTeamID(team2id).
		WithCreateAt(1000).
		WithUpdateAt(0).
		WithChecklists([]int{1}).
		WithMembers([]userInfo{jon, andrew}).
		ToPlaybook()

	pb06 := NewPBBuilder().
		WithTitle("playbook 06").
		WithTeamID(team2id).
		WithCreateAt(1100).
		WithUpdateAt(0).
		WithChecklists([]int{1, 2, 3}).
		WithMembers([]userInfo{matt}).
		ToPlaybook()

	pb07 := NewPBBuilder().
		WithTitle("playbook 07").
		WithTeamID(team3id).
		WithCreateAt(1200).
		WithUpdateAt(0).
		WithChecklists([]int{1}).
		WithMembers([]userInfo{andrew}).
		ToPlaybook()

	pb08 := NewPBBuilder().
		WithTitle("playbook 008 -- so many members, but should have Desmond and Lucy").
		WithTeamID(team3id).
		WithCreateAt(1300).
		WithUpdateAt(0).
		WithChecklists([]int{1}).
		WithMembers(append(multipleUserInfo(100), desmond, lucia)).
		WithChannelNameTemplate("playbook YY").
		ToPlaybook()

	pb09 := NewPBBuilder().
		WithTitle("playbook 09 -- all access").
		WithTeamID(team3id).
		WithCreateAt(1600).
		WithUpdateAt(0).
		WithChecklists([]int{1}).
		WithMembers([]userInfo{}).
		WithChannelNameTemplate("playbook XX").
		ToPlaybook()

	pb10 := NewPBBuilder().
		WithTitle("playbook 10").
		WithDescription("I'm archived").
		WithTeamID(team1id).
		WithCreateAt(1700).
		WithUpdateAt(0).
		WithDeleteAt(1701).
		WithChecklists([]int{1, 2}).
		WithMembers([]userInfo{jon, andrew, matt}).
		ToPlaybook()

	pb11 := NewPBBuilder().
		WithTitle("playbook 11").
		WithTeamID(team1id).
		WithCreateAt(1800).
		WithUpdateAt(0).
		WithCreatePublicPlaybook(true).
		WithMembers([]userInfo{jack}).
		ToPlaybook()

	playbooks := []app.Playbook{pb01, pb02, pb03, pb04, pb05, pb06, pb07, pb08, pb09, pb10, pb11}

	createPlaybooks := func(store app.PlaybookStore) {
		t.Helper()

		for _, p := range playbooks {
			_, err := store.Create(p)
			require.NoError(t, err)
		}
	}

	tests := []struct {
		name          string
		teamID        string
		requesterInfo app.RequesterInfo
		options       app.PlaybookFilterOptions
		expected      app.GetPlaybooksResults
		expectedErr   error
	}{
		{
			name:   "team1 from Andrew",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID: andrew.ID,
				TeamID: team1id,
			},
			options: app.PlaybookFilterOptions{
				Sort:    app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb01, pb02, pb11},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Andrew, with archived",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID: andrew.ID,
				TeamID: team1id,
			},
			options: app.PlaybookFilterOptions{
				Sort:         app.SortByCreateAt,
				Page:         0,
				PerPage:      1000,
				WithArchived: true,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb01, pb02, pb10, pb11},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from jon",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID: jon.ID,
				TeamID: team1id,
			},
			options: app.PlaybookFilterOptions{
				Sort:    app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb01, pb03, pb11},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from jon title desc",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID: jon.ID,
				TeamID: team1id,
			},
			options: app.PlaybookFilterOptions{
				Sort:      app.SortByTitle,
				Direction: app.DirectionDesc,
				Page:      0,
				PerPage:   1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb11, pb03, pb01},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from jon sort by stages desc",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID: jon.ID,
				TeamID: team1id,
			},
			options: app.PlaybookFilterOptions{
				Sort:      app.SortByStages,
				Direction: app.DirectionDesc,
				Page:      0,
				PerPage:   1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb03, pb01, pb11},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin, no special access",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:  lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort:    app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb03, pb11},
			},
			expectedErr: nil,
		},
		/*{
			name:   "team1 from Admin",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort: app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb01, pb02, pb03, pb04},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin, member only",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort: app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb03},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by steps desc",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort:      app.SortBySteps,
				Direction: app.DirectionDesc,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb04, pb02, pb03, pb01},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by title desc",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort:      app.SortByTitle,
				Direction: app.DirectionDesc,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb04, pb03, pb02, pb01},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by steps, default is asc",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort: app.SortBySteps,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb01, pb03, pb02, pb04},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by steps, specify asc",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort:      app.SortBySteps,
				Direction: app.DirectionAsc,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb01, pb03, pb02, pb04},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by steps, desc",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort:      app.SortBySteps,
				Direction: app.DirectionDesc,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb04, pb02, pb03, pb01},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by stages",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort: app.SortByStages,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb04, pb01, pb03, pb02},
			},
			expectedErr: nil,
		},
		{
			name:   "team1 from Admin sort by stages, desc",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort:      app.SortByStages,
				Direction: app.DirectionDesc,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb02, pb03, pb01, pb04},
			},
			expectedErr: nil,
		},*/
		{
			name:   "team2 from Matt",
			teamID: team2id,
			requesterInfo: app.RequesterInfo{
				UserID: matt.ID,
				TeamID: team2id,
			},
			options: app.PlaybookFilterOptions{
				Sort:    app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 1,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb06},
			},
			expectedErr: nil,
		},
		{
			name:   "team3 from Andrew (not on team)",
			teamID: team3id,
			requesterInfo: app.RequesterInfo{
				UserID: andrew.ID,
				TeamID: team3id,
			},
			options: app.PlaybookFilterOptions{
				Sort:    app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []app.Playbook{},
			},
			expectedErr: nil,
		},
		/*{
			name:   "team3 from Admin",
			teamID: team3id,
			requesterInfo: app.RequesterInfo{
				UserID:          lucia.ID,
				IsAdmin: true,
			},
			options: app.PlaybookFilterOptions{
				Sort: app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb07, pb08},
			},
			expectedErr: nil,
		},*/
		{
			name:   "team3 from Desmond - testing many members",
			teamID: team3id,
			requesterInfo: app.RequesterInfo{
				UserID: desmond.ID,
				TeamID: team3id,
			},
			options: app.PlaybookFilterOptions{
				Sort:    app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []app.Playbook{},
			},
			expectedErr: nil,
		},
		{
			name:   "none found",
			teamID: "not-existing",
			expected: app.GetPlaybooksResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      nil,
			},
			expectedErr: nil,
		},
		{
			name:   "all teams from Andrew",
			teamID: "",
			requesterInfo: app.RequesterInfo{
				UserID: andrew.ID,
				TeamID: "",
			},
			options: app.PlaybookFilterOptions{
				Sort:    app.SortByTitle,
				Page:    0,
				PerPage: 1000,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 4,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb01, pb02, pb05, pb11},
			},
			expectedErr: nil,
		},
		{
			name:   "playbooks Andrew is member of",
			teamID: team1id,
			requesterInfo: app.RequesterInfo{
				UserID: andrew.ID,
				TeamID: team1id,
			},
			options: app.PlaybookFilterOptions{
				Sort:               app.SortByTitle,
				Page:               0,
				PerPage:            1000,
				WithMembershipOnly: true,
			},
			expected: app.GetPlaybooksResults{
				TotalCount: 2,
				PageCount:  1,
				HasMore:    false,
				Items:      []app.Playbook{pb01, pb02},
			},
			expectedErr: nil,
		},
	}

	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookStore := setupPlaybookStore(t, db)

	t.Run(driverName+" - zero playbooks", func(t *testing.T) {
		result, err := playbookStore.GetPlaybooks()
		require.NoError(t, err)
		require.ElementsMatch(t, []app.Playbook{}, result)
	})

	store := setupSQLStore(t, db)
	setupTeamMembersTable(t, db)
	addUsers(t, store, users)
	addUsersToTeam(t, store, users, team1id)
	addUsersToTeam(t, store, users, team2id)
	makeAdmin(t, store, lucy)

	createPlaybooks(playbookStore)

	for _, testCase := range tests {
		t.Run(driverName+" - "+testCase.name, func(t *testing.T) {
			actual, err := playbookStore.GetPlaybooksForTeam(testCase.requesterInfo, testCase.teamID, testCase.options)

			if testCase.expectedErr != nil {
				require.Nil(t, actual)
				require.Error(t, err)
				require.Equal(t, testCase.expectedErr.Error(), err.Error())

				return
			}

			require.NoError(t, err)

			for i, p := range actual.Items {
				require.True(t, model.IsValidId(p.ID))
				actual.Items[i].ID = ""
				cleanMetricsIDs(actual.Items[i].Metrics)
				require.Equal(t, p.Metrics, testCase.expected.Items[i].Metrics)
			}

			// remove the checklists and members from the expected playbooks--we don't return them in getPlaybooks
			for i := range testCase.expected.Items {
				testCase.expected.Items[i].Checklists = nil
				testCase.expected.Items[i].Members = nil
			}

			require.ElementsMatch(t, justTitles(testCase.expected.Items), justTitles(actual.Items))
			require.Equal(t, testCase.expected.HasMore, actual.HasMore)
			require.Equal(t, testCase.expected.PageCount, actual.PageCount)
			require.Equal(t, testCase.expected.TotalCount, actual.TotalCount)
			require.Len(t, actual.Items, len(testCase.expected.Items))
		})
	}
}

func justTitles(playbooks []app.Playbook) []string {
	titles := []string{}
	for _, pb := range playbooks {
		titles = append(titles, pb.Title)
	}

	return titles
}

func TestUpdatePlaybook(t *testing.T) {
	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	alice := userInfo{
		ID:   model.NewId(),
		Name: "alice",
	}

	jon := userInfo{
		ID:   model.NewId(),
		Name: "jon",
	}

	andrew := userInfo{
		ID:   model.NewId(),
		Name: "Andrew",
	}

	matt := userInfo{
		ID:   model.NewId(),
		Name: "Matt",
	}

	bill := userInfo{
		ID:   model.NewId(),
		Name: "Bill",
	}

	jen := userInfo{
		ID:   model.NewId(),
		Name: "Jen",
	}

	db := setupTestDB(t)
	playbookStore := setupPlaybookStore(t, db)

	tests := []struct {
		name        string
		playbook    app.Playbook
		update      func(app.Playbook) app.Playbook
		expectedErr error
		clean       func(app.Playbook, app.Playbook) (app.Playbook, app.Playbook)
	}{
		{
			name:     "id should not be empty",
			playbook: NewPBBuilder().ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				return app.Playbook{}
			},
			expectedErr: errors.New("id should not be empty"),
		},
		{
			name:     "Playbook run /can/ contain checklists with no items",
			playbook: NewPBBuilder().WithChecklists([]int{1}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old.Checklists[0].Items = nil
				old.NumSteps = 0
				return old
			},
			expectedErr: nil,
		},
		{
			name:     "playbook now public",
			playbook: NewPBBuilder().WithChecklists([]int{1}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old.CreatePublicPlaybookRun = true
				return old
			},
			expectedErr: nil,
		},
		{
			name:     "playbook new title",
			playbook: NewPBBuilder().WithChecklists([]int{1}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old.Title = "new title"
				return old
			},
			expectedErr: nil,
		},
		{
			name: "playbook new description",
			playbook: NewPBBuilder().WithDescription("original description").
				WithChecklists([]int{1}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old.Description = "new description"
				return old
			},
			expectedErr: nil,
		},
		{
			name:     "delete playbook",
			playbook: NewPBBuilder().WithChecklists([]int{1}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old.DeleteAt = model.GetMillis()
				return old
			},
			expectedErr: nil,
		},
		{
			name:     "Playbook run with 2 checklists, update the checklists a bit",
			playbook: NewPBBuilder().WithChecklists([]int{1, 2}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old.Checklists[0].Items[0].State = app.ChecklistItemStateClosed
				old.Checklists[1].Items[1].Title = "new title"
				return old
			},
			expectedErr: nil,
		},
		{
			name:     "Playbook run with 3 checklists, update to 0",
			playbook: NewPBBuilder().WithChecklists([]int{1, 2, 5}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old.Checklists = []app.Checklist{}
				old.NumSteps = 0
				old.NumStages = 0
				return old
			},
			expectedErr: nil,
		},
		{
			name: "Playbook run with 2 members, go to 1",
			playbook: NewPBBuilder().WithChecklists([]int{1, 2}).
				WithMembers([]userInfo{jon, andrew}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old.Members = membersFromIds([]string{andrew.ID})
				return old
			},
			expectedErr: nil,
		},
		{
			name: "Playbook run with 3 members, go to 4 with different members",
			playbook: NewPBBuilder().WithChecklists([]int{1, 2}).
				WithMembers([]userInfo{jon, andrew, bob}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				oldMembers := []string{matt.ID, bill.ID, alice.ID, jen.ID}
				sort.Strings(oldMembers)
				old.Members = membersFromIds(oldMembers)
				return old
			},
			expectedErr: nil,
		},
		{
			name: "Playbook run with 3 members, go to 4 with one different member",
			playbook: NewPBBuilder().WithChecklists([]int{1, 2}).
				WithMembers([]userInfo{jon, andrew, bob}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				oldMembers := []string{jon.ID, andrew.ID, bob.ID, alice.ID}
				sort.Strings(oldMembers)
				old.Members = membersFromIds(oldMembers)
				return old
			},
			expectedErr: nil,
		},
		{
			name:     "Playbook run with 0 members, go to 2",
			playbook: NewPBBuilder().WithChecklists([]int{1, 2}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				oldMembers := []string{alice.ID, jen.ID}
				sort.Strings(oldMembers)
				old.Members = membersFromIds(oldMembers)
				return old
			},
			expectedErr: nil,
		},
		{
			name: "Playbook run with 5 members, go to 0",
			playbook: NewPBBuilder().
				WithChecklists([]int{1, 2}).
				WithMembers([]userInfo{
					jon,
					andrew,
					{model.NewId(), "j1"},
					{model.NewId(), "j2"},
					{model.NewId(), "j3"},
				}).
				ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old.Members = nil
				return old
			},
			expectedErr: nil,
		},
		{
			name:     "playbook with 0 metrics, go to 3",
			playbook: NewPBBuilder().ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old, err := playbookStore.Get(old.ID)
				require.NoError(t, err)
				old.Title = "new title"
				old.Metrics = metricsFromNames([]string{"name3", "name1", "name2"})
				return old
			},
			expectedErr: nil,
			clean: func(old, updated app.Playbook) (app.Playbook, app.Playbook) {
				cleanMetricsIDs(updated.Metrics)
				return old, updated
			},
		},
		{
			name:     "playbook with 4 metrics, go to 0",
			playbook: NewPBBuilder().WithMetrics([]string{"name3", "name1", "name2", "name4"}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old, err := playbookStore.Get(old.ID)
				require.NoError(t, err)
				old.Title = "new title"
				old.Metrics = nil
				return old
			},
			expectedErr: nil,
		},
		{
			name:     "playbook with 4 metrics, go to 3 and reorder",
			playbook: NewPBBuilder().WithMetrics([]string{"name3", "name1", "name2", "name4"}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old, err := playbookStore.Get(old.ID)
				require.NoError(t, err)

				old.Title = "new title"
				old.Metrics = old.Metrics[1:]
				old.Metrics[0], old.Metrics[1] = old.Metrics[1], old.Metrics[0]
				return old
			},
			expectedErr: nil,
		},
		{
			name:     "playbook with 4 metrics, go to 3. reorder and replacement",
			playbook: NewPBBuilder().WithMetrics([]string{"name3", "name1", "name2", "name4"}).ToPlaybook(),
			update: func(old app.Playbook) app.Playbook {
				old, err := playbookStore.Get(old.ID)
				require.NoError(t, err)

				old.Title = "new title"
				old.Metrics = old.Metrics[2:]
				old.Metrics[0], old.Metrics[1] = old.Metrics[1], old.Metrics[0]
				old.Metrics = append(old.Metrics, metricsFromNames([]string{"name10"})...)
				return old
			},
			expectedErr: nil,
			clean: func(old, updated app.Playbook) (app.Playbook, app.Playbook) {
				cleanMetricsIDs(old.Metrics)
				cleanMetricsIDs(updated.Metrics)
				return old, updated
			},
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			returned, err := playbookStore.Create(testCase.playbook)
			testCase.playbook.ID = returned
			require.NoError(t, err)
			expected := testCase.update(testCase.playbook)

			err = playbookStore.Update(expected)

			if testCase.expectedErr != nil {
				require.Error(t, err)
				require.EqualError(t, err, testCase.expectedErr.Error())
				return
			}

			require.NoError(t, err)

			actual, err := playbookStore.Get(expected.ID)
			require.NoError(t, err)
			if testCase.clean != nil {
				expected, actual = testCase.clean(expected, actual)
			}
			require.Equal(t, expected, actual)
		})
	}
}

func TestDeletePlaybook(t *testing.T) {
	team1id := model.NewId()

	andrew := userInfo{
		ID:   model.NewId(),
		Name: "Andrew",
	}

	matt := userInfo{
		ID:   model.NewId(),
		Name: "Matt",
	}

	pb02 := NewPBBuilder().
		WithTitle("playbook 2").
		WithTeamID(team1id).
		WithCreateAt(600).
		WithCreatePublic(true).
		WithChecklists([]int{1, 4, 6, 7, 1}). // 19
		WithMembers([]userInfo{andrew, matt}).
		WithMetrics([]string{"name1", "name2"}).
		ToPlaybook()

	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookStore := setupPlaybookStore(t, db)

	t.Run(driverName+" - id empty", func(t *testing.T) {
		err := playbookStore.Archive("")
		require.Error(t, err)
		require.EqualError(t, err, "ID cannot be empty")
	})

	t.Run(driverName+" - create and delete playbook", func(t *testing.T) {
		now := model.GetMillis()

		id, err := playbookStore.Create(pb02)
		require.NoError(t, err)
		expected := pb02.Clone()
		expected.ID = id

		err = playbookStore.Archive(id)
		require.NoError(t, err)

		actual, err := playbookStore.Get(id)
		require.NoError(t, err)
		require.GreaterOrEqual(t, actual.DeleteAt, now)

		expected.DeleteAt = actual.DeleteAt
		cleanMetricsIDs(actual.Metrics)
		require.Equal(t, expected, actual)
	})
}

func TestGetPlaybooksForKeywords(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()
	team3id := model.NewId()

	pb01 := NewPBBuilder().
		WithTitle("playbook 1").
		WithTeamID(team1id).
		WithKeywords([]string{"one", "two", "three"}).
		ToPlaybook()

	pb02 := NewPBBuilder().
		WithTitle("playbook 2").
		WithTeamID(team1id).
		WithKeywords([]string{"one", "two"}).
		ToPlaybook()

	pb03 := NewPBBuilder().
		WithTitle("playbook 3").
		WithTeamID(team1id).
		WithKeywords([]string{"one"}).
		ToPlaybook()

	pb04 := NewPBBuilder().
		WithTitle("playbook 4").
		WithTeamID(team1id).
		ToPlaybook()

	pb05 := NewPBBuilder().
		WithTitle("playbook 5").
		WithTeamID(team2id).
		ToPlaybook()

	pb06 := NewPBBuilder().
		WithTitle("playbook 6").
		WithTeamID(team2id).
		ToPlaybook()

	pb07 := NewPBBuilder().
		WithTitle("playbook 7").
		WithTeamID(team3id).
		ToPlaybook()

	pb08 := NewPBBuilder().
		WithTitle("playbook 8").
		WithTeamID(team3id).
		ToPlaybook()

	pb09 := NewPBBuilder().
		WithTitle("playbook 9").
		WithTeamID(team3id).
		WithKeywords([]string{"other", "keywords"}).
		ToPlaybook()

	pb := []app.Playbook{pb01, pb02, pb03, pb04, pb05, pb06, pb07, pb08, pb09}

	createPlaybooks := func(store app.PlaybookStore) {
		t.Helper()

		for _, p := range pb {
			_, err := store.Create(p)
			require.NoError(t, err)
		}
	}

	expected := []app.Playbook{pb01, pb02, pb03, pb09}
	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookStore := setupPlaybookStore(t, db)

	t.Run("zero playbooks", func(t *testing.T) {
		result, err := playbookStore.GetPlaybooks()
		require.NoError(t, err)
		require.ElementsMatch(t, []app.Playbook{}, result)
	})

	createPlaybooks(playbookStore)

	t.Run(driverName+" - get playbooks with keywords", func(t *testing.T) {
		actual, err := playbookStore.GetPlaybooksWithKeywords(app.PlaybookFilterOptions{Page: 0, PerPage: 100})
		sort.Slice(actual, func(i, j int) bool { return actual[i].Title < actual[j].Title })

		require.NoError(t, err)
		require.Len(t, actual, len(expected))
		for i := range actual {
			require.Equal(t, expected[i].TeamID, actual[i].TeamID)
			require.Equal(t, expected[i].Title, actual[i].Title)
			require.Equal(t, expected[i].SignalAnyKeywords, actual[i].SignalAnyKeywords)
		}
	})
}

func TestGetTimeLastUpdated(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()
	team3id := model.NewId()

	pb01 := NewPBBuilder().
		WithTitle("playbook 1").
		WithTeamID(team1id).
		WithKeywords([]string{"one", "two", "three"}).
		WithUpdateAt(400).
		ToPlaybook()

	pb02 := NewPBBuilder().
		WithTitle("playbook 2").
		WithTeamID(team1id).
		WithUpdateAt(500).
		WithKeywords([]string{"one", "two"}).
		ToPlaybook()

	pb03 := NewPBBuilder().
		WithTitle("playbook 3").
		WithTeamID(team2id).
		WithUpdateAt(450).
		ToPlaybook()

	pb04 := NewPBBuilder().
		WithTitle("playbook 4").
		WithTeamID(team3id).
		WithUpdateAt(600).
		WithKeywords([]string{"one"}).
		ToPlaybook()

	pb05 := NewPBBuilder().
		WithTitle("playbook 5").
		WithTeamID(team3id).
		WithUpdateAt(700).
		ToPlaybook()

	pb := []app.Playbook{pb01, pb02, pb03, pb04, pb05}

	createPlaybooks := func(store app.PlaybookStore) {
		t.Helper()

		for _, p := range pb {
			_, err := store.Create(p)
			require.NoError(t, err)
		}
	}

	expected := int64(600)
	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookStore := setupPlaybookStore(t, db)

	t.Run("zero playbooks", func(t *testing.T) {
		result, err := playbookStore.GetPlaybooks()
		require.NoError(t, err)
		require.ElementsMatch(t, []app.Playbook{}, result)

		lastUpdated, err := playbookStore.GetTimeLastUpdated(true)
		require.NoError(t, err)
		require.Equal(t, int64(0), lastUpdated)
	})

	createPlaybooks(playbookStore)

	t.Run(driverName+" - get time last updated", func(t *testing.T) {
		actual, err := playbookStore.GetTimeLastUpdated(true)

		require.NoError(t, err)
		require.Equal(t, expected, actual)
	})
}

func TestGetPlaybookIDsForUser(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()
	team3id := model.NewId()

	lucy := userInfo{
		ID:   model.NewId(),
		Name: "Lucy",
	}

	jon := userInfo{
		ID:   model.NewId(),
		Name: "jon",
	}

	andrew := userInfo{
		ID:   model.NewId(),
		Name: "Andrew",
	}

	matt := userInfo{
		ID:   model.NewId(),
		Name: "Matt",
	}

	lucia := userInfo{
		ID:   model.NewId(),
		Name: "Lucía",
	}

	bill := userInfo{
		ID:   model.NewId(),
		Name: "Bill",
	}

	jen := userInfo{
		ID:   model.NewId(),
		Name: "Jen",
	}

	desmond := userInfo{
		ID:   model.NewId(),
		Name: "Desmond",
	}

	users := []userInfo{jon, andrew, matt, lucia, bill, jen, desmond, lucy}

	pb01 := NewPBBuilder().
		WithTeamID(team1id).
		WithMembers([]userInfo{jon, andrew, matt}).
		ToPlaybook()

	pb02 := NewPBBuilder().
		WithTeamID(team1id).
		WithMembers([]userInfo{andrew, matt}).
		ToPlaybook()

	pb03 := NewPBBuilder().
		WithTeamID(team1id).
		WithMembers([]userInfo{jon, matt, lucia}).
		ToPlaybook()

	pb04 := NewPBBuilder().
		WithTeamID(team1id).
		WithMembers([]userInfo{matt}).
		ToPlaybook()

	pb05 := NewPBBuilder().
		WithTeamID(team2id).
		WithMembers([]userInfo{jon, andrew}).
		ToPlaybook()

	pb06 := NewPBBuilder().
		WithTeamID(team2id).
		WithMembers([]userInfo{matt}).
		ToPlaybook()

	pb07 := NewPBBuilder().
		WithTeamID(team3id).
		WithMembers([]userInfo{andrew}).
		ToPlaybook()

	pb08 := NewPBBuilder().
		WithTeamID(team3id).
		WithMembers(append(multipleUserInfo(100), desmond, lucia)).
		ToPlaybook()

	pb09 := NewPBBuilder().
		WithTeamID(team3id).
		WithMembers([]userInfo{}).
		ToPlaybook()

	pb := []app.Playbook{pb01, pb02, pb03, pb04, pb05, pb06, pb07, pb08, pb09}

	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookStore := setupPlaybookStore(t, db)

	t.Run("zero playbooks", func(t *testing.T) {
		result, err := playbookStore.GetPlaybooks()
		require.NoError(t, err)
		require.ElementsMatch(t, []app.Playbook{}, result)
	})

	store := setupSQLStore(t, db)
	setupTeamMembersTable(t, db)
	addUsers(t, store, users)

	t.Helper()

	for i := range pb {
		id, err := playbookStore.Create(pb[i])
		pb[i].ID = id
		require.NoError(t, err)
	}

	tests := []struct {
		name        string
		teamID      string
		userID      string
		expected    []string
		expectedErr error
	}{
		{
			name:        "team1 from Andrew",
			teamID:      team1id,
			userID:      andrew.ID,
			expected:    []string{pb[0].ID, pb[1].ID},
			expectedErr: nil,
		},
		{
			name:        "team1 from jon",
			teamID:      team1id,
			userID:      jon.ID,
			expected:    []string{pb[0].ID, pb[2].ID},
			expectedErr: nil,
		},
		{
			name:        "team1 from lucia",
			teamID:      team1id,
			userID:      lucia.ID,
			expected:    []string{pb[2].ID},
			expectedErr: nil,
		},
		{
			name:        "team2 from Matt",
			teamID:      team2id,
			userID:      matt.ID,
			expected:    []string{pb[5].ID},
			expectedErr: nil,
		},
		{
			name:        "team3 from Andrew (not on team)",
			teamID:      team3id,
			userID:      andrew.ID,
			expected:    []string{pb[6].ID, pb[8].ID},
			expectedErr: nil,
		},
		{
			name:        "team3 from Lucia",
			teamID:      team3id,
			userID:      lucia.ID,
			expected:    []string{pb[7].ID, pb[8].ID},
			expectedErr: nil,
		},
		{
			name:        "team3 from Desmond - testing many members",
			teamID:      team3id,
			userID:      desmond.ID,
			expected:    []string{pb[7].ID, pb[8].ID},
			expectedErr: nil,
		},
		{
			name:        "none found",
			teamID:      "not-existing",
			userID:      matt.ID,
			expected:    []string{},
			expectedErr: nil,
		},
		{
			name:        "team3 from Matt",
			teamID:      team3id,
			userID:      matt.ID,
			expected:    []string{pb[8].ID},
			expectedErr: nil,
		},
	}

	for _, testCase := range tests {
		t.Run(driverName+" - "+testCase.name, func(t *testing.T) {
			actual, err := playbookStore.GetPlaybookIDsForUser(testCase.userID, testCase.teamID)

			if testCase.expectedErr != nil {
				require.Nil(t, actual)
				require.Error(t, err)
				require.Equal(t, testCase.expectedErr.Error(), err.Error())

				return
			}

			require.NoError(t, err)
			require.ElementsMatch(t, testCase.expected, actual)
		})
	}

	for i := range pb {
		pb[i].ID = ""
	}
}

func TestGetPlaybooksActiveTotal(t *testing.T) {
	teamIDs := []string{model.NewId(), model.NewId(), model.NewId()}

	createPlaybooks := func(store app.PlaybookStore, num int) []string {
		t.Helper()
		playbooksIDs := make([]string, num)

		for i := range playbooksIDs {
			pb := NewPBBuilder().
				WithTitle(fmt.Sprintf("playbook %d", i)).
				WithTeamID(teamIDs[i%len(teamIDs)]).
				WithUpdateAt(int64(i * 100)).
				ToPlaybook()

			id, err := store.Create(pb)
			require.NoError(t, err)
			playbooksIDs[i] = id
		}
		return playbooksIDs
	}

	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookStore := setupPlaybookStore(t, db)

	t.Run("zero playbooks", func(t *testing.T) {
		actual, err := playbookStore.GetPlaybooksActiveTotal()
		require.NoError(t, err)
		require.Equal(t, int64(0), actual)
	})

	playbooksNum := 20
	playbooksIDs := createPlaybooks(playbookStore, playbooksNum)

	t.Run(driverName+" - only active playbooks", func(t *testing.T) {
		actual, err := playbookStore.GetPlaybooksActiveTotal()

		require.NoError(t, err)
		require.Equal(t, int64(playbooksNum), actual)
	})

	// archive 1/3 of playbooks
	for i := 0; i < playbooksNum/3; i++ {
		err := playbookStore.Archive(playbooksIDs[i])
		require.NoError(t, err)
	}

	t.Run(driverName+" - both active and archived playbooks", func(t *testing.T) {
		actual, err := playbookStore.GetPlaybooksActiveTotal()

		require.NoError(t, err)
		require.Equal(t, int64(playbooksNum-playbooksNum/3), actual)
	})
}

// PlaybookBuilder is a utility to build playbooks with a default base.
// Use it as:
// NewBuilder.WithName("name").WithXYZ(xyz)....ToPlaybook()
type PlaybookBuilder struct {
	*app.Playbook
}

func NewPBBuilder() *PlaybookBuilder {
	timeNow := model.GetMillis()
	return &PlaybookBuilder{
		&app.Playbook{
			Title:                     "base playbook",
			TeamID:                    model.NewId(),
			CreatePublicPlaybookRun:   false,
			CreateAt:                  model.GetMillis(),
			UpdateAt:                  timeNow,
			DeleteAt:                  0,
			Checklists:                []app.Checklist(nil),
			Members:                   []app.PlaybookMember(nil),
			InvitedUserIDs:            []string(nil),
			InvitedGroupIDs:           []string(nil),
			NumActions:                1, // Channel creation is always on
			DefaultPlaybookAdminRole:  app.PlaybookRoleAdmin,
			DefaultPlaybookMemberRole: app.PlaybookRoleMember,
			DefaultRunAdminRole:       app.RunRoleAdmin,
			DefaultRunMemberRole:      app.RunRoleMember,
		},
	}
}

func (p *PlaybookBuilder) WithID() *PlaybookBuilder {
	p.ID = model.NewId()

	return p
}

func (p *PlaybookBuilder) WithTitle(title string) *PlaybookBuilder {
	p.Title = title

	return p
}

func (p *PlaybookBuilder) WithDescription(desc string) *PlaybookBuilder {
	p.Description = desc

	return p
}

func (p *PlaybookBuilder) WithTeamID(id string) *PlaybookBuilder {
	p.TeamID = id

	return p
}

func (p *PlaybookBuilder) WithCreatePublic(public bool) *PlaybookBuilder {
	p.CreatePublicPlaybookRun = public

	return p
}

func (p *PlaybookBuilder) WithCreatePublicPlaybook(public bool) *PlaybookBuilder {
	p.Public = public

	return p
}

func (p *PlaybookBuilder) WithCreateAt(createAt int64) *PlaybookBuilder {
	p.CreateAt = createAt

	return p
}

func (p *PlaybookBuilder) WithDeleteAt(deleteAt int64) *PlaybookBuilder {
	p.DeleteAt = deleteAt

	return p
}

func (p *PlaybookBuilder) WithChecklists(itemsPerChecklist []int) *PlaybookBuilder {
	p.Checklists = make([]app.Checklist, len(itemsPerChecklist))

	for i, numItems := range itemsPerChecklist {
		var items []app.ChecklistItem
		for j := 0; j < numItems; j++ {
			items = append(items, app.ChecklistItem{
				ID:    model.NewId(),
				Title: fmt.Sprint("Checklist ", i, " - item ", j),
			})
		}

		p.Checklists[i] = app.Checklist{
			ID:    model.NewId(),
			Title: fmt.Sprint("Checklist ", i),
			Items: items,
		}
	}

	p.NumStages = int64(len(itemsPerChecklist))
	p.NumSteps = sum(itemsPerChecklist)

	return p
}

func (p *PlaybookBuilder) WithChannelNameTemplate(channelNameTemplate string) *PlaybookBuilder {
	p.ChannelNameTemplate = channelNameTemplate

	return p
}

func sum(nums []int) int64 {
	ret := 0
	for _, n := range nums {
		ret += n
	}
	return int64(ret)
}

func (p *PlaybookBuilder) WithMembers(members []userInfo) *PlaybookBuilder {
	memberIDs := make([]string, len(members))

	for i, member := range members {
		memberIDs[i] = member.ID
	}
	sort.Strings(memberIDs)

	p.Members = membersFromIds(memberIDs)

	if len(members) == 0 {
		p.Public = true
	}

	return p
}

func (p *PlaybookBuilder) WithKeywords(keywords []string) *PlaybookBuilder {
	p.SignalAnyKeywordsEnabled = true
	p.SignalAnyKeywords = keywords
	p.NumActions++

	return p
}

func (p *PlaybookBuilder) WithUpdateAt(updateAt int64) *PlaybookBuilder {
	p.UpdateAt = updateAt

	return p
}

func (p *PlaybookBuilder) WithMetrics(names []string) *PlaybookBuilder {
	if len(names) == 0 {
		return p
	}
	p.Metrics = metricsFromNames(names)

	return p
}

func (p *PlaybookBuilder) ToPlaybook() app.Playbook {
	return *p.Playbook
}

func setupPlaybookStore(t *testing.T, db *sqlx.DB) app.PlaybookStore {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	sqlStore := setupSQLStore(t, db)

	return NewPlaybookStore(pluginAPIClient, sqlStore)
}

func TestGetTopPlaybooks(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()

	jon := userInfo{
		ID:   model.NewId(),
		Name: "jon",
	}

	matt := userInfo{
		ID:   model.NewId(),
		Name: "Matt",
	}

	desmond := userInfo{
		ID:   model.NewId(),
		Name: "Desmond",
	}

	pb01 := NewPBBuilder().
		WithTitle("playbook 1").
		WithDescription("this is a description, not very long, but it can be up to 4096 bytes").
		WithTeamID(team1id).
		WithCreateAt(500).
		WithChecklists([]int{1, 2}).
		WithMembers([]userInfo{jon, matt, desmond}).
		ToPlaybook()

	pb02 := NewPBBuilder().
		WithTitle("playbook 2").
		WithTeamID(team1id).
		WithCreateAt(600).
		WithChecklists([]int{1, 4, 6, 7, 1}). // 19
		WithMembers([]userInfo{matt}).
		WithMetrics([]string{"name11", "name12"}).
		ToPlaybook()

	pb03 := NewPBBuilder().
		WithTitle("playbook 3").
		WithTeamID(team2id).
		WithChecklists([]int{1, 2, 3}).
		WithCreateAt(700).
		WithMembers([]userInfo{jon, matt}).
		WithMetrics([]string{"name14", "name12", "name13", "name11"}).
		ToPlaybook()

	pb04 := NewPBBuilder().
		WithTitle("playbook 4").
		WithDescription("this is a description, not very long, but it can be up to 2048 bytes").
		WithTeamID(team1id).
		WithCreateAt(800).
		WithChecklists([]int{20}).
		WithMembers([]userInfo{matt}).
		WithCreatePublicPlaybook(true).
		WithMetrics([]string{"name17"}).
		ToPlaybook()

	playbooks := []app.Playbook{pb01, pb02, pb03, pb04}

	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookStore := setupPlaybookStore(t, db)
	playbookRunStore := setupPlaybookRunStore(t, db)

	// create playbooks
	createPlaybooks := func(store app.PlaybookStore) {
		t.Helper()

		for index, p := range playbooks {
			p.ID = ""
			playbookCreatedID, err := store.Create(p)
			playbooks[index].ID = playbookCreatedID
			require.NoError(t, err)
		}
	}
	createPlaybooks(playbookStore)
	playbookRuns := []*app.PlaybookRun{
		NewBuilder(t).WithName("pb01-0").WithPlaybookID(playbooks[0].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb01-1").WithPlaybookID(playbooks[0].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb01-2").WithPlaybookID(playbooks[0].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb01-3").WithPlaybookID(playbooks[0].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb02-0").WithPlaybookID(playbooks[1].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb02-1").WithPlaybookID(playbooks[1].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb02-2").WithPlaybookID(playbooks[1].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb02-3").WithPlaybookID(playbooks[1].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb02-4").WithPlaybookID(playbooks[1].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb02-5").WithPlaybookID(playbooks[1].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb03-0").WithPlaybookID(playbooks[2].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb03-1").WithPlaybookID(playbooks[2].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb03-2").WithPlaybookID(playbooks[2].ID).WithCreateAt(200).ToPlaybookRun(),
		NewBuilder(t).WithName("pb04-0").WithPlaybookID(playbooks[3].ID).WithCreateAt(400).ToPlaybookRun(),
		NewBuilder(t).WithName("pb04-1").WithPlaybookID(playbooks[3].ID).WithCreateAt(400).ToPlaybookRun(),
	}
	// create playbook runs
	for _, playbookRun := range playbookRuns {
		_, err := playbookRunStore.CreatePlaybookRun(playbookRun)
		require.NoError(t, err)
	}

	t.Run(driverName+" - get top team playbooks", func(t *testing.T) {
		// for jon
		topPlaybooks, err := playbookStore.GetTopPlaybooksForTeam(team1id, jon.ID, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 100})
		require.NoError(t, err)
		// should get top playbooks as pb01.ID, and pb04.ID
		// implicitly means there's no playbooks from other team
		require.Len(t, topPlaybooks.Items, 2)

		require.Equal(t, topPlaybooks.Items[0].NumRuns, 4)
		require.Equal(t, topPlaybooks.Items[0].PlaybookID, playbooks[0].ID)
		require.Equal(t, topPlaybooks.Items[1].NumRuns, 2)
		require.Equal(t, topPlaybooks.Items[1].PlaybookID, playbooks[3].ID)

		// for matt
		topPlaybooks, err = playbookStore.GetTopPlaybooksForTeam(team1id, matt.ID, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 100})
		require.NoError(t, err)
		// should get top playbooks as pb01.ID, pb02.ID and pb04.ID
		// implicitly means there's no playbooks from other team
		require.Len(t, topPlaybooks.Items, 3)
		require.Equal(t, topPlaybooks.Items[0].NumRuns, 6)
		require.Equal(t, topPlaybooks.Items[0].PlaybookID, playbooks[1].ID)
		require.Equal(t, topPlaybooks.Items[1].NumRuns, 4)
		require.Equal(t, topPlaybooks.Items[1].PlaybookID, playbooks[0].ID)
		require.Equal(t, topPlaybooks.Items[2].NumRuns, 2)
		require.Equal(t, topPlaybooks.Items[2].PlaybookID, playbooks[3].ID)
	})

	t.Run(driverName+" - get top user playbooks", func(t *testing.T) {
		// for jon
		topPlaybooks, err := playbookStore.GetTopPlaybooksForUser(team1id, jon.ID, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 100})
		require.NoError(t, err)
		// should get top playbooks as pb01.ID, and pb04.ID
		// implicitly means there's no playbooks from other team
		require.Len(t, topPlaybooks.Items, 1)
		// fmt.Println(topPlaybooks.Items)
		require.Equal(t, topPlaybooks.Items[0].NumRuns, 4)
		require.Equal(t, topPlaybooks.Items[0].PlaybookID, playbooks[0].ID)

		// for team 2
		topPlaybooks, err = playbookStore.GetTopPlaybooksForUser(team2id, jon.ID, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 100})
		require.NoError(t, err)
		// should get top playbooks as pb01.ID, and pb04.ID
		// implicitly means there's no playbooks from other team
		require.Len(t, topPlaybooks.Items, 1)
		// fmt.Println(topPlaybooks.Items)
		require.Equal(t, topPlaybooks.Items[0].NumRuns, 3)
		require.Equal(t, topPlaybooks.Items[0].PlaybookID, playbooks[2].ID)

		// for matt
		topPlaybooks, err = playbookStore.GetTopPlaybooksForUser(team1id, matt.ID, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 100})
		require.NoError(t, err)
		// should get top playbooks as pb01.ID, and pb04.ID
		// implicitly means there's no playbooks from other team
		require.Len(t, topPlaybooks.Items, 3)
		require.Equal(t, topPlaybooks.Items[0].NumRuns, 6)
		require.Equal(t, topPlaybooks.Items[0].PlaybookID, playbooks[1].ID)
		require.Equal(t, topPlaybooks.Items[1].NumRuns, 4)
		require.Equal(t, topPlaybooks.Items[1].PlaybookID, playbooks[0].ID)
		require.Equal(t, topPlaybooks.Items[2].NumRuns, 2)
		require.Equal(t, topPlaybooks.Items[2].PlaybookID, playbooks[3].ID)
	})
}
