// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDeepMergeMaps(t *testing.T) {
	testCases := []struct {
		Name     string
		Base     map[string]any
		Patch    map[string]any
		Expected map[string]any
	}{
		{
			Name:     "Values of base doesn't exist in patch",
			Base:     map[string]any{"Name": "John", "Surname": "Doe"},
			Patch:    map[string]any{"Name": "Jane"},
			Expected: map[string]any{"Name": "Jane", "Surname": "Doe"},
		},
		{
			Name:     "Values of patch doesn't exist in base",
			Base:     map[string]any{"Name": "John"},
			Patch:    map[string]any{"Name": "Jane", "Surname": "Doe"},
			Expected: map[string]any{"Name": "Jane", "Surname": "Doe"},
		},
		{
			Name:     "Maps contain nested maps",
			Base:     map[string]any{"Person": map[string]any{"Name": "John", "Surname": "Doe"}},
			Patch:    map[string]any{"Person": map[string]any{"Name": "Jane"}, "Age": 27},
			Expected: map[string]any{"Person": map[string]any{"Name": "Jane", "Surname": "Doe"}, "Age": 27},
		},
		{
			Name:     "Values have different types",
			Base:     map[string]any{"Person": "John Doe"},
			Patch:    map[string]any{"Person": map[string]any{"Name": "John", "Surname": "Doe"}},
			Expected: map[string]any{"Person": map[string]any{"Name": "John", "Surname": "Doe"}},
		},
		{
			Name:     "Values have different types, reversed",
			Base:     map[string]any{"Person": map[string]any{"Name": "John", "Surname": "Doe"}},
			Patch:    map[string]any{"Person": "John Doe"},
			Expected: map[string]any{"Person": "John Doe"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			require.Equal(t, DeepMergeMaps(tc.Base, tc.Patch), tc.Expected)
		})
	}
}

func TestMergePluginConfigs(t *testing.T) {
	basePluginConfig := map[string]map[string]any{
		"plugin.1": {
			"First": "key",
			"Second": map[string]any{
				"nested": "key",
			},
		},
		"plugin.2": {
			"Name": "John",
		},
	}

	patchPluginConfig := map[string]map[string]any{
		"plugin.1": {
			"Second": map[string]any{
				"nested": false,
				"new":    1,
			},
		},
		"plugin.3": {
			"New": "plugin",
		},
	}

	expectedPluginConfig := map[string]map[string]any{
		"plugin.1": {
			"First": "key",
			"Second": map[string]any{
				"nested": false,
				"new":    1,
			},
		},
		"plugin.2": {
			"Name": "John",
		},
		"plugin.3": {
			"New": "plugin",
		},
	}

	mergedPluginConfigs := MergePluginConfigs(basePluginConfig, patchPluginConfig)
	require.Equal(t, expectedPluginConfig, mergedPluginConfigs)
}
