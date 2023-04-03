// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/guregu/null.v4"
)

func TestGetSiteStats(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("get sites stats", func(t *testing.T) {
		t.Run("unauthenticated", func(t *testing.T) {
			stats, err := e.UnauthenticatedPlaybooksClient.Stats.GetSiteStats(context.Background())
			assert.Nil(t, stats)
			requireErrorWithStatusCode(t, err, http.StatusUnauthorized)
		})

		t.Run("get stats for basic server", func(t *testing.T) {
			stats, err := e.PlaybooksAdminClient.Stats.GetSiteStats(context.Background())
			require.NoError(t, err)
			assert.NotEmpty(t, stats)
			assert.Equal(t, 4, stats.TotalPlaybooks)
			assert.Equal(t, 1, stats.TotalPlaybookRuns)
		})

		t.Run("add extra playbooks/runs and get stats again", func(t *testing.T) {
			e.CreateBasicPlaybook()
			e.CreateBasicRun()
			e.CreateBasicRun()

			stats, err := e.PlaybooksAdminClient.Stats.GetSiteStats(context.Background())
			require.NoError(t, err)
			assert.NotEmpty(t, stats)
			assert.Equal(t, 6, stats.TotalPlaybooks)
			assert.Equal(t, 3, stats.TotalPlaybookRuns)
		})
	})
}

func TestPlaybookKeyMetricsStats(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("3 runs with published metrics, 2 runs without publishing", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:   "pb1",
			TeamID:  e.BasicTeam.Id,
			Public:  true,
			Metrics: createMetricsConfigs([]string{client.MetricTypeCurrency, client.MetricTypeDuration}),
		})
		require.NoError(e.T, err)

		pb, err := e.PlaybooksClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(e.T, err)

		metricsData := createMetricsData(pb.Metrics, [][]int64{{12312, 9123}, {653, 7262}, {322, 76575}})
		// create runs and publish metrics data
		createRunsWithMetrics(t, e, playbookID, metricsData, true)
		// create runs, set metrics data, but do not publish
		createRunsWithMetrics(t, e, playbookID, metricsData[1:], false)

		stats, err := e.PlaybooksClient.Playbooks.Stats(context.Background(), playbookID)
		require.NoError(t, err)
		require.Equal(t, stats.MetricOverallAverage, intsToNullInts([]int64{4429, 30986}))
		require.Equal(t, stats.MetricRollingAverage, intsToNullInts([]int64{4429, 30986}))
		require.Equal(t, stats.MetricRollingAverageChange, []null.Int{null.NewInt(0, false), null.NewInt(0, false)})
		require.Equal(t, stats.MetricRollingValues, [][]int64{{322, 653, 12312}, {76575, 7262, 9123}})
		require.Equal(t, stats.MetricValueRange, [][]int64{{322, 12312}, {7262, 76575}})
	})

	t.Run("13 runs with published metrics, 7 runs without publishing", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:   "pb2",
			TeamID:  e.BasicTeam.Id,
			Public:  true,
			Metrics: createMetricsConfigs([]string{client.MetricTypeCurrency, client.MetricTypeInteger, client.MetricTypeDuration}),
		})
		require.NoError(e.T, err)

		pb, err := e.PlaybooksClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(e.T, err)

		data := make([][]int64, 15)
		for i := range data {
			data[i] = []int64{100 + int64(i), 2000000 + int64(i), 3000000000 + int64(i)}
		}
		metricsData := createMetricsData(pb.Metrics, data)
		createRunsWithMetrics(t, e, playbookID, metricsData, true)
		createRunsWithMetrics(t, e, playbookID, metricsData[8:], false)

		stats, err := e.PlaybooksClient.Playbooks.Stats(context.Background(), playbookID)
		require.NoError(t, err)
		require.Equal(t, stats.MetricOverallAverage, intsToNullInts([]int64{107, 2000007, 3000000007}))
		require.Equal(t, stats.MetricRollingAverage, intsToNullInts([]int64{109, 2000009, 3000000009})) // last 10 runs average
		require.Equal(t, stats.MetricRollingAverageChange, intsToNullInts([]int64{6, 0, 0}))
		require.Equal(t, stats.MetricRollingValues,
			[][]int64{
				{114, 113, 112, 111, 110, 109, 108, 107, 106, 105},
				{2000014, 2000013, 2000012, 2000011, 2000010, 2000009, 2000008, 2000007, 2000006, 2000005},
				{3000000014, 3000000013, 3000000012, 3000000011, 3000000010, 3000000009, 3000000008, 3000000007, 3000000006, 3000000005},
			})
		require.Equal(t, stats.MetricValueRange, [][]int64{{100, 114}, {2000000, 2000014}, {3000000000, 3000000014}})
	})

	t.Run("23 runs with published metrics", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:   "pb3",
			TeamID:  e.BasicTeam.Id,
			Public:  true,
			Metrics: createMetricsConfigs([]string{client.MetricTypeCurrency}),
		})
		require.NoError(e.T, err)

		pb, err := e.PlaybooksClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(e.T, err)

		data := make([][]int64, 23)
		for i := range data {
			data[i] = []int64{10 + int64(i)} //11, 12, 13 ... 32
		}
		metricsData := createMetricsData(pb.Metrics, data)
		createRunsWithMetrics(t, e, playbookID, metricsData, true)

		stats, err := e.PlaybooksClient.Playbooks.Stats(context.Background(), playbookID)
		require.NoError(t, err)
		require.Equal(t, stats.MetricOverallAverage, intsToNullInts([]int64{21}))
		require.Equal(t, stats.MetricRollingAverage, intsToNullInts([]int64{27})) // last 10 runs average
		require.Equal(t, stats.MetricRollingAverageChange, intsToNullInts([]int64{58}))
		require.Equal(t, stats.MetricRollingValues, [][]int64{{32, 31, 30, 29, 28, 27, 26, 25, 24, 23}})
		require.Equal(t, stats.MetricValueRange, [][]int64{{10, 32}})
	})

	t.Run("publish runs with metrics, then add additional metric to the playbook", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:   "pb4",
			TeamID:  e.BasicTeam.Id,
			Public:  true,
			Metrics: createMetricsConfigs([]string{client.MetricTypeCurrency}),
		})
		require.NoError(e.T, err)

		pb, err := e.PlaybooksClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(e.T, err)

		metricsData := createMetricsData(pb.Metrics, [][]int64{{2}, {1}, {2}, {7}, {3}, {5}, {1}, {7}, {2}, {3}, {5}, {6}, {7}, {1}})
		createRunsWithMetrics(t, e, playbookID, metricsData, true)

		// add a metric to the playbook at first position
		pb.Metrics = append(pb.Metrics, pb.Metrics[0])
		pb.Metrics[0] = client.PlaybookMetricConfig{
			Title: "metric2",
			Type:  client.MetricTypeInteger,
		}

		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *pb)
		require.NoError(e.T, err)

		stats, err := e.PlaybooksClient.Playbooks.Stats(context.Background(), playbookID)
		require.NoError(t, err)
		require.Equal(t, stats.MetricOverallAverage, []null.Int{null.NewInt(0, false), null.IntFrom(3)})
		require.Equal(t, stats.MetricRollingAverage, []null.Int{null.NewInt(0, false), null.IntFrom(4)}) // last 10 runs average
		require.Equal(t, stats.MetricRollingAverageChange, []null.Int{null.NewInt(0, false), null.IntFrom(33)})
		require.Equal(t, stats.MetricRollingValues, [][]int64{nil, {1, 7, 6, 5, 3, 2, 7, 1, 5, 3}})
		require.Equal(t, stats.MetricValueRange, [][]int64{nil, {1, 7}})
	})
}

