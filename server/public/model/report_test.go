// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestUserReportToReport(t *testing.T) {
	t.Run("places team membership between channel count and deleted-at", func(t *testing.T) {
		channelCount := 5
		deleteAt := int64(1700000000000)
		report := &UserReport{
			User: User{
				Id:       "user-id",
				Username: "some-user",
				Email:    "user@example.com",
				DeleteAt: deleteAt,
			},
			ChannelCount: &channelCount,
			Teams:        "Engineering, Marketing",
		}

		row := report.ToReport()

		require.Len(t, row, 14)
		require.Equal(t, "user-id", row[0])
		require.Equal(t, "some-user", row[1])
		require.Equal(t, "user@example.com", row[2])
		// ChannelCount, Teams and DeletedAt are the trailing three columns, in
		// that order.
		require.Equal(t, "5", row[11])
		require.Equal(t, "Engineering, Marketing", row[12])
		require.Equal(t, time.UnixMilli(deleteAt).String(), row[13])
	})

	t.Run("renders an empty team membership when the user has no teams", func(t *testing.T) {
		report := &UserReport{
			User:  User{Id: "user-id", Username: "some-user"},
			Teams: "",
		}

		row := report.ToReport()

		require.Equal(t, "", row[12])
	})
}
