// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

func (a *App) ValidateExtension(extensionID string) bool {
	extensionIsValid := false
	extensionIDs := a.Config().ExtensionSettings.AllowedExtensionsIDs

	for _, id := range extensionIDs {
		if extensionID == id {
			extensionIsValid = true
		}
	}

	if !extensionIsValid {
		return false
	}

	return true
}
