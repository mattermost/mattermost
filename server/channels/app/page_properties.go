// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	PropertyValueTargetTypePage = "page"
)

func (a *App) GetPagePropertyGroup() (*model.PropertyGroup, error) {
	return a.Srv().propertyService.GetPropertyGroup("pages")
}

func (a *App) GetPagePropertyFieldByName(fieldName string) (*model.PropertyField, *model.AppError) {
	group, err := a.GetPagePropertyGroup()
	if err != nil {
		return nil, model.NewAppError("GetPagePropertyFieldByName", "app.page.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	field, err := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", fieldName)
	if err != nil {
		return nil, model.NewAppError("GetPagePropertyFieldByName", "app.page.get_field.app_error", map[string]any{"FieldName": fieldName}, "", http.StatusInternalServerError).Wrap(err)
	}

	return field, nil
}

func (a *App) SetPageStatus(rctx request.CTX, pageId, status string) *model.AppError {
	rctx.Logger().Info("SetPageStatus called",
		mlog.String("page_id", pageId),
		mlog.String("status", status))

	post, getErr := a.GetSinglePost(rctx, pageId, false)
	if getErr != nil {
		return model.NewAppError("SetPageStatus", "app.page.set_status.page_not_found.app_error", nil, "", http.StatusNotFound).Wrap(getErr)
	}

	if post.Type != model.PostTypePage {
		return model.NewAppError("SetPageStatus", "app.page.set_status.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	group, err := a.GetPagePropertyGroup()
	if err != nil {
		rctx.Logger().Error("SetPageStatus: failed to get property group", mlog.Err(err))
		return model.NewAppError("SetPageStatus", "app.page.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("SetPageStatus: property group found", mlog.String("group_id", group.ID))

	statusField, err := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", pagePropertyNameStatus)
	if err != nil {
		rctx.Logger().Error("SetPageStatus: failed to get status field", mlog.Err(err))
		return model.NewAppError("SetPageStatus", "app.page.get_status_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("SetPageStatus: status field found", mlog.String("field_id", statusField.ID))

	if err := a.validatePageStatus(statusField, status); err != nil {
		rctx.Logger().Error("SetPageStatus: validation failed", mlog.Err(err))
		return err
	}

	propertyValue := &model.PropertyValue{
		TargetID:   pageId,
		TargetType: PropertyValueTargetTypePage,
		GroupID:    group.ID,
		FieldID:    statusField.ID,
		Value:      json.RawMessage(fmt.Sprintf(`"%s"`, status)),
	}

	rctx.Logger().Info("SetPageStatus: upserting property value",
		mlog.String("target_id", pageId),
		mlog.String("group_id", group.ID),
		mlog.String("field_id", statusField.ID),
		mlog.String("value", string(propertyValue.Value)))

	_, err = a.Srv().propertyService.UpsertPropertyValue(propertyValue)
	if err != nil {
		rctx.Logger().Error("SetPageStatus: upsert failed", mlog.Err(err))
		return model.NewAppError("SetPageStatus", "app.page.set_status.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("SetPageStatus: successfully saved status",
		mlog.String("page_id", pageId),
		mlog.String("status", status))

	return nil
}

func (a *App) GetPageStatus(rctx request.CTX, pageId string) (string, *model.AppError) {
	rctx.Logger().Info("GetPageStatus called", mlog.String("page_id", pageId))

	post, getErr := a.GetSinglePost(rctx, pageId, false)
	if getErr != nil {
		return "", model.NewAppError("GetPageStatus", "app.page.get_status.page_not_found.app_error", nil, "", http.StatusNotFound).Wrap(getErr)
	}

	if post.Type != model.PostTypePage {
		return "", model.NewAppError("GetPageStatus", "app.page.get_status.not_a_page.app_error", nil, "", http.StatusBadRequest)
	}

	group, err := a.GetPagePropertyGroup()
	if err != nil {
		rctx.Logger().Error("GetPageStatus: failed to get property group", mlog.Err(err))
		return "", model.NewAppError("GetPageStatus", "app.page.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("GetPageStatus: property group found", mlog.String("group_id", group.ID))

	statusField, err := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", pagePropertyNameStatus)
	if err != nil {
		rctx.Logger().Error("GetPageStatus: failed to get status field", mlog.Err(err))
		return "", model.NewAppError("GetPageStatus", "app.page.get_status_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("GetPageStatus: status field found", mlog.String("field_id", statusField.ID))

	searchOpts := model.PropertyValueSearchOpts{
		TargetIDs: []string{pageId},
		FieldID:   statusField.ID,
		PerPage:   1,
	}

	rctx.Logger().Info("GetPageStatus: searching property values",
		mlog.String("group_id", group.ID),
		mlog.String("field_id", statusField.ID),
		mlog.String("target_id", pageId))

	values, err := a.Srv().propertyService.SearchPropertyValues(group.ID, searchOpts)
	if err != nil {
		rctx.Logger().Warn("GetPageStatus: search returned error, using default",
			mlog.Err(err),
			mlog.String("default", model.PageStatusInProgress))
		return model.PageStatusInProgress, nil
	}

	if len(values) == 0 {
		rctx.Logger().Warn("GetPageStatus: no values found, using default",
			mlog.String("page_id", pageId),
			mlog.String("default", model.PageStatusInProgress))
		return model.PageStatusInProgress, nil
	}

	rctx.Logger().Info("GetPageStatus: found property values", mlog.Int("count", len(values)))

	var status string
	if err := json.Unmarshal(values[0].Value, &status); err != nil {
		rctx.Logger().Error("GetPageStatus: failed to unmarshal status, using default",
			mlog.Err(err),
			mlog.String("raw_value", string(values[0].Value)),
			mlog.String("default", model.PageStatusInProgress))
		return model.PageStatusInProgress, nil
	}

	rctx.Logger().Info("GetPageStatus: returning status",
		mlog.String("page_id", pageId),
		mlog.String("status", status))

	return status, nil
}

func (a *App) GetPageStatusField() (*model.PropertyField, *model.AppError) {
	group, err := a.GetPagePropertyGroup()
	if err != nil {
		return nil, model.NewAppError("GetPageStatusField", "app.page.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	statusField, err := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", pagePropertyNameStatus)
	if err != nil {
		return nil, model.NewAppError("GetPageStatusField", "app.page.get_status_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return statusField, nil
}

func (a *App) validatePageStatus(field *model.PropertyField, status string) *model.AppError {
	optionsRaw, exists := field.Attrs["options"]
	if !exists {
		return model.NewAppError("validatePageStatus", "app.page.validate_status.no_options", nil, "", http.StatusInternalServerError)
	}

	// After JSON unmarshaling, options is []any where each element is map[string]any
	optionsSlice, ok := optionsRaw.([]any)
	if !ok {
		// Try the original type in case it wasn't marshaled/unmarshaled
		optionsMap, ok2 := optionsRaw.([]map[string]string)
		if !ok2 {
			return model.NewAppError("validatePageStatus", "app.page.validate_status.no_options", nil, "", http.StatusInternalServerError)
		}
		// Handle []map[string]string case
		for _, option := range optionsMap {
			if option["name"] == status {
				return nil
			}
		}
		return model.NewAppError("validatePageStatus", "app.page.validate_status.invalid_value", map[string]any{"Status": status}, "", http.StatusBadRequest)
	}

	// Handle []any case (from JSON unmarshaling)
	for _, optionRaw := range optionsSlice {
		option, ok := optionRaw.(map[string]any)
		if !ok {
			continue
		}
		if nameVal, ok := option["name"]; ok {
			if nameStr, ok := nameVal.(string); ok && nameStr == status {
				return nil
			}
		}
	}

	return model.NewAppError("validatePageStatus", "app.page.validate_status.invalid_value", map[string]any{"Status": status}, "", http.StatusBadRequest)
}

// EnrichPageWithProperties adds property values to page props before returning to client
func (a *App) EnrichPageWithProperties(rctx request.CTX, page *model.Post) *model.AppError {
	if page == nil || page.Type != model.PostTypePage {
		return nil
	}

	rctx.Logger().Info("EnrichPageWithProperties called", mlog.String("page_id", page.Id))

	status, err := a.GetPageStatus(rctx, page.Id)
	if err != nil {
		rctx.Logger().Warn("EnrichPageWithProperties: failed to get page status",
			mlog.String("page_id", page.Id),
			mlog.Err(err))
		return nil
	}

	rctx.Logger().Info("EnrichPageWithProperties: got status",
		mlog.String("page_id", page.Id),
		mlog.String("status", status))

	if status != "" {
		if page.Props == nil {
			page.Props = make(model.StringInterface)
		}
		page.Props["page_status"] = status
		rctx.Logger().Info("EnrichPageWithProperties: set page_status prop",
			mlog.String("page_id", page.Id),
			mlog.String("status", status))
	}

	return nil
}

// EnrichPagesWithProperties enriches multiple pages with their property values
func (a *App) EnrichPagesWithProperties(rctx request.CTX, postList *model.PostList) *model.AppError {
	if postList == nil || len(postList.Posts) == 0 {
		return nil
	}

	// Fetch metadata once (not per page)
	group, err := a.GetPagePropertyGroup()
	if err != nil {
		rctx.Logger().Warn("EnrichPagesWithProperties: failed to get property group, skipping enrichment", mlog.Err(err))
		return nil
	}

	statusField, err := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", pagePropertyNameStatus)
	if err != nil {
		rctx.Logger().Warn("EnrichPagesWithProperties: failed to get status field, skipping enrichment", mlog.Err(err))
		return nil
	}

	// Collect all page IDs
	pageIds := make([]string, 0, len(postList.Posts))
	for _, page := range postList.Posts {
		if page.Type == model.PostTypePage {
			pageIds = append(pageIds, page.Id)
		}
	}

	if len(pageIds) == 0 {
		return nil
	}

	// Batch fetch ALL property values in ONE query
	searchOpts := model.PropertyValueSearchOpts{
		TargetIDs: pageIds,
		FieldID:   statusField.ID,
		PerPage:   len(pageIds),
	}

	values, err := a.Srv().propertyService.SearchPropertyValues(group.ID, searchOpts)
	if err != nil {
		rctx.Logger().Warn("EnrichPagesWithProperties: search returned error, skipping enrichment", mlog.Err(err))
		return nil
	}

	// Build a map of pageId -> status value
	statusMap := make(map[string]string)
	for _, value := range values {
		var status string
		if jsonErr := json.Unmarshal(value.Value, &status); jsonErr == nil {
			statusMap[value.TargetID] = status
		}
	}

	// Apply status to each page
	for _, page := range postList.Posts {
		if page.Type != model.PostTypePage {
			continue
		}

		status, found := statusMap[page.Id]
		if !found {
			status = model.PageStatusInProgress
		}

		props := page.GetProps()
		if props == nil {
			props = make(map[string]any)
		}
		props["page_status"] = status
		page.SetProps(props)
	}

	return nil
}
