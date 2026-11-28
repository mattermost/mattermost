// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"testing"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/guregu/null.v4"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_sqlstore "github.com/mattermost/mattermost-plugin-playbooks/server/sqlstore/mocks"
)

func TestCreateAndGetPlaybookRun(t *testing.T) {
	db := setupTestDB(t)
	store := setupSQLStore(t, db)
	playbookRunStore := setupPlaybookRunStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	validPlaybookRuns := []struct {
		Name        string
		PlaybookRun *app.PlaybookRun
		ExpectedErr error
	}{
		{
			Name:        "Empty values",
			PlaybookRun: &app.PlaybookRun{},
			ExpectedErr: nil,
		},
		{
			Name:        "Base playbook run",
			PlaybookRun: NewBuilder(t).ToPlaybookRun(),
			ExpectedErr: nil,
		},
		{
			Name:        "Name with unicode characters",
			PlaybookRun: NewBuilder(t).WithName("valid unicode: ñäåö").ToPlaybookRun(),
			ExpectedErr: nil,
		},
		{
			Name:        "Created at 0",
			PlaybookRun: NewBuilder(t).WithCreateAt(0).ToPlaybookRun(),
			ExpectedErr: nil,
		},
		{
			Name:        "PlaybookRun with one checklist and 10 items",
			PlaybookRun: NewBuilder(t).WithChecklists([]int{10}).ToPlaybookRun(),
			ExpectedErr: nil,
		},
		{
			Name:        "PlaybookRun with five checklists with different number of items",
			PlaybookRun: NewBuilder(t).WithChecklists([]int{1, 2, 3, 4, 5}).ToPlaybookRun(),
			ExpectedErr: nil,
		},
		{
			Name:        "PlaybookRun should not be nil",
			PlaybookRun: nil,
			ExpectedErr: errors.New("playbook run is nil"),
		},
		{
			Name:        "PlaybookRun /can/ contain checklists with no items",
			PlaybookRun: NewBuilder(t).WithChecklists([]int{0}).ToPlaybookRun(),
			ExpectedErr: nil,
		},
	}

	for _, testCase := range validPlaybookRuns {
		t.Run(testCase.Name, func(t *testing.T) {
			var expectedPlaybookRun app.PlaybookRun
			if testCase.PlaybookRun != nil {
				expectedPlaybookRun = *testCase.PlaybookRun
			}

			returned, err := playbookRunStore.CreatePlaybookRun(testCase.PlaybookRun)

			if testCase.ExpectedErr != nil {
				require.Error(t, err)
				require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
				require.Nil(t, returned)
				return
			}

			require.NoError(t, err)
			require.True(t, model.IsValidId(returned.ID))
			expectedPlaybookRun.ID = returned.ID

			createPlaybookRunChannel(t, store, testCase.PlaybookRun)

			_, err = playbookRunStore.GetPlaybookRun(expectedPlaybookRun.ID)
			require.NoError(t, err)
		})
	}
}

// TestGetPlaybookRun only tests getting a non-existent playbook run, since getting existing playbook runs
// is tested in TestCreateAndGetPlaybookRun above.
func TestGetPlaybookRun(t *testing.T) {
	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	setupChannelsTable(t, db)

	validPlaybookRuns := []struct {
		Name        string
		ID          string
		ExpectedErr error
	}{
		{
			Name:        "Get a non-existing playbook run",
			ID:          "nonexisting",
			ExpectedErr: errors.New("playbook run with id 'nonexisting' does not exist: not found"),
		},
		{
			Name:        "Get without ID",
			ID:          "",
			ExpectedErr: errors.New("ID cannot be empty"),
		},
	}

	for _, testCase := range validPlaybookRuns {
		t.Run(testCase.Name, func(t *testing.T) {
			returned, err := playbookRunStore.GetPlaybookRun(testCase.ID)

			require.Error(t, err)
			require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
			require.Nil(t, returned)
		})
	}
}

func TestUpdatePlaybookRun(t *testing.T) {
	pbWithMetrics := NewPBBuilder().
		WithTitle("playbook").
		WithMetrics([]string{"name3", "name1", "name2"}).
		ToPlaybook()

	post1 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 10000000,
		DeleteAt: 0,
	}
	post2 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 20000000,
		DeleteAt: 0,
	}
	post3 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 30000000,
		DeleteAt: 0,
	}
	post4 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000000,
		DeleteAt: 40300000,
	}
	post5 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000001,
		DeleteAt: 0,
	}
	post6 := &model.Post{
		Id:       model.NewId(),
		CreateAt: 40000002,
		DeleteAt: 0,
	}
	allPosts := []*model.Post{post1, post2, post3, post4, post5, post6}

	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)

	setupChannelsTable(t, db)
	setupPostsTable(t, db)
	savePosts(t, store, allPosts)

	playbookStore := setupPlaybookStore(t, db)
	id, err := playbookStore.Create(pbWithMetrics)
	require.NoError(t, err)
	pbWithMetrics, err = playbookStore.Get(id)
	require.NoError(t, err)

	validPlaybookRuns := []struct {
		Name        string
		PlaybookRun *app.PlaybookRun
		Update      func(app.PlaybookRun) *app.PlaybookRun
		ExpectedErr error
	}{
		{
			Name:        "nil playbook run",
			PlaybookRun: NewBuilder(t).ToPlaybookRun(),
			Update: func(old app.PlaybookRun) *app.PlaybookRun {
				return nil
			},
			ExpectedErr: errors.New("playbook run is nil"),
		},
		{
			Name:        "id should not be empty",
			PlaybookRun: NewBuilder(t).ToPlaybookRun(),
			Update: func(old app.PlaybookRun) *app.PlaybookRun {
				old.ID = ""
				return &old
			},
			ExpectedErr: errors.New("ID should not be empty"),
		},
		{
			Name:        "PlaybookRun /can/ contain checklists with no items",
			PlaybookRun: NewBuilder(t).WithChecklists([]int{1}).ToPlaybookRun(),
			Update: func(old app.PlaybookRun) *app.PlaybookRun {
				old.Checklists[0].Items = nil
				old.Checklists[0].ItemsOrder = []string{}
				return &old
			},
			ExpectedErr: nil,
		},
		{
			Name:        "new description",
			PlaybookRun: NewBuilder(t).WithDescription("old description").ToPlaybookRun(),
			Update: func(old app.PlaybookRun) *app.PlaybookRun {
				old.Summary = "new description"
				return &old
			},
			ExpectedErr: nil,
		},
		{
			Name:        "PlaybookRun with 2 checklists, update the checklists a bit",
			PlaybookRun: NewBuilder(t).WithChecklists([]int{1, 1}).ToPlaybookRun(),
			Update: func(old app.PlaybookRun) *app.PlaybookRun {
				old.Checklists[0].Items[0].State = app.ChecklistItemStateClosed
				old.Checklists[1].Items[0].Title = "new title"
				return &old
			},
			ExpectedErr: nil,
		},
		{
			Name:        "PlaybookRun with metrics, update retrospective text and metrics data",
			PlaybookRun: NewBuilder(t).WithPlaybookID(pbWithMetrics.ID).ToPlaybookRun(),
			Update: func(old app.PlaybookRun) *app.PlaybookRun {
				old.MetricsData = generateMetricData(pbWithMetrics)
				old.Retrospective = "Retro1"
				return &old
			},
			ExpectedErr: nil,
		},
		{
			Name:        "PlaybookRun with metrics, update metrics data partially",
			PlaybookRun: NewBuilder(t).WithPlaybookID(pbWithMetrics.ID).ToPlaybookRun(),
			Update: func(old app.PlaybookRun) *app.PlaybookRun {
				old.MetricsData = generateMetricData(pbWithMetrics)[1:]
				return &old
			},
			ExpectedErr: nil,
		},
		{
			Name:        "PlaybookRun with metrics, update metrics data twice. First one will test insert in the table, second will test update",
			PlaybookRun: NewBuilder(t).WithPlaybookID(pbWithMetrics.ID).ToPlaybookRun(),
			Update: func(old app.PlaybookRun) *app.PlaybookRun {
				old.MetricsData = generateMetricData(pbWithMetrics)

				//first update will insert rows
				_, err = playbookRunStore.UpdatePlaybookRun(&old)
				require.NoError(t, err)

				//second update will update values
				for i := range old.MetricsData {
					old.MetricsData[i].Value = null.IntFrom(old.MetricsData[i].Value.ValueOrZero() * 10)
				}
				old.Retrospective = "Retro3"
				return &old
			},
			ExpectedErr: nil,
		},
	}

	for _, testCase := range validPlaybookRuns {
		t.Run(testCase.Name, func(t *testing.T) {
			returned, err := playbookRunStore.CreatePlaybookRun(testCase.PlaybookRun)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, returned)

			expected := testCase.Update(*returned)

			_, err = playbookRunStore.UpdatePlaybookRun(expected)

			if testCase.ExpectedErr != nil {
				require.Error(t, err)
				require.Equal(t, testCase.ExpectedErr.Error(), err.Error())
				return
			}

			require.NoError(t, err)

			actual, err := playbookRunStore.GetPlaybookRun(expected.ID)
			require.NoError(t, err)
			// Populate ItemsOrder to match what GetPlaybookRun returns after MarshalJSON
			expected.ItemsOrder = expected.GetItemsOrder()
			for i := range expected.Checklists {
				expected.Checklists[i].ItemsOrder = expected.Checklists[i].GetItemsOrder()
			}
			require.Equal(t, expected, actual)
		})
	}
}

