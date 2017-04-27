// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"
)

func TestConfigDefaultFileSettingsDirectory(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	if c1.FileSettings.Directory != "./data/" {
		t.Fatal("FileSettings.Directory should default to './data/'")
	}
}
