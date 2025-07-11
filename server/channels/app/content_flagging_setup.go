// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const contentFlaggingSetupDoneKey = "content_flagging_setup_done"

var contentFlaggingGroupID string
var contentFlaggingSetupOnce sync.Once

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

func (a *App) SetupContentFlaggingProperties() error {
	var setupErr error

	contentFlaggingSetupOnce.Do(func() {
		groupId, err := a.GetContentFlaggingGroupID()
		if err != nil {
			setupErr = errors.Wrap(err, "failed to get Content Flagging group ID when setting up content flagging properties")
			return
		}

		if system, err := a.Srv().Store().System().GetByName(contentFlaggingSetupDoneKey); err == nil && system.Value == "true" {
			// If the setup is already done, we skip the property creation
			return
		}

		// register status property
		properties := []*model.PropertyField{
			{
				GroupID: groupId,
				Name:    "status",
				Type:    model.PropertyFieldTypeText,
			},
			{
				GroupID: groupId,
				Name:    "reporting_user_id",
				Type:    model.PropertyFieldTypeUser,
			},
			{
				GroupID: groupId,
				Name:    "reporting_reason",
				Type:    model.PropertyFieldTypeText,
			},
			{
				GroupID: groupId,
				Name:    "reporting_comment",
				Type:    model.PropertyFieldTypeText,
			},
			{
				GroupID: groupId,
				Name:    "reporting_time",
				Type:    model.PropertyFieldTypeText,
			},
			{
				GroupID: groupId,
				Name:    "reviewer_user_id",
				Type:    model.PropertyFieldTypeUser,
			},
			{
				GroupID: groupId,
				Name:    "actor_user_id",
				Type:    model.PropertyFieldTypeUser,
			},
			{
				GroupID: groupId,
				Name:    "actor_comment",
				Type:    model.PropertyFieldTypeText,
			},
			{
				GroupID: groupId,
				Name:    "action_action_time",
				Type:    model.PropertyFieldTypeText,
			},
		}

		for _, property := range properties {
			if _, err := a.Srv().propertyService.CreatePropertyField(property); err != nil {
				setupErr = errors.Wrapf(err, "failed to create content flagging property %q", property.Name)
				return
			}
		}

		if err := a.Srv().Store().System().Save(&model.System{Name: contentFlaggingSetupDoneKey, Value: "true"}); err != nil {
			setupErr = errors.Wrap(err, "failed to save content flagging setup done flag in system store")
			return
		}
	})

	return setupErr
}