func TestIfDeletedMetricsAreOmitted(t *testing.T) {
	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)

	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	//create playbook with metrics
	playbookStore := setupPlaybookStore(t, db)
	playbook := NewPBBuilder().
		WithTitle("playbook").
		WithMetrics([]string{"name3", "name1"}).
		ToPlaybook()
	id, err := playbookStore.Create(playbook)
	require.NoError(t, err)
	playbook, err = playbookStore.Get(id)
	require.NoError(t, err)

	// create run based on playbook
	playbookRun := NewBuilder(t).WithPlaybookID(playbook.ID).ToPlaybookRun()
	playbookRun, err = playbookRunStore.CreatePlaybookRun(playbookRun)
	require.NoError(t, err)
	createPlaybookRunChannel(t, store, playbookRun)

	// store metrics values
	playbookRun.MetricsData = generateMetricData(playbook)
	_, err = playbookRunStore.UpdatePlaybookRun(playbookRun)
	require.NoError(t, err)

	// delete one metric config from playbook
	playbook.Metrics = playbook.Metrics[1:]
	err = playbookStore.Update(playbook)
	require.NoError(t, err)

	// should return single metric
	actual, err := playbookRunStore.GetPlaybookRun(playbookRun.ID)
	require.NoError(t, err)
	require.Len(t, actual.MetricsData, 1)
	require.Equal(t, actual.MetricsData[0].MetricConfigID, playbook.Metrics[0].ID)
}

func TestRestorePlaybookRun(t *testing.T) {
	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)

	now := model.GetMillis()
	initialPlaybookRun := NewBuilder(t).
		WithCreateAt(now - 1000).
		WithCurrentStatus(app.StatusFinished).
		ToPlaybookRun()

	returned, err := playbookRunStore.CreatePlaybookRun(initialPlaybookRun)
	require.NoError(t, err)
	createPlaybookRunChannel(t, store, returned)

	err = playbookRunStore.RestorePlaybookRun(returned.ID, now)
	require.NoError(t, err)

	finalPlaybookRun := *returned
	finalPlaybookRun.CurrentStatus = app.StatusInProgress
	finalPlaybookRun.EndAt = 0
	finalPlaybookRun.LastStatusUpdateAt = now

	actual, err := playbookRunStore.GetPlaybookRun(returned.ID)
	require.NoError(t, err)

	// UpdateAt field is now set automatically by RestorePlaybookRun using model.GetMillis(),
	// so we need to copy the actual value to our expected object to make the test pass
	finalPlaybookRun.UpdateAt = actual.UpdateAt

	require.Equal(t, &finalPlaybookRun, actual)
}

// TestGetPlaybookRunsWithOmitEnded verifies that the OmitEnded filter option works correctly.
func TestGetPlaybookRunsWithOmitEnded(t *testing.T) {
	db := setupTestDB(t)
	store := setupSQLStore(t, db)
	playbookRunStore := setupPlaybookRunStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)
	setupTeamMembersTable(t, db)

	// Create team
	teamID := model.NewId()
	team := model.Team{
		Id:   teamID,
		Name: "test-team",
	}
	createTeams(t, store, []model.Team{team})

	// Create user with admin permissions
	userID := model.NewId()
	user := userInfo{
		ID:   userID,
		Name: "test-user",
	}
	addUsers(t, store, []userInfo{user})
	addUsersToTeam(t, store, []userInfo{user}, teamID)

	// Create an active run with EndAt = 0
	activeRun := NewBuilder(t).
		WithTeamID(teamID).
		WithName("active").
		WithCurrentStatus(app.StatusInProgress).
		ToPlaybookRun()
	activeRun, err := playbookRunStore.CreatePlaybookRun(activeRun)
	require.NoError(t, err)
	createPlaybookRunChannel(t, store, activeRun)

	// Create a run that will be finished
	finishedRun := NewBuilder(t).
		WithName("finished").
		WithTeamID(teamID).
		WithOwnerUserID(userID).
		ToPlaybookRun()
	finishedRun, err = playbookRunStore.CreatePlaybookRun(finishedRun)
	require.NoError(t, err)
	createPlaybookRunChannel(t, store, finishedRun)

	// Finish the run using the store API (sets EndAt > 0 and status to Finished)
	endAt := model.GetMillis()
	err = playbookRunStore.FinishPlaybookRun(finishedRun.ID, endAt)
	require.NoError(t, err)

	// Verify the runs were created with the expected statuses
	verifyActiveRun, err := playbookRunStore.GetPlaybookRun(activeRun.ID)
	require.NoError(t, err)
	require.Equal(t, app.StatusInProgress, verifyActiveRun.CurrentStatus)
	require.Equal(t, int64(0), verifyActiveRun.EndAt)

	verifyFinishedRun, err := playbookRunStore.GetPlaybookRun(finishedRun.ID)
	require.NoError(t, err)
	require.Equal(t, app.StatusFinished, verifyFinishedRun.CurrentStatus)
	require.NotEqual(t, int64(0), verifyFinishedRun.EndAt)

	// Setup requester with admin permissions to bypass permissions checks
	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		IsAdmin: true,
	}

	// Test 1: With OmitEnded = false, both runs should be returned
	options := app.PlaybookRunFilterOptions{
		OmitEnded: false,
		TeamID:    teamID,
		Sort:      app.SortByID,
		Direction: app.DirectionAsc,
		Page:      0,
		PerPage:   10,
	}

	results, err := playbookRunStore.GetPlaybookRuns(requesterInfo, options)
	require.NoError(t, err)
	require.Equal(t, 2, len(results.Items), "Should include both active and finished runs")

	// Test 2: With OmitEnded = true, only active run should be returned
	options.OmitEnded = true
	results, err = playbookRunStore.GetPlaybookRuns(requesterInfo, options)
	require.NoError(t, err)
	require.Equal(t, 1, len(results.Items), "Should only include active runs")
	require.Equal(t, activeRun.ID, results.Items[0].ID, "Should be the active run")
}

// intended to catch problems with the code assembling StatusPosts
func TestStressTestGetPlaybookRuns(t *testing.T) {
	// Change these to larger numbers to stress test. Keep them low for CI.
	numPlaybookRuns := 100
	postsPerPlaybookRun := 3
	perPage := 10
	verifyPages := []int{0, 2, 4, 6, 8}

	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)

	setupChannelsTable(t, db)
	setupPostsTable(t, db)
	teamID := model.NewId()
	withPosts := createPlaybookRunsAndPosts(t, store, playbookRunStore, numPlaybookRuns, postsPerPlaybookRun, teamID)

	t.Run("stress test status posts retrieval", func(t *testing.T) {
		for _, p := range verifyPages {
			returned, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
				UserID:  "testID",
				IsAdmin: true,
			}, app.PlaybookRunFilterOptions{
				TeamID:    teamID,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      p,
				PerPage:   perPage,
			})
			require.NoError(t, err)
			numRet := min(perPage, len(withPosts))
			require.Equal(t, numRet, len(returned.Items))
			for i := 0; i < numRet; i++ {
				idx := p*perPage + i
				assert.ElementsMatch(t, withPosts[idx].StatusPosts, returned.Items[i].StatusPosts)
				expWithoutStatusPosts := withPosts[idx]
				expWithoutStatusPosts.StatusPosts = nil
				actWithoutStatusPosts := returned.Items[i]
				actWithoutStatusPosts.StatusPosts = nil
				// Since UpdateAt is automatically set to CreateAt in migration 000080,
				// we need to copy the value for test comparison
				expWithoutStatusPosts.UpdateAt = actWithoutStatusPosts.UpdateAt
				assert.Equal(t, expWithoutStatusPosts, actWithoutStatusPosts)
			}
		}
	})
}

