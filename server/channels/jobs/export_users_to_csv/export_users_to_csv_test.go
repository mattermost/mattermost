// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_users_to_csv

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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
