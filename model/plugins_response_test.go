// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPluginsResponseJson(t *testing.T) {
	manifest := &Manifest{
		Id: "theid",
		Server: &ManifestServer{
			Executable: "theexecutable",
		},
		Webapp: &ManifestWebapp{
			BundlePath: "thebundlepath",
		},
	}

	response := &PluginsResponse{
		Active:   []*PluginInfo{{Manifest: *manifest}},
		Inactive: []*PluginInfo{},
	}

	json := response.ToJson()
	newResponse := PluginsResponseFromJson(strings.NewReader(json))
	assert.Equal(t, newResponse, response)
	assert.Equal(t, newResponse.ToJson(), json)
	assert.Equal(t, PluginsResponseFromJson(strings.NewReader("junk")), (*PluginsResponse)(nil))
}
