// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func getCategoriesForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	categories, appErr := c.App.GetSidebarCategoriesForTeamForUser(c.AppContext, c.Params.UserId, c.Params.TeamId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	categoriesJSON, err := json.Marshal(categories)
	if err != nil {
		c.Err = model.NewAppError("getCategoriesForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(categoriesJSON)
}

func createCategoryForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	auditREC := c.MakeAuditRecord("createCategoryForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditREC)

	var categoryCreateRequest model.SidebarCategoryWithChannels
	err := json.NewDecoder(r.Body).Decode(&categoryCreateRequest)
	if err != nil || c.Params.UserId != categoryCreateRequest.UserId || c.Params.TeamId != categoryCreateRequest.TeamId {
		c.SetInvalidParamWithErr("category", err)
		return
	}

	if appERR := validateSidebarCategory(c, c.Params.TeamId, c.Params.UserId, &categoryCreateRequest); appERR != nil {
		c.Err = appERR
		return
	}

	category, appERR := c.App.CreateSidebarCategory(c.AppContext, c.Params.UserId, c.Params.TeamId, &categoryCreateRequest)
	if appERR != nil {
		c.Err = appERR
		return
	}

	categoryJSON, err := json.Marshal(category)
	if err != nil {
		c.Err = model.NewAppError("createCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditREC.Success()

	w.Write(categoryJSON)
}

func getCategoryOrderForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	order, appERR := c.App.GetSidebarCategoryOrder(c.AppContext, c.Params.UserId, c.Params.TeamId)
	if appERR != nil {
		c.Err = appERR
		return
	}

	err := json.NewEncoder(w).Encode(order)
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func updateCategoryOrderForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	auditREC := c.MakeAuditRecord("updateCategoryOrderForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditREC)

	categoryOrder := model.ArrayFromJSON(r.Body)

	for _, categoryID := range categoryOrder {
		if !c.App.SessionHasPermissionToCategory(c.AppContext, *c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, categoryID) {
			c.SetInvalidParam("category")
			return
		}
	}

	err := c.App.UpdateSidebarCategoryOrder(c.AppContext, c.Params.UserId, c.Params.TeamId, categoryOrder)
	if err != nil {
		c.Err = err
		return
	}

	auditREC.Success()
	w.Write([]byte(model.ArrayToJSON(categoryOrder)))
}

func getCategoryForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId().RequireCategoryId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToCategory(c.AppContext, *c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, c.Params.CategoryId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	categories, appERR := c.App.GetSidebarCategory(c.AppContext, c.Params.CategoryId)
	if appERR != nil {
		c.Err = appERR
		return
	}

	categoriesJSON, err := json.Marshal(categories)
	if err != nil {
		c.Err = model.NewAppError("getCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(categoriesJSON)
}

func updateCategoriesForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	auditREC := c.MakeAuditRecord("updateCategoriesForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditREC)

	var categoriesUpdateRequest []*model.SidebarCategoryWithChannels
	err := json.NewDecoder(r.Body).Decode(&categoriesUpdateRequest)
	if err != nil {
		c.SetInvalidParamWithErr("category", err)
		return
	}

	for _, category := range categoriesUpdateRequest {
		if !c.App.SessionHasPermissionToCategory(c.AppContext, *c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, category.Id) {
			c.SetInvalidParam("category")
			return
		}
	}

	if appERR := validateSidebarCategories(c, c.Params.TeamId, c.Params.UserId, categoriesUpdateRequest); appERR != nil {
		c.Err = appERR
		return
	}

	categories, appERR := c.App.UpdateSidebarCategories(c.AppContext, c.Params.UserId, c.Params.TeamId, categoriesUpdateRequest)
	if appERR != nil {
		c.Err = appERR
		return
	}

	categoriesJSON, err := json.Marshal(categories)
	if err != nil {
		c.Err = model.NewAppError("updateCategoriesForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditREC.Success()
	w.Write(categoriesJSON)
}

func validateSidebarCategory(c *Context, teamID, userID string, category *model.SidebarCategoryWithChannels) *model.AppError {
	channels, appERR := c.App.GetChannelsForTeamForUser(c.AppContext, teamID, userID, &model.ChannelSearchOpts{
		IncludeDeleted: true,
		LastDeleteAt:   0,
	})
	if appERR != nil {
		return model.NewAppError("validateSidebarCategory", "api.invalid_channel", nil, "", http.StatusBadRequest).Wrap(appERR)
	}

	category.Channels = validateSidebarCategoryChannels(c, userID, category.Channels, channels)

	return nil
}

func validateSidebarCategories(c *Context, teamID, userID string, categories []*model.SidebarCategoryWithChannels) *model.AppError {
	channels, err := c.App.GetChannelsForTeamForUser(c.AppContext, teamID, userID, &model.ChannelSearchOpts{
		IncludeDeleted: true,
		LastDeleteAt:   0,
	})
	if err != nil {
		return model.NewAppError("validateSidebarCategory", "api.invalid_channel", nil, err.Error(), http.StatusBadRequest)
	}

	for _, category := range categories {
		category.Channels = validateSidebarCategoryChannels(c, userID, category.Channels, channels)
	}

	return nil
}

func validateSidebarCategoryChannels(c *Context, userID string, channelIDs []string, channels model.ChannelList) []string {
	var filtered []string

	for _, channelID := range channelIDs {
		found := false
		for _, channel := range channels {
			if channel.Id == channelID {
				found = true
				break
			}
		}

		if found {
			filtered = append(filtered, channelID)
		} else {
			c.Logger.Info("Stopping user from adding channel to their sidebar when they are not a member", mlog.String("user_id", userID), mlog.String("channel_id", channelID))
		}
	}

	return filtered
}

func updateCategoryForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId().RequireCategoryId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToCategory(c.AppContext, *c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, c.Params.CategoryId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	auditREC := c.MakeAuditRecord("updateCategoryForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditREC)

	var categoryUpdateRequest model.SidebarCategoryWithChannels
	err := json.NewDecoder(r.Body).Decode(&categoryUpdateRequest)
	if err != nil || categoryUpdateRequest.TeamId != c.Params.TeamId || categoryUpdateRequest.UserId != c.Params.UserId {
		c.SetInvalidParamWithErr("category", err)
		return
	}

	if appERR := validateSidebarCategory(c, c.Params.TeamId, c.Params.UserId, &categoryUpdateRequest); appERR != nil {
		c.Err = appERR
		return
	}

	categoryUpdateRequest.Id = c.Params.CategoryId

	categories, appERR := c.App.UpdateSidebarCategories(c.AppContext, c.Params.UserId, c.Params.TeamId, []*model.SidebarCategoryWithChannels{&categoryUpdateRequest})
	if appERR != nil {
		c.Err = appERR
		return
	}

	categoryJSON, err := json.Marshal(categories[0])
	if err != nil {
		c.Err = model.NewAppError("updateCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditREC.Success()
	w.Write(categoryJSON)
}

func deleteCategoryForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId().RequireCategoryId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToCategory(c.AppContext, *c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, c.Params.CategoryId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	auditREC := c.MakeAuditRecord("deleteCategoryForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditREC)

	appERR := c.App.DeleteSidebarCategory(c.AppContext, c.Params.UserId, c.Params.TeamId, c.Params.CategoryId)
	if appERR != nil {
		c.Err = appERR
		return
	}

	auditREC.Success()
	ReturnStatusOK(w)
}
