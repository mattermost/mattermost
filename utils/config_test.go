// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"github.com/mattermost/platform/i18n"
	"testing"
)

var T = i18n.TranslateFunc

func TestConfig(t *testing.T) {
	T = i18n.GetTranslationsBySystemLocale()
	LoadConfig("config.json", T)
}
