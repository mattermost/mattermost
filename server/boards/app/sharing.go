// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/server/v7/boards/model"
)

func (a *App) GetSharing(boardID string) (*model.Sharing, error) {
	sharing, err := a.store.GetSharing(boardID)
	if err != nil {
		return nil, err
	}
	return sharing, nil
}

func (a *App) UpsertSharing(sharing model.Sharing) error {
	return a.store.UpsertSharing(sharing)
}