func TestStressTestGetPlaybookRunsStats(t *testing.T) {
	// don't need to assemble stats in CI
	t.SkipNow()

	// Change these to larger numbers to stress test.
	numPlaybookRuns := 1000
	postsPerPlaybookRun := 3
	perPage := 10

	// For stats:
	numReps := 30

	// so we don't start returning pages with 0 playbook runs:
	require.LessOrEqual(t, numReps*perPage, numPlaybookRuns)

	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)

	setupChannelsTable(t, db)
	setupPostsTable(t, db)
	teamID := model.NewId()
	_ = createPlaybookRunsAndPosts(t, store, playbookRunStore, numPlaybookRuns, postsPerPlaybookRun, teamID)

	t.Run("stress test status posts retrieval", func(t *testing.T) {
		intervals := make([]int64, 0, numReps)
		for i := 0; i < numReps; i++ {
			start := time.Now()
			_, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
				UserID:  "testID",
				IsAdmin: true,
			}, app.PlaybookRunFilterOptions{
				TeamID:    teamID,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
				Page:      i,
				PerPage:   perPage,
			})
			intervals = append(intervals, time.Since(start).Milliseconds())
			require.NoError(t, err)
		}
		cil, ciu := ciForN30(intervals)
		fmt.Printf("Mean: %.2f\tStdErr: %.2f\t95%% CI: (%.2f, %.2f)\n",
			mean(intervals), stdErr(intervals), cil, ciu)
	})
}

func createPlaybookRunsAndPosts(t testing.TB, store *SQLStore, playbookRunStore app.PlaybookRunStore, numPlaybookRuns, maxPostsPerPlaybookRun int, teamID string) []app.PlaybookRun {
	playbookRunsSorted := make([]app.PlaybookRun, 0, numPlaybookRuns)
	for i := 0; i < numPlaybookRuns; i++ {
		numPosts := maxPostsPerPlaybookRun
		posts := make([]*model.Post, 0, numPosts)
		for j := 0; j < numPosts; j++ {
			post := newPost(rand.Intn(2) == 0)
			posts = append(posts, post)
		}
		savePosts(t, store, posts)

		createAt := int64(100000 + i)
		inc := NewBuilder(t).
			WithTeamID(teamID).
			WithCreateAt(createAt).
			WithUpdateAt(createAt). // Set UpdateAt to match CreateAt
			WithName(fmt.Sprintf("playbook run %d", i)).
			WithChecklists([]int{1}).
			ToPlaybookRun()
		ret, err := playbookRunStore.CreatePlaybookRun(inc)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, ret)
		// Populate ItemsOrder to match what GetPlaybookRuns would return after MarshalJSON
		ret.ItemsOrder = ret.GetItemsOrder()
		playbookRunsSorted = append(playbookRunsSorted, *ret)
	}

	return playbookRunsSorted
}

func newPost(deleted bool) *model.Post {
	createAt := rand.Int63()
	deleteAt := int64(0)
	if deleted {
		deleteAt = createAt + 100
	}
	return &model.Post{
		Id:       model.NewId(),
		CreateAt: createAt,
		DeleteAt: deleteAt,
	}
}

func TestGetPlaybookRunIDForChannel(t *testing.T) {
	db := setupTestDB(t)
	store := setupSQLStore(t, db)
	playbookRunStore := setupPlaybookRunStore(t, db)
	setupChannelsTable(t, db)

	t.Run("retrieve existing playbookRunID", func(t *testing.T) {
		playbookRun1 := NewBuilder(t).ToPlaybookRun()
		playbookRun2 := NewBuilder(t).ToPlaybookRun()

		returned1, err := playbookRunStore.CreatePlaybookRun(playbookRun1)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, playbookRun1)

		returned2, err := playbookRunStore.CreatePlaybookRun(playbookRun2)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, playbookRun2)

		ids1, err := playbookRunStore.GetPlaybookRunIDsForChannel(playbookRun1.ChannelID)
		require.NoError(t, err)
		require.Len(t, ids1, 1)
		require.Equal(t, returned1.ID, ids1[0])
		ids2, err := playbookRunStore.GetPlaybookRunIDsForChannel(playbookRun2.ChannelID)
		require.NoError(t, err)
		require.Len(t, ids2, 1)
		require.Equal(t, returned2.ID, ids2[0])
	})
	t.Run("fail to retrieve non-existing playbookRunID", func(t *testing.T) {
		ids1, err := playbookRunStore.GetPlaybookRunIDsForChannel("nonexistingid")
		require.Error(t, err)
		require.Len(t, ids1, 0)
		require.True(t, strings.HasPrefix(err.Error(),
			"channel with id (nonexistingid) does not have a playbook run"))
	})
}

func TestNukeDB(t *testing.T) {
	team1id := model.NewId()

	alice := userInfo{
		ID:   model.NewId(),
		Name: "alice",
	}

	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}

	db := setupTestDB(t)
	store := setupSQLStore(t, db)

	setupChannelsTable(t, db)
	setupTeamMembersTable(t, db)

	playbookRunStore := setupPlaybookRunStore(t, db)
	playbookStore := setupPlaybookStore(t, db)

	t.Run("nuke db with a few playbook runs in it", func(t *testing.T) {
		for i := 0; i < 10; i++ {
			newPlaybookRun := NewBuilder(t).ToPlaybookRun()
			_, err := playbookRunStore.CreatePlaybookRun(newPlaybookRun)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, newPlaybookRun)
		}

		var rows int64
		err := db.Get(&rows, "SELECT COUNT(*) FROM IR_Incident")
		require.NoError(t, err)
		require.Equal(t, 10, int(rows))

		err = playbookRunStore.NukeDB()
		require.NoError(t, err)

		err = db.Get(&rows, "SELECT COUNT(*) FROM IR_Incident")
		require.NoError(t, err)
		require.Equal(t, 0, int(rows))
	})

	t.Run("nuke db with playbooks", func(t *testing.T) {
		members := []userInfo{alice, bob}
		addUsers(t, store, members)
		addUsersToTeam(t, store, members, team1id)

		for i := 0; i < 10; i++ {
			newPlaybook := NewPBBuilder().WithMembers(members).ToPlaybook()
			_, err := playbookStore.Create(newPlaybook)
			require.NoError(t, err)
		}

		var rows int64

		err := db.Get(&rows, "SELECT COUNT(*) FROM IR_Playbook")
		require.NoError(t, err)
		require.Equal(t, 10, int(rows))

		err = db.Get(&rows, "SELECT COUNT(*) FROM IR_PlaybookMember")
		require.NoError(t, err)
		require.Equal(t, 20, int(rows))

		err = playbookRunStore.NukeDB()
		require.NoError(t, err)

		err = db.Get(&rows, "SELECT COUNT(*) FROM IR_Playbook")
		require.NoError(t, err)
		require.Equal(t, 0, int(rows))

		err = db.Get(&rows, "SELECT COUNT(*) FROM IR_PlaybookMember")
		require.NoError(t, err)
		require.Equal(t, 0, int(rows))
	})
}

