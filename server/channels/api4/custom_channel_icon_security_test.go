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
// CUSTOM CHANNEL ICONS SECURITY
// ----------------------------------------------------------------------------

func TestCustomChannelIconSecurityFeatureFlag(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = false
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)

	t.Run("GET list returns 403 when feature disabled", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("POST create returns 403 when feature disabled", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Name: "test", Svg: "<svg>test</svg>"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("GET single returns 403 when feature disabled", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/custom_channel_icons/"+model.NewId(), "")
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("PUT update returns 403 when feature disabled", func(t *testing.T) {
		newName := "updated"
		patch := &model.CustomChannelIconPatch{Name: &newName}
		resp, err := th.SystemAdminClient.DoAPIPutJSON(context.Background(), "/custom_channel_icons/"+model.NewId(), patch)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("DELETE returns 403 when feature disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/custom_channel_icons/"+model.NewId())
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}

func TestCustomChannelIconSecurityPermissions(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)

	t.Run("Regular user can GET list", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		checkStatusCode(t, resp, err, http.StatusOK)
		closeIfOpen(resp, err)
	})

	t.Run("Regular user cannot POST create", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Name: "user-created", Svg: "<svg>hack</svg>"}
		resp, err := th.Client.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Regular user cannot PUT update", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Name: "admin-icon", Svg: "<svg>admin</svg>"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusCreated)
		var created model.CustomChannelIcon
		json.NewDecoder(resp.Body).Decode(&created)
		closeIfOpen(resp, err)

		newName := "hacked"
		patch := &model.CustomChannelIconPatch{Name: &newName}
		resp, err = th.Client.DoAPIPutJSON(context.Background(), "/custom_channel_icons/"+created.Id, patch)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})

	t.Run("Regular user cannot DELETE", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Name: "to-delete", Svg: "<svg>del</svg>"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusCreated)
		var created model.CustomChannelIcon
		json.NewDecoder(resp.Body).Decode(&created)
		closeIfOpen(resp, err)

		resp, err = th.Client.DoAPIDelete(context.Background(), "/custom_channel_icons/"+created.Id)
		checkStatusCode(t, resp, err, http.StatusForbidden)
	})
}

func TestCustomChannelIconSecurityValidation(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)

	t.Run("Create with missing name returns 400", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Svg: "<svg>test</svg>"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Create with missing SVG returns 400", func(t *testing.T) {
		icon := &model.CustomChannelIcon{Name: "test"}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Create with SVG exceeding 50KB returns 400", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name: "large-icon",
			Svg:  strings.Repeat("a", model.CustomChannelIconSvgMaxSize+1),
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Create with name exceeding 64 chars returns 400", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name: strings.Repeat("a", model.CustomChannelIconNameMaxLength+1),
			Svg:  "<svg>test</svg>",
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusBadRequest)
	})

	t.Run("Update non-existent icon returns 404", func(t *testing.T) {
		newName := "ghost"
		patch := &model.CustomChannelIconPatch{Name: &newName}
		resp, err := th.SystemAdminClient.DoAPIPutJSON(context.Background(), "/custom_channel_icons/nonexistent", patch)
		checkStatusCode(t, resp, err, http.StatusNotFound)
	})

	t.Run("Delete non-existent icon returns 404", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIDelete(context.Background(), "/custom_channel_icons/nonexistent")
		checkStatusCode(t, resp, err, http.StatusNotFound)
	})

	t.Run("SVG with script tags accepted as base64 content", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name: "xss-test-icon",
			Svg:  `PHN2Zz48c2NyaXB0PmFsZXJ0KCd4c3MnKTwvc2NyaXB0Pjwvc3ZnPg==`,
		}
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		checkStatusCode(t, resp, err, http.StatusCreated)
		closeIfOpen(resp, err)
	})
}
