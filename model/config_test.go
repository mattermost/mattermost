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

func TestConfigDefaultEmailNotificationContentsType(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	if *c1.EmailSettings.EmailNotificationContentsType != EMAIL_NOTIFICATION_CONTENTS_FULL {
		t.Fatal("EmailSettings.EmailNotificationContentsType should default to 'full'")
	}
}

func TestConfigDefaultFileSettingsS3SSE(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	if *c1.FileSettings.AmazonS3SSE != false {
		t.Fatal("FileSettings.AmazonS3SSE should default to false")
	}
}
