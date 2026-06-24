// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUserReportToReport(t *testing.T) {
	t.Run("includes team membership in the report row", func(t *testing.T) {
		report := &UserReport{
			User: User{
				Id:       "user-id",
				Username: "some-user",
				Email:    "user@example.com",
			},
			Teams: "Engineering, Marketing",
		}

		row := report.ToReport()

		require.Equal(t, "user-id", row[0])
		require.Equal(t, "some-user", row[1])
		require.Equal(t, "user@example.com", row[2])
		// Teams sits between ChannelCount and DeletedAt.
		require.Equal(t, "Engineering, Marketing", row[len(row)-2])
		require.Contains(t, row, "Engineering, Marketing")
	})

	t.Run("renders an empty team membership when the user has no teams", func(t *testing.T) {
		report := &UserReport{
			User:  User{Id: "user-id", Username: "some-user"},
			Teams: "",
		}

		row := report.ToReport()

		require.Equal(t, "", row[len(row)-2])
	})
}
