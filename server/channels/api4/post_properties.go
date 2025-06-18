// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"github.com/mattermost/mattermost/server/public/model"
	"net/http"
)

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

	s, _ := json.Marshal(patch)
	fmt.Printf("%s\n", string(s))
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

	patch := make(model.PatchPostProperties)

	for fieldID, value := range rawPatch {
		field, ok := fieldMap[fieldID]
		if !ok {
			return nil, model.NewAppError("toPostPropertiesPatch", "api.post_properties.to_post_properties_patch.app_error", map[string]any{"FieldID": fieldID}, "", http.StatusNotFound)
		}

		if _, ok := patch[field.GroupID]; !ok {
			patch[field.GroupID] = make(map[string]json.RawMessage)
		}

		patch[field.GroupID][field.ID] = value
	}

	return patch, nil
}
