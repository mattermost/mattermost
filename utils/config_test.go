// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"
	"github.com/mattermost/platform/i18n"
)

func TestConfig(t *testing.T) {
	T := i18n.GetSystemLanguage()
	LoadConfig("config.json", T)
}
