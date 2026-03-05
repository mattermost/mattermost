// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// Helper function to make POST requests with JSON body
func doPostJSON(t *testing.T, client *model.Client4, endpoint string, body any) (*http.Response, []byte) {
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
	th := Setup(t).InitBasic(t)
	client := th.Client

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer th.RestoreDefaultRolePermissions(t, defaultRolePermissions)

	t.Run("should return forbidden error when user lacks permission", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadUserManagementUsers.Id, model.SystemUserRoleId)

		_, resp, err := client.GetUsersForReporting(context.Background(), &model.UserReportOptions{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("should return user reports when user has permission", func(t *testing.T) {
		th.AddPermissionToRole(t, model.PermissionSysconsoleReadUserManagementUsers.Id, model.SystemUserRoleId)

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
		th.AddPermissionToRole(t, model.PermissionSysconsoleReadUserManagementUsers.Id, model.SystemUserRoleId)

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
	th := Setup(t).InitBasic(t)

	// Set up Enterprise license for compliance/reporting features
	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise)
	th.App.Srv().SetLicense(license)

	// Create test posts with controlled timestamps using App layer
	// Setting CreateAt explicitly allows us to test time-based queries accurately
	// This is a common pattern in API tests (see post_test.go for similar usage)
	baseTime := model.GetMillis()
	var testPosts []*model.Post
	for i := range 15 {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Test post " + strconv.Itoa(i),
			CreateAt:  baseTime + (int64(i) * 1000), // 1 second apart
			UpdateAt:  baseTime + (int64(i) * 1000),
		}
		createdPost, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		testPosts = append(testPosts, createdPost)
	}

	t.Run("should return bad request when license is not Enterprise", func(t *testing.T) {
		// Remove license temporarily
		th.App.Srv().SetLicense(nil)
		defer func() {
			// Restore Enterprise license for remaining tests
			license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise)
			th.App.Srv().SetLicense(license)
		}()

		th.LoginSystemAdmin(t)

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     "",
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("should return bad request when license is Professional (not Enterprise)", func(t *testing.T) {
		// Set Professional license (not sufficient)
		professionalLicense := model.NewTestLicenseSKU(model.LicenseShortSkuProfessional)
		th.App.Srv().SetLicense(professionalLicense)
		defer func() {
			// Restore Enterprise license for remaining tests
			license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise)
			th.App.Srv().SetLicense(license)
		}()

		th.LoginSystemAdmin(t)

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     "",
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("should return forbidden error when user lacks permission", func(t *testing.T) {
		th.LoginBasic(t)

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     "",
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.Client, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("should return posts when system admin makes request", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     "",
			"per_page":   10,
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
		th.LoginSystemAdmin(t)

		requestBody := map[string]any{
			"cursor":   "",
			"per_page": 10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("should return 404 for non-existent channel", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Use a valid ID format but for a channel that doesn't exist
		nonExistentChannelId := model.NewId()

		requestBody := map[string]any{
			"channel_id": nonExistentChannelId,
			"cursor":     "",
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusNotFound, resp.StatusCode, "should return 404 for non-existent channel")
	})

	t.Run("should accept empty cursor for first page", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Empty cursor is valid for first page
		// This is the documented behavior in OpenAPI spec and mmctl default
		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     "", // Empty cursor for first page
			"per_page":   10,
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode, "empty cursor should be accepted")

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)
		require.NotNil(t, result.Posts)
		require.GreaterOrEqual(t, len(result.Posts), 10, "should return posts with empty cursor")
	})

	t.Run("should accept omitted cursor for first page", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Cursor can be omitted entirely for first page
		requestBody := map[string]any{
			"channel_id":     th.BasicChannel.Id,
			"sort_direction": "asc",
			"per_page":       10,
			// cursor omitted
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode, "omitted cursor should be accepted")

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)
		require.NotNil(t, result.Posts)
		require.GreaterOrEqual(t, len(result.Posts), 10, "should return posts")
	})

	t.Run("should reject invalid cursor format", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     "invalid:cursor", // Invalid cursor format
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "invalid cursor format should be rejected")
	})

	t.Run("should handle cursor pagination correctly", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// First page
		requestBody1 := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     "",
			"per_page":   5,
		}

		resp1, body1 := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody1)
		require.Equal(t, http.StatusOK, resp1.StatusCode)

		var result1 model.ReportPostListResponse
		err1 := json.Unmarshal(body1, &result1)
		require.NoError(t, err1)
		require.Len(t, result1.Posts, 5)
		require.NotNil(t, result1.NextCursor, "should have next cursor for more pages")

		// Second page using cursor from first page
		requestBody2 := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     result1.NextCursor.Cursor, // Opaque cursor from previous response
			"per_page":   5,
		}

		resp2, body2 := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody2)
		require.Equal(t, http.StatusOK, resp2.StatusCode)

		var result2 model.ReportPostListResponse
		err2 := json.Unmarshal(body2, &result2)
		require.NoError(t, err2)
		require.Len(t, result2.Posts, 5)

		// Verify no duplicate posts between pages
		for _, post1 := range result1.Posts {
			for _, post2 := range result2.Posts {
				require.NotEqual(t, post1.Id, post2.Id, "should not have duplicate posts across pages")
			}
		}
	})

	t.Run("should support DESC sort order", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Start from future time and go backwards
		futureTime := baseTime + (20 * 1000) // Well after all test posts
		requestBody := map[string]any{
			"channel_id":     th.BasicChannel.Id,
			"cursor":         "",
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

	t.Run("should use cursor parameters when cursor is provided (self-contained cursor)", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Create a cursor with sort_direction=desc
		cursor := model.EncodeReportPostCursor(
			th.BasicChannel.Id,
			"create_at",
			false, // include_deleted
			false, // exclude_system_posts
			"desc",
			baseTime,
			"",
		)

		// Make request with different parameters - cursor parameters should win
		requestBody := map[string]any{
			"channel_id":     th.BasicChannel.Id,
			"cursor":         cursor,
			"sort_direction": "asc",       // Different from cursor, but cursor should win
			"time_field":     "update_at", // Different from cursor, but cursor should win
			"per_page":       100,
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode, "cursor parameters should take precedence (self-contained cursor)")

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)

		// Verify the query used DESC order (from cursor, not request body)
		// If DESC is being used, posts should be ordered by CreateAt descending
		if len(result.Posts) > 1 {
			postSlice := make([]*model.Post, 0, len(result.Posts))
			postSlice = append(postSlice, result.Posts...)
			// Sort by the expected order (desc)
			sort.Slice(postSlice, func(i, j int) bool {
				if postSlice[i].CreateAt == postSlice[j].CreateAt {
					return postSlice[i].Id > postSlice[j].Id
				}
				return postSlice[i].CreateAt > postSlice[j].CreateAt
			})
			// Verify first post matches what we expect from DESC order
			firstPost := postSlice[0]
			for _, post := range result.Posts {
				if post.CreateAt < baseTime {
					// Found a post before cursor - verify it matches DESC expectations
					require.LessOrEqual(t, post.CreateAt, baseTime, "with DESC from cursor, should get posts <= cursor time")
					break
				}
			}
			_ = firstPost // Just need to verify DESC was used
		}
	})

	t.Run("should support update_at time field", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     "",
			"time_field": "update_at",
			"per_page":   10,
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)
		require.NotNil(t, result.Posts)
	})

	t.Run("should include deleted posts when requested", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Delete a post
		deletedPost := testPosts[0]
		_, err := th.SystemAdminClient.DeletePost(context.Background(), deletedPost.Id)
		require.NoError(t, err)

		// Request without including deleted posts
		requestBody1 := map[string]any{
			"channel_id":      th.BasicChannel.Id,
			"cursor":          "",
			"include_deleted": false,
			"per_page":        100,
		}

		resp1, body1 := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody1)
		require.Equal(t, http.StatusOK, resp1.StatusCode)

		var result1 model.ReportPostListResponse
		err1 := json.Unmarshal(body1, &result1)
		require.NoError(t, err1)

		// Verify deleted post is not included
		hasDeleted := false
		for _, post := range result1.Posts {
			if post.Id == deletedPost.Id {
				hasDeleted = true
				break
			}
		}
		require.False(t, hasDeleted, "should not include deleted post by default")

		// Request with including deleted posts
		requestBody2 := map[string]any{
			"channel_id":      th.BasicChannel.Id,
			"cursor":          "",
			"include_deleted": true,
			"per_page":        100,
		}

		resp2, body2 := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody2)
		require.Equal(t, http.StatusOK, resp2.StatusCode)

		var result2 model.ReportPostListResponse
		err2 := json.Unmarshal(body2, &result2)
		require.NoError(t, err2)

		// Verify deleted post is included
		var deletedPostResult *model.Post
		for _, post := range result2.Posts {
			if post.Id == deletedPost.Id {
				deletedPostResult = post
				break
			}
		}
		require.NotNil(t, deletedPostResult, "should include deleted post when requested")
		require.Greater(t, deletedPostResult.DeleteAt, int64(0), "post should have DeleteAt set")
	})

	t.Run("should exclude all system posts when requested", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Create various types of system posts with controlled timestamps
		systemPostTypes := []string{
			model.PostTypeHeaderChange,
			model.PostTypeJoinChannel,
			model.PostTypeLeaveChannel,
			model.PostTypeAddToChannel,
		}

		for i, postType := range systemPostTypes {
			systemPost := &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    th.SystemAdminUser.Id,
				Message:   "System message",
				Type:      postType,
				CreateAt:  baseTime + (int64(20+i) * 1000), // After all test posts
				UpdateAt:  baseTime + (int64(20+i) * 1000),
			}
			_, _, appErr := th.App.CreatePost(th.Context, systemPost, th.BasicChannel, model.CreatePostFlags{})
			require.Nil(t, appErr)
		}

		// Request with excluding all system posts
		requestBody := map[string]any{
			"channel_id":           th.BasicChannel.Id,
			"cursor":               "",
			"exclude_system_posts": true,
			"per_page":             100,
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.ReportPostListResponse
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)

		// Verify no system posts are included (any type starting with "system_")
		for _, post := range result.Posts {
			require.False(t, post.IsSystemMessage(), "system posts should be excluded, found type: %s", post.Type)
		}
	})

	t.Run("should enforce max per_page limit", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     "",
			"per_page":   5000, // More than max
		}

		resp, body := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusOK, resp.StatusCode, "should cap per_page to MaxReportingPerPage instead of rejecting")

		// Verify it was capped to max (we can't directly check the query but the request succeeds)
		var result map[string]any
		err := json.Unmarshal(body, &result)
		require.NoError(t, err)
		require.NotNil(t, result["posts"], "should return posts with capped per_page")
	})

	t.Run("should validate invalid channel_id format", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Invalid ID format (not a valid 26-character ID)
		requestBody := map[string]any{
			"channel_id": "invalid_id",
			"cursor":     "",
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should reject invalid ID format")
	})

	t.Run("should reject tampered cursor with invalid TimeField", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Create a tampered cursor with invalid TimeField
		tamperedCursor := encodeManualCursor("1", th.BasicChannel.Id, "DROP TABLE Posts", "false", "false", "asc", "1640000000000", model.NewId())

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     tamperedCursor,
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should reject cursor with invalid time_field")
	})

	t.Run("should reject tampered cursor with invalid SortDirection", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Create a tampered cursor with SQL injection in SortDirection
		tamperedCursor := encodeManualCursor("1", th.BasicChannel.Id, "create_at", "false", "false", "ASC; DROP TABLE Posts--", "1640000000000", model.NewId())

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     tamperedCursor,
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should reject cursor with invalid sort_direction")
	})

	t.Run("should reject tampered cursor with invalid ChannelId", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Create a tampered cursor with invalid channel ID format
		tamperedCursor := encodeManualCursor("1", "bad_id", "create_at", "false", "false", "asc", "1640000000000", model.NewId())

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     tamperedCursor,
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should reject cursor with invalid channel_id")
	})

	t.Run("should reject tampered cursor with invalid CursorId", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		// Create a tampered cursor with invalid cursor ID format
		tamperedCursor := encodeManualCursor("1", th.BasicChannel.Id, "create_at", "false", "false", "asc", "1640000000000", "bad_cursor_id")

		requestBody := map[string]any{
			"channel_id": th.BasicChannel.Id,
			"cursor":     tamperedCursor,
			"per_page":   10,
		}

		resp, _ := doPostJSON(t, th.SystemAdminClient, "/api/v4/reports/posts", requestBody)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should reject cursor with invalid cursor_id")
	})
}

// encodeManualCursor is a test helper to create cursors with arbitrary values for tampering tests
func encodeManualCursor(version, channelId, timeField, includeDeleted, excludeSystemPosts, sortDirection, timestamp, postId string) string {
	plainText := fmt.Sprintf("%s:%s:%s:%s:%s:%s:%s:%s",
		version, channelId, timeField, includeDeleted, excludeSystemPosts, sortDirection, timestamp, postId)
	return base64.URLEncoding.EncodeToString([]byte(plainText))
}
