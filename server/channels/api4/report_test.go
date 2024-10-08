// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetUsersForReporting(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer th.RestoreDefaultRolePermissions(defaultRolePermissions)

	t.Run("should return forbidden error when user lacks permission", func(t *testing.T) {
		th.RemovePermissionFromRole(model.PermissionSysconsoleReadUserManagementUsers.Id, model.SystemUserRoleId)

		_, resp, err := client.GetUsersForReporting(context.Background(), &model.UserReportOptions{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("should return user reports when user has permission", func(t *testing.T) {
		th.AddPermissionToRole(model.PermissionSysconsoleReadUserManagementUsers.Id, model.SystemUserRoleId)

		options := &model.UserReportOptions{
			ReportingBaseOptions: model.ReportingBaseOptions{
				PageSize: 10,
			},
		}

		userReports, resp, err := client.GetUsersForReporting(context.Background(), options)
		require.NoError(t, err)
		require.NotNil(t, userReports)
		require.GreaterOrEqual(t, len(userReports), 1)
		CheckOKStatus(t, resp)
	})

	t.Run("should return bad request on invalid parameters", func(t *testing.T) {
		th.AddPermissionToRole(model.PermissionSysconsoleReadUserManagementUsers.Id, model.SystemUserRoleId)

		options := &model.UserReportOptions{
			Team: "invalid_team_id",
		}

		_, resp, err := client.GetUsersForReporting(context.Background(), options)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestFillReportingBaseOptions(t *testing.T) {
	t.Run("default values", func(t *testing.T) {
		values := url.Values{}

		options := fillReportingBaseOptions(values)

		require.Equal(t, "Username", options.SortColumn)
		require.Equal(t, "next", options.Direction)
		require.Equal(t, false, options.SortDesc)
		require.Equal(t, 50, options.PageSize)
		require.Equal(t, "", options.FromColumnValue)
		require.Equal(t, "", options.FromId)
		require.Equal(t, "", options.DateRange)
	})

	t.Run("custom values", func(t *testing.T) {
		values := url.Values{}
		values.Set("sort_column", "Email")
		values.Set("direction", "prev")
		values.Set("sort_direction", "desc")
		values.Set("page_size", "25")
		values.Set("from_column_value", "some_value")
		values.Set("from_id", "some_id")
		values.Set("date_range", "last_seven")

		options := fillReportingBaseOptions(values)

		require.Equal(t, "Email", options.SortColumn)
		require.Equal(t, "prev", options.Direction)
		require.Equal(t, true, options.SortDesc)
		require.Equal(t, 25, options.PageSize)
		require.Equal(t, "some_value", options.FromColumnValue)
		require.Equal(t, "some_id", options.FromId)
		require.Equal(t, "last_seven", options.DateRange)
	})

	t.Run("invalid page_size", func(t *testing.T) {
		values := url.Values{}
		values.Set("page_size", "an_very_invalid_number")

		options := fillReportingBaseOptions(values)

		require.Equal(t, 50, options.PageSize)
	})

	t.Run("invalid direction", func(t *testing.T) {
		values := url.Values{}
		values.Set("direction", "a_crazy_direction")

		options := fillReportingBaseOptions(values)

		require.Equal(t, "next", options.Direction)
	})
}

func TestFillUserReportOptions(t *testing.T) {
	validTeamID := model.NewId()

	t.Run("default values", func(t *testing.T) {
		values := url.Values{}
		values.Set("team_filter", validTeamID)

		options, _ := fillUserReportOptions(values)

		expected := &model.UserReportOptions{
			Team:         validTeamID,
			Role:         "",
			HasNoTeam:    false,
			HideActive:   false,
			HideInactive: false,
			SearchTerm:   "",
		}

		require.Equal(t, expected, options)
	})

	t.Run("empty team_filter", func(t *testing.T) {
		values := url.Values{}
		values.Set("team_filter", "")

		options, _ := fillUserReportOptions(values)

		require.Equal(t, "", options.Team)
	})

	t.Run("valid team_filter", func(t *testing.T) {
		values := url.Values{}
		values.Set("team_filter", validTeamID)

		options, _ := fillUserReportOptions(values)

		require.Equal(t, validTeamID, options.Team)
	})
}
