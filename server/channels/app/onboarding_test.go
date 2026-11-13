// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	mm_model "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func TestOnboardingSavesOrganizationName(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	appErr := th.App.CompleteOnboarding(th.Context, &mm_model.CompleteOnboardingRequest{
		Organization: "Mattermost In Tests",
	})
	require.Nil(t, appErr)
	defer func() {
		_, err := th.App.Srv().Store().System().PermanentDeleteByName(mm_model.SystemOrganizationName)
		require.NoError(t, err)
	}()

	sys, storeErr := th.App.Srv().Store().System().GetByName(mm_model.SystemOrganizationName)
	require.NoError(t, storeErr)
	require.Equal(t, "Mattermost In Tests", sys.Value)
}

func TestOnboardingSavesSiteURL(t *testing.T) {
	// Not parallel: a subtest sets an environment variable.
	th := Setup(t)

	setSiteURL := func(siteURL string) {
		th.App.UpdateConfig(func(cfg *mm_model.Config) {
			cfg.ServiceSettings.SiteURL = &siteURL
		})
	}
	completeOnboarding := func(th *TestHelper, siteURL string) *mm_model.AppError {
		return th.App.CompleteOnboarding(th.Context, &mm_model.CompleteOnboardingRequest{
			Organization: "Mattermost In Tests",
			SiteURL:      siteURL,
		})
	}

	t.Run("saves the site URL when none is set", func(t *testing.T) {
		for _, current := range []string{"", mm_model.ServiceSettingsDefaultSiteURL} {
			setSiteURL(current)

			require.Nil(t, completeOnboarding(th, "https://mattermost.example.com/"))
			assert.Equal(t, "https://mattermost.example.com", *th.App.Config().ServiceSettings.SiteURL)
		}

		setSiteURL("")
		require.Nil(t, completeOnboarding(th, "http://10.0.0.5:8065"))
		assert.Equal(t, "http://10.0.0.5:8065", *th.App.Config().ServiceSettings.SiteURL)
	})

	t.Run("ignores an empty site URL", func(t *testing.T) {
		setSiteURL("")

		require.Nil(t, completeOnboarding(th, ""))
		assert.Empty(t, *th.App.Config().ServiceSettings.SiteURL)
	})

	t.Run("does not overwrite a site URL set by an admin", func(t *testing.T) {
		setSiteURL("https://admin.example.com")

		require.Nil(t, completeOnboarding(th, "https://mattermost.example.com"))
		assert.Equal(t, "https://admin.example.com", *th.App.Config().ServiceSettings.SiteURL)
	})

	t.Run("skips the site URL when system admins are restricted", func(t *testing.T) {
		setSiteURL("")
		th.App.UpdateConfig(func(cfg *mm_model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })
		defer th.App.UpdateConfig(func(cfg *mm_model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = false })

		require.Nil(t, completeOnboarding(th, "https://mattermost.example.com"))
		assert.Empty(t, *th.App.Config().ServiceSettings.SiteURL)
	})

	t.Run("rejects an invalid site URL", func(t *testing.T) {
		setSiteURL("")

		for _, siteURL := range []string{
			"mattermost.example.com",
			"/relative/path",
			"ftp://mattermost.example.com",
			"https://",
			"http:///path",
			"https://mattermost.example.com/subpath",
			"https://mattermost.example.com/?a=1",
			"https://mattermost.example.com/#fragment",
			"https://user:secret@mattermost.example.com",
			" https://mattermost.example.com",
			"https://:8065",
			"https://mattermost.example.com:",
			"https://mattermost.example.com:0",
			"https://mattermost.example.com:99999",
		} {
			appErr := completeOnboarding(th, siteURL)
			require.NotNil(t, appErr, siteURL)
			assert.Equal(t, "api.error_invalid_site_url_provided_for_onboarding", appErr.Id, siteURL)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode, siteURL)
		}
		assert.Empty(t, *th.App.Config().ServiceSettings.SiteURL)
	})

	t.Run("skips a site URL set by an environment variable", func(t *testing.T) {
		setSiteURL("")
		// An empty value is still an override: the config store would re-apply it on save.
		t.Setenv("MM_SERVICESETTINGS_SITEURL", "")

		require.Nil(t, completeOnboarding(th, "https://mattermost.example.com"))
		assert.Empty(t, *th.App.Config().ServiceSettings.SiteURL)

		// The config value alone can't prove the guard fired, since a save would be undone by the
		// override anyway, so check for its log line.
		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertLog(t, th.LogBuffer, mlog.LvlDebug.Name, "Site URL is set by an environment variable, ignoring the onboarding value")
	})

	t.Run("completes onboarding when saving the site URL fails", func(t *testing.T) {
		th := Setup(t)

		// Fail every config save from a plugin hook.
		tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t, []string{
			fmt.Sprintf(configurationWillBeSavedHookTemplate, `return nil, fmt.Errorf("plugin hook failed")`),
		}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.NoError(t, activationErrors[0])

		require.Nil(t, completeOnboarding(th, "https://mattermost.example.com"))
		assert.Empty(t, *th.App.Config().ServiceSettings.SiteURL)

		onboarding, appErr := th.App.GetOnboarding()
		require.Nil(t, appErr)
		assert.Equal(t, "true", onboarding.Value)

		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertLog(t, th.LogBuffer, mlog.LvlWarn.Name, "Failed to save the Site URL during onboarding")
	})
}
