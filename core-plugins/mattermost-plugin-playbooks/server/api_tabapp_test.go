// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
)

func TestTabAppGetRuns(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	do := func(t *testing.T, method string, headers map[string]string) (*http.Response, error) {
		t.Helper()

		return e.ServerClient.DoAPIRequestWithHeaders(context.Background(), method, e.ServerClient.URL+"/plugins/playbooks/tabapp/runs", "", headers)
	}

	setTabApp := func(t *testing.T, enable bool) {
		cfg := e.Srv.Config()
		cfg.PluginSettings.Plugins["playbooks"]["EnableTeamsTabApp"] = enable

		var patchedConfig model.Config

		// Patching only the plugin config mysteriously doesn't trigger an OnConfigurationChange
		// back to the plugin. So mess with an unrelated setting to force this to happen.
		patchedConfig.ServiceSettings.GiphySdkKey = model.NewPointer(model.NewRandomString(6))
		patchedConfig.PluginSettings.Plugins = map[string]map[string]any{
			"playbooks": cfg.PluginSettings.Plugins["playbooks"],
		}
		_, _, err := e.ServerAdminClient.PatchConfig(context.Background(), &patchedConfig)
		require.NoError(t, err)
	}

	setDeveloperAndTestingMode := func(t *testing.T, enable bool) {
		var patchedConfig model.Config
		patchedConfig.ServiceSettings.EnableDeveloper = model.NewPointer(enable)
		patchedConfig.ServiceSettings.EnableTesting = model.NewPointer(enable)
		_, _, err := e.ServerAdminClient.PatchConfig(context.Background(), &patchedConfig)
		require.NoError(t, err)
	}

	setShowFullName := func(t *testing.T, enable bool) {
		var patchedConfig model.Config
		patchedConfig.PrivacySettings.ShowFullName = model.NewPointer(enable)
		_, _, err := e.ServerAdminClient.PatchConfig(context.Background(), &patchedConfig)
		require.NoError(t, err)
	}

	assertNoCORS := func(t *testing.T, response *http.Response) {
		assert.Empty(t, response.Header.Get("Access-Control-Allow-Origin"))
		assert.Empty(t, response.Header.Get("Access-Control-Allow-Headers"))
		assert.Empty(t, response.Header.Get("Access-Control-Allow-Methods"))
	}

	assertCORS := func(t *testing.T, expectedOrigin string, response *http.Response) {
		assert.Equal(t, expectedOrigin, response.Header.Get("Access-Control-Allow-Origin"))
		assert.Equal(t, "Authorization", response.Header.Get("Access-Control-Allow-Headers"))
		assert.Equal(t, "OPTIONS,GET", response.Header.Get("Access-Control-Allow-Methods"))
	}

	t.Run("feature disabled", func(t *testing.T) {
		setTabApp(t, false)
		setDeveloperAndTestingMode(t, false)

		response, err := do(t, http.MethodGet, nil)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, response.StatusCode)
		assertNoCORS(t, response)
	})

	t.Run("CORS headers, no provided Origin header", func(t *testing.T) {
		setTabApp(t, true)
		setDeveloperAndTestingMode(t, false)

		response, err := do(t, http.MethodOptions, nil)
		require.NoError(t, err)
		require.Equal(t, http.StatusNoContent, response.StatusCode)
		assertCORS(t, api.MicrosoftTeamsAppDomain, response)
	})

	t.Run("CORS headers, matching Origin header", func(t *testing.T) {
		setTabApp(t, true)
		setDeveloperAndTestingMode(t, false)

		response, err := do(t, http.MethodOptions, map[string]string{
			"Origin": api.MicrosoftTeamsAppDomain,
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusNoContent, response.StatusCode)
		assertCORS(t, api.MicrosoftTeamsAppDomain, response)
	})

	t.Run("CORS headers, mis-matched Origin header", func(t *testing.T) {
		setTabApp(t, true)
		setDeveloperAndTestingMode(t, false)

		response, err := do(t, http.MethodOptions, map[string]string{
			"Origin": "example.com",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusNoContent, response.StatusCode)
		assertCORS(t, api.MicrosoftTeamsAppDomain, response)
	})

	t.Run("CORS headers, mis-matched Origin header, developer + testing mode", func(t *testing.T) {
		setTabApp(t, true)
		setDeveloperAndTestingMode(t, true)

		response, err := do(t, http.MethodOptions, map[string]string{
			"Origin": "example.com",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusNoContent, response.StatusCode)
		assertCORS(t, "example.com", response)
	})

	t.Run("fetch runs, none to return (no token and developer + testing mode)", func(t *testing.T) {
		setTabApp(t, true)
		setDeveloperAndTestingMode(t, true)

		response, err := do(t, http.MethodGet, map[string]string{
			"Authorization": "",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, response.StatusCode)
		assertCORS(t, "", response)

		tabAppResults, err := e.PlaybooksClient.TabApp.GetRuns(context.Background(), "", client.TabAppGetRunsOptions{Page: 0, PerPage: 100})
		require.NoError(t, err)

		require.Empty(t, tabAppResults.Items)
		require.Empty(t, tabAppResults.Users)
		require.Empty(t, tabAppResults.Posts)
	})

	t.Run("fetch runs, one to return (no token and developer + testing mode), show full name disabled", func(t *testing.T) {
		setTabApp(t, true)
		setDeveloperAndTestingMode(t, true)
		setShowFullName(t, false)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Invite @msteams",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
		t.Cleanup(func() {
			err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
			require.NoError(t, err)
		})

		msteamsUser, _, err := e.ServerClient.GetUserByUsername(context.Background(), "msteams", "")
		require.NoError(t, err)

		_, _, err = e.ServerClient.AddTeamMember(context.Background(), e.BasicTeam.Id, msteamsUser.Id)
		require.NoError(t, err)

		_, err = addParticipants(e.PlaybooksClient, run.ID, []string{msteamsUser.Id})
		require.NoError(t, err)

		tabAppResults, err := e.PlaybooksClient.TabApp.GetRuns(context.Background(), "", client.TabAppGetRunsOptions{Page: 0, PerPage: 100})
		require.NoError(t, err)

		require.Len(t, tabAppResults.Items, 1)
		require.Len(t, tabAppResults.Users, 2)
		for _, user := range tabAppResults.Users {
			switch user.UserID {
			case msteamsUser.Id:
				assert.Equal(t, msteamsUser.Username, user.FirstName)
			case e.RegularUser.Id:
				assert.Equal(t, e.RegularUser.Username, user.FirstName)
			default:
				assert.Fail(t, "unexpected user id %s", user.UserID)
			}
			assert.Empty(t, user.LastName)
		}
		require.Empty(t, tabAppResults.Posts)
	})

	t.Run("fetch runs, one to return (no token and developer + testing mode), show full name enabled", func(t *testing.T) {
		setTabApp(t, true)
		setDeveloperAndTestingMode(t, true)
		setShowFullName(t, true)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Invite @msteams",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
		t.Cleanup(func() {
			err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
			require.NoError(t, err)
		})

		msteamsUser, _, err := e.ServerClient.GetUserByUsername(context.Background(), "msteams", "")
		require.NoError(t, err)

		_, _, err = e.ServerClient.AddTeamMember(context.Background(), e.BasicTeam.Id, msteamsUser.Id)
		require.NoError(t, err)

		_, err = addParticipants(e.PlaybooksClient, run.ID, []string{msteamsUser.Id})
		require.NoError(t, err)

		tabAppResults, err := e.PlaybooksClient.TabApp.GetRuns(context.Background(), "", client.TabAppGetRunsOptions{Page: 0, PerPage: 100})
		require.NoError(t, err)

		require.Len(t, tabAppResults.Items, 1)
		require.Len(t, tabAppResults.Users, 2)
		for _, user := range tabAppResults.Users {
			switch user.UserID {
			case msteamsUser.Id:
				assert.Equal(t, msteamsUser.FirstName, user.FirstName)
				assert.Equal(t, msteamsUser.LastName, user.LastName)
			case e.RegularUser.Id:
				assert.Equal(t, e.RegularUser.FirstName, user.FirstName)
				assert.Equal(t, e.RegularUser.LastName, user.LastName)
			default:
				assert.Fail(t, "unexpected user id %s", user.UserID)
			}
		}
		require.Empty(t, tabAppResults.Posts)
	})
}
