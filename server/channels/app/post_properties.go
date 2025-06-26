// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"github.com/mattermost/mattermost/server/public/model"
	"net/http"
)

type PostPropertyChangeListener func(postId, userID, groupID string, oldProperties map[string]model.PropertyValue, newProperties map[string]json.RawMessage) *model.AppError

var postPropertyChangeListenerMap = map[string]PostPropertyChangeListener{
	model.ContentFlaggingGroupName: contentFlaggingPostPropertyChangeListener,
}

func (a *App) PatchPostProperties(userId, postId string, patch model.PatchPostProperties) *model.AppError {
	oldProperties, appErr := a.getPostPropertiesGrouped(postId, patch)
	if appErr != nil {
		return appErr
	}

	// now upsert the changes in DB, then run change listeners
	var propertyValues []*model.PropertyValue
	for groupId, groupValues := range patch {
		for fieldId, propertyValue := range groupValues.PropertyValueById {
			value := &model.PropertyValue{
				TargetID:   postId,
				TargetType: model.TargetTypePost,
				GroupID:    groupId,
				FieldID:    fieldId,
				Value:      propertyValue,
			}
			propertyValues = append(propertyValues, value)
		}
	}

	updatedPropertyValues, err := a.PropertyService().UpsertPropertyValues(propertyValues)
	if err != nil {
		return model.NewAppError("App.PatchPostProperties", "", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	j, _ := json.Marshal(updatedPropertyValues)
	fmt.Println(string(j))

	// run each change listener
	for groupId := range patch {
		groupName := patch[groupId].Group.Name
		changeListener, ok := postPropertyChangeListenerMap[groupName]
		if !ok {
			// not having a change listener for group is considered error
			return model.NewAppError("App.PatchPostProperties", "", nil, "", http.StatusBadRequest)
		}

		err := changeListener(postId, userId, groupId, oldProperties[groupId], patch[groupId].PropertyValueById)
		if err != nil {
			return model.NewAppError("App.PatchPostProperties", "", nil, "", err.StatusCode).Wrap(err)
		}
	}

	return nil
}

func contentFlaggingPostPropertyChangeListener(postId, userID, groupID string, oldProperties map[string]model.PropertyValue, newProperties map[string]json.RawMessage) *model.AppError {
	// no-op
	return nil
}

func (a *App) getPostPropertiesGrouped(postId string, patch model.PatchPostProperties) (model.GroupedPropertyValues, *model.AppError) {
	var groupIDs []string
	for groupId := range patch {
		groupIDs = append(groupIDs, groupId)
	}

	propertyValues, err := a.PropertyService().GetForTarget(postId, model.TargetTypePost, groupIDs)
	if err != nil {
		return nil, model.NewAppError("App.getPostPropertiesGrouped", "", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	groupedPropertyValues := model.GroupedPropertyValues{}

	for _, propertyValue := range propertyValues {
		if _, ok := groupedPropertyValues[propertyValue.GroupID]; !ok {
			groupedPropertyValues[propertyValue.GroupID] = map[string]model.PropertyValue{}
		}

		groupedPropertyValues[propertyValue.GroupID][propertyValue.ID] = *propertyValue
	}

	return groupedPropertyValues, nil
}
