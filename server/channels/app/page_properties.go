// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// pageWritableProps is the allowlist of post props that external callers may set via
// the wiki-scoped props endpoint. Only translation metadata keys are permitted.
var pageWritableProps = map[string]bool{
	model.PostPropsPageTranslatedFrom:      true,
	model.PostPropsPageTranslationLanguage: true,
	model.PostPropsPageTranslations:        true,
}

// PatchPageProps merges the provided props into the page post, keeping only keys
// that appear in pageWritableProps. The caller is responsible for permission checks.
func (a *App) PatchPageProps(rctx request.CTX, page *model.Post, props map[string]any, channel *model.Channel) (*model.Post, *model.AppError) {
	updated := page.Clone()
	if updated.Props == nil {
		updated.Props = make(model.StringInterface)
	}
	applied := 0
	for k, v := range props {
		if pageWritableProps[k] {
			updated.Props[k] = v
			applied++
		}
	}
	if applied == 0 {
		return nil, model.NewAppError("PatchPageProps", "app.page.patch_props.no_valid_keys.app_error", nil, "no writable prop keys provided", http.StatusBadRequest)
	}

	result, storeErr := a.Srv().Store().Page().Update(rctx, updated)
	if storeErr != nil {
		statusCode := http.StatusInternalServerError
		if store.IsErrNotFound(storeErr) {
			statusCode = http.StatusNotFound
		}
		return nil, model.NewAppError("PatchPageProps", "app.page.patch_props.store_error.app_error", nil, "", statusCode).Wrap(storeErr)
	}

	return a.finalizePageUpdate(rctx, result, "", "", channel)
}

func (a *App) GetPagePropertyGroup() (*model.PropertyGroup, error) {
	return a.Srv().PropertyService().GetPropertyGroup("pages")
}

