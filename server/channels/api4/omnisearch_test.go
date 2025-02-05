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
