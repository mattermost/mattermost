// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
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

	if _, err := w.Write(categoriesJSON); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateCategoryForTeamForUser, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	var categoryCreateRequest model.SidebarCategoryWithChannels
	err := json.NewDecoder(r.Body).Decode(&categoryCreateRequest)
	if err != nil || c.Params.UserId != categoryCreateRequest.UserId || c.Params.TeamId != categoryCreateRequest.TeamId {
		c.SetInvalidParamWithErr("category", err)
		return
	}

	if appErr := validateSidebarCategory(c, c.Params.TeamId, c.Params.UserId, &categoryCreateRequest); appErr != nil {
		c.Err = appErr
		return
	}

	category, appErr := c.App.CreateSidebarCategory(c.AppContext, c.Params.UserId, c.Params.TeamId, &categoryCreateRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}

	categoryJSON, err := json.Marshal(category)
	if err != nil {
		c.Err = model.NewAppError("createCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()

	if _, err := w.Write(categoryJSON); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	order, appErr := c.App.GetSidebarCategoryOrder(c.AppContext, c.Params.UserId, c.Params.TeamId)
	if appErr != nil {
		c.Err = appErr
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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateCategoryOrderForTeamForUser, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	categoryOrder, err := model.NonSortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("updateCategoryOrderForTeamForUser", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	for _, categoryId := range categoryOrder {
		if !c.App.SessionHasPermissionToCategory(c.AppContext, *c.AppContext.Session(), c.Params.UserId, c.Params.TeamId, categoryId) {
			c.SetInvalidParam("category")
			return
		}
	}

	appErr := c.App.UpdateSidebarCategoryOrder(c.AppContext, c.Params.UserId, c.Params.TeamId, categoryOrder)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	if _, err := w.Write([]byte(model.ArrayToJSON(categoryOrder))); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	categories, appErr := c.App.GetSidebarCategory(c.AppContext, c.Params.CategoryId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	categoriesJSON, err := json.Marshal(categories)
	if err != nil {
		c.Err = model.NewAppError("getCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(categoriesJSON); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateCategoriesForTeamForUser, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

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

	if appErr := validateSidebarCategories(c, c.Params.TeamId, c.Params.UserId, categoriesUpdateRequest); appErr != nil {
		c.Err = appErr
		return
	}

	categories, appErr := c.App.UpdateSidebarCategories(c.AppContext, c.Params.UserId, c.Params.TeamId, categoriesUpdateRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}

	categoriesJSON, err := json.Marshal(categories)
	if err != nil {
		c.Err = model.NewAppError("updateCategoriesForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	if _, err := w.Write(categoriesJSON); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func validateSidebarCategory(c *Context, teamId, userId string, category *model.SidebarCategoryWithChannels) *model.AppError {
	channels, appErr := c.App.GetChannelsForTeamForUser(c.AppContext, teamId, userId, &model.ChannelSearchOpts{
		IncludeDeleted: true,
		LastDeleteAt:   0,
	})
	if appErr != nil {
		return model.NewAppError("validateSidebarCategory", "api.invalid_channel", nil, "", http.StatusBadRequest).Wrap(appErr)
	}

	category.Channels = validateSidebarCategoryChannels(c, userId, category.Channels, channelListToMap(channels))

	return nil
}

func validateSidebarCategories(c *Context, teamId, userId string, categories []*model.SidebarCategoryWithChannels) *model.AppError {
	channels, err := c.App.GetChannelsForTeamForUser(c.AppContext, teamId, userId, &model.ChannelSearchOpts{
		IncludeDeleted: true,
		LastDeleteAt:   0,
	})
	if err != nil {
		return model.NewAppError("validateSidebarCategory", "api.invalid_channel", nil, "", http.StatusBadRequest).Wrap(err)
	}

	channelMap := channelListToMap(channels)

	for _, category := range categories {
		category.Channels = validateSidebarCategoryChannels(c, userId, category.Channels, channelMap)
	}

	return nil
}

func channelListToMap(channelList model.ChannelList) map[string]*model.Channel {
	channelMap := make(map[string]*model.Channel, len(channelList))
	for _, channel := range channelList {
		channelMap[channel.Id] = channel
	}
	return channelMap
}

// validateSidebarCategoryChannels returns a normalized slice of channel IDs by removing duplicates from it and
// ensuring that it only contains IDs of channels in the given map of Channels by IDs.
func validateSidebarCategoryChannels(c *Context, userId string, channelIds []string, channelMap map[string]*model.Channel) []string {
	var filtered []string

	for _, channelId := range channelIds {
		if _, ok := channelMap[channelId]; ok {
			filtered = append(filtered, channelId)
		} else {
			c.Logger.Info("Stopping user from adding channel to their sidebar when they are not a member", mlog.String("user_id", userId), mlog.String("channel_id", channelId))
		}
	}

	filtered = model.RemoveDuplicateStringsNonSort(filtered)

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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateCategoryForTeamForUser, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	var categoryUpdateRequest model.SidebarCategoryWithChannels
	err := json.NewDecoder(r.Body).Decode(&categoryUpdateRequest)
	if err != nil || categoryUpdateRequest.TeamId != c.Params.TeamId || categoryUpdateRequest.UserId != c.Params.UserId {
		c.SetInvalidParamWithErr("category", err)
		return
	}

	if appErr := validateSidebarCategory(c, c.Params.TeamId, c.Params.UserId, &categoryUpdateRequest); appErr != nil {
		c.Err = appErr
		return
	}

	categoryUpdateRequest.Id = c.Params.CategoryId

	categories, appErr := c.App.UpdateSidebarCategories(c.AppContext, c.Params.UserId, c.Params.TeamId, []*model.SidebarCategoryWithChannels{&categoryUpdateRequest})
	if appErr != nil {
		c.Err = appErr
		return
	}

	categoryJSON, err := json.Marshal(categories[0])
	if err != nil {
		c.Err = model.NewAppError("updateCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	if _, err := w.Write(categoryJSON); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteCategoryForTeamForUser, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	appErr := c.App.DeleteSidebarCategory(c.AppContext, c.Params.UserId, c.Params.TeamId, c.Params.CategoryId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