func TestTasksAndRunsDigest(t *testing.T) {
	db := setupTestDB(t)
	store := setupSQLStore(t, db)
	playbookRunStore := setupPlaybookRunStore(t, db)
	setupTeamsTable(t, db)

	userID := "testUserID"
	testUser := userInfo{ID: userID, Name: "test.user"}
	otherCommanderUserID := model.NewId()
	otherCommander := userInfo{ID: otherCommanderUserID, Name: "other.commander"}
	addUsers(t, store, []userInfo{testUser, otherCommander})

	team1 := model.Team{
		Id:   model.NewId(),
		Name: "Team1",
	}
	team2 := model.Team{
		Id:   model.NewId(),
		Name: "Team2",
	}
	createTeams(t, store, []model.Team{team1, team2})

	channel01 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-01"}
	channel02 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-02"}
	channel03 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-03"}
	channel04 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-04"}
	channel05 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-05"}
	channel06 := model.Channel{Id: model.NewId(), Type: "O", Name: "channel-06"}
	channels := []model.Channel{channel01, channel02, channel03, channel04, channel05, channel06}

	// three assigned tasks for inc01, and an overdue update
	inc01 := *NewBuilder(nil).
		WithName("inc01 - this is the playbook name for channel 01").
		WithChannel(&channel01).
		WithTeamID(team1.Id).
		WithChecklists([]int{1, 2, 3, 4}).
		WithStatusUpdateEnabled(true).
		WithUpdateOverdueBy(2 * time.Minute).
		WithOwnerUserID(userID).
		ToPlaybookRun()
	inc01.Checklists[0].Items[0].AssigneeID = userID
	inc01.Checklists[1].Items[1].AssigneeID = userID
	inc01.Checklists[2].Items[2].AssigneeID = userID
	inc01TaskTitles := []string{
		inc01.Checklists[0].Items[0].Title,
		inc01.Checklists[1].Items[1].Title,
		inc01.Checklists[2].Items[2].Title,
	}
	// This should not trigger an assigned task:
	inc01.Checklists[3].Items[0].Title = userID

	// one assigned task for inc02, works cross team, with overdue update
	inc02 := *NewBuilder(nil).
		WithName("inc02 - this is the playbook name for channel 02").
		WithChannel(&channel02).
		WithTeamID(team2.Id).
		WithStatusUpdateEnabled(true).
		WithUpdateOverdueBy(1 * time.Minute).
		WithOwnerUserID(userID).
		WithChecklists([]int{1, 2, 3, 4}).
		ToPlaybookRun()
	inc02.Checklists[3].Items[2].AssigneeID = userID
	inc02TaskTitles := []string{inc02.Checklists[3].Items[2].Title}

	// no assigned task for inc03, with non-overdue update
	inc03 := *NewBuilder(nil).
		WithName("inc03 - this is the playbook name for channel 03").
		WithChannel(&channel03).
		WithTeamID(team1.Id).
		WithStatusUpdateEnabled(true).
		WithUpdateOverdueBy(-2 * time.Minute).
		WithOwnerUserID(userID).
		WithChecklists([]int{1, 2, 3, 4}).
		ToPlaybookRun()
	inc03.Checklists[3].Items[2].AssigneeID = "someotheruserid"

	// one assigned task for inc04, with overdue update, but inc04 is finished
	inc04 := *NewBuilder(nil).
		WithName("inc04 - this is the playbook name for channel 04").
		WithChannel(&channel04).
		WithTeamID(team1.Id).
		WithChecklists([]int{1, 2, 3, 4}).
		WithStatusUpdateEnabled(true).
		WithUpdateOverdueBy(2 * time.Minute).
		WithOwnerUserID(userID).
		WithCurrentStatus(app.StatusFinished).
		ToPlaybookRun()
	inc04.Checklists[3].Items[2].AssigneeID = userID

	// no assigned task for inc05, and not participant in inc05
	inc05 := *NewBuilder(nil).
		WithName("inc05 - this is the playbook name for channel 05").
		WithChannel(&channel05).
		WithTeamID(team1.Id).
		WithOwnerUserID(otherCommanderUserID).
		WithChecklists([]int{1, 2, 3, 4}).
		ToPlaybookRun()
	inc05.Checklists[3].Items[2].AssigneeID = "someotheruserid"

	// no assigned task for inc06, with overdue update, not commander but participating
	inc06 := *NewBuilder(nil).
		WithName("inc06 - this is the playbook name for channel 06").
		WithChannel(&channel06).
		WithTeamID(team1.Id).
		WithOwnerUserID(otherCommanderUserID).
		WithStatusUpdateEnabled(true).
		WithUpdateOverdueBy(2 * time.Minute).
		WithChecklists([]int{1, 2, 3, 4}).
		ToPlaybookRun()
	inc03.Checklists[2].Items[2].AssigneeID = "someotheruserid"

	playbookRuns := []app.PlaybookRun{inc01, inc02, inc03, inc04, inc05, inc06}

	for i := range playbookRuns {
		created, err := playbookRunStore.CreatePlaybookRun(&playbookRuns[i])
		playbookRuns[i] = *created
		require.NoError(t, err)
	}

	addUsersToRuns(t, store, []userInfo{testUser}, []string{playbookRuns[0].ID, playbookRuns[1].ID, playbookRuns[2].ID, playbookRuns[3].ID, playbookRuns[5].ID})

	createChannels(t, store, channels)

	t.Run("gets assigned tasks only", func(t *testing.T) {
		runs, err := playbookRunStore.GetRunsWithAssignedTasks(userID)
		require.NoError(t, err)

		total := 0
		for _, run := range runs {
			total += len(run.Tasks)
		}

		require.Equal(t, 4, total)

		// don't make assumptions about ordering until we figure that out PM-side
		expected := map[string][]string{
			inc01.Name: inc01TaskTitles,
			inc02.Name: inc02TaskTitles,
		}
		for _, run := range runs {
			for _, task := range run.Tasks {
				require.Contains(t, expected[run.Name], task.Title)
			}
		}
	})

	t.Run("gets participating runs only", func(t *testing.T) {
		runs, err := playbookRunStore.GetParticipatingRuns(userID)
		require.NoError(t, err)

		total := len(runs)

		require.Equal(t, 4, total)

		// don't make assumptions about ordering until we figure that out PM-side
		expected := map[string]int{
			inc01.Name: 1,
			inc02.Name: 1,
			inc03.Name: 1,
			inc06.Name: 1,
		}

		actual := make(map[string]int)

		for _, run := range runs {
			actual[run.Name]++
		}

		require.Equal(t, expected, actual)
	})

	t.Run("gets overdue updates", func(t *testing.T) {
		runs, err := playbookRunStore.GetOverdueUpdateRuns(userID)
		require.NoError(t, err)

		total := len(runs)

		require.Equal(t, 2, total)

		// don't make assumptions about ordering until we figure that out PM-side
		expected := map[string]int{
			inc01.Name: 1,
			inc02.Name: 1,
		}

		actual := make(map[string]int)

		for _, run := range runs {
			actual[run.Name]++
		}

		require.Equal(t, expected, actual)
	})
}

func TestGetRunsActiveTotal(t *testing.T) {
	createRuns := func(store *SQLStore, playbookRunStore app.PlaybookRunStore, num int, status string) {
		now := model.GetMillis()
		for i := 0; i < num; i++ {
			run := NewBuilder(t).
				WithCreateAt(now - int64(i*1000)).
				WithCurrentStatus(status).
				ToPlaybookRun()

			returned, err := playbookRunStore.CreatePlaybookRun(run)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, returned)
		}
	}

	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)

	t.Run("zero runs", func(t *testing.T) {
		actual, err := playbookRunStore.GetRunsActiveTotal()
		require.NoError(t, err)
		require.Equal(t, int64(0), actual)
	})

	// add finished runs
	createRuns(store, playbookRunStore, 10, app.StatusFinished)

	t.Run("zero active runs, few finished runs", func(t *testing.T) {
		actual, err := playbookRunStore.GetRunsActiveTotal()
		require.NoError(t, err)
		require.Equal(t, int64(0), actual)
	})

	// add active runs
	createRuns(store, playbookRunStore, 15, app.StatusInProgress)
	t.Run("few active runs, few finished runs", func(t *testing.T) {
		actual, err := playbookRunStore.GetRunsActiveTotal()
		require.NoError(t, err)
		require.Equal(t, int64(15), actual)
	})
}

func TestGetOverdueUpdateRunsTotal(t *testing.T) {
	// overdue: 0 means no reminders at all. -1 means set only due reminders. 1 means set only overdue reminders.
	createRuns := func(store *SQLStore, playbookRunStore app.PlaybookRunStore, num int, status string, overdue int) {
		now := model.GetMillis()
		for i := 0; i < num; i++ {
			run := NewBuilder(t).
				WithCreateAt(now - int64(i*1000)).
				WithCurrentStatus(status).
				WithStatusUpdateEnabled(true).
				WithUpdateOverdueBy(time.Duration(overdue) * 2 * time.Minute * time.Duration(i+1)).
				ToPlaybookRun()

			returned, err := playbookRunStore.CreatePlaybookRun(run)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, returned)
		}
	}

	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)

	t.Run("zero runs", func(t *testing.T) {
		actual, err := playbookRunStore.GetOverdueUpdateRunsTotal()
		require.NoError(t, err)
		require.Equal(t, int64(0), actual)
	})

	t.Run("zero active runs with overdue, few finished runs with overdue", func(t *testing.T) {
		// add finished runs with overdue reminders
		createRuns(store, playbookRunStore, 7, app.StatusFinished, 1)
		// add active runs without reminders
		createRuns(store, playbookRunStore, 5, app.StatusInProgress, 0)

		actual, err := playbookRunStore.GetOverdueUpdateRunsTotal()
		require.NoError(t, err)
		require.Equal(t, int64(0), actual)
	})

	t.Run("few active runs with overdue", func(t *testing.T) {
		// add active runs with overdue
		createRuns(store, playbookRunStore, 9, app.StatusInProgress, 1)

		actual, err := playbookRunStore.GetOverdueUpdateRunsTotal()
		require.NoError(t, err)
		require.Equal(t, int64(9), actual)
	})

	t.Run("few active runs with due reminder", func(t *testing.T) {
		// add active runs with due reminder
		createRuns(store, playbookRunStore, 4, app.StatusInProgress, -1)

		actual, err := playbookRunStore.GetOverdueUpdateRunsTotal()
		require.NoError(t, err)
		require.Equal(t, int64(9), actual)
	})
}

