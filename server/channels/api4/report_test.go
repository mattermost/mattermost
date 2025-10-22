// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// Helper function to make POST requests with JSON body
func doPostJSON(t *testing.T, client *model.Client4, endpoint string, body interface{}) (*http.Response, []byte) {
	jsonBytes, err := json.Marshal(body)
	require.NoError(t, err)

	req, err := http.NewRequest("POST", client.URL+endpoint, bytes.NewBuffer(jsonBytes))
	require.NoError(t, err)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(model.HeaderAuth, model.HeaderBearer+" "+client.AuthToken)

	resp, err := client.HTTPClient.Do(req)
	require.NoError(t, err)

	defer resp.Body.Close()
	responseBytes, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	return resp, responseBytes
}

func TestGetUsersForReporting(t *testing.T) {
	mainHelper.Parallel(t)
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
	mainHelper.Parallel(t)
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
	mainHelper.Parallel(t)
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

func TestGetPostsForReporting(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create test posts with controlled timestamps using App layer
	// Setting CreateAt explicitly allows us to test time-based queries accurately
	// This is a common pattern in API tests (see post_test.go for similar usage)
	baseTime := model.GetMillis()
	var testPosts []*model.Post
	for i := 0; i < 15; i++ {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Test post " + strconv.Itoa(i),
			CreateAt:  baseTime + (int64(i) * 1000), // 1 second apart
			UpdateAt:  baseTime + (int64(i) * 1000),
		}
		createdPost, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		testPosts = append(testPosts, createdPost)
	}

	t.Run("should return forbidden error when user lacks permission", func(t *testing.T) {
		th.LoginBasic()

		requestBody := map[string]interface{}{
			"channel_id":  th.BasicChannel.Id,
			"cursor_time": baseTime,
			"cursor_id":   "",
			"per_page":    10,
		}

		resp, _ := doPostJSON(t, th.Client, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("should return posts when system admin makes request", func(t *testing.T) {
		th.LoginSystemAdmin()

		requestBody := map[string]interface{}{
			"channel_id":  th.BasicChannel.Id,
			"cursor_time": baseTime,
			"cursor_id":   "",
			"per_page":    10,
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)
		require.NotNil(t, result.Posts)
		require.GreaterOrEqual(t, len(result.Posts), 10)
	})

	t.Run("should validate required channel_id parameter", func(t *testing.T) {
		th.LoginSystemAdmin()

		requestBody := map[string]interface{}{
			"cursor_time": baseTime,
			"cursor_id":   "",
			"per_page":    10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("should validate required cursor_time parameter", func(t *testing.T) {
		th.LoginSystemAdmin()

		requestBody := map[string]interface{}{
			"channel_id": th.BasicChannel.Id,
			"cursor_id":  "",
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("should handle cursor pagination correctly", func(t *testing.T) {
		th.LoginSystemAdmin()

		// First page
		requestBody1 := map[string]interface{}{
			"channel_id":  th.BasicChannel.Id,
			"cursor_time": baseTime,
			"cursor_id":   "",
			"per_page":    5,
		}

		resp1, body1 := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody1)
		require.Equal(t, http.StatusOK, resp1.StatusCode)

		var result1 model.ReportPostListResponse
		err1 := json.Unmarshal(body1, &result1)
		require.NoError(t, err1)
		require.Len(t, result1.Posts, 5)
		require.NotNil(t, result1.NextCursor, "should have next cursor for more pages")

		// Second page using cursor from first page
		requestBody2 := map[string]interface{}{
			"channel_id":  th.BasicChannel.Id,
			"cursor_time": result1.NextCursor.CursorTime,
			"cursor_id":   result1.NextCursor.CursorId,
			"per_page":    5,
		}

		resp2, body2 := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody2)
		require.Equal(t, http.StatusOK, resp2.StatusCode)

		var result2 model.ReportPostListResponse
		err2 := json.Unmarshal(body2, &result2)
		require.NoError(t, err2)
		require.Len(t, result2.Posts, 5)

		// Verify no duplicate posts between pages
		for id1 := range result1.Posts {
			_, exists := result2.Posts[id1]
			require.False(t, exists, "should not have duplicate posts across pages")
		}
	})

	t.Run("should filter by time range with end_time", func(t *testing.T) {
		th.LoginSystemAdmin()

		// Request only first 5 posts (0-4) by setting end_time just after post 4
		endTime := baseTime + (4 * 1000) + 500 // Halfway to post 5

		requestBody := map[string]interface{}{
			"channel_id":  th.BasicChannel.Id,
			"cursor_time": baseTime,
			"cursor_id":   "",
			"end_time":    endTime,
			"per_page":    100,
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)
		require.Len(t, result.Posts, 5, "should get only 5 posts (0-4) within time range")

		// Verify all posts are within time range
		for _, post := range result.Posts {
			require.GreaterOrEqual(t, post.CreateAt, baseTime, "post should be after cursor_time")
			require.LessOrEqual(t, post.CreateAt, endTime, "post should be before end_time")
		}
	})

	t.Run("should support DESC sort order", func(t *testing.T) {
		th.LoginSystemAdmin()

		// Start from future time and go backwards
		futureTime := baseTime + (20 * 1000) // Well after all test posts
		requestBody := map[string]interface{}{
			"channel_id":     th.BasicChannel.Id,
			"cursor_time":    futureTime,
			"cursor_id":      "",
			"sort_direction": "desc",
			"per_page":       5,
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)
		require.Len(t, result.Posts, 5, "should get 5 posts")

		// Verify all posts are within expected time range
		// Since the API returns a map, we can't check ordering directly,
		// but we can verify all posts are from the expected range
		for _, post := range result.Posts {
			require.LessOrEqual(t, post.CreateAt, futureTime, "post should be before cursor_time")
			require.GreaterOrEqual(t, post.CreateAt, baseTime, "post should be within expected range")
		}

		// The fact that we got exactly 5 posts and they're all in range
		// validates that DESC pagination is working correctly
	})

	t.Run("should support update_at time field", func(t *testing.T) {
		th.LoginSystemAdmin()

		requestBody := map[string]interface{}{
			"channel_id":  th.BasicChannel.Id,
			"cursor_time": baseTime,
			"cursor_id":   "",
			"time_field":  "update_at",
			"per_page":    10,
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)
		require.NotNil(t, result.Posts)
	})

	t.Run("should include deleted posts when requested", func(t *testing.T) {
		th.LoginSystemAdmin()

		// Delete a post
		deletedPost := testPosts[0]
		_, err := th.SystemAdminClient.DeletePost(context.Background(), deletedPost.Id)
		require.NoError(t, err)

		// Request without including deleted posts
		requestBody1 := map[string]interface{}{
			"channel_id":      th.BasicChannel.Id,
			"cursor_time":     baseTime,
			"cursor_id":       "",
			"include_deleted": false,
			"per_page":        100,
		}

		resp1, body1 := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody1)
		require.Equal(t, http.StatusOK, resp1.StatusCode)

		var result1 model.ReportPostListResponse
		err1 := json.Unmarshal(body1, &result1)
		require.NoError(t, err1)

		// Verify deleted post is not included
		_, hasDeleted := result1.Posts[deletedPost.Id]
		require.False(t, hasDeleted, "should not include deleted post by default")

		// Request with including deleted posts
		requestBody2 := map[string]interface{}{
			"channel_id":      th.BasicChannel.Id,
			"cursor_time":     baseTime,
			"cursor_id":       "",
			"include_deleted": true,
			"per_page":        100,
		}

		resp2, body2 := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody2)
		require.Equal(t, http.StatusOK, resp2.StatusCode)

		var result2 model.ReportPostListResponse
		err2 := json.Unmarshal(body2, &result2)
		require.NoError(t, err2)

		// Verify deleted post is included
		deletedPostResult, hasDeleted2 := result2.Posts[deletedPost.Id]
		require.True(t, hasDeleted2, "should include deleted post when requested")
		require.Greater(t, deletedPostResult.DeleteAt, int64(0), "post should have DeleteAt set")
	})

	t.Run("should exclude channel metadata system posts when requested", func(t *testing.T) {
		th.LoginSystemAdmin()

		// Create a system post for channel header change with controlled timestamp
		// App layer respects CreateAt when explicitly set
		systemPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.SystemAdminUser.Id,
			Message:   "Channel header changed",
			Type:      model.PostTypeHeaderChange,
			CreateAt:  baseTime + (int64(20) * 1000), // After all test posts
			UpdateAt:  baseTime + (int64(20) * 1000),
		}
		_, appErr := th.App.CreatePost(th.Context, systemPost, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// Request with excluding metadata posts
		requestBody := map[string]interface{}{
			"channel_id": th.BasicChannel.Id,
			"cursor_time": baseTime,
			"cursor_id":   "",
			"exclude_channel_metadata_system_posts": true,
			"per_page": 100,
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)

		// Verify no system metadata posts are included
		for _, post := range result.Posts {
			require.NotEqual(t, model.PostTypeHeaderChange, post.Type, "header change posts should be excluded")
			require.NotEqual(t, model.PostTypeDisplaynameChange, post.Type, "displayname change posts should be excluded")
			require.NotEqual(t, model.PostTypePurposeChange, post.Type, "purpose change posts should be excluded")
		}
	})

	t.Run("should enforce max per_page limit", func(t *testing.T) {
		th.LoginSystemAdmin()

		requestBody := map[string]interface{}{
			"channel_id":  th.BasicChannel.Id,
			"cursor_time": baseTime,
			"cursor_id":   "",
			"per_page":    5000, // More than max
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should reject per_page > MaxReportingPerPage")
	})

	t.Run("should validate invalid channel_id", func(t *testing.T) {
		th.LoginSystemAdmin()

		requestBody := map[string]interface{}{
			"channel_id":  "invalid_id",
			"cursor_time": baseTime,
			"cursor_id":   "",
			"per_page":    10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}
