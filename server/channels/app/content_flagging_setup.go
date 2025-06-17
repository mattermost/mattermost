// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

var contentFlaggingGroupID string

func (a *App) GetContentFlaggingGroupID() (string, error) {
	if contentFlaggingGroupID != "" {
		return contentFlaggingGroupID, nil
	}

	group, err := a.Srv().propertyService.RegisterPropertyGroup(model.ContentFlaggingGroupName)
	if err != nil {
		return "", errors.Wrap(err, "failed to register Content Flagging group")
	}
	contentFlaggingGroupID = group.ID

	return contentFlaggingGroupID, nil
}