func TestGetOverdueRetroRunsTotal(t *testing.T) {
	createRuns := func(
		store *SQLStore,
		playbookRunStore app.PlaybookRunStore,
		num int,
		status string,
		retroEnabled bool,
		retroInterval int64,
		retroPublishedAt int64,
		retroCanceled bool,
	) {

		now := model.GetMillis()

		for i := 0; i < num; i++ {
			run := NewBuilder(t).
				WithCreateAt(now - int64(i*1000)).
				WithCurrentStatus(status).
				WithRetrospectiveEnabled(retroEnabled).
				WithRetrospectivePublishedAt(retroPublishedAt).
				WithRetrospectiveCanceled(retroCanceled).
				WithRetrospectiveReminderInterval(retroInterval).
				ToPlaybookRun()

			returned, err := playbookRunStore.CreatePlaybookRun(run)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, returned)
		}
	}

	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)

	t.Run("zero runs", func(t *testing.T) {
		actual, err := playbookRunStore.GetOverdueRetroRunsTotal()
		require.NoError(t, err)
		require.Equal(t, int64(0), actual)
	})

	t.Run("zero finished runs, few active runs", func(t *testing.T) {
		// add active runs with enabled/disabled retro
		createRuns(store, playbookRunStore, 5, app.StatusInProgress, true, 60, 0, false)
		createRuns(store, playbookRunStore, 2, app.StatusInProgress, false, 0, 0, false)
		// add active runs with published retro
		createRuns(store, playbookRunStore, 6, app.StatusInProgress, true, 60, 100000000, false)

		actual, err := playbookRunStore.GetOverdueRetroRunsTotal()
		require.NoError(t, err)
		require.Equal(t, int64(0), actual)
	})

	t.Run("few finished runs, few active runs", func(t *testing.T) {
		// add finished runs with enabled/disabled retro
		createRuns(store, playbookRunStore, 3, app.StatusFinished, true, 60, 0, false)
		createRuns(store, playbookRunStore, 4, app.StatusFinished, false, 60, 0, false)
		// add finished runs with published/canceled retro
		createRuns(store, playbookRunStore, 7, app.StatusFinished, true, 60, 100000000, false)
		createRuns(store, playbookRunStore, 8, app.StatusFinished, true, 60, 100000000, true)
		// add finished runs without retro and without reminder
		createRuns(store, playbookRunStore, 2, app.StatusFinished, true, 60, 100000000, false)

		actual, err := playbookRunStore.GetOverdueRetroRunsTotal()
		require.NoError(t, err)
		require.Equal(t, int64(3), actual)
	})
}

func TestGetFollowersActiveTotal(t *testing.T) {
	createRuns := func(
		playbookRunStore app.PlaybookRunStore,
		followers []string,
		teamID string,
		num int,
		status string,
	) {

		for i := 0; i < num; i++ {
			run := NewBuilder(t).
				WithCurrentStatus(status).
				WithTeamID(teamID).
				ToPlaybookRun()

			returned, err := playbookRunStore.CreatePlaybookRun(run)
			require.NoError(t, err)
			for _, f := range followers {
				err = playbookRunStore.Follow(returned.ID, f)
				require.NoError(t, err)
			}
		}
	}

	alice := userInfo{
		ID: model.NewId(),
	}
	bob := userInfo{
		ID: model.NewId(),
	}
	followers := []string{alice.ID, bob.ID}
	teamID := model.NewId()

	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	setupChannelsTable(t, db)
	setupTeamMembersTable(t, db)

	t.Run("zero active followers", func(t *testing.T) {
		// create active runs without followers
		createRuns(playbookRunStore, nil, teamID, 2, app.StatusInProgress)
		// create finished runs with followers
		createRuns(playbookRunStore, followers, teamID, 3, app.StatusFinished)

		actual, err := playbookRunStore.GetFollowersActiveTotal()
		require.NoError(t, err)
		require.Equal(t, int64(0), actual)
	})

	t.Run("runs with active followers", func(t *testing.T) {
		// create active runs with followers
		createRuns(playbookRunStore, followers, teamID, 3, app.StatusInProgress)
		createRuns(playbookRunStore, followers[:1], teamID, 2, app.StatusInProgress)

		expected := 2*3 + 1*2
		actual, err := playbookRunStore.GetFollowersActiveTotal()
		require.NoError(t, err)
		require.Equal(t, int64(expected), actual)
	})
}

func TestGetParticipantsActiveTotal(t *testing.T) {
	createRuns := func(
		store *SQLStore,
		playbookRunStore app.PlaybookRunStore,
		playbookID string,
		participants []userInfo,
		teamID string,
		num int,
		status string,
	) {

		for i := 0; i < num; i++ {
			run := NewBuilder(t).
				WithCurrentStatus(status).
				WithPlaybookID(playbookID).
				WithTeamID(teamID).
				ToPlaybookRun()

			returned, err := playbookRunStore.CreatePlaybookRun(run)
			require.NoError(t, err)
			if len(participants) > 0 {
				addUsersToRuns(t, store, participants, []string{returned.ID})
			}

			createPlaybookRunChannel(t, store, returned)
		}
	}

	alice := userInfo{
		ID:   model.NewId(),
		Name: "alice",
	}
	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}
	tom := userInfo{
		ID:   model.NewId(),
		Name: "tom",
	}
	bot1 := userInfo{
		ID:   model.NewId(),
		Name: "Mr. Bot",
	}

	playbook1 := NewPBBuilder().
		WithTitle("playbook 1").
		ToPlaybook()
	playbook2 := NewPBBuilder().
		WithTitle("playbook 2").
		ToPlaybook()

	team1ID := model.NewId()
	team2ID := model.NewId()

	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	playbookStore := setupPlaybookStore(t, db)
	store := setupSQLStore(t, db)
	setupTeamMembersTable(t, db)
	setupChannelMembersTable(t, db)
	setupChannelMemberHistoryTable(t, db)
	setupChannelsTable(t, db)

	addUsers(t, store, []userInfo{alice, bob, tom})
	addBots(t, store, []userInfo{bot1})

	addUsersToTeam(t, store, []userInfo{alice, bob, bot1}, team1ID)
	addUsersToTeam(t, store, []userInfo{tom, bob, bot1}, team2ID)

	// create two playbooks
	playbook1ID, err := playbookStore.Create(playbook1)
	require.NoError(t, err)
	playbook2ID, err := playbookStore.Create(playbook2)
	require.NoError(t, err)

	t.Run("zero active participants", func(t *testing.T) {
		// create active runs without participants
		createRuns(store, playbookRunStore, "", nil, team1ID, 2, app.StatusInProgress)
		// create finished runs with participants
		createRuns(store, playbookRunStore, playbook1ID, []userInfo{alice, bob, bot1}, team1ID, 3, app.StatusFinished)

		actual, err := playbookRunStore.GetParticipantsActiveTotal()
		require.NoError(t, err)
		require.Equal(t, int64(0), actual)
	})

	t.Run("runs with active participants", func(t *testing.T) {
		// create active runs with participants
		createRuns(store, playbookRunStore, playbook1ID, []userInfo{alice, bob, bot1}, team1ID, 3, app.StatusInProgress)
		createRuns(store, playbookRunStore, playbook2ID, []userInfo{tom, bob}, team2ID, 5, app.StatusInProgress)

		expected := 3*3 + 2*5
		actual, err := playbookRunStore.GetParticipantsActiveTotal()
		require.NoError(t, err)
		require.Equal(t, int64(expected), actual)
	})
}

func setupPlaybookRunStore(t *testing.T, db *sqlx.DB) app.PlaybookRunStore {
	mockCtrl := gomock.NewController(t)

	kvAPI := mock_sqlstore.NewMockKVAPI(mockCtrl)
	configAPI := mock_sqlstore.NewMockConfigurationAPI(mockCtrl)
	pluginAPIClient := PluginAPIClient{
		KV:            kvAPI,
		Configuration: configAPI,
	}

	sqlStore := setupSQLStore(t, db)

	return NewPlaybookRunStore(pluginAPIClient, sqlStore)
}

