// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
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

	th.App.Srv().SetLicense(model.NewTestLicense("omnisearch"))

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
						Id: "result1",
						Title: "Result 1",
						Description: "First test result",
						Link: "/link/to/result1",
						CreateAt: 1234,
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

		params := &model.SearchParameter{
			Terms:          model.NewString("searchterm"),
			IsOrSearch:     model.NewBool(false),
			TimeZoneOffset: model.NewInt(0),
			Page:           model.NewInt(0),
			PerPage:        model.NewInt(10),
		}

		results, resp, err := th.Client.OmniSearch(context.Background(), params)
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)
		require.Len(t, results, 1)
		require.Equal(t, "result1", results[0].Id)
		require.Equal(t, "Result 1", results[0].Title)
		require.Equal(t, "First test result", results[0].Description)
		require.Equal(t, "/link/to/result1", results[0].Link)
		require.Equal(t, int64(1234), results[0].CreateAt)
		require.Equal(t, "test_source", results[0].Source)
	})

	t.Run("should handle disabled omnisearch", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableOmniSearch = false
		})

		params := &model.SearchParameter{
			Terms:          model.NewString("searchterm"),
			IsOrSearch:     model.NewBool(false),
			TimeZoneOffset: model.NewInt(0),
			Page:           model.NewInt(0),
			PerPage:        model.NewInt(10),
		}

		_, resp, err := th.Client.OmniSearch(context.Background(), params)
		require.Error(t, err)
		require.Equal(t, 501, resp.StatusCode)
	})

	t.Run("should handle non-enterprise", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableOmniSearch = true
		})

		params := &model.SearchParameter{
			Terms:          model.NewString("searchterm"),
			IsOrSearch:     model.NewBool(false),
			TimeZoneOffset: model.NewInt(0),
			Page:           model.NewInt(0),
			PerPage:        model.NewInt(10),
		}

		_, resp, err := th.Client.OmniSearch(context.Background(), params)
		require.Error(t, err)
		require.Equal(t, 501, resp.StatusCode)
	})

	t.Run("should handle invalid parameters", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableOmniSearch = true
		})
		th.App.Srv().SetLicense(model.NewTestLicense("omnisearch"))

		params := &model.SearchParameter{
			Terms:          nil,
			IsOrSearch:     model.NewBool(false),
			TimeZoneOffset: model.NewInt(0),
			Page:           model.NewInt(0),
			PerPage:        model.NewInt(10),
		}

		_, resp, err := th.Client.OmniSearch(context.Background(), params)
		require.Error(t, err)
		require.Equal(t, 400, resp.StatusCode)
	})

	t.Run("should handle unauthorized user", func(t *testing.T) {
		params := &model.SearchParameter{
			Terms:          model.NewString("searchterm"),
			IsOrSearch:     model.NewBool(false),
			TimeZoneOffset: model.NewInt(0),
			Page:           model.NewInt(0),
			PerPage:        model.NewInt(10),
		}

		client := th.CreateClient()
		_, resp, err := client.OmniSearch(context.Background(), params)
		require.Error(t, err)
		require.Equal(t, 401, resp.StatusCode)
	})
}
