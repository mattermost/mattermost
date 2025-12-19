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

// SetPageStatus sets the status property for a page.
// Accepts a type-safe *Page that has already been validated.
func (a *App) SetPageStatus(rctx request.CTX, page *Page, status string) *model.AppError {
	pageId := page.Id()

	rctx.Logger().Debug("SetPageStatus called",
		mlog.String("page_id", pageId),
		mlog.String("status", status))

	group, err := a.GetPagePropertyGroup()
	if err != nil {
		rctx.Logger().Error("SetPageStatus: failed to get property group", mlog.Err(err))
		return model.NewAppError("SetPageStatus", "app.page.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Debug("SetPageStatus: property group found", mlog.String("group_id", group.ID))

	statusField, err := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", pagePropertyNameStatus)
	if err != nil {
		rctx.Logger().Error("SetPageStatus: failed to get status field", mlog.Err(err))
		return model.NewAppError("SetPageStatus", "app.page.get_status_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Debug("SetPageStatus: status field found", mlog.String("field_id", statusField.ID))

	if err := a.validatePageStatus(statusField, status); err != nil {
		rctx.Logger().Error("SetPageStatus: validation failed", mlog.Err(err))
		return err
	}

	propertyValue := &model.PropertyValue{
		TargetID:   pageId,
		TargetType: PropertyValueTargetTypePage,
		GroupID:    group.ID,
		FieldID:    statusField.ID,
		Value:      json.RawMessage(strconv.Quote(status)),
	}

	rctx.Logger().Debug("SetPageStatus: upserting property value",
		mlog.String("target_id", pageId),
		mlog.String("group_id", group.ID),
		mlog.String("field_id", statusField.ID),
		mlog.String("value", string(propertyValue.Value)))

	_, err = a.Srv().propertyService.UpsertPropertyValue(propertyValue)
	if err != nil {
		rctx.Logger().Error("SetPageStatus: upsert failed", mlog.Err(err))
		return model.NewAppError("SetPageStatus", "app.page.set_status.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Debug("SetPageStatus: successfully saved status",
		mlog.String("page_id", pageId),
		mlog.String("status", status))

	return nil
}

// GetPageStatus gets the status property for a page.
// Accepts a type-safe *Page that has already been validated.
func (a *App) GetPageStatus(rctx request.CTX, page *Page) (string, *model.AppError) {
	pageId := page.Id()

	rctx.Logger().Debug("GetPageStatus called", mlog.String("page_id", pageId))

	group, err := a.GetPagePropertyGroup()
	if err != nil {
		rctx.Logger().Error("GetPageStatus: failed to get property group", mlog.Err(err))
		return "", model.NewAppError("GetPageStatus", "app.page.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Debug("GetPageStatus: property group found", mlog.String("group_id", group.ID))

	statusField, err := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", pagePropertyNameStatus)
	if err != nil {
		rctx.Logger().Error("GetPageStatus: failed to get status field", mlog.Err(err))
		return "", model.NewAppError("GetPageStatus", "app.page.get_status_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Debug("GetPageStatus: status field found", mlog.String("field_id", statusField.ID))

	searchOpts := model.PropertyValueSearchOpts{
		TargetIDs: []string{pageId},
		FieldID:   statusField.ID,
		PerPage:   1,
	}

	rctx.Logger().Debug("GetPageStatus: searching property values",
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

	rctx.Logger().Debug("GetPageStatus: found property values", mlog.Int("count", len(values)))

	var status string
	if err := json.Unmarshal(values[0].Value, &status); err != nil {
		rctx.Logger().Error("GetPageStatus: failed to unmarshal status, using default",
			mlog.Err(err),
			mlog.String("raw_value", string(values[0].Value)),
			mlog.String("default", model.PageStatusInProgress))
		return model.PageStatusInProgress, nil
	}

	rctx.Logger().Debug("GetPageStatus: returning status",
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

// EnrichPageWithProperties adds property values to page props before returning to client.
// This method reuses the batch enrichment logic to avoid redundant DB queries.
// Set useMaster to true when calling after a write operation to ensure read-after-write consistency in HA.
func (a *App) EnrichPageWithProperties(rctx request.CTX, page *model.Post, useMaster ...bool) *model.AppError {
	if !IsPagePost(page) {
		return nil
	}

	// Wrap single page in a PostList and use the batch method
	// This avoids 4 separate DB queries that GetPageStatus would make
	postList := &model.PostList{
		Posts: map[string]*model.Post{page.Id: page},
		Order: []string{page.Id},
	}

	return a.EnrichPagesWithProperties(rctx, postList, useMaster...)
}

// EnrichPagesWithProperties enriches multiple pages with their property values
// (page_status and wiki_id) in batched queries to minimize DB trips.
// Set useMaster to true when calling after a write operation to ensure read-after-write consistency in HA.
func (a *App) EnrichPagesWithProperties(rctx request.CTX, postList *model.PostList, useMaster ...bool) *model.AppError {
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

	wikiField, err := a.Srv().propertyService.GetPropertyFieldByName(group.ID, "", pagePropertyNameWiki)
	if err != nil {
		rctx.Logger().Warn("EnrichPagesWithProperties: failed to get wiki field, skipping wiki_id enrichment", mlog.Err(err))
		// Continue without wiki enrichment - status enrichment can still proceed
	}

	// Collect all page IDs
	pageIds := make([]string, 0, len(postList.Posts))
	for _, page := range postList.Posts {
		if IsPagePost(page) {
			pageIds = append(pageIds, page.Id)
		}
	}

	if len(pageIds) == 0 {
		return nil
	}

	// Determine if we should use master DB for read-after-write consistency
	shouldUseMaster := len(useMaster) > 0 && useMaster[0]

	if shouldUseMaster {
		rctx.Logger().Debug("EnrichPagesWithProperties: using master DB for read-after-write consistency",
			mlog.Int("page_count", len(pageIds)))
	}

	// Batch fetch status property values in ONE query
	statusSearchOpts := model.PropertyValueSearchOpts{
		TargetIDs: pageIds,
		FieldID:   statusField.ID,
		PerPage:   len(pageIds),
		UseMaster: shouldUseMaster,
	}

	statusValues, err := a.Srv().propertyService.SearchPropertyValues(group.ID, statusSearchOpts)
	if err != nil {
		rctx.Logger().Warn("EnrichPagesWithProperties: status search returned error, skipping enrichment", mlog.Err(err))
		return nil
	}

	// Build a map of pageId -> status value
	statusMap := make(map[string]string)
	for _, value := range statusValues {
		var status string
		if jsonErr := json.Unmarshal(value.Value, &status); jsonErr == nil {
			statusMap[value.TargetID] = status
		}
	}

	// Batch fetch wiki property values in ONE query (if wiki field is available)
	wikiMap := make(map[string]string)
	if wikiField != nil {
		wikiSearchOpts := model.PropertyValueSearchOpts{
			TargetIDs: pageIds,
			FieldID:   wikiField.ID,
			PerPage:   len(pageIds),
			UseMaster: shouldUseMaster,
		}

		wikiValues, wikiErr := a.Srv().propertyService.SearchPropertyValues(group.ID, wikiSearchOpts)
		if wikiErr != nil {
			rctx.Logger().Warn("EnrichPagesWithProperties: wiki search returned error, skipping wiki_id enrichment", mlog.Err(wikiErr))
		} else {
			for _, value := range wikiValues {
				var wikiId string
				if jsonErr := json.Unmarshal(value.Value, &wikiId); jsonErr == nil {
					wikiMap[value.TargetID] = wikiId
				}
			}
		}
	}

	// Apply status and wiki_id to each page
	for _, page := range postList.Posts {
		if !IsPagePost(page) {
			continue
		}

		props := page.GetProps()
		if props == nil {
			props = make(map[string]any)
		}

		status, found := statusMap[page.Id]
		if !found {
			status = model.PageStatusInProgress
		}
		props[model.PagePropsPageStatus] = status

		if wikiId, found := wikiMap[page.Id]; found && wikiId != "" {
			props[model.PagePropsWikiID] = wikiId
		}

		page.SetProps(props)
	}

	rctx.Logger().Debug("EnrichPagesWithProperties: completed",
		mlog.Int("pages_processed", len(pageIds)),
		mlog.Int("statuses_found", len(statusMap)),
		mlog.Int("wiki_ids_found", len(wikiMap)),
		mlog.Bool("used_master", shouldUseMaster))

	return nil
}
