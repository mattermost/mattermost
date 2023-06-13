// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/guregu/null.v4"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost/server/v8/playbooks/server/sqlstore/mocks"
)

func setupStatsStore(t *testing.T, db *sqlx.DB) *StatsStore {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	sqlStore := setupSQLStore(t, db)

	return NewStatsStore(pluginAPIClient, sqlStore)
}

func TestTotalInProgressPlaybookRuns(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()

	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	lucy := userInfo{
		ID:   model.NewId(),
		Name: "Lucy",
	}

	john := userInfo{
		ID:   model.NewId(),
		Name: "john",
	}

	jane := userInfo{
		ID:   model.NewId(),
		Name: "jane",
	}

	phil := userInfo{
		ID:   model.NewId(),
		Name: "phil",
	}

	quincy := userInfo{
		ID:   model.NewId(),
		Name: "quincy",
	}

	notInvolved := userInfo{
		ID:   model.NewId(),
		Name: "notinvolved",
	}

	bot1 := userInfo{
		ID:   model.NewId(),
		Name: "Mr. Bot",
	}

	bot2 := userInfo{
		ID:   model.NewId(),
		Name: "Mrs. Bot",
	}

	channel01 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 123, DeleteAt: 0}
	channel02 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 199, DeleteAt: 0}
	channel03 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 222, DeleteAt: 0}
	channel04 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel05 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel06 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel07 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel08 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	channel09 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}

	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookRunStore := setupPlaybookRunStore(t, db)
	statsStore := setupStatsStore(t, db)

	store := setupSQLStore(t, db)
	setupTeamMembersTable(t, db)
	setupChannelMembersTable(t, db)
	setupChannelMemberHistoryTable(t, db)
	setupChannelsTable(t, db)

	addUsers(t, store, []userInfo{lucy, bob, john, jane, notInvolved, phil, quincy, bot1, bot2})
	addBots(t, store, []userInfo{bot1, bot2})
	addUsersToTeam(t, store, []userInfo{lucy, bob, john, jane, notInvolved, phil, quincy, bot1, bot2}, team1id)
	addUsersToTeam(t, store, []userInfo{lucy, bob, john, jane, notInvolved, phil, quincy, bot1, bot2}, team2id)
	createChannels(t, store, []model.Channel{channel01, channel02, channel03, channel04, channel05, channel06, channel07, channel08, channel09})
	makeAdmin(t, store, bob)

	inc01 := *NewBuilder(nil).
		WithName("pr 1 - wheel cat aliens wheelbarrow").
		WithChannel(&channel01).
		WithTeamID(team1id).
		WithCurrentStatus(app.StatusInProgress).
		WithCreateAt(123).
		WithPlaybookID("playbook1").
		ToPlaybookRun()

	inc02 := *NewBuilder(nil).
		WithName("pr 2").
		WithChannel(&channel02).
		WithTeamID(team1id).
		WithCurrentStatus(app.StatusInProgress).
		WithCreateAt(123).
		WithPlaybookID("playbook1").
		ToPlaybookRun()

	inc03 := *NewBuilder(nil).
		WithName("pr 3").
		WithChannel(&channel03).
		WithTeamID(team1id).
		WithCurrentStatus(app.StatusFinished).
		WithPlaybookID("playbook2").
		WithCreateAt(123).
		ToPlaybookRun()

	inc04 := *NewBuilder(nil).
		WithName("pr 4").
		WithChannel(&channel04).
		WithTeamID(team2id).
		WithCurrentStatus(app.StatusInProgress).
		WithPlaybookID("playbook1").
		WithCreateAt(123).
		ToPlaybookRun()

	inc05 := *NewBuilder(nil).
		WithName("pr 5").
		WithChannel(&channel05).
		WithTeamID(team2id).
		WithCurrentStatus(app.StatusInProgress).
		WithPlaybookID("playbook2").
		WithCreateAt(123).
		ToPlaybookRun()

	inc06 := *NewBuilder(nil).
		WithName("pr 6").
		WithChannel(&channel06).
		WithTeamID(team1id).
		WithCurrentStatus(app.StatusInProgress).
		WithPlaybookID("playbook1").
		WithCreateAt(123).
		ToPlaybookRun()

	inc07 := *NewBuilder(nil).
		WithName("pr 7").
		WithChannel(&channel07).
		WithTeamID(team2id).
		WithCurrentStatus(app.StatusInProgress).
		WithPlaybookID("playbook2").
		WithCreateAt(123).
		ToPlaybookRun()

	inc08 := *NewBuilder(nil).
		WithName("pr 8").
		WithChannel(&channel08).
		WithTeamID(team1id).
		WithCurrentStatus(app.StatusFinished).
		WithPlaybookID("playbook1").
		WithCreateAt(123).
		ToPlaybookRun()

	inc09 := *NewBuilder(nil).
		WithName("pr 9").
		WithChannel(&channel09).
		WithTeamID(team2id).
		WithCurrentStatus(app.StatusFinished).
		WithPlaybookID("playbook2").
		WithCreateAt(123).
		ToPlaybookRun()

	playbookRuns := []app.PlaybookRun{inc01, inc02, inc03, inc04, inc05, inc06, inc07, inc08, inc09}

	for i := range playbookRuns {
		created, err := playbookRunStore.CreatePlaybookRun(&playbookRuns[i])
		require.NoError(t, err)
		playbookRuns[i] = *created
	}

	addUsersToRuns(t, store, []userInfo{bob, lucy, phil}, []string{playbookRuns[0].ID, playbookRuns[1].ID, playbookRuns[2].ID, playbookRuns[3].ID, playbookRuns[5].ID, playbookRuns[6].ID, playbookRuns[7].ID, playbookRuns[8].ID})
	addUsersToRuns(t, store, []userInfo{bob, quincy}, []string{playbookRuns[4].ID})
	addUsersToRuns(t, store, []userInfo{john}, []string{playbookRuns[0].ID})
	addUsersToRuns(t, store, []userInfo{jane}, []string{playbookRuns[0].ID, playbookRuns[1].ID})

	t.Run(driverName+" Active Participants - team1", func(t *testing.T) {
		result := statsStore.TotalActiveParticipants(&StatsFilters{
			TeamID: team1id,
		})
		assert.Equal(t, 5, result)
	})

	t.Run(driverName+" Active Participants - team2", func(t *testing.T) {
		result := statsStore.TotalActiveParticipants(&StatsFilters{
			TeamID: team2id,
		})
		assert.Equal(t, 4, result)
	})

	t.Run(driverName+" Active Participants, playbook1", func(t *testing.T) {
		result := statsStore.TotalActiveParticipants(&StatsFilters{
			PlaybookID: "playbook1",
		})
		assert.Equal(t, 5, result)
	})

	t.Run(driverName+" Active Participants, playbook2", func(t *testing.T) {
		result := statsStore.TotalActiveParticipants(&StatsFilters{
			PlaybookID: "playbook2",
		})
		assert.Equal(t, 4, result)
	})

	t.Run(driverName+" Active Participants, all", func(t *testing.T) {
		result := statsStore.TotalActiveParticipants(&StatsFilters{})
		assert.Equal(t, 6, result)
	})

	t.Run(driverName+" In-progress Playbook Runs - team1", func(t *testing.T) {
		result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{
			TeamID: team1id,
		})
		assert.Equal(t, 3, result)
	})

	t.Run(driverName+" In-progress Playbook Runs - team2", func(t *testing.T) {
		result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{
			TeamID: team2id,
		})
		assert.Equal(t, 3, result)
	})

	t.Run(driverName+" In-progress Playbook Runs - playbook1", func(t *testing.T) {
		result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{
			PlaybookID: "playbook1",
		})
		assert.Equal(t, 4, result)
	})

	t.Run(driverName+" In-progress Playbook Runs - playbook2", func(t *testing.T) {
		result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{
			PlaybookID: "playbook2",
		})
		assert.Equal(t, 2, result)
	})

	t.Run(driverName+" In-progress Playbook Runs - all", func(t *testing.T) {
		result := statsStore.TotalInProgressPlaybookRuns(&StatsFilters{})
		assert.Equal(t, 6, result)
	})

	/* This can't be tested well because it uses model.GetMillis() inside
	t.Run(driverName+" Average Druation Active Playbook Runs Minutes", func(t *testing.T) {
		result := statsStore.AverageDurationActivePlaybookRunsMinutes()
		assert.Equal(t, 26912080, result)
	})*/

	t.Run(driverName+" RunsStartedPerWeekLastXWeeks for a playbook with no runs", func(t *testing.T) {
		runsStartedPerWeek, _ := statsStore.RunsStartedPerWeekLastXWeeks(4, &StatsFilters{
			PlaybookID: "playbook101test123123",
		})
		assert.Equal(t, []int{0, 0, 0, 0}, runsStartedPerWeek)
	})

	t.Run(driverName+" ActiveRunsPerDayLastXDays for a playbook with no runs", func(t *testing.T) {
		activeRunsPerDay, _ := statsStore.ActiveRunsPerDayLastXDays(4, &StatsFilters{
			PlaybookID: "playbook101test1234",
		})
		assert.Equal(t, []int{0, 0, 0, 0}, activeRunsPerDay)
	})

	t.Run(driverName+" ActiveParticipantsPerDayLastXDays for a playbook with no runs", func(t *testing.T) {
		activeParticipantsPerDay, _ := statsStore.ActiveParticipantsPerDayLastXDays(4, &StatsFilters{
			PlaybookID: "playbook101test32412",
		})
		assert.Equal(t, []int{0, 0, 0, 0}, activeParticipantsPerDay)
	})
}