func TestGetSchemeRolesForChannel(t *testing.T) {
	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)

	t.Run("channel with no scheme", func(t *testing.T) {
		_, err := store.execBuilder(store.db, sq.
			Insert("Schemes").
			SetMap(map[string]interface{}{
				"ID":                      "scheme_0",
				"DefaultChannelGuestRole": "guest0",
				"DefaultChannelUserRole":  "user0",
				"DefaultChannelAdminRole": "admin0",
			}))
		require.NoError(t, err)

		_, err = store.execBuilder(store.db, sq.
			Insert("Channels").
			SetMap(map[string]interface{}{
				"ID": "channel_0",
			}))
		require.NoError(t, err)

		_, _, _, err = playbookRunStore.GetSchemeRolesForChannel("channel_0")
		require.Error(t, err)
	})

	t.Run("channel with scheme", func(t *testing.T) {
		_, err := store.execBuilder(store.db, sq.
			Insert("Schemes").
			SetMap(map[string]interface{}{
				"ID":                      "scheme_1",
				"DefaultChannelGuestRole": nil,
				"DefaultChannelUserRole":  "user1",
				"DefaultChannelAdminRole": "admin1",
			}))
		require.NoError(t, err)

		_, err = store.execBuilder(store.db, sq.
			Insert("Channels").
			SetMap(map[string]interface{}{
				"ID":       "channel_1",
				"SchemeId": "scheme_1",
			}))
		require.NoError(t, err)

		guest, user, admin, err := playbookRunStore.GetSchemeRolesForChannel("channel_1")
		require.NoError(t, err)
		require.Equal(t, guest, model.ChannelGuestRoleId)
		require.Equal(t, user, "user1")
		require.Equal(t, admin, "admin1")
	})
}

func TestGetPlaybookRunIDsForUser(t *testing.T) {
	db := setupTestDB(t)
	playbookRunStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)
	setupTeamMembersTable(t, db)

	alice := userInfo{
		ID:   model.NewId(),
		Name: "alice",
	}
	bob := userInfo{
		ID:   model.NewId(),
		Name: "bob",
	}
	tom := userInfo{
		ID:   model.NewId(),
		Name: "tom",
	}
	allIDs := []string{}
	teamID := model.NewId()
	addUsersToTeam(t, store, []userInfo{alice, bob, tom}, teamID)

	for i := 0; i < 10; i++ {
		run := NewBuilder(t).WithTeamID(teamID).ToPlaybookRun()

		returned, err := playbookRunStore.CreatePlaybookRun(run)
		require.NoError(t, err)

		allIDs = append(allIDs, returned.ID)
	}

	t.Run("no runs for user", func(t *testing.T) {
		returnedIDs, err := playbookRunStore.GetPlaybookRunIDsForUser(alice.ID)
		require.NoError(t, err)
		require.Len(t, returnedIDs, 0)
	})

	t.Run("all runs for user", func(t *testing.T) {
		for _, id := range allIDs {
			addUsersToRuns(t, store, []userInfo{tom}, []string{id})
		}
		returnedIDs, err := playbookRunStore.GetPlaybookRunIDsForUser(tom.ID)
		require.NoError(t, err)
		require.Len(t, returnedIDs, len(allIDs))
	})

	t.Run("some runs for user", func(t *testing.T) {
		for i := 0; i < len(allIDs)/2; i++ {
			addUsersToRuns(t, store, []userInfo{bob}, []string{allIDs[i]})
		}
		returnedIDs, err := playbookRunStore.GetPlaybookRunIDsForUser(bob.ID)
		require.NoError(t, err)
		require.Len(t, returnedIDs, len(allIDs)/2)
	})

	t.Run("remove user from team", func(t *testing.T) {
		for _, id := range allIDs {
			addUsersToRuns(t, store, []userInfo{alice}, []string{id})
		}
		updateBuilder := store.builder.Update("TeamMembers").
			Set("DeleteAt", model.GetMillis()).
			Where(sq.And{sq.Eq{"TeamID": teamID}, sq.Eq{"UserID": alice.ID}})
		_, err := store.execBuilder(store.db, updateBuilder)
		require.NoError(t, err)

		returnedIDs, err := playbookRunStore.GetPlaybookRunIDsForUser(alice.ID)
		require.NoError(t, err)
		require.Len(t, returnedIDs, 0)
	})
}