func createRunsWithMetrics(t *testing.T, e *TestEnvironment, playbookID string, metricsData [][]client.RunMetricData, publish bool) {
	for i, md := range metricsData {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        fmt.Sprint("run", i),
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)

		retrospective := client.RetrospectiveUpdate{
			Text:    fmt.Sprint("retro text", i),
			Metrics: md,
		}

		//publish or save retro info
		if publish {
			err = e.PlaybooksClient.PlaybookRuns.PublishRetrospective(context.Background(), run.ID, e.RegularUser.Id, retrospective)
		} else {
			err = e.PlaybooksClient.PlaybookRuns.UpdateRetrospective(context.Background(), run.ID, e.RegularUser.Id, retrospective)
		}
		assert.NoError(t, err)
	}
}

func createMetricsData(metricsConfigs []client.PlaybookMetricConfig, data [][]int64) [][]client.RunMetricData {
	metricsData := make([][]client.RunMetricData, len(data))
	for i, d := range data {
		md := make([]client.RunMetricData, len(metricsConfigs))
		for j, c := range metricsConfigs {
			md[j] = client.RunMetricData{MetricConfigID: c.ID, Value: null.IntFrom(d[j])}
		}
		metricsData[i] = md
	}
	return metricsData
}

func createMetricsConfigs(types []string) []client.PlaybookMetricConfig {
	configs := make([]client.PlaybookMetricConfig, len(types))
	for i, t := range types {
		configs[i] = client.PlaybookMetricConfig{
			Title: fmt.Sprint("metric", i),
			Type:  t,
		}
	}
	return configs
}

func intsToNullInts(nums []int64) []null.Int {
	res := make([]null.Int, len(nums))
	for i := range nums {
		res[i] = null.IntFrom(nums[i])
	}
	return res
}
