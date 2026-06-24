// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_users_to_csv

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCSVExportColumns(t *testing.T) {
	t.Run("should include a Teams column", func(t *testing.T) {
		require.Contains(t, csvExportColumns, "Teams")
	})

	t.Run("header columns must align with the report row values", func(t *testing.T) {
		// The CSV header is written separately from the data rows, so a mismatch
		// between the header and model.UserReport.ToReport would silently shift
		// every column. Keep them in lock-step.
		report := (&model.UserReport{}).ToReport()
		require.Equal(t, len(csvExportColumns), len(report))
	})
}
