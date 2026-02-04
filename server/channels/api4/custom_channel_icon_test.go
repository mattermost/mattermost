// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

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

func TestGetCustomChannelIcons(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	t.Run("Get empty list", func(t *testing.T) {
		resp, err := client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var icons []*model.CustomChannelIcon
		err = json.NewDecoder(resp.Body).Decode(&icons)
		require.NoError(t, err)
		assert.Empty(t, icons)
	})

	t.Run("Get list with icons", func(t *testing.T) {
		// Create an icon
		icon := &model.CustomChannelIcon{
			Name: "test-icon",
			Svg:  "<svg>test</svg>",
		}
		resp, err := adminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		require.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
		defer resp.Body.Close()

		// Get list
		resp, err = client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var icons []*model.CustomChannelIcon
		err = json.NewDecoder(resp.Body).Decode(&icons)
		require.NoError(t, err)
		assert.Len(t, icons, 1)
		assert.Equal(t, "test-icon", icons[0].Name)
	})

	t.Run("Feature disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.CustomChannelIcons = false
		})

		resp, err := client.DoAPIGet(context.Background(), "/custom_channel_icons", "")
		require.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		defer resp.Body.Close()
	})
}

func TestGetCustomChannelIcon(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	// Create an icon
	icon := &model.CustomChannelIcon{
		Name: "test-icon-get",
		Svg:  "<svg>test</svg>",
	}
	resp, err := adminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
	require.NoError(t, err)
	defer resp.Body.Close()

	var createdIcon model.CustomChannelIcon
	err = json.NewDecoder(resp.Body).Decode(&createdIcon)
	require.NoError(t, err)

	t.Run("Get existing icon", func(t *testing.T) {
		resp, err := client.DoAPIGet(context.Background(), "/custom_channel_icons/"+createdIcon.Id, "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var fetchedIcon model.CustomChannelIcon
		err = json.NewDecoder(resp.Body).Decode(&fetchedIcon)
		require.NoError(t, err)
		assert.Equal(t, createdIcon.Id, fetchedIcon.Id)
	})

	t.Run("Get non-existent icon", func(t *testing.T) {
		resp, err := client.DoAPIGet(context.Background(), "/custom_channel_icons/nonexistent", "")
		require.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		defer resp.Body.Close()
	})

	t.Run("Get deleted icon", func(t *testing.T) {
		// Delete the icon
		resp, err := adminClient.DoAPIDelete(context.Background(), "/custom_channel_icons/"+createdIcon.Id)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		// Try to get it
		resp, err = client.DoAPIGet(context.Background(), "/custom_channel_icons/"+createdIcon.Id, "")
		require.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		defer resp.Body.Close()
	})
}

func TestCreateCustomChannelIcon(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	t.Run("Admin create success", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name: "admin-created",
			Svg:  "<svg>content</svg>",
		}
		resp, err := adminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		require.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
		defer resp.Body.Close()

		var createdIcon model.CustomChannelIcon
		err = json.NewDecoder(resp.Body).Decode(&createdIcon)
		require.NoError(t, err)
		assert.Equal(t, "admin-created", createdIcon.Name)
		assert.NotEmpty(t, createdIcon.Id)
		assert.Equal(t, th.SystemAdminUser.Id, createdIcon.CreatedBy)
	})

	t.Run("Regular user create forbidden", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name: "user-created",
			Svg:  "<svg>content</svg>",
		}
		resp, err := client.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		require.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		defer resp.Body.Close()
	})

	t.Run("Validation failures", func(t *testing.T) {
		// Empty name
		icon := &model.CustomChannelIcon{Svg: "<svg>test</svg>"}
		resp, err := adminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		require.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		defer resp.Body.Close()

		// Empty SVG
		icon = &model.CustomChannelIcon{Name: "test"}
		resp, err = adminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		require.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		defer resp.Body.Close()

		// Name too long
		icon = &model.CustomChannelIcon{
			Name: strings.Repeat("a", model.CustomChannelIconNameMaxLength+1),
			Svg:  "<svg>test</svg>",
		}
		resp, err = adminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		require.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		defer resp.Body.Close()

		// SVG too large
		icon = &model.CustomChannelIcon{
			Name: "large-svg",
			Svg:  strings.Repeat("a", model.CustomChannelIconSvgMaxSize+1),
		}
		resp, err = adminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
		require.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		defer resp.Body.Close()
	})
}

