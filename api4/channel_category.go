// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
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

	categories, err := c.App.GetSidebarCategories(c.Params.UserId, c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write(categories.ToJson())
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

	auditRec := c.MakeAuditRecord("createCategoryForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	var categoryCreateRequest *model.SidebarCategoryWithChannels
	err := json.NewDecoder(r.Body).Decode(&categoryCreateRequest)
	if err != nil || c.Params.UserId != categoryCreateRequest.UserId || c.Params.TeamId != categoryCreateRequest.TeamId {
		c.SetInvalidParam("category")
		return
	}

	if appErr := validateSidebarCategory(c, c.Params.TeamId, c.Params.UserId, categoryCreateRequest); appErr != nil {
		c.Err = appErr
		return
	}

	category, appErr := c.App.CreateSidebarCategory(c.Params.UserId, c.Params.TeamId, categoryCreateRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	w.Write(category.ToJson())
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

	order, err := c.App.GetSidebarCategoryOrder(c.Params.UserId, c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.ArrayToJson(order)))
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

	auditRec := c.MakeAuditRecord("updateCategoryOrderForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	categoryOrder := model.ArrayFromJson(r.Body)

	for _, categoryId := range categoryOrder {
		if !c.App.SessionHasPermissionToCategory(*c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, categoryId) {
			c.SetInvalidParam("category")
			return
		}
	}

	err := c.App.UpdateSidebarCategoryOrder(c.Params.UserId, c.Params.TeamId, categoryOrder)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	w.Write([]byte(model.ArrayToJson(categoryOrder)))
}

func getCategoryForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId().RequireCategoryId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToCategory(*c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, c.Params.CategoryId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	categories, err := c.App.GetSidebarCategory(c.Params.CategoryId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write(categories.ToJson())
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

	auditRec := c.MakeAuditRecord("updateCategoriesForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	var categoriesUpdateRequest []*model.SidebarCategoryWithChannels
	err := json.NewDecoder(r.Body).Decode(&categoriesUpdateRequest)
	if err != nil {
		c.SetInvalidParam("category")
		return
	}

	for _, category := range categoriesUpdateRequest {
		if !c.App.SessionHasPermissionToCategory(*c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, category.Id) {
			c.SetInvalidParam("category")
			return
		}
	}

	if appErr := validateSidebarCategories(c, c.Params.TeamId, c.Params.UserId, categoriesUpdateRequest); appErr != nil {
		c.Err = appErr
		return
	}

	categories, appErr := c.App.UpdateSidebarCategories(c.Params.UserId, c.Params.TeamId, categoriesUpdateRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	w.Write(model.SidebarCategoriesWithChannelsToJson(categories))
}

func validateSidebarCategory(c *Context, teamId, userId string, category *model.SidebarCategoryWithChannels) *model.AppError {
	channels, err := c.App.GetChannelsForUser(teamId, userId, true, 0)
	if err != nil {
		return model.NewAppError("validateSidebarCategory", "api.invalid_channel", nil, err.Error(), http.StatusBadRequest)
	}

	category.Channels = validateSidebarCategoryChannels(userId, category.Channels, channels)

	return nil
}

func validateSidebarCategories(c *Context, teamId, userId string, categories []*model.SidebarCategoryWithChannels) *model.AppError {
	channels, err := c.App.GetChannelsForUser(teamId, userId, true, 0)
	if err != nil {
		return model.NewAppError("validateSidebarCategory", "api.invalid_channel", nil, err.Error(), http.StatusBadRequest)
	}

	for _, category := range categories {
		category.Channels = validateSidebarCategoryChannels(userId, category.Channels, channels)
	}

	return nil
}

func validateSidebarCategoryChannels(userId string, channelIds []string, channels *model.ChannelList) []string {
	var filtered []string

	for _, channelId := range channelIds {
		found := false
		for _, channel := range *channels {
			if channel.Id == channelId {
				found = true
				break
			}
		}

		if found {
			filtered = append(filtered, channelId)
		} else {
			mlog.Info("Stopping user from adding channel to their sidebar when they are not a member", mlog.String("user_id", userId), mlog.String("channel_id", channelId))
		}
	}

	return filtered
}

func updateCategoryForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId().RequireCategoryId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToCategory(*c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, c.Params.CategoryId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	auditRec := c.MakeAuditRecord("updateCategoryForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	var categoryUpdateRequest *model.SidebarCategoryWithChannels
	err := json.NewDecoder(r.Body).Decode(&categoryUpdateRequest)
	if err != nil || categoryUpdateRequest.TeamId != c.Params.TeamId || categoryUpdateRequest.UserId != c.Params.UserId {
		c.SetInvalidParam("category")
		return
	}

	if appErr := validateSidebarCategory(c, c.Params.TeamId, c.Params.UserId, categoryUpdateRequest); appErr != nil {
		c.Err = appErr
		return
	}

	categoryUpdateRequest.Id = c.Params.CategoryId

	categories, appErr := c.App.UpdateSidebarCategories(c.Params.UserId, c.Params.TeamId, []*model.SidebarCategoryWithChannels{categoryUpdateRequest})
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	w.Write(categories[0].ToJson())
}

func deleteCategoryForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId().RequireCategoryId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToCategory(*c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, c.Params.CategoryId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	auditRec := c.MakeAuditRecord("deleteCategoryForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	appErr := c.App.DeleteSidebarCategory(c.Params.UserId, c.Params.TeamId, c.Params.CategoryId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