func TestTotalPlaybookRuns(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()

	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	lucy := userInfo{
		ID:   model.NewId(),
		Name: "Lucy",
	}

	john := userInfo{
		ID:   model.NewId(),
		Name: "john",
	}

	bot1 := userInfo{
		ID:   model.NewId(),
		Name: "Mr. Bot",
	}

	bot2 := userInfo{
		ID:   model.NewId(),
		Name: "Mrs. Bot",
	}

	chanOpen01 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 123, DeleteAt: 0}
	chanOpen02 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 199, DeleteAt: 0}
	chanOpen03 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 222, DeleteAt: 0}
	chanPrivate01 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	chanPrivate02 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	chanPrivate03 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	chanPrivate04 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	chanPrivate05 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}
	chanPrivate06 := model.Channel{Id: model.NewId(), Type: "P", CreateAt: 333, DeleteAt: 0}

	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookRunStore := setupPlaybookRunStore(t, db)
	statsStore := setupStatsStore(t, db)

	store := setupSQLStore(t, db)
	setupTeamMembersTable(t, db)
	setupChannelMembersTable(t, db)
	setupChannelMemberHistoryTable(t, db)
	setupChannelsTable(t, db)

	addUsers(t, store, []userInfo{lucy, bob, john, bot1, bot2})
	addBots(t, store, []userInfo{bot1, bot2})
	addUsersToTeam(t, store, []userInfo{lucy, bob, john, bot2}, team1id)
	addUsersToTeam(t, store, []userInfo{lucy, bob, bot1, bot2}, team2id)
	createChannels(t, store, []model.Channel{chanOpen01, chanOpen02, chanOpen03, chanPrivate01, chanPrivate02, chanPrivate03, chanPrivate04, chanPrivate05, chanPrivate06})
	makeAdmin(t, store, bob)

	// create run with different statuses, channels, teams and playbooks
	run01 := *NewBuilder(nil).
		WithName("pr 1 - team1-channel1-inprogress").
		WithChannel(&chanOpen01).
		WithTeamID(team1id).
		WithCurrentStatus(app.StatusInProgress).
		WithCreateAt(123).
		WithPlaybookID("playbook1").
		ToPlaybookRun()

	run02 := *NewBuilder(nil).
		WithName("pr 2 - team1-channel2-inprogress").
		WithChannel(&chanOpen02).
		WithTeamID(team1id).
		WithCurrentStatus(app.StatusInProgress).
		WithCreateAt(123).
		WithPlaybookID("playbook1").
		ToPlaybookRun()

	run03 := *NewBuilder(nil).
		WithName("pr 3 - team1-channel3-finished").
		WithChannel(&chanOpen03).
		WithTeamID(team1id).
		WithCurrentStatus(app.StatusFinished).
		WithPlaybookID("playbook2").
		WithCreateAt(123).
		ToPlaybookRun()

	run04 := *NewBuilder(nil).
		WithName("pr 4 - team2-channel4-inprogress").
		WithChannel(&chanPrivate01).
		WithTeamID(team2id).
		WithCurrentStatus(app.StatusInProgress).
		WithPlaybookID("playbook1").
		WithCreateAt(123).
		ToPlaybookRun()

	run05 := *NewBuilder(nil).
		WithName("pr 5 - team2-channel5-inprogress").
		WithChannel(&chanPrivate02).
		WithTeamID(team2id).
		WithCurrentStatus(app.StatusInProgress).
		WithPlaybookID("playbook2").
		WithCreateAt(123).
		ToPlaybookRun()

	run06 := *NewBuilder(nil).
		WithName("pr 6 - team2-channel5-finished").
		WithChannel(&chanPrivate03).
		WithTeamID(team2id).
		WithCurrentStatus(app.StatusFinished).
		WithPlaybookID("playbook1").
		WithCreateAt(123).
		ToPlaybookRun()

	playbookRuns := []app.PlaybookRun{run01, run02, run03, run04, run05, run06}

	for i := range playbookRuns {
		created, err := playbookRunStore.CreatePlaybookRun(&playbookRuns[i])
		playbookRuns[i] = *created
		require.NoError(t, err)
	}

	addUsersToRuns(t, store, []userInfo{bob, lucy, bot1, bot2}, []string{playbookRuns[0].ID, playbookRuns[1].ID, playbookRuns[2].ID, playbookRuns[3].ID, playbookRuns[5].ID})
	addUsersToRuns(t, store, []userInfo{bob}, []string{playbookRuns[4].ID})
	addUsersToRuns(t, store, []userInfo{john}, []string{playbookRuns[0].ID})

	t.Run(driverName+" TotalPlaybookRuns", func(t *testing.T) {
		result, err := statsStore.TotalPlaybookRuns()
		assert.NoError(t, err)
		assert.Equal(t, 6, result)
	})
}

