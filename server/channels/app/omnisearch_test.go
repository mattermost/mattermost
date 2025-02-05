// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestOmniSearch(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableOmniSearch = true
	})

	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuEnterprise

	th.App.Srv().SetLicense(license)

	t.Run("should return results from plugin", func(t *testing.T) {
		pluginCode := `
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnOmniSearch(c *plugin.Context, terms string, userID string, isOrSearch bool, timeZoneOffset int, page int, perPage int) ([]*model.OmniSearchResult, error) {
				if terms != "searchterm" {
					return nil, nil
				}

				return []*model.OmniSearchResult{
					{
						ID: "result1",
						Title: "Result 1",
						Description: "First test result",
						Link: "/link/to/result1",
						CreateAt: 1234,
						Source: "test_source",
					},
					{
						ID: "result2",
						Title: "Result 2",
						Description: "Second test result",
						Link: "/link/to/result2",
						CreateAt: 5678,
						Source: "test_source",
					},
				}, nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}`

		pluginID := "testplugin"
		pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`

		setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)

		results, err := th.App.OmniSearch(th.Context, "searchterm", th.BasicUser.Id, false, 0, 0, 10)
		require.Nil(t, err)
		require.Len(t, results, 2)
		require.Equal(t, "result1", results[0].ID)
		require.Equal(t, "Result 1", results[0].Title)
		require.Equal(t, "First test result", results[0].Description)
		require.Equal(t, "/link/to/result1", results[0].Link)
		require.Equal(t, int64(1234), results[0].CreateAt)
		require.Equal(t, "test_source", results[0].Source)
	})

	t.Run("should handle multiple plugins with mixed results", func(t *testing.T) {
		// First plugin - returns results successfully
		pluginCode1 := `
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnOmniSearch(c *plugin.Context, terms string, userID string, isOrSearch bool, timeZoneOffset int, page int, perPage int) ([]*model.OmniSearchResult, error) {
				return []*model.OmniSearchResult{
					{
						ID: "success1",
						Title: "Success Result",
						Description: "Result from successful plugin",
						Link: "/link/to/success",
						CreateAt: 1234,
						Source: "success_plugin",
					},
				}, nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}`

		// Second plugin - returns error
		pluginCode2 := `
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnOmniSearch(c *plugin.Context, terms string, userID string, isOrSearch bool, timeZoneOffset int, page int, perPage int) ([]*model.OmniSearchResult, error) {
				return nil, fmt.Errorf("simulated error")
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}`

		setupPluginAPITest(t, pluginCode1, `{"id": "testplugin_success", "server": {"executable": "backend.exe"}}`, "testplugin_success", th.App, th.Context)
		setupPluginAPITest(t, pluginCode2, `{"id": "testplugin_error", "server": {"executable": "backend.exe"}}`, "testplugin_error", th.App, th.Context)

		results, err := th.App.OmniSearch(th.Context, "searchterm", th.BasicUser.Id, false, 0, 0, 10)
		require.Nil(t, err)
		require.Len(t, results, 1)
		require.Equal(t, "success1", results[0].ID)
		require.Equal(t, "Success Result", results[0].Title)
		require.Equal(t, "Result from successful plugin", results[0].Description)
		require.Equal(t, "success_plugin", results[0].Source)
	})

	t.Run("should handle plugin error", func(t *testing.T) {
		pluginCode := `
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnOmniSearch(c *plugin.Context, terms string, userID string, isOrSearch bool, timeZoneOffset int, page int, perPage int) ([]*model.OmniSearchResult, error) {
				return nil, fmt.Errorf("simulated error")
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}`

		pluginID := "testplugin2"
		pluginManifest := `{"id": "testplugin2", "server": {"executable": "backend.exe"}}`

		setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)

		results, err := th.App.OmniSearch(th.Context, "searchterm", th.BasicUser.Id, false, 0, 0, 10)
		require.Nil(t, err)
		require.Empty(t, results)
	})

	t.Run("should handle disabled omnisearch", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableOmniSearch = false
		})

		results, err := th.App.OmniSearch(th.Context, "searchterm", th.BasicUser.Id, false, 0, 0, 10)
		require.NotNil(t, err)
		require.Equal(t, "store.sql_omnisearch.disabled", err.Id)
		require.Empty(t, results)
	})

	t.Run("should handle non-enterprise", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableOmniSearch = true
		})

		results, err := th.App.OmniSearch(th.Context, "searchterm", th.BasicUser.Id, false, 0, 0, 10)
		require.NotNil(t, err)
		require.Equal(t, "store.sql_omnisearch.entreprise-only", err.Id)
		require.Empty(t, results)
	})
}
