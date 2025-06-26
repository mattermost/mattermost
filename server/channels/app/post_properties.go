// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"net/http"
)

type PostPropertyChangeListener func(postId, userID, groupID string, oldProperties map[string]model.PropertyValue, newProperties map[string]model.PropertyValue) *model.AppError

var postPropertyChangeListenerMap = map[string]PostPropertyChangeListener{
	model.ContentFlaggingGroupName: contentFlaggingPostPropertyChangeListener,
}

func (a *App) PatchPostProperties(userId, postId string, patch model.PatchPostProperties) ([]*model.PropertyValue, *model.AppError) {
	oldProperties, appErr := a.getPostPropertiesGrouped(postId, patch)
	if appErr != nil {
		return nil, appErr
	}

	// now upsert the changes in DB, then run change listeners
	var allGroupPropertyValues []*model.PropertyValue
	for _, groupValues := range patch {
		//for fieldId, propertyValue := range groupValues.PropertyValueById {
		//	value := &model.PropertyValue{
		//		TargetID:   postId,
		//		TargetType: model.TargetTypePost,
		//		GroupID:    groupId,
		//		FieldID:    fieldId,
		//		Value:      propertyValue,
		//	}
		//	allGroupPropertyValues = append(allGroupPropertyValues, value)
		//}
		allGroupPropertyValues = append(allGroupPropertyValues, groupValues...)
	}

	updatedPropertyValues, err := a.PropertyService().UpsertPropertyValues(allGroupPropertyValues)
	if err != nil {
		return nil, model.NewAppError("App.PatchPostProperties", "", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	groupedMappedUpdatedValues := model.GroupedPropertyValues{}
	for _, updatedPropertyValue := range updatedPropertyValues {
		if _, exists := groupedMappedUpdatedValues[updatedPropertyValue.GroupID]; !exists {
			groupedMappedUpdatedValues[updatedPropertyValue.GroupID] = map[string]model.PropertyValue{}
		}

		groupedMappedUpdatedValues[updatedPropertyValue.GroupID][updatedPropertyValue.ID] = *updatedPropertyValue
	}

	// run each change listener
	for groupName := range patch {
		changeListener, ok := postPropertyChangeListenerMap[groupName]
		if !ok {
			// not having a change listener for group is considered error
			return nil, model.NewAppError("App.PatchPostProperties", "", nil, "", http.StatusBadRequest)
		}

		groupId := patch[groupName][0].GroupID
		err := changeListener(postId, userId, groupId, oldProperties[groupId], groupedMappedUpdatedValues[groupName])
		if err != nil {
			return nil, model.NewAppError("App.PatchPostProperties", "", nil, "", err.StatusCode).Wrap(err)
		}
	}

	return updatedPropertyValues, nil
}

func contentFlaggingPostPropertyChangeListener(postId, userID, groupID string, oldProperties map[string]model.PropertyValue, newProperties map[string]model.PropertyValue) *model.AppError {
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
