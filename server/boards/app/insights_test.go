// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	mm_model "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/boards/model"
)

var mockInsightsBoards = []*model.Board{
	{
		ID:    "mock-user-workspace-id",
		Title: "MockUserWorkspace",
	},
}

var mockTeamInsights = []*model.BoardInsight{
	{
		BoardID: "board-id-1",
	},
	{
		BoardID: "board-id-2",
	},
}

var mockTeamInsightsList = &model.BoardInsightsList{
	InsightsListData: mm_model.InsightsListData{HasNext: false},
	Items:            mockTeamInsights,
}

type insightError struct {
	msg string
}

func (ie insightError) Error() string {
	return ie.msg
}

func TestGetTeamAndUserBoardsInsights(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("success query", func(t *testing.T) {
		fakeLicense := &mm_model.License{Features: &mm_model.Features{}, SkuShortName: mm_model.LicenseShortSkuEnterprise}
		th.Store.EXPECT().GetLicense().Return(fakeLicense).AnyTimes()
		fakeUser := &model.User{
			ID:      "user-id",
			IsGuest: false,
		}
		th.Store.EXPECT().GetUserByID("user-id").Return(fakeUser, nil).AnyTimes()
		th.Store.EXPECT().GetBoardsForUserAndTeam("user-id", "team-id", true).Return(mockInsightsBoards, nil).AnyTimes()
		th.Store.EXPECT().
			GetTeamBoardsInsights("team-id", int64(0), 0, 10, []string{"mock-user-workspace-id"}).
			Return(mockTeamInsightsList, nil)
		results, err := th.App.GetTeamBoardsInsights("user-id", "team-id", &mm_model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 10})
		require.NoError(t, err)
		require.Len(t, results.Items, 2)
		th.Store.EXPECT().
			GetUserBoardsInsights("team-id", "user-id", int64(0), 0, 10, []string{"mock-user-workspace-id"}).
			Return(mockTeamInsightsList, nil)
		results, err = th.App.GetUserBoardsInsights("user-id", "team-id", &mm_model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 10})
		require.NoError(t, err)
		require.Len(t, results.Items, 2)
	})

	t.Run("fail query", func(t *testing.T) {
		fakeLicense := &mm_model.License{Features: &mm_model.Features{}, SkuShortName: mm_model.LicenseShortSkuEnterprise}
		th.Store.EXPECT().GetLicense().Return(fakeLicense).AnyTimes()
		fakeUser := &model.User{
			ID:      "user-id",
			IsGuest: false,
		}
		th.Store.EXPECT().GetUserByID("user-id").Return(fakeUser, nil).AnyTimes()
		th.Store.EXPECT().GetBoardsForUserAndTeam("user-id", "team-id", true).Return(mockInsightsBoards, nil).AnyTimes()
		th.Store.EXPECT().
			GetTeamBoardsInsights("team-id", int64(0), 0, 10, []string{"mock-user-workspace-id"}).
			Return(nil, insightError{"board-insight-error"})
		_, err := th.App.GetTeamBoardsInsights("user-id", "team-id", &mm_model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 10})
		require.Error(t, err)
		require.ErrorIs(t, err, insightError{"board-insight-error"})
		th.Store.EXPECT().
			GetUserBoardsInsights("team-id", "user-id", int64(0), 0, 10, []string{"mock-user-workspace-id"}).
			Return(nil, insightError{"board-insight-error"})
		_, err = th.App.GetUserBoardsInsights("user-id", "team-id", &mm_model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 10})
		require.Error(t, err)
		require.ErrorIs(t, err, insightError{"board-insight-error"})
	})
}
