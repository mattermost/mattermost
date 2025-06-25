// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"github.com/mattermost/mattermost/server/public/model"
	"net/http"
)

type PatchPostPropertyGroupPermissionHandler func(postID, userID, groupName string, propertiesByGroup map[string]json.RawMessage) (map[string]json.RawMessage, *model.AppError)

var patchPermissionHandlerMap = map[string]PatchPostPropertyGroupPermissionHandler{
	model.ContentFlaggingGroupName: contentReviewGroupPermissionCheckHandler,
}

func (api *API) InitPostProperties() {
	api.BaseRoutes.PostProperties.Handle("/{post_id:[A-Za-z0-9]+}", api.APISessionRequired(patchPostProperties)).Methods(http.MethodPatch)
}

func patchPostProperties(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	postId := c.Params.PostId

	rawPatch := make(map[string]json.RawMessage)
	if err := json.NewDecoder(r.Body).Decode(&rawPatch); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	patch, appErr := toPostPropertiesPatch(c, postId, rawPatch)
	if appErr != nil {
		c.Err = appErr
		return
	}

	patch, appErr = patchPostPropertiesPermissionCheck(postId, c.AppContext.Session().UserId, patch)
	if appErr != nil {
		c.Err = appErr
		return
	}

}

func toPostPropertiesPatch(c *Context, postId string, rawPatch map[string]json.RawMessage) (model.PatchPostProperties, *model.AppError) {
	fieldIDs := []string{}
	for fieldID := range rawPatch {
		fieldIDs = append(fieldIDs, fieldID)
	}

	fields, err := c.App.PropertyService().GetPropertyFields("", fieldIDs)
	if err != nil {
		return nil, model.NewAppError("toPostPropertiesPatch", "api.post_properties.to_post_properties_patch.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fieldMap := make(map[string]*model.PropertyField)
	for _, field := range fields {
		fieldMap[field.ID] = field
	}

	patchByGroupId := model.PatchPostProperties{}

	for fieldID, value := range rawPatch {
		field, ok := fieldMap[fieldID]
		if !ok {
			return nil, model.NewAppError("toPostPropertiesPatch", "api.post_properties.to_post_properties_patch.app_error", map[string]any{"FieldID": fieldID}, "", http.StatusNotFound)
		}

		if _, ok := patchByGroupId[field.GroupID]; !ok {
			patchByGroupId[field.GroupID] = &model.Foo{
				PropertyValueById: make(map[string]json.RawMessage),
			}
		}

		patchByGroupId[field.GroupID].PropertyValueById[field.ID] = value
	}

	for groupID := range patchByGroupId {
		group, err := c.App.PropertyService().GetPropertyGroupById(groupID)
		if err != nil {
			return nil, model.NewAppError("toPostPropertiesPatch", "api.post_properties.to_post_properties_patch.app_error", map[string]any{"GroupId": groupID}, "", http.StatusInternalServerError)
		}

		patchByGroupId[groupID].PropertyValueById["1"] = json.RawMessage("1")
		patchByGroupId[groupID].Group = group
	}

	return patchByGroupId, nil
}

func patchPostPropertiesPermissionCheck(postID, userID string, patch model.PatchPostProperties) (model.PatchPostProperties, *model.AppError) {
	for groupId, foo := range patch {
		properties := foo.PropertyValueById
		groupName := patch[groupId].Group.Name

		groupPermissionFunc, ok := patchPermissionHandlerMap[patch[groupId].Group.Name]
		if !ok {
			return nil, model.NewAppError("patchPostPropertiesPermissionCheck", "api.post_properties.permission_check.unknown_group_specified", nil, "", http.StatusBadRequest)
		}

		updatedProperties, appErr := groupPermissionFunc(postID, userID, groupName, properties)
		if appErr != nil {
			return nil, model.NewAppError("patchPostPropertiesPermissionCheck", "api.post_properties.permission_check.permission_error", nil, "", appErr.StatusCode).Wrap(appErr)
		}

		patch[groupId].PropertyValueById = updatedProperties
	}

	return patch, nil
}

func contentReviewGroupPermissionCheckHandler(postID, userID, groupID string, propertiesByGroup map[string]json.RawMessage) (map[string]json.RawMessage, *model.AppError) {
	// temporary no-op implementation. Actual implementation to be added later
	return propertiesByGroup, nil
}