func TestTotalPlaybooks(t *testing.T) {
	team1id := model.NewId()
	team2id := model.NewId()

	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	lucy := userInfo{
		ID:   model.NewId(),
		Name: "Lucy",
	}

	bot1 := userInfo{
		ID:   model.NewId(),
		Name: "Mr. Bot",
	}

	bot2 := userInfo{
		ID:   model.NewId(),
		Name: "Mrs. Bot",
	}

	channel01 := model.Channel{Id: model.NewId(), Type: "O", CreateAt: 123, DeleteAt: 0}

	db := setupTestDB(t)
	driverName := db.DriverName()
	playbookStore := setupPlaybookStore(t, db)
	playbookRunStore := setupPlaybookRunStore(t, db)
	statsStore := setupStatsStore(t, db)

	store := setupSQLStore(t, db)
	setupTeamMembersTable(t, db)
	setupChannelMembersTable(t, db)
	setupChannelMemberHistoryTable(t, db)
	setupChannelsTable(t, db)

	addUsers(t, store, []userInfo{lucy, bob, bot1, bot2})
	addBots(t, store, []userInfo{bot1, bot2})
	addUsersToTeam(t, store, []userInfo{lucy, bot2}, team1id)
	addUsersToTeam(t, store, []userInfo{lucy, bob, bot1, bot2}, team2id)
	createChannels(t, store, []model.Channel{channel01})
	addUsersToChannels(t, store, []userInfo{bob, lucy, bot1, bot2}, []string{channel01.Id})
	makeAdmin(t, store, bob)

	pb01 := NewPBBuilder().
		WithTeamID(team1id).
		WithTitle("playbook 1").
		ToPlaybook()
	pb02 := NewPBBuilder().
		WithTeamID(team2id).
		WithTitle("Playbook 2").
		ToPlaybook()
	for _, pb := range []app.Playbook{pb01, pb02} {
		_, err := playbookStore.Create(pb)
		require.NoError(t, err)
	}

	// create at least a run to have playbooks with and without runs
	run01 := *NewBuilder(nil).
		WithName("pr 1").
		WithChannel(&channel01).
		WithTeamID(team1id).
		WithCurrentStatus(app.StatusInProgress).
		WithCreateAt(123).
		WithPlaybookID("playbook1").
		ToPlaybookRun()

	_, err := playbookRunStore.CreatePlaybookRun(&run01)
	require.NoError(t, err)

	t.Run(driverName+" TotalPlaybooks", func(t *testing.T) {
		result, err := statsStore.TotalPlaybooks()
		assert.NoError(t, err)
		assert.Equal(t, 2, result)
	})
}