func (a *App) GetPagePropertyFieldByName(fieldName string) (*model.PropertyField, *model.AppError) {
	group, err := a.GetPagePropertyGroup()
	if err != nil {
		return nil, model.NewAppError("GetPagePropertyFieldByName", "app.page.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	field, err := a.Srv().PropertyService().PropertyAccessService().GetPropertyFieldByName(anonymousCallerID, group.ID, "", fieldName)
	if err != nil {
		return nil, model.NewAppError("GetPagePropertyFieldByName", "app.page.get_field.app_error", map[string]any{"FieldName": fieldName}, "", http.StatusInternalServerError).Wrap(err)
	}

	return field, nil
}

func (a *App) SetPageStatus(rctx request.CTX, pageId string, status string) *model.AppError {
	statusField, appErr := a.GetPagePropertyFieldByName(pagePropertyNameStatus)
	if appErr != nil {
		return appErr
	}

	if err := a.validatePageStatus(statusField, status); err != nil {
		return err
	}

	propertyValue := &model.PropertyValue{
		TargetID:   pageId,
		TargetType: model.PropertyValueTargetTypePage,
		GroupID:    statusField.GroupID,
		FieldID:    statusField.ID,
		Value:      json.RawMessage(strconv.Quote(status)),
	}

	if _, err := a.Srv().PropertyService().PropertyAccessService().UpsertPropertyValue(anonymousCallerID, propertyValue); err != nil {
		return model.NewAppError("SetPageStatus", "app.page.set_status.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// TODO: remove once getPageStatus API handler is migrated to use EnrichPageWithProperties
func (a *App) GetPageStatus(rctx request.CTX, pageId string) (string, *model.AppError) {
	statusField, appErr := a.GetPagePropertyFieldByName(pagePropertyNameStatus)
	if appErr != nil {
		return "", appErr
	}

	searchOpts := model.PropertyValueSearchOpts{
		TargetIDs: []string{pageId},
		FieldID:   statusField.ID,
		PerPage:   1,
	}

	values, err := a.Srv().PropertyService().PropertyAccessService().SearchPropertyValues(anonymousCallerID, statusField.GroupID, searchOpts)
	if err != nil {
		return "", model.NewAppError("GetPageStatus", "app.page.search_status_values.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(values) == 0 {
		return "", nil
	}

	var status string
	if err := json.Unmarshal(values[0].Value, &status); err != nil {
		rctx.Logger().Error("GetPageStatus: failed to unmarshal status",
			mlog.Err(err),
			mlog.String("raw_value", string(values[0].Value)))
		return "", nil
	}

	return status, nil
}

func (a *App) GetPageStatusField() (*model.PropertyField, *model.AppError) {
	return a.GetPagePropertyFieldByName(pagePropertyNameStatus)
}

func (a *App) validatePageStatus(field *model.PropertyField, status string) *model.AppError {
	optionsRaw, exists := field.Attrs["options"]
	if !exists {
		return model.NewAppError("validatePageStatus", "app.page.validate_status.no_options", nil, "", http.StatusInternalServerError)
	}

	optionsSlice, ok := optionsRaw.([]any)
	if !ok {
		return model.NewAppError("validatePageStatus", "app.page.validate_status.no_options", nil, "", http.StatusInternalServerError)
	}

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

// EnrichPageWithProperties adds property values to page props before returning to client.
// This is best-effort: errors are logged as warnings and do not fail the call.
// Set useMaster to true when calling after a write operation to ensure read-after-write consistency in HA.
func (a *App) EnrichPageWithProperties(rctx request.CTX, page *model.Post, useMaster ...bool) {
	if !IsPagePost(page) {
		return
	}

	postList := &model.PostList{
		Posts: map[string]*model.Post{page.Id: page},
		Order: []string{page.Id},
	}

	a.EnrichPagesWithProperties(rctx, postList, useMaster...)
}

// EnrichPagesWithProperties enriches multiple pages with their property values
// (page_status) in batched queries to minimize DB trips.
// This is best-effort: errors are logged as warnings and do not fail the call.
// Set useMaster to true when calling after a write operation to ensure read-after-write consistency in HA.
func (a *App) EnrichPagesWithProperties(rctx request.CTX, postList *model.PostList, useMaster ...bool) {
	if postList == nil || len(postList.Posts) == 0 {
		return
	}

	statusField, fieldErr := a.GetPagePropertyFieldByName(pagePropertyNameStatus)
	if fieldErr != nil {
		rctx.Logger().Warn("EnrichPagesWithProperties: failed to get status field, skipping enrichment", mlog.Err(fieldErr))
		return
	}

	pageIds := make([]string, 0, len(postList.Posts))
	for _, page := range postList.Posts {
		if IsPagePost(page) {
			pageIds = append(pageIds, page.Id)
		}
	}

	if len(pageIds) == 0 {
		return
	}

	shouldUseMaster := len(useMaster) > 0 && useMaster[0]

	statusSearchOpts := model.PropertyValueSearchOpts{
		TargetIDs:  pageIds,
		TargetType: model.PropertyValueTargetTypePage,
		FieldID:    statusField.ID,
		PerPage:    len(pageIds),
		UseMaster:  shouldUseMaster,
	}

	statusValues, err := a.Srv().PropertyService().PropertyAccessService().SearchPropertyValues(anonymousCallerID, statusField.GroupID, statusSearchOpts)
	if err != nil {
		rctx.Logger().Warn("EnrichPagesWithProperties: status search returned error, skipping enrichment", mlog.Err(err))
		return
	}

	statusMap := make(map[string]string)
	for _, value := range statusValues {
		var status string
		if jsonErr := json.Unmarshal(value.Value, &status); jsonErr == nil {
			statusMap[value.TargetID] = status
		}
	}

	for _, page := range postList.Posts {
		if !IsPagePost(page) {
			continue
		}

		props := page.GetProps()
		if props == nil {
			props = make(map[string]any)
		}

		props[model.PagePropsPageStatus] = statusMap[page.Id]

		page.SetProps(props)
	}
}
