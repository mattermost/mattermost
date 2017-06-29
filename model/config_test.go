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

	if *c1.FileSettings.EnableClientSideEncryption {
		t.Fatal("FileSettings.EnableClientSideEncryption should default to false")
	}

	c1 = Config{}
	c1.FileSettings.EnableClientSideEncryption = new(bool)
	*c1.FileSettings.EnableClientSideEncryption = true
	c1.SetDefaults()

	if *c1.FileSettings.ClientSideEncryptionKey == "" {
		t.Fatal("FileSettings.ClientSideEncryptionKey should be generated if EnableClientSideEncryption is true and no value is provided")
	}
}
