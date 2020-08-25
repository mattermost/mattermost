// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func getCategoriesForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.App.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
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

	if !c.App.SessionHasPermissionToUser(*c.App.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	auditRec := c.MakeAuditRecord("createCategoryForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	categoryCreateRequest, err := model.SidebarCategoryFromJson(r.Body)
	if err != nil || c.Params.UserId != categoryCreateRequest.UserId || c.Params.TeamId != categoryCreateRequest.TeamId {
		c.SetInvalidParam("category")
		return
	}
	if appErr := validateUserChannels("createCategoryForTeamForUser", c, c.Params.TeamId, c.Params.UserId, categoryCreateRequest.Channels); appErr != nil {
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

	if !c.App.SessionHasPermissionToUser(*c.App.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
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

	if !c.App.SessionHasPermissionToUser(*c.App.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	auditRec := c.MakeAuditRecord("updateCategoryOrderForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	categoryOrder := model.ArrayFromJson(r.Body)

	for _, categoryId := range categoryOrder {
		if !c.App.SessionHasPermissionToCategory(*c.App.Session(), c.Params.UserId, c.Params.TeamId, categoryId) {
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

	if !c.App.SessionHasPermissionToCategory(*c.App.Session(), c.Params.UserId, c.Params.TeamId, c.Params.CategoryId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
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

	if !c.App.SessionHasPermissionToUser(*c.App.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	auditRec := c.MakeAuditRecord("updateCategoriesForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	categoriesUpdateRequest, err := model.SidebarCategoriesFromJson(r.Body)
	if err != nil {
		c.SetInvalidParam("category")
		return
	}
	var channelsToCheck []string
	for _, category := range categoriesUpdateRequest {
		if !c.App.SessionHasPermissionToCategory(*c.App.Session(), c.Params.UserId, c.Params.TeamId, category.Id) {
			c.SetInvalidParam("category")
			return
		}
		channelsToCheck = append(channelsToCheck, category.Channels...)
	}
	if appErr := validateUserChannels("updateCategoriesForTeamForUser", c, c.Params.TeamId, c.Params.UserId, channelsToCheck); appErr != nil {
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

// validateUserChannels confirms that the given user is a member of the given channel IDs. Returns an error if the user
// is not a member of any channel or nil if the user is a member of each channel.
func validateUserChannels(operationName string, c *Context, teamId, userId string, channelIDs []string) *model.AppError {
	channels, err := c.App.GetChannelsForUser(teamId, userId, true, 0)
	if err != nil {
		return model.NewAppError("Api4."+operationName, "api.invalid_channel", nil, err.Error(), http.StatusBadRequest)
	}

	for _, channelId := range channelIDs {
		found := false
		for _, channel := range *channels {
			if channel.Id == channelId {
				found = true
				break
			}
		}

		if !found {
			return model.NewAppError("Api4."+operationName, "api.invalid_channel", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func updateCategoryForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId().RequireCategoryId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToCategory(*c.App.Session(), c.Params.UserId, c.Params.TeamId, c.Params.CategoryId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	auditRec := c.MakeAuditRecord("updateCategoryForTeamForUser", audit.Fail)
	defer c.LogAuditRec(auditRec)

	categoryUpdateRequest, err := model.SidebarCategoryFromJson(r.Body)
	if err != nil || categoryUpdateRequest.TeamId != c.Params.TeamId || categoryUpdateRequest.UserId != c.Params.UserId {
		c.SetInvalidParam("category")
		return
	}

	if appErr := validateUserChannels("updateCategoryForTeamForUser", c, c.Params.TeamId, c.Params.UserId, categoryUpdateRequest.Channels); appErr != nil {
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

	if !c.App.SessionHasPermissionToCategory(*c.App.Session(), c.Params.UserId, c.Params.TeamId, c.Params.CategoryId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
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