func TestMetricsStats(t *testing.T) {
	teamID := model.NewId()

	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	playbookStore := setupPlaybookStore(t, db)
	statsStore := setupStatsStore(t, db)
	store := setupSQLStore(t, db)

	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	publishTime := model.GetMillis()

	t.Run("no metrics configured", func(t *testing.T) {
		playbook := NewPBBuilder().
			WithTitle("pb1").
			WithTeamID(teamID).
			WithCreateAt(500).
			ToPlaybook()

		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)

		// create 4 runs
		createRunsWithMetrics(t, playbookRunStore, store, playbookID, [][]app.RunMetricData{nil, nil, nil}, true, &publishTime)

		filters := StatsFilters{
			PlaybookID: playbookID,
		}

		actualAverage := statsStore.MetricOverallAverage(filters)
		actualRollingAverage, actualRollingAverageChange := statsStore.MetricRollingAverageAndChange(2, filters)
		actualRollingValues, _ := statsStore.MetricRollingValuesLastXRuns(2, 1, filters)
		actualRange := statsStore.MetricValueRange(filters)
		require.Equal(t, []null.Int{}, actualAverage)
		require.Equal(t, []null.Int{}, actualRollingAverage)
		require.Equal(t, []null.Int{}, actualRollingAverageChange)
		require.Equal(t, [][]int64{}, actualRollingValues)
		require.Equal(t, [][]int64{}, actualRange)
	})

	t.Run("no published metrics", func(t *testing.T) {
		playbook := NewPBBuilder().
			WithTitle("pb1").
			WithTeamID(teamID).
			WithCreateAt(500).
			WithMetrics([]string{"metric1", "metric2"}).
			ToPlaybook()

		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)
		playbook, err = playbookStore.Get(playbookID)
		require.NoError(t, err)

		metricsData := createMetricsData(playbook.Metrics, [][]int64{{2, 3}, {9, 8}, {11, 1}, {7, 3}, {3, 10}})
		createRunsWithMetrics(t, playbookRunStore, store, playbookID, metricsData, false, &publishTime)

		filters := StatsFilters{
			PlaybookID: playbookID,
		}

		actualAverage := statsStore.MetricOverallAverage(filters)
		actualRollingAverage, actualRollingAverageChange := statsStore.MetricRollingAverageAndChange(2, filters)
		actualRollingValues, _ := statsStore.MetricRollingValuesLastXRuns(2, 1, filters)
		actualRange := statsStore.MetricValueRange(filters)
		require.Equal(t, []null.Int{null.NewInt(0, false), null.NewInt(0, false)}, actualAverage)
		require.Equal(t, []null.Int{null.NewInt(0, false), null.NewInt(0, false)}, actualRollingAverage)
		require.Equal(t, []null.Int{null.NewInt(0, false), null.NewInt(0, false)}, actualRollingAverageChange)
		require.Equal(t, [][]int64{nil, nil}, actualRollingValues)
		require.Equal(t, [][]int64{nil, nil}, actualRange)
	})

	t.Run("publish runs with metrics", func(t *testing.T) {
		playbook := NewPBBuilder().
			WithTitle("pb1").
			WithTeamID(teamID).
			WithCreateAt(500).
			WithMetrics([]string{"metric1", "metric2"}).
			ToPlaybook()

		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)
		playbook, err = playbookStore.Get(playbookID)
		require.NoError(t, err)

		metricsData := createMetricsData(playbook.Metrics, [][]int64{{2, 3}, {9, 8}, {11, 1}, {7, 3}, {3, 10}})
		createRunsWithMetrics(t, playbookRunStore, store, playbookID, metricsData, true, &publishTime)

		filters := StatsFilters{
			PlaybookID: playbookID,
		}

		// period value is 2, tests case when there is available data for full two periods
		actualAverage := statsStore.MetricOverallAverage(filters)
		actualRollingAverage, actualRollingAverageChange := statsStore.MetricRollingAverageAndChange(2, filters)
		actualRollingValues, _ := statsStore.MetricRollingValuesLastXRuns(2, 1, filters)
		actualRange := statsStore.MetricValueRange(filters)
		require.Equal(t, []null.Int{null.IntFrom(6), null.IntFrom(5)}, actualAverage)
		require.Equal(t, []null.Int{null.IntFrom(5), null.IntFrom(6)}, actualRollingAverage)
		require.Equal(t, []null.Int{null.IntFrom(-50), null.IntFrom(50)}, actualRollingAverageChange)
		require.Equal(t, [][]int64{{7, 11}, {3, 1}}, actualRollingValues)
		require.Equal(t, [][]int64{{2, 11}, {1, 10}}, actualRange)

		// period value is 4
		actualRollingAverage, actualRollingAverageChange = statsStore.MetricRollingAverageAndChange(4, filters)
		actualRollingValues, _ = statsStore.MetricRollingValuesLastXRuns(3, 3, filters)
		require.Equal(t, []null.Int{null.IntFrom(7), null.IntFrom(5)}, actualRollingAverage)
		require.Equal(t, []null.Int{null.IntFrom(250), null.IntFrom(66)}, actualRollingAverageChange)
		require.Equal(t, [][]int64{{9, 2}, {8, 3}}, actualRollingValues)
	})

	t.Run("publish runs with metrics, then add additional metric to the playbook", func(t *testing.T) {
		playbook := NewPBBuilder().
			WithTitle("pb1").
			WithTeamID(teamID).
			WithCreateAt(500).
			WithMetrics([]string{"metric1"}).
			ToPlaybook()

		playbookID, err := playbookStore.Create(playbook)
		require.NoError(t, err)
		playbook, err = playbookStore.Get(playbookID)
		require.NoError(t, err)

		metricsData := createMetricsData(playbook.Metrics, [][]int64{{2}, {9}, {11}, {7}, {3}})
		createRunsWithMetrics(t, playbookRunStore, store, playbookID, metricsData, true, &publishTime)
		createRunsWithMetrics(t, playbookRunStore, store, playbookID, metricsData[2:], false, &publishTime)

		filters := StatsFilters{
			PlaybookID: playbookID,
		}

		// add a metric to the playbook at first position
		playbook.Metrics = append(playbook.Metrics, playbook.Metrics[0])
		playbook.Metrics[0] = app.PlaybookMetricConfig{
			Title: "metric2",
			Type:  app.MetricTypeInteger,
		}

		err = playbookStore.Update(playbook)
		require.NoError(t, err)

		// the first metric's values should not be available
		actualAverage := statsStore.MetricOverallAverage(filters)
		actualRollingAverage, actualRollingAverageChange := statsStore.MetricRollingAverageAndChange(3, filters)
		actualRollingValues, _ := statsStore.MetricRollingValuesLastXRuns(3, 1, filters)
		actualRange := statsStore.MetricValueRange(filters)
		require.Equal(t, []null.Int{null.NewInt(0, false), null.IntFrom(6)}, actualAverage)
		require.Equal(t, []null.Int{null.NewInt(0, false), null.IntFrom(7)}, actualRollingAverage)
		require.Equal(t, []null.Int{null.NewInt(0, false), null.IntFrom(40)}, actualRollingAverageChange)
		require.Equal(t, [][]int64{nil, {7, 11, 9}}, actualRollingValues)
		require.Equal(t, [][]int64{nil, {2, 11}}, actualRange)

		// publish more data, now with two metrics
		playbook, err = playbookStore.Get(playbookID)
		require.NoError(t, err)

		metricsData = createMetricsData(playbook.Metrics, [][]int64{{200, 3}, {103, 9}})
		createRunsWithMetrics(t, playbookRunStore, store, playbookID, metricsData, true, &publishTime)

		actualAverage = statsStore.MetricOverallAverage(filters)
		actualRollingAverage, actualRollingAverageChange = statsStore.MetricRollingAverageAndChange(4, filters)
		actualRollingValues, _ = statsStore.MetricRollingValuesLastXRuns(4, 0, filters)
		actualRange = statsStore.MetricValueRange(filters)
		require.Equal(t, []null.Int{null.IntFrom(151), null.IntFrom(6)}, actualAverage)
		require.Equal(t, []null.Int{null.IntFrom(151), null.IntFrom(5)}, actualRollingAverage)
		require.Equal(t, []null.Int{null.NewInt(0, false), null.IntFrom(-29)}, actualRollingAverageChange)
		require.Equal(t, [][]int64{{103, 200}, {9, 3, 3, 7}}, actualRollingValues)
		require.Equal(t, [][]int64{{103, 200}, {2, 11}}, actualRange)
	})
}

