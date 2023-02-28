package app

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/model"
)

var errInvalidTeam = errors.New("invalid team id")

var mockTeam = &model.Team{
	ID:    "mock-team-id",
	Title: "MockTeam",
}

var errUpsertSignupToken = errors.New("upsert error")

func TestGetRootTeam(t *testing.T) {
	var newRootTeam = &model.Team{
		ID:    "0",
		Title: "NewRootTeam",
	}

	testCases := []struct {
		title                    string
		teamToReturnBeforeUpsert *model.Team
		teamToReturnAfterUpsert  *model.Team
		isError                  bool
	}{
		{
			"Success, Return new root team, when root team returned by mockstore is nil",
			nil,
			newRootTeam,
			false,
		},
		{
			"Success, Return existing root team, when root team returned by mockstore is notnil",
			newRootTeam,
			nil,
			false,
		},
		{
			"Fail, Return nil, when root team returned by mockstore is nil, and upsert new root team fails",
			nil,
			nil,
			true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.title, func(t *testing.T) {
			th, tearDown := SetupTestHelper(t)
			defer tearDown()
			th.Store.EXPECT().GetTeam("0").Return(tc.teamToReturnBeforeUpsert, nil)
			if tc.teamToReturnBeforeUpsert == nil {
				th.Store.EXPECT().UpsertTeamSignupToken(gomock.Any()).DoAndReturn(
					func(arg0 model.Team) error {
						if tc.isError {
							return errUpsertSignupToken
						}
						th.Store.EXPECT().GetTeam("0").Return(tc.teamToReturnAfterUpsert, nil)
						return nil
					})
			}
			rootTeam, err := th.App.GetRootTeam()

			if tc.isError {
				require.Error(t, err)
			} else {
				assert.NotNil(t, rootTeam.ID)
				assert.NotNil(t, rootTeam.SignupToken)
				assert.Equal(t, "", rootTeam.ModifiedBy)
				assert.Equal(t, int64(0), rootTeam.UpdateAt)
				assert.Equal(t, "NewRootTeam", rootTeam.Title)
				require.NoError(t, err)
				require.NotNil(t, rootTeam)
			}
		})
	}
}

func TestGetTeam(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	testCases := []struct {
		title   string
		teamID  string
		isError bool
	}{
		{
			"Success, Return new root team, when team returned by mockstore is not nil",
			"mock-team-id",
			false,
		},
		{
			"Success, Return nil, when get team returns an sql error",
			"team-not-available-id",
			false,
		},
		{
			"Fail, Return nil, when get team by mockstore returns an error",
			"invalid-team-id",
			true,
		},
	}

	th.Store.EXPECT().GetTeam("mock-team-id").Return(mockTeam, nil)
	th.Store.EXPECT().GetTeam("invalid-team-id").Return(nil, errInvalidTeam)
	th.Store.EXPECT().GetTeam("team-not-available-id").Return(nil, sql.ErrNoRows)
	for _, tc := range testCases {
		t.Run(tc.title, func(t *testing.T) {
			t.Log(tc.title)
			team, err := th.App.GetTeam(tc.teamID)

			if tc.isError {
				require.Error(t, err)
			} else if tc.teamID != "team-not-available-id" {
				assert.NotNil(t, team.ID)
				assert.NotNil(t, team.SignupToken)
				assert.Equal(t, "mock-team-id", team.ID)
				assert.Equal(t, "", team.ModifiedBy)
				assert.Equal(t, int64(0), team.UpdateAt)
				assert.Equal(t, "MockTeam", team.Title)
				require.NoError(t, err)
				require.NotNil(t, team)
			}
		})
	}
}

func TestTeamOperations(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	th.Store.EXPECT().UpsertTeamSettings(*mockTeam).Return(nil)
	th.Store.EXPECT().UpsertTeamSignupToken(*mockTeam).Return(nil)
	th.Store.EXPECT().GetTeamCount().Return(int64(10), nil)

	errUpsertTeamSettings := th.App.UpsertTeamSettings(*mockTeam)
	assert.NoError(t, errUpsertTeamSettings)

	errUpsertTeamSignupToken := th.App.UpsertTeamSignupToken(*mockTeam)
	assert.NoError(t, errUpsertTeamSignupToken)

	count, errGetTeamCount := th.App.GetTeamCount()
	assert.NoError(t, errGetTeamCount)
	assert.Equal(t, int64(10), count)
}
