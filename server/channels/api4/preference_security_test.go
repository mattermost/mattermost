// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// mattermost-extended-test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ----------------------------------------------------------------------------
// PREFERENCE PUSH SECURITY
// ----------------------------------------------------------------------------

func TestPreferencePushSecurity(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns 403 for regular user", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "display_settings",
			Name:     "theme",
			Value:    "dark",
		}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/users/"+th.BasicUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can push preferences", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "display_settings",
			Name:     "theme",
			Value:    "dark",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		var pushResp model.PushPreferenceResponse
		decErr := json.NewDecoder(resp.Body).Decode(&pushResp)
		require.NoError(t, decErr)
		assert.GreaterOrEqual(t, pushResp.AffectedUsers, int64(0))
	})

	t.Run("Empty category returns 400", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "",
			Name:     "theme",
			Value:    "dark",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Category exceeding 32 chars returns 400", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: strings.Repeat("a", 33),
			Name:     "theme",
			Value:    "dark",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Name exceeding 32 chars returns 400", func(t *testing.T) {
		req := &model.PushPreferenceRequest{
			Category: "test",
			Name:     strings.Repeat("a", 33),
			Value:    "dark",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/push", req)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})
}

// ----------------------------------------------------------------------------
// PREFERENCE DISCOVERY SECURITY
// ----------------------------------------------------------------------------

func TestPreferenceDiscoverySecurity(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Returns 403 for regular user", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/users/"+th.BasicUser.Id+"/preferences/discover", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Admin can discover preferences", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/users/"+th.SystemAdminUser.Id+"/preferences/discover", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		defer closeIfOpen(resp, err)

		// Just verify we can decode the response (may be null/empty if no preferences exist)
		var keys json.RawMessage
		decErr := json.NewDecoder(resp.Body).Decode(&keys)
		require.NoError(t, decErr)
	})
}
