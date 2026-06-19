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

// PatchPageProps merges the allowlisted writable props (translation metadata) into the page's
// persisted Props blob. Non-allowlisted keys are silently dropped. The patched keys are surfaced
// in the returned page's transient Properties so the client sees them in the response.
func (a *App) PatchPageProps(rctx request.CTX, page *model.Page, props map[string]any, channel *model.Channel) (*model.Page, *model.AppError) {
	// Clone before mutating so a failed store write never leaves the caller's page
	// carrying props that were not persisted.
	updatedInput := page.Clone()
	if updatedInput.Props == nil {
		updatedInput.Props = model.StringInterface{}
	}
	patched := model.StringInterface{}
	for k, v := range props {
		if pageWritableProps[k] {
			updatedInput.Props[k] = v
			patched[k] = v
		}
	}

	if len(patched) == 0 {
		return nil, model.NewAppError("PatchPageProps", "app.page.patch_props.no_valid_keys.app_error", nil, "no writable prop keys provided", http.StatusBadRequest)
	}

	updated, err := a.Srv().Store().Page().Update(rctx, updatedInput)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if store.IsErrNotFound(err) {
			statusCode = http.StatusNotFound
		}
		return nil, model.NewAppError("PatchPageProps", "app.page.patch_props.update.app_error", nil, "", statusCode).Wrap(err)
	}

	a.EnrichPageWithProperties(rctx, updated)
	if updated.Properties == nil {
		updated.Properties = map[string]any{}
	}
	for k, v := range patched {
		updated.Properties[k] = v
	}
	return updated, nil
}

func (a *App) GetPagePropertyGroup() (*model.PropertyGroup, error) {
	return a.Srv().PropertyService().GetPropertyGroup("pages")
}

func (a *App) GetPagePropertyFieldByName(fieldName string) (*model.PropertyField, *model.AppError) {
	group, err := a.GetPagePropertyGroup()
	if err != nil {
		return nil, model.NewAppError("GetPagePropertyFieldByName", "app.page.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	field, err := a.Srv().PropertyService().GetPropertyFieldByName(nil, group.ID, "", fieldName)
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

	if _, err := a.Srv().PropertyService().UpsertPropertyValue(rctx, propertyValue); err != nil {
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

	values, err := a.Srv().PropertyService().SearchPropertyValues(rctx, statusField.GroupID, searchOpts)
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

// EnrichPageWithProperties adds property values (page_status) to a Page's transient
// Properties map before returning to the client. Best-effort: errors are logged and
// do not fail the call. Pass useMaster=true after a write to ensure read-after-write
// consistency in HA.
func (a *App) EnrichPageWithProperties(rctx request.CTX, page *model.Page, useMaster ...bool) {
	if page == nil {
		return
	}
	a.EnrichPagesWithProperties(rctx, []*model.Page{page}, useMaster...)
}

// EnrichPagesWithProperties enriches a slice of Pages with their property values
// (page_status) in batched queries to minimise DB trips. Best-effort: errors are
// logged and do not fail the call. Pass useMaster=true after a write.
func (a *App) EnrichPagesWithProperties(rctx request.CTX, pages []*model.Page, useMaster ...bool) {
	if len(pages) == 0 {
		return
	}

	statusField, fieldErr := a.GetPagePropertyFieldByName(pagePropertyNameStatus)
	if fieldErr != nil {
		rctx.Logger().Warn("EnrichPagesWithProperties: failed to get status field, skipping enrichment", mlog.Err(fieldErr))
		return
	}

	pageIds := make([]string, 0, len(pages))
	for _, p := range pages {
		if p != nil {
			pageIds = append(pageIds, p.Id)
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

	statusValues, err := a.Srv().PropertyService().SearchPropertyValues(rctx, statusField.GroupID, statusSearchOpts)
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

	for _, p := range pages {
		if p == nil {
			continue
		}
		if p.Properties == nil {
			p.Properties = make(map[string]any)
		}
		p.Properties[model.PagePropsPageStatus] = statusMap[p.Id]
		// Surface the allowlisted translation metadata persisted in Props (translated_from,
		// translation_language, translations) so the client reads it from Properties uniformly.
		for k := range pageWritableProps {
			if v, ok := p.Props[k]; ok {
				p.Properties[k] = v
			}
		}
	}
}

// EnrichPostListPageProperties enriches page-type posts in a PostList with their
// property values. This is the Post-search path; pages retrieved via the Pages table
// use EnrichPagesWithProperties instead.
func (a *App) EnrichPostListPageProperties(rctx request.CTX, postList *model.PostList, useMaster ...bool) {
	if postList == nil || len(postList.Posts) == 0 {
		return
	}

	statusField, fieldErr := a.GetPagePropertyFieldByName(pagePropertyNameStatus)
	if fieldErr != nil {
		rctx.Logger().Warn("EnrichPostListPageProperties: failed to get status field, skipping enrichment", mlog.Err(fieldErr))
		return
	}

	pageIds := make([]string, 0, len(postList.Posts))
	for _, p := range postList.Posts {
		if IsPagePost(p) {
			pageIds = append(pageIds, p.Id)
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

	statusValues, err := a.Srv().PropertyService().SearchPropertyValues(rctx, statusField.GroupID, statusSearchOpts)
	if err != nil {
		rctx.Logger().Warn("EnrichPostListPageProperties: status search returned error, skipping enrichment", mlog.Err(err))
		return
	}

	statusMap := make(map[string]string)
	for _, value := range statusValues {
		var status string
		if jsonErr := json.Unmarshal(value.Value, &status); jsonErr == nil {
			statusMap[value.TargetID] = status
		}
	}

	for _, p := range postList.Posts {
		if !IsPagePost(p) {
			continue
		}
		props := p.GetProps()
		if props == nil {
			props = make(map[string]any)
		}
		props[model.PagePropsPageStatus] = statusMap[p.Id]
		p.SetProps(props)
	}
}
