// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("offline status", func(t *testing.T) {
		userStatus, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "offline", userStatus.Status)
	})

	t.Run("online status", func(t *testing.T) {
		th.App.SetStatusOnline(th.BasicUser.Id, true)
		userStatus, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "online", userStatus.Status)
	})

	t.Run("away status", func(t *testing.T) {
		th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, true)
		userStatus, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "away", userStatus.Status)
	})

	t.Run("dnd status", func(t *testing.T) {
		th.App.SetStatusDoNotDisturb(th.BasicUser.Id)
		userStatus, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "dnd", userStatus.Status)
	})

	t.Run("dnd status timed", func(t *testing.T) {
		th.App.SetStatusDoNotDisturbTimed(th.BasicUser.Id, time.Now().Add(10*time.Minute).Unix())
		userStatus, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "dnd", userStatus.Status)
	})

	t.Run("dnd status timed restore after time interval", func(t *testing.T) {
		task := model.CreateRecurringTaskFromNextIntervalTime("Unset DND Statuses From Test", th.App.UpdateDNDStatusOfUsers, 1*time.Second)
		defer task.Cancel()
		th.App.SetStatusOnline(th.BasicUser.Id, true)
		userStatus, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "online", userStatus.Status)
		th.App.SetStatusDoNotDisturbTimed(th.BasicUser.Id, time.Now().Add(2*time.Second).Unix())
		userStatus, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "dnd", userStatus.Status)
		// Poll for status restore instead of sleeping a fixed duration (MM-63533).
		// The recurring task runs every 1s but can lag under CI load.
		require.Eventually(t, func() bool {
			userStatus, _, err = client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
			return err == nil && userStatus.Status == "online"
		}, 15*time.Second, 500*time.Millisecond, "DND status was not restored to online within timeout")
	})

	t.Run("back to offline status", func(t *testing.T) {
		th.App.SetStatusOffline(th.BasicUser.Id, true, false)
		userStatus, _, err := client.GetUserStatus(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "offline", userStatus.Status)
	})

	t.Run("get other user status", func(t *testing.T) {
		// Get user2 status logged as user1
		userStatus, _, err := client.GetUserStatus(context.Background(), th.BasicUser2.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "offline", userStatus.Status)
	})

	t.Run("get status from logged out user", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, resp, err := client.GetUserStatus(context.Background(), th.BasicUser2.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("get status from other user", func(t *testing.T) {
		th.LoginBasic2(t)
		userStatus, _, err := client.GetUserStatus(context.Background(), th.BasicUser2.Id, "")
		require.NoError(t, err)
		assert.Equal(t, "offline", userStatus.Status)
	})
}

func TestGetUsersStatusesByIds(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	usersIds := []string{th.BasicUser.Id, th.BasicUser2.Id}

	t.Run("empty userIds list", func(t *testing.T) {
		_, resp, err := client.GetUsersStatusesByIds(context.Background(), []string{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("completely invalid userIds list", func(t *testing.T) {
		_, resp, err := client.GetUsersStatusesByIds(context.Background(), []string{"invalid_user_id", "invalid_user_id"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("partly invalid userIds list", func(t *testing.T) {
		_, resp, err := client.GetUsersStatusesByIds(context.Background(), []string{th.BasicUser.Id, "invalid_user_id"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("offline status", func(t *testing.T) {
		usersStatuses, _, err := client.GetUsersStatusesByIds(context.Background(), usersIds)
		require.NoError(t, err)
		for _, userStatus := range usersStatuses {
			assert.Equal(t, "offline", userStatus.Status)
		}
	})

	t.Run("online status", func(t *testing.T) {
		th.App.SetStatusOnline(th.BasicUser.Id, true)
		th.App.SetStatusOnline(th.BasicUser2.Id, true)
		usersStatuses, _, err := client.GetUsersStatusesByIds(context.Background(), usersIds)
		require.NoError(t, err)
		for _, userStatus := range usersStatuses {
			assert.Equal(t, "online", userStatus.Status)
		}
	})

	t.Run("away status", func(t *testing.T) {
		th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, true)
		th.App.SetStatusAwayIfNeeded(th.BasicUser2.Id, true)
		usersStatuses, _, err := client.GetUsersStatusesByIds(context.Background(), usersIds)
		require.NoError(t, err)
		for _, userStatus := range usersStatuses {
			assert.Equal(t, "away", userStatus.Status)
		}
	})

	t.Run("dnd status", func(t *testing.T) {
		th.App.SetStatusDoNotDisturb(th.BasicUser.Id)
		th.App.SetStatusDoNotDisturb(th.BasicUser2.Id)
		usersStatuses, _, err := client.GetUsersStatusesByIds(context.Background(), usersIds)
		require.NoError(t, err)
		for _, userStatus := range usersStatuses {
			assert.Equal(t, "dnd", userStatus.Status)
		}
	})

	t.Run("dnd status", func(t *testing.T) {
		th.App.SetStatusDoNotDisturbTimed(th.BasicUser.Id, time.Now().Add(10*time.Minute).Unix())
		th.App.SetStatusDoNotDisturbTimed(th.BasicUser2.Id, time.Now().Add(15*time.Minute).Unix())
		usersStatuses, _, err := client.GetUsersStatusesByIds(context.Background(), usersIds)
		require.NoError(t, err)
		for _, userStatus := range usersStatuses {
			assert.Equal(t, "dnd", userStatus.Status)
		}
	})

	t.Run("get statuses from logged out user", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)

		_, resp, err := client.GetUsersStatusesByIds(context.Background(), usersIds)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetUserStatusActiveChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	privateChannel := th.CreatePrivateChannel(t)

	_, _, err := th.Client.ViewChannel(context.Background(), th.BasicUser.Id, &model.ChannelView{ChannelId: privateChannel.Id})
	require.NoError(t, err)

	status, appErr := th.App.GetStatus(th.BasicUser.Id)
	require.Nil(t, appErr)
	require.Equal(t, privateChannel.Id, status.ActiveChannel, "precondition: the target user must have an active channel set")

	getRawStatus := func(t *testing.T, client *model.Client4, userID string) map[string]any {
		t.Helper()
		resp, err := client.DoAPIGet(context.Background(), "/users/"+userID+"/status", "")
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var raw map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&raw))
		return raw
	}

	getRawStatusesByIds := func(t *testing.T, client *model.Client4, userIDs []string) []map[string]any {
		t.Helper()
		body, jsonErr := json.Marshal(userIDs)
		require.NoError(t, jsonErr)

		resp, err := client.DoAPIPost(context.Background(), "/users/status/ids", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var raw []map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&raw))
		return raw
	}

	t.Run("get status of a user active in a channel the caller is not a member of", func(t *testing.T) {
		th.LoginBasic2(t)

		_, resp, err := th.Client.GetChannel(context.Background(), privateChannel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		raw := getRawStatus(t, th.Client, th.BasicUser.Id)
		assert.NotContains(t, raw, "active_channel")
		assert.Equal(t, th.BasicUser.Id, raw["user_id"])
		assert.Equal(t, model.StatusOnline, raw["status"])
	})

	t.Run("get statuses by ids of a user active in a channel the caller is not a member of", func(t *testing.T) {
		th.LoginBasic2(t)

		raw := getRawStatusesByIds(t, th.Client, []string{th.BasicUser.Id, th.BasicUser2.Id})
		require.Len(t, raw, 2)
		for _, status := range raw {
			assert.NotContains(t, status, "active_channel")
			assert.NotEmpty(t, status["user_id"])
			assert.NotEmpty(t, status["status"])
		}
	})

	t.Run("get own status", func(t *testing.T) {
		th.LoginBasic(t)

		raw := getRawStatus(t, th.Client, th.BasicUser.Id)
		assert.NotContains(t, raw, "active_channel")

		rawList := getRawStatusesByIds(t, th.Client, []string{th.BasicUser.Id})
		require.Len(t, rawList, 1)
		assert.NotContains(t, rawList[0], "active_channel")
	})

	t.Run("get status as system admin", func(t *testing.T) {
		raw := getRawStatus(t, th.SystemAdminClient, th.BasicUser.Id)
		assert.NotContains(t, raw, "active_channel")

		rawList := getRawStatusesByIds(t, th.SystemAdminClient, []string{th.BasicUser.Id})
		require.Len(t, rawList, 1)
		assert.NotContains(t, rawList[0], "active_channel")
	})

	t.Run("update own status", func(t *testing.T) {
		th.LoginBasic(t)

		toUpdate := &model.Status{UserId: th.BasicUser.Id, Status: model.StatusDnd, Manual: true}
		body, jsonErr := json.Marshal(toUpdate)
		require.NoError(t, jsonErr)

		resp, err := th.Client.DoAPIPut(context.Background(), "/users/"+th.BasicUser.Id+"/status", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var raw map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&raw))
		assert.NotContains(t, raw, "active_channel")
		assert.Equal(t, model.StatusDnd, raw["status"])
	})

	t.Run("the active channel is still tracked server side", func(t *testing.T) {
		status, appErr := th.App.GetStatus(th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.Equal(t, privateChannel.Id, status.ActiveChannel)
	})
}

func TestUpdateUserStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("set online status", func(t *testing.T) {
		toUpdateUserStatus := &model.Status{Status: "online", UserId: th.BasicUser.Id}
		updateUserStatus, _, err := client.UpdateUserStatus(context.Background(), th.BasicUser.Id, toUpdateUserStatus)
		require.NoError(t, err)
		assert.Equal(t, "online", updateUserStatus.Status)
	})

	t.Run("set away status", func(t *testing.T) {
		toUpdateUserStatus := &model.Status{Status: "away", UserId: th.BasicUser.Id}
		updateUserStatus, _, err := client.UpdateUserStatus(context.Background(), th.BasicUser.Id, toUpdateUserStatus)
		require.NoError(t, err)
		assert.Equal(t, "away", updateUserStatus.Status)
	})

	t.Run("set dnd status timed", func(t *testing.T) {
		toUpdateUserStatus := &model.Status{Status: "dnd", UserId: th.BasicUser.Id, DNDEndTime: time.Now().Add(10 * time.Minute).Unix()}
		updateUserStatus, _, err := client.UpdateUserStatus(context.Background(), th.BasicUser.Id, toUpdateUserStatus)
		require.NoError(t, err)
		assert.Equal(t, "dnd", updateUserStatus.Status)
	})

	t.Run("set offline status", func(t *testing.T) {
		toUpdateUserStatus := &model.Status{Status: "offline", UserId: th.BasicUser.Id}
		updateUserStatus, _, err := client.UpdateUserStatus(context.Background(), th.BasicUser.Id, toUpdateUserStatus)
		require.NoError(t, err)
		assert.Equal(t, "offline", updateUserStatus.Status)
	})

	t.Run("set status for other user as regular user", func(t *testing.T) {
		toUpdateUserStatus := &model.Status{Status: "online", UserId: th.BasicUser2.Id}
		_, resp, err := client.UpdateUserStatus(context.Background(), th.BasicUser2.Id, toUpdateUserStatus)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("set status for other user as admin user", func(t *testing.T) {
		toUpdateUserStatus := &model.Status{Status: "online", UserId: th.BasicUser2.Id}
		updateUserStatus, _, _ := th.SystemAdminClient.UpdateUserStatus(context.Background(), th.BasicUser2.Id, toUpdateUserStatus)
		assert.Equal(t, "online", updateUserStatus.Status)
	})

	t.Run("not matching status user id and the user id passed in the function", func(t *testing.T) {
		toUpdateUserStatus := &model.Status{Status: "online", UserId: th.BasicUser2.Id}
		_, resp, err := client.UpdateUserStatus(context.Background(), th.BasicUser.Id, toUpdateUserStatus)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get statuses from logged out user", func(t *testing.T) {
		toUpdateUserStatus := &model.Status{Status: "online", UserId: th.BasicUser2.Id}
		_, err := client.Logout(context.Background())
		require.NoError(t, err)

		_, resp, err := client.UpdateUserStatus(context.Background(), th.BasicUser2.Id, toUpdateUserStatus)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestUpdateUserCustomStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("set custom status", func(t *testing.T) {
		toUpdateCustomStatus := &model.CustomStatus{
			Emoji: "calendar", // Use a valid emoji name
			Text:  "My custom status",
		}
		_, resp, err := client.UpdateUserCustomStatus(context.Background(), th.BasicUser.Id, toUpdateCustomStatus)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		user, _, err := client.GetUser(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		customStatus := user.GetCustomStatus()
		require.NotNil(t, customStatus)
		assert.Equal(t, toUpdateCustomStatus.Emoji, customStatus.Emoji)
		assert.Equal(t, toUpdateCustomStatus.Text, customStatus.Text)
	})

	t.Run("update custom status with duration", func(t *testing.T) {
		expiresAt := time.Now().Add(1 * time.Hour)
		toUpdateCustomStatus := &model.CustomStatus{
			Emoji:     "palm_tree", // Use a valid emoji name
			Text:      "On vacation",
			Duration:  "date_and_time",
			ExpiresAt: expiresAt,
		}
		_, resp, err := client.UpdateUserCustomStatus(context.Background(), th.BasicUser.Id, toUpdateCustomStatus)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		user, _, err := client.GetUser(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		customStatus := user.GetCustomStatus()
		require.NotNil(t, customStatus)
		assert.Equal(t, toUpdateCustomStatus.Emoji, customStatus.Emoji)
		assert.Equal(t, toUpdateCustomStatus.Text, customStatus.Text)
		assert.Equal(t, toUpdateCustomStatus.Duration, customStatus.Duration)

		require.NotNil(t, customStatus.ExpiresAt, "Expected ExpiresAt to be set")
		// Check that ExpiresAt is within 5 seconds of the expected time
		assert.WithinDuration(t, expiresAt, customStatus.ExpiresAt, 5*time.Second)
	})

	t.Run("attempt to set custom status when disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableCustomUserStatuses = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableCustomUserStatuses = true })

		toUpdateCustomStatus := &model.CustomStatus{
			Emoji: "palm_tree",
			Text:  "My custom status",
		}
		_, resp, err := client.UpdateUserCustomStatus(context.Background(), th.BasicUser.Id, toUpdateCustomStatus)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		// Assert that the error ID is "api.custom_status.disabled"
		if appErr, ok := err.(*model.AppError); ok {
			assert.Equal(t, "api.custom_status.disabled", appErr.Id)
		} else {
			t.Errorf("expected *model.AppError, got %T", err)
		}
	})

	t.Run("attempt to set custom status for another user", func(t *testing.T) {
		toUpdateCustomStatus := &model.CustomStatus{
			Emoji: "palm_tree",
			Text:  "My custom status",
		}
		_, resp, err := client.UpdateUserCustomStatus(context.Background(), th.BasicUser2.Id, toUpdateCustomStatus)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("attempt to set custom status with invalid data", func(t *testing.T) {
		toUpdateCustomStatus := &model.CustomStatus{
			Emoji:     "invalid_emoji",
			Text:      strings.Repeat("a", 101), // Exceeds max length
			Duration:  "invalid_duration",
			ExpiresAt: time.Now().Add(-1 * time.Hour),
		}
		_, resp, err := client.UpdateUserCustomStatus(context.Background(), th.BasicUser.Id, toUpdateCustomStatus)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("attempt to set custom status as non-authenticated user", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		toUpdateCustomStatus := &model.CustomStatus{
			Emoji: "palm_tree",
			Text:  "My custom status",
		}
		_, resp, err := client.UpdateUserCustomStatus(context.Background(), th.BasicUser.Id, toUpdateCustomStatus)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestRemoveUserCustomStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("remove custom status successfully", func(t *testing.T) {
		toUpdateCustomStatus := &model.CustomStatus{
			Emoji: "calendar",
			Text:  "My custom status",
		}
		_, _, err := client.UpdateUserCustomStatus(context.Background(), th.BasicUser.Id, toUpdateCustomStatus)
		require.NoError(t, err)

		resp, err := client.RemoveUserCustomStatus(context.Background(), th.BasicUser.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		user, _, err := client.GetUser(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		customStatus := user.GetCustomStatus()
		assert.Nil(t, customStatus)
	})

	t.Run("attempt to remove custom status when disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableCustomUserStatuses = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableCustomUserStatuses = true })

		resp, err := client.RemoveUserCustomStatus(context.Background(), th.BasicUser.Id)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("attempt to remove custom status for another user", func(t *testing.T) {
		resp, err := client.RemoveUserCustomStatus(context.Background(), th.BasicUser2.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("attempt to remove custom status as non-authenticated user", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		resp, err := client.RemoveUserCustomStatus(context.Background(), th.BasicUser.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("remove non-existent custom status", func(t *testing.T) {
		th.LoginBasic(t)
		resp, err := client.RemoveUserCustomStatus(context.Background(), th.BasicUser.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("remove custom status with system admin", func(t *testing.T) {
		toUpdateCustomStatus := &model.CustomStatus{
			Emoji: "calendar",
			Text:  "My custom status",
		}
		_, _, err := client.UpdateUserCustomStatus(context.Background(), th.BasicUser.Id, toUpdateCustomStatus)
		require.NoError(t, err)

		resp, err := th.SystemAdminClient.RemoveUserCustomStatus(context.Background(), th.BasicUser.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		user, _, err := client.GetUser(context.Background(), th.BasicUser.Id, "")
		require.NoError(t, err)
		customStatus := user.GetCustomStatus()
		assert.Nil(t, customStatus)
	})
}
