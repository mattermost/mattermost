// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/model"
)

func TestMarketplaceProviderGetCommand(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	mp := MarketplaceProvider{}

	testCases := []struct {
		TestName string

		PluginEnabled      bool
		MarketplaceEnabled bool

		MustAutocomplete bool
	}{
		{
			"All true",
			true, true,
			true,
		},
		{
			"Plugin false",
			false, true,
			false,
		},
		{
			"Marketplace false",
			true, false,
			false,
		},
		{
			"All false",
			false, false,
			false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.TestName, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.Enable = tc.PluginEnabled
				*cfg.PluginSettings.EnableMarketplace = tc.MarketplaceEnabled
			})

			cmd := mp.GetCommand(th.App, th.Context.T)
			require.Equal(t, tc.MustAutocomplete, cmd.AutoComplete)
		})
	}
}
