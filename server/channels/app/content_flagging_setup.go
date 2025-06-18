// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"sync"
	"sync/atomic"
)

const (
	ContentFlaggingPropertyStausName = "status"
)

var contentFlaggingGroupID string
var contentFlaggingSetupMutex = sync.RWMutex{}
var contentFlaggingSetupDone int32

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
	// Setup needs to be done only once, so we use an atomic flag
	if atomic.LoadInt32(&contentFlaggingSetupDone) != 0 {
		return nil
	}

	groupId, err := a.GetContentFlaggingGroupID()
	if err != nil {
		return errors.Wrap(err, "failed to get Content Flagging group ID when setting up content flagging properties")
	}

	// register status property
	properties := []*model.PropertyField{
		{
			GroupID: groupId,
			Name:    ContentFlaggingPropertyStausName,
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

	existingContentFlaggingProperties, err := a.Srv().propertyService.SearchPropertyFields(groupId, "", model.PropertyFieldSearchOpts{PerPage: 100, IncludeDeleted: false})
	if err != nil {
		return errors.Wrap(err, "failed to search existing content flagging properties")
	}

	propertyNames := make(map[string]bool)
	for _, property := range existingContentFlaggingProperties {
		propertyNames[property.Name] = true
	}

	for _, property := range properties {
		if _, exists := propertyNames[property.Name]; exists {
			continue // skip if property already exists
		}

		if _, err := a.Srv().propertyService.CreatePropertyField(property); err != nil {
			return errors.Wrapf(err, "failed to create content flagging property %q", property.Name)
		}
	}

	atomic.StoreInt32(&contentFlaggingSetupDone, 1)
	return nil
}