func TestUpdateCustomChannelIcon(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	// Create initial icon
	icon := &model.CustomChannelIcon{
		Name: "original",
		Svg:  "<svg>original</svg>",
	}
	resp, err := adminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
	require.NoError(t, err)
	defer resp.Body.Close()
	var createdIcon model.CustomChannelIcon
	json.NewDecoder(resp.Body).Decode(&createdIcon)

	t.Run("Admin update success", func(t *testing.T) {
		newName := "updated"
		newSvg := "<svg>updated</svg>"
		newNormalize := true
		patch := &model.CustomChannelIconPatch{
			Name:           &newName,
			Svg:            &newSvg,
			NormalizeColor: &newNormalize,
		}

		resp, err := adminClient.DoAPIPutJSON(context.Background(), "/custom_channel_icons/"+createdIcon.Id, patch)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		var updatedIcon model.CustomChannelIcon
		err = json.NewDecoder(resp.Body).Decode(&updatedIcon)
		require.NoError(t, err)
		assert.Equal(t, newName, updatedIcon.Name)
		assert.Equal(t, newSvg, updatedIcon.Svg)
		assert.True(t, updatedIcon.NormalizeColor)
	})

	t.Run("Regular user update forbidden", func(t *testing.T) {
		newName := "hacked"
		patch := &model.CustomChannelIconPatch{Name: &newName}
		resp, err := client.DoAPIPutJSON(context.Background(), "/custom_channel_icons/"+createdIcon.Id, patch)
		require.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		defer resp.Body.Close()
	})

	t.Run("Update non-existent", func(t *testing.T) {
		newName := "ghost"
		patch := &model.CustomChannelIconPatch{Name: &newName}
		resp, err := adminClient.DoAPIPutJSON(context.Background(), "/custom_channel_icons/nonexistent", patch)
		require.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		defer resp.Body.Close()
	})
}

func TestDeleteCustomChannelIcon(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomChannelIcons = true
		*cfg.CacheSettings.CacheType = "lru"
	}).InitBasic(t)
	client := th.Client
	adminClient := th.SystemAdminClient

	// Create icon
	icon := &model.CustomChannelIcon{
		Name: "to-delete",
		Svg:  "<svg>delete</svg>",
	}
	resp, err := adminClient.DoAPIPostJSON(context.Background(), "/custom_channel_icons", icon)
	require.NoError(t, err)
	defer resp.Body.Close()
	var createdIcon model.CustomChannelIcon
	json.NewDecoder(resp.Body).Decode(&createdIcon)

	t.Run("Regular user delete forbidden", func(t *testing.T) {
		resp, err := client.DoAPIDelete(context.Background(), "/custom_channel_icons/"+createdIcon.Id)
		require.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		defer resp.Body.Close()
	})

	t.Run("Admin delete success", func(t *testing.T) {
		resp, err := adminClient.DoAPIDelete(context.Background(), "/custom_channel_icons/"+createdIcon.Id)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		defer resp.Body.Close()

		// Verify deleted
		resp, err = adminClient.DoAPIGet(context.Background(), "/custom_channel_icons/"+createdIcon.Id, "")
		require.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		defer resp.Body.Close()
	})

	t.Run("Delete non-existent", func(t *testing.T) {
		resp, err := adminClient.DoAPIDelete(context.Background(), "/custom_channel_icons/nonexistent")
		require.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		defer resp.Body.Close()
	})
}
