// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

// this functions loads translations from filesystem if they are not
// loaded already and assigns english while loading server config
func TranslationsPreInit() error {
	translationsDir := "i18n"
	if mattermostPath := os.Getenv("MM_SERVER_PATH"); mattermostPath != "" {
		translationsDir = filepath.Join(mattermostPath, "i18n")
	}

	i18nDirectory, found := fileutils.FindDirRelBinary(translationsDir)
	if !found {
		return fmt.Errorf("unable to find i18n directory at %q", translationsDir)
	}

	return i18n.TranslationsPreInit(i18nDirectory)
}