func TestActivitySince(t *testing.T) {
	// Create a separate test subtest for each test case to ensure proper isolation
	t.Run("basic since filter tests", func(t *testing.T) {
		db := setupTestDB(t)
		playbookRunStore := setupPlaybookRunStore(t, db)
		store := setupSQLStore(t, db)
		setupChannelsTable(t, db)

		// Use a unique team ID for this test to prevent interference with other tests
		teamID := model.NewId()

		// Create base time
		baseTime := model.GetMillis()

		// Create several playbook runs with different update times
		run1 := NewBuilder(t).
			WithTeamID(teamID).
			WithCreateAt(baseTime - 5000).
			WithName("Run 1 - oldest").
			ToPlaybookRun()

		run2 := NewBuilder(t).
			WithTeamID(teamID).
			WithCreateAt(baseTime - 4000).
			WithName("Run 2 - middle").
			ToPlaybookRun()

		run3 := NewBuilder(t).
			WithTeamID(teamID).
			WithCreateAt(baseTime - 3000).
			WithName("Run 3 - newest").
			ToPlaybookRun()

		// Create and store the runs
		run1, err := playbookRunStore.CreatePlaybookRun(run1)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, run1)

		run2, err = playbookRunStore.CreatePlaybookRun(run2)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, run2)

		run3, err = playbookRunStore.CreatePlaybookRun(run3)
		require.NoError(t, err)
		createPlaybookRunChannel(t, store, run3)

		// Update run1 with an older timestamp (use direct SQL to control UpdateAt)
		oldUpdateTime := baseTime - 2000
		_, err = store.execBuilder(store.db, sq.
			Update("IR_Incident").
			Set("Name", "Run 1 - updated older").
			Set("UpdateAt", oldUpdateTime).
			Where(sq.Eq{"ID": run1.ID}))
		require.NoError(t, err)

		// Update run2 with a newer timestamp (use direct SQL to control UpdateAt)
		newUpdateTime := baseTime - 1000
		_, err = store.execBuilder(store.db, sq.
			Update("IR_Incident").
			Set("Name", "Run 2 - updated newer").
			Set("UpdateAt", newUpdateTime).
			Where(sq.Eq{"ID": run2.ID}))
		require.NoError(t, err)

		// Finish run3
		finishTime := baseTime - 500
		err = playbookRunStore.FinishPlaybookRun(run3.ID, finishTime)
		require.NoError(t, err)

		// Test cases
		t.Run("get runs updated since a specific time", func(t *testing.T) {
			// Get runs updated since oldUpdateTime - should include run1, run2, and run3 (run3 is included because finishing it updates UpdateAt to finishTime)
			results, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
				UserID:  "testID",
				IsAdmin: true,
			}, app.PlaybookRunFilterOptions{
				TeamID:        teamID,
				ActivitySince: oldUpdateTime,
				Page:          0,
				PerPage:       10,
			})

			require.NoError(t, err)
			require.Equal(t, 3, len(results.Items))

			// Verify run3 is included in the results with the correct EndAt time
			foundRun3 := false
			for _, run := range results.Items {
				if run.ID == run3.ID {
					foundRun3 = true
					require.Equal(t, finishTime, run.EndAt)
					break
				}
			}
			require.True(t, foundRun3, "Run3 should be in the results")
		})

		t.Run("get runs updated since a later time", func(t *testing.T) {
			// Get runs updated since newUpdateTime - should include run2 and run3 (run3 is included because finishing it updates UpdateAt to finishTime)
			results, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
				UserID:  "testID",
				IsAdmin: true,
			}, app.PlaybookRunFilterOptions{
				TeamID:        teamID,
				ActivitySince: newUpdateTime,
				Page:          0,
				PerPage:       10,
			})

			require.NoError(t, err)
			require.Equal(t, 2, len(results.Items))

			// Verify both run2 and run3 are in the results
			foundRun2 := false
			foundRun3 := false
			for _, run := range results.Items {
				switch run.ID {
				case run2.ID:
					foundRun2 = true
				case run3.ID:
					foundRun3 = true
				}
			}
			require.True(t, foundRun2, "Run2 should be in the results")
			require.True(t, foundRun3, "Run3 should be in the results")
		})

		t.Run("get runs updated since a time after all updates", func(t *testing.T) {
			// Get runs updated since after all updates - should include none
			results, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
				UserID:  "testID",
				IsAdmin: true,
			}, app.PlaybookRunFilterOptions{
				TeamID:        teamID,
				ActivitySince: baseTime + 1000, // Future time
				Page:          0,
				PerPage:       10,
			})

			require.NoError(t, err)
			require.Equal(t, 0, len(results.Items))
		})

		t.Run("finished runs are correctly reported", func(t *testing.T) {
			// Create another run and finish it
			run4 := NewBuilder(t).
				WithTeamID(teamID).
				WithCreateAt(baseTime).
				WithName("Run 4 - to be finished").
				ToPlaybookRun()

			run4, err = playbookRunStore.CreatePlaybookRun(run4)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, run4)

			// Finish it with a newer timestamp
			newerFinishTime := baseTime + 500
			err = playbookRunStore.FinishPlaybookRun(run4.ID, newerFinishTime)
			require.NoError(t, err)

			// Get runs with since parameter earlier than the finish
			results, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
				UserID:  "testID",
				IsAdmin: true,
			}, app.PlaybookRunFilterOptions{
				TeamID:        teamID,
				ActivitySince: baseTime,
				Page:          0,
				PerPage:       10,
			})

			require.NoError(t, err)

			// Verify run4 is returned in the items with correct EndAt
			foundRun4 := false
			for _, run := range results.Items {
				if run.ID == run4.ID {
					foundRun4 = true
					require.Equal(t, newerFinishTime, run.EndAt)
					break
				}
			}
			require.True(t, foundRun4, "Run 4 should be in the results")
		})

		t.Run("with empty results", func(t *testing.T) {
			// Add runs in a different team
			otherTeamID := model.NewId()
			otherRun := NewBuilder(t).
				WithTeamID(otherTeamID).
				WithCreateAt(baseTime).
				WithName("Run in other team").
				ToPlaybookRun()

			otherRun, err = playbookRunStore.CreatePlaybookRun(otherRun)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, otherRun)

			// Query with a team filter that won't match anything
			results, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
				UserID:  "testID",
				IsAdmin: true,
			}, app.PlaybookRunFilterOptions{
				TeamID:        model.NewId(), // Non-existent team
				ActivitySince: 0,
				Page:          0,
				PerPage:       10,
			})

			require.NoError(t, err)
			require.Equal(t, 0, len(results.Items))
		})
	})

	// Create a separate test for pagination to ensure complete isolation
	t.Run("pagination works correctly with ActivitySince filter", func(t *testing.T) {
		// Set up fresh test environment
		db := setupTestDB(t)
		playbookRunStore := setupPlaybookRunStore(t, db)
		store := setupSQLStore(t, db)
		setupChannelsTable(t, db)

		// Use a unique team ID for this test to ensure isolation
		teamID := model.NewId()

		// Create base time
		baseTime := model.GetMillis()
		// Create 10 more runs to test pagination
		playbookRuns := make([]*app.PlaybookRun, 10)

		// Create runs with sequential update times after baseTime
		for i := 0; i < 10; i++ {
			run := NewBuilder(t).
				WithTeamID(teamID).
				WithCreateAt(baseTime + int64(i*100)).
				WithName(fmt.Sprintf("Pagination Run %d", i+1)).
				ToPlaybookRun()

			// Store the run
			var err error
			playbookRuns[i], err = playbookRunStore.CreatePlaybookRun(run)
			require.NoError(t, err)
			createPlaybookRunChannel(t, store, playbookRuns[i])

			// Set update time to be after baseTime
			updateTime := baseTime + int64((i+1)*100)
			playbookRuns[i].UpdateAt = updateTime
			playbookRuns[i].Name = fmt.Sprintf("Pagination Run %d - updated", i+1)
			_, err = playbookRunStore.UpdatePlaybookRun(playbookRuns[i])
			require.NoError(t, err)
		}

		// Test first page with small page size
		firstPageResults, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
			UserID:  "testID",
			IsAdmin: true,
		}, app.PlaybookRunFilterOptions{
			TeamID:        teamID,
			ActivitySince: baseTime,
			Page:          0,
			PerPage:       5, // Request first 5 items
		})

		require.NoError(t, err)
		require.Equal(t, 5, len(firstPageResults.Items), "First page should contain exactly 5 items")
		require.True(t, firstPageResults.HasMore, "Should indicate there are more results")

		// Test second page
		secondPageResults, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
			UserID:  "testID",
			IsAdmin: true,
		}, app.PlaybookRunFilterOptions{
			TeamID:        teamID,
			ActivitySince: baseTime,
			Page:          1,
			PerPage:       5, // Request next 5 items
		})

		require.NoError(t, err)
		require.Equal(t, 5, len(secondPageResults.Items), "Second page should contain exactly 5 items")
		// We have cleared previous test data to ensure HasMore will be false consistently

		// Verify we have different items on each page (no overlap)
		firstPageIDs := make(map[string]bool)
		for _, run := range firstPageResults.Items {
			firstPageIDs[run.ID] = true
		}

		for _, run := range secondPageResults.Items {
			require.False(t, firstPageIDs[run.ID], "Items on second page should not appear on first page")
		}

		// Verify total count is correct and consistent between pages
		expectedTotalCount := 10 // Just our 10 new runs, since tests are now isolated
		require.Equal(t, expectedTotalCount, firstPageResults.TotalCount, "Total count should be correct on first page")
		require.Equal(t, firstPageResults.TotalCount, secondPageResults.TotalCount, "Total count should be consistent between pages")

		// Verify page count is correct
		expectedPageCount := (expectedTotalCount + 4) / 5 // Ceiling division for (10/5) = 2
		require.Equal(t, expectedPageCount, firstPageResults.PageCount, "Page count should be correct")

		// Verify requesting past the end returns empty results but correct metadata
		beyondEndResults, err := playbookRunStore.GetPlaybookRuns(app.RequesterInfo{
			UserID:  "testID",
			IsAdmin: true,
		}, app.PlaybookRunFilterOptions{
			TeamID:        teamID,
			ActivitySince: baseTime,
			Page:          3, // Past the end
			PerPage:       5,
		})

		require.NoError(t, err)
		require.Equal(t, 0, len(beyondEndResults.Items), "Page beyond the end should be empty")
		require.Equal(t, expectedTotalCount, beyondEndResults.TotalCount, "Total count should still be correct")
		require.Equal(t, expectedPageCount, beyondEndResults.PageCount, "Page count should still be correct")
		require.False(t, beyondEndResults.HasMore, "HasMore should be false for page beyond the end")
	})
}

// PlaybookRunBuilder is a utility to build playbook runs with a default base.
// Use it as:
// NewBuilder.WithName("name").WithXYZ(xyz)....ToPlaybookRun()
type PlaybookRunBuilder struct {
	t           testing.TB
	playbookRun *app.PlaybookRun
}

func NewBuilder(t testing.TB) *PlaybookRunBuilder {
	return &PlaybookRunBuilder{
		t: t,
		playbookRun: &app.PlaybookRun{
			Name:          "base playbook run",
			OwnerUserID:   model.NewId(),
			TeamID:        model.NewId(),
			ChannelID:     model.NewId(),
			CreateAt:      model.GetMillis(),
			DeleteAt:      0,
			PostID:        model.NewId(),
			PlaybookID:    model.NewId(),
			Checklists:    nil,
			CurrentStatus: "InProgress",
			Type:          app.RunTypePlaybook,
			ItemsOrder:    []string{},
		},
	}
}

func (ib *PlaybookRunBuilder) WithName(name string) *PlaybookRunBuilder {
	ib.playbookRun.Name = name

	return ib
}

func (ib *PlaybookRunBuilder) WithDescription(desc string) *PlaybookRunBuilder {
	ib.playbookRun.Summary = desc

	return ib
}

func (ib *PlaybookRunBuilder) WithID() *PlaybookRunBuilder {
	ib.playbookRun.ID = model.NewId()

	return ib
}

func (ib *PlaybookRunBuilder) WithParticipant(user userInfo) *PlaybookRunBuilder {
	ib.playbookRun.ParticipantIDs = append(ib.playbookRun.ParticipantIDs, user.ID)
	sort.Strings(ib.playbookRun.ParticipantIDs)

	return ib
}

func (ib *PlaybookRunBuilder) ToPlaybookRun() *app.PlaybookRun {
	return ib.playbookRun
}

func (ib *PlaybookRunBuilder) WithCreateAt(createAt int64) *PlaybookRunBuilder {
	ib.playbookRun.CreateAt = createAt

	return ib
}

func (ib *PlaybookRunBuilder) WithUpdateAt(updateAt int64) *PlaybookRunBuilder {
	ib.playbookRun.UpdateAt = updateAt

	return ib
}