func createRunsWithMetrics(t *testing.T, playbookRunStore app.PlaybookRunStore, store *SQLStore, playbookID string, metricsData [][]app.RunMetricData, publish bool, publishTime *int64) {
	var channels []model.Channel
	for i, md := range metricsData {
		channel := model.Channel{Id: model.NewId(), Type: "O", DisplayName: "displayname for channel", Name: "channel"}
		channels = append(channels, channel)

		playbookRun := NewBuilder(t).
			WithName(fmt.Sprint("run", i)).
			WithPlaybookID(playbookID).
			WithChannel(&channel).
			ToPlaybookRun()

		playbookRun, err := playbookRunStore.CreatePlaybookRun(playbookRun)
		assert.NoError(t, err)
		assert.NotNil(t, playbookRun)

		playbookRun.Retrospective = "retro text"
		playbookRun.MetricsData = md

		if publish {
			// increase time by 10 sec to avoid duplicate values. Otherwise, metric values sorted by `PublishedAt` may be inconsistent.
			*publishTime += 10000
			playbookRun.RetrospectivePublishedAt = *publishTime
			playbookRun.RetrospectiveWasCanceled = false
		}

		_, err = playbookRunStore.UpdatePlaybookRun(playbookRun)
		require.NoError(t, err)
	}

	if len(channels) > 0 {
		createChannels(t, store, channels)
	}
}

func createMetricsData(metricsConfigs []app.PlaybookMetricConfig, data [][]int64) [][]app.RunMetricData {
	metricsData := make([][]app.RunMetricData, len(data))
	for i, d := range data {
		md := make([]app.RunMetricData, len(metricsConfigs))
		for j, c := range metricsConfigs {
			md[j] = app.RunMetricData{MetricConfigID: c.ID, Value: null.IntFrom(d[j])}
		}
		metricsData[i] = md
	}
	return metricsData
}
