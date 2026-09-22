// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_users_to_csv

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func TestCSVExportColumns(t *testing.T) {
	t.Run("header has the expected columns in order", func(t *testing.T) {
		// Pin the exact header so a rename or reorder is caught. Teams sits
		// between ChannelCount and DeletedAt.
		require.Equal(t, []string{
			"Id",
			"Username",
			"Email",
			"CreateAt",
			"Name",
			"Roles",
			"LastLogin",
			"LastStatusAt",
			"LastPostDate",
			"DaysActive",
			"TotalPosts",
			"ChannelCount",
			"Teams",
			"DeletedAt",
		}, csvExportColumns)
	})

	t.Run("header column count matches the report row values", func(t *testing.T) {
		// The CSV header is written separately from the data rows, so a count
		// mismatch between the header and model.UserReport.ToReport would
		// silently shift every column. Keep them in lock-step.
		report := (&model.UserReport{}).ToReport()
		require.Equal(t, len(csvExportColumns), len(report))
	})
}

// recordingExportApp records the filters the export queries users with.
type recordingExportApp struct {
	filters []*model.UserReportOptions
	users   []*model.UserReport
}

func (a *recordingExportApp) SaveReportChunk(format string, prefix string, count int, reportData []model.ReportableObject) *model.AppError {
	return nil
}

func (a *recordingExportApp) CompileReportChunks(format string, prefix string, numberOfChunks int, headers []string) *model.AppError {
	return nil
}

func (a *recordingExportApp) SendReportToUser(rctx request.CTX, job *model.Job, format string) *model.AppError {
	return nil
}

func (a *recordingExportApp) CleanupReportChunks(format string, prefix string, numberOfChunks int) *model.AppError {
	return nil
}

func (a *recordingExportApp) GetUsersForReporting(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError) {
	a.filters = append(a.filters, filter)
	return a.users, nil
}

func TestGetData(t *testing.T) {
	jobData := func() model.StringMap {
		return model.StringMap{
			"requesting_user_id": "cxzhnzbpqbnufc5qhnr63zcpdw",
			"date_range":         model.ReportDurationAllTime,
			"start_at":           "100",
			"end_at":             "200",
			"role":               "system_user",
			"team":               "hn6jhbbutbyd8mmwbtkr3sozbo",
			"hide_active":        "false",
			"hide_inactive":      "true",
			"guest_filter":       "all",
			"search_term":        "alice",
		}
	}

	batchOfOne := func() []*model.UserReport {
		return []*model.UserReport{{
			User: model.User{Id: "wbtkr3sozbohn6jhbbutbyd8mm", Username: "alice-smith"},
		}}
	}

	t.Run("should query users with every filter the export was started with", func(t *testing.T) {
		app := &recordingExportApp{users: batchOfOne()}

		reportData, nextData, done, err := getData(app)(jobData())
		require.NoError(t, err)
		require.False(t, done)
		require.Len(t, reportData, 1)

		require.Len(t, app.filters, 1)
		filter := app.filters[0]
		require.Equal(t, "alice", filter.SearchTerm)
		require.Equal(t, "system_user", filter.Role)
		require.Equal(t, "hn6jhbbutbyd8mmwbtkr3sozbo", filter.Team)
		require.Equal(t, "all", filter.GuestFilter)
		require.False(t, filter.HideActive)
		require.True(t, filter.HideInactive)
		require.Equal(t, int64(100), filter.StartAt)
		require.Equal(t, int64(200), filter.EndAt)

		require.Equal(t, "alice-smith", nextData["last_column_value"])
		require.Equal(t, "wbtkr3sozbohn6jhbbutbyd8mm", nextData["last_user_id"])
	})

	t.Run("should keep filtering on the search term once the cursor advances", func(t *testing.T) {
		app := &recordingExportApp{users: batchOfOne()}

		_, nextData, _, err := getData(app)(jobData())
		require.NoError(t, err)

		_, _, _, err = getData(app)(nextData)
		require.NoError(t, err)

		require.Len(t, app.filters, 2)
		require.Equal(t, "alice", app.filters[1].SearchTerm)
		require.Equal(t, "alice-smith", app.filters[1].FromColumnValue)
		require.Equal(t, "wbtkr3sozbohn6jhbbutbyd8mm", app.filters[1].FromId)
	})

	t.Run("should export everything for jobs queued before search terms were recorded", func(t *testing.T) {
		app := &recordingExportApp{users: batchOfOne()}

		data := jobData()
		delete(data, "search_term")

		_, _, _, err := getData(app)(data)
		require.NoError(t, err)

		require.Len(t, app.filters, 1)
		require.Empty(t, app.filters[0].SearchTerm)
	})
}