func (ib *PlaybookRunBuilder) WithChecklists(itemsPerChecklist []int) *PlaybookRunBuilder {
	ib.playbookRun.Checklists = make([]app.Checklist, len(itemsPerChecklist))
	var checklistIDs []string

	for i, numItems := range itemsPerChecklist {
		var items []app.ChecklistItem
		var itemIDs []string
		for j := 0; j < numItems; j++ {
			itemID := model.NewId()
			items = append(items, app.ChecklistItem{
				ID:    itemID,
				Title: fmt.Sprint("Checklist ", i, " - item ", j),
			})
			itemIDs = append(itemIDs, itemID)
		}

		checklistID := model.NewId()
		ib.playbookRun.Checklists[i] = app.Checklist{
			ID:         checklistID,
			Title:      fmt.Sprint("Checklist ", i),
			Items:      items,
			ItemsOrder: itemIDs,
		}
		checklistIDs = append(checklistIDs, checklistID)
	}

	ib.playbookRun.ItemsOrder = checklistIDs
	return ib
}

func (ib *PlaybookRunBuilder) WithOwnerUserID(id string) *PlaybookRunBuilder {
	ib.playbookRun.OwnerUserID = id

	return ib
}

func (ib *PlaybookRunBuilder) WithTeamID(id string) *PlaybookRunBuilder {
	ib.playbookRun.TeamID = id

	return ib
}

func (ib *PlaybookRunBuilder) WithCurrentStatus(status string) *PlaybookRunBuilder {
	ib.playbookRun.CurrentStatus = status

	if status == app.StatusFinished {
		ib.playbookRun.EndAt = ib.playbookRun.CreateAt + 100
	}

	return ib
}

func (ib *PlaybookRunBuilder) WithChannel(channel *model.Channel) *PlaybookRunBuilder {
	ib.playbookRun.ChannelID = channel.Id

	// Consider the playbook run name as authoritative.
	channel.DisplayName = ib.playbookRun.Name

	return ib
}

func (ib *PlaybookRunBuilder) WithPlaybookID(id string) *PlaybookRunBuilder {
	ib.playbookRun.PlaybookID = id

	return ib
}

func (ib *PlaybookRunBuilder) WithStatusUpdateEnabled(isEnabled bool) *PlaybookRunBuilder {
	ib.playbookRun.StatusUpdateEnabled = isEnabled

	return ib
}

// WithUpdateOverdueBy sets a PreviousReminder and LastStatusUpdate such that there is an update
// due overdueAmount ago. Set a negative number for an update due in the future.
func (ib *PlaybookRunBuilder) WithUpdateOverdueBy(overdueAmount time.Duration) *PlaybookRunBuilder {
	// simplify the math: set previous reminder to be the overdue amount
	ib.playbookRun.PreviousReminder = overdueAmount

	// and the lastStatusUpdateAt to be twice as much before that
	ib.playbookRun.LastStatusUpdateAt = time.Now().Add(-2*overdueAmount).Unix() * 1000

	return ib
}

func (ib *PlaybookRunBuilder) WithRetrospectiveEnabled(enabled bool) *PlaybookRunBuilder {
	ib.playbookRun.RetrospectiveEnabled = enabled

	return ib
}

func (ib *PlaybookRunBuilder) WithRetrospectivePublishedAt(publishedAt int64) *PlaybookRunBuilder {
	ib.playbookRun.RetrospectivePublishedAt = publishedAt

	return ib
}

func (ib *PlaybookRunBuilder) WithRetrospectiveCanceled(canceled bool) *PlaybookRunBuilder {
	ib.playbookRun.RetrospectiveWasCanceled = canceled

	return ib
}

func (ib *PlaybookRunBuilder) WithRetrospectiveReminderInterval(interval int64) *PlaybookRunBuilder {
	ib.playbookRun.RetrospectiveReminderIntervalSeconds = interval

	return ib
}

func generateMetricData(playbook app.Playbook) []app.RunMetricData {
	metrics := make([]app.RunMetricData, 0)
	for i, mc := range playbook.Metrics {
		metrics = append(metrics,
			app.RunMetricData{
				MetricConfigID: mc.ID,
				Value:          null.IntFrom(int64(i + 10)),
			},
		)
	}
	// Entirely for consistency for the tests
	sort.Slice(metrics, func(i, j int) bool { return metrics[i].MetricConfigID < metrics[j].MetricConfigID })

	return metrics
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func TestPopulateChecklistIDs(t *testing.T) {
	t.Run("updates ItemsOrder after assigning IDs to items without IDs", func(t *testing.T) {
		// Simulate the scenario where an item is duplicated and has no ID
		checklists := []app.Checklist{
			{
				ID:    "checklist1",
				Title: "Test Checklist",
				Items: []app.ChecklistItem{
					{ID: "item1", Title: "Task A"},
					{ID: "item2", Title: "Task B"},
					{ID: "", Title: "Task B (duplicate)"}, // Duplicated item with no ID
					{ID: "item3", Title: "Task C"},
				},
				ItemsOrder: []string{"item1", "item2", "item3"}, // Missing the duplicate item
			},
		}

		result := populateChecklistIDs(checklists)

		// Verify that all items now have IDs
		for i, item := range result[0].Items {
			require.NotEmpty(t, item.ID, "Item %d should have an ID", i)
		}

		// Verify that ItemsOrder is updated to include all items in the correct order
		expectedOrder := []string{
			result[0].Items[0].ID, // item1
			result[0].Items[1].ID, // item2
			result[0].Items[2].ID, // duplicate item (now has ID)
			result[0].Items[3].ID, // item3
		}
		require.Equal(t, expectedOrder, result[0].ItemsOrder, "ItemsOrder should reflect the current order of items")
		require.Len(t, result[0].ItemsOrder, 4, "ItemsOrder should include all items")
	})

	t.Run("handles multiple checklists with items without IDs", func(t *testing.T) {
		checklists := []app.Checklist{
			{
				ID:    "checklist1",
				Title: "First Checklist",
				Items: []app.ChecklistItem{
					{ID: "item1", Title: "Task A"},
					{ID: "", Title: "Task A (duplicate)"},
				},
				ItemsOrder: []string{"item1"},
			},
			{
				ID:    "checklist2",
				Title: "Second Checklist",
				Items: []app.ChecklistItem{
					{ID: "item2", Title: "Task B"},
					{ID: "", Title: "Task B (duplicate)"},
					{ID: "item3", Title: "Task C"},
				},
				ItemsOrder: []string{"item2", "item3"},
			},
		}

		result := populateChecklistIDs(checklists)

		// Verify first checklist
		require.Len(t, result[0].ItemsOrder, 2, "First checklist should have 2 items in order")
		require.Equal(t, result[0].Items[0].ID, result[0].ItemsOrder[0])
		require.Equal(t, result[0].Items[1].ID, result[0].ItemsOrder[1])

		// Verify second checklist
		require.Len(t, result[1].ItemsOrder, 3, "Second checklist should have 3 items in order")
		require.Equal(t, result[1].Items[0].ID, result[1].ItemsOrder[0])
		require.Equal(t, result[1].Items[1].ID, result[1].ItemsOrder[1])
		require.Equal(t, result[1].Items[2].ID, result[1].ItemsOrder[2])
	})

	t.Run("preserves existing ItemsOrder when all items have IDs", func(t *testing.T) {
		checklists := []app.Checklist{
			{
				ID:    "checklist1",
				Title: "Test Checklist",
				Items: []app.ChecklistItem{
					{ID: "item1", Title: "Task A"},
					{ID: "item2", Title: "Task B"},
					{ID: "item3", Title: "Task C"},
				},
				ItemsOrder: []string{"item1", "item2", "item3"},
			},
		}

		result := populateChecklistIDs(checklists)

		// ItemsOrder should be updated to match the current order
		expectedOrder := []string{"item1", "item2", "item3"}
		require.Equal(t, expectedOrder, result[0].ItemsOrder, "ItemsOrder should match current order")
	})
}

func TestBumpRunUpdatedAt(t *testing.T) {
	db := setupTestDB(t)

	team1id := model.NewId()
	playbookStore := setupPlaybookStore(t, db)
	playbookRunStore := setupPlaybookRunStore(t, db)

	playbook := NewPBBuilder().
		WithTitle("Test Playbook").
		WithTeamID(team1id).
		ToPlaybook()

	playbookID, err := playbookStore.Create(playbook)
	require.NoError(t, err)

	playbookRun := NewBuilder(t).
		WithName("Test Run").
		WithPlaybookID(playbookID).
		WithTeamID(team1id).
		WithUpdateAt(1).
		ToPlaybookRun()

	createdRun, err := playbookRunStore.CreatePlaybookRun(playbookRun)
	require.NoError(t, err)

	err = playbookRunStore.BumpRunUpdatedAt(createdRun.ID)
	require.NoError(t, err)

	updatedRun, err := playbookRunStore.GetPlaybookRun(createdRun.ID)
	require.NoError(t, err)
	require.Greater(t, updatedRun.UpdateAt, int64(1))
}
