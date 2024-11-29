// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitScheduledPost() {
	api.BaseRoutes.Posts.Handle("/schedule", api.APISessionRequired(createSchedulePost)).Methods(http.MethodPost)
	api.BaseRoutes.Posts.Handle("/schedule/{scheduled_post_id:[A-Za-z0-9]+}", api.APISessionRequired(updateScheduledPost)).Methods(http.MethodPut)
	api.BaseRoutes.Posts.Handle("/schedule/{scheduled_post_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteScheduledPost)).Methods(http.MethodDelete)
	api.BaseRoutes.Posts.Handle("/scheduled/team/{team_id:[A-Za-z0-9]+}", api.APISessionRequired(getTeamScheduledPosts)).Methods(http.MethodGet)
}

func scheduledPostChecks(where string, c *Context, scheduledPost *model.ScheduledPost) {
	// ***************************************************************
	// NOTE - if you make any change here, please make sure to apply the
	//	      same change for scheduled posts job as well in the `canPostScheduledPost()` function
	//	      in app layer.
	// ***************************************************************

	userCreatePostPermissionCheckWithContext(c, scheduledPost.ChannelId)
	if c.Err != nil {
		return
	}

	postHardenedModeCheckWithContext(where, c, scheduledPost.GetProps())
	if c.Err != nil {
		return
	}

	postPriorityCheckWithContext(where, c, scheduledPost.GetPriority(), scheduledPost.RootId)
}

func requireScheduledPostsEnabled(c *Context) {
	if !*c.App.Srv().Config().ServiceSettings.ScheduledPosts {
		c.Err = model.NewAppError("", "api.scheduled_posts.feature_disabled", nil, "", http.StatusBadRequest)
		return
	}

	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("", "api.scheduled_posts.license_error", nil, "", http.StatusBadRequest)
		return
	}
}

func createSchedulePost(c *Context, w http.ResponseWriter, r *http.Request) {
	requireScheduledPostsEnabled(c)
	if c.Err != nil {
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	var scheduledPost model.ScheduledPost
	if err := json.NewDecoder(r.Body).Decode(&scheduledPost); err != nil {
		c.SetInvalidParamWithErr("schedule_post", err)
		return
	}
	scheduledPost.UserId = c.AppContext.Session().UserId
	scheduledPost.SanitizeInput()

	auditRec := c.MakeAuditRecord("createSchedulePost", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	audit.AddEventParameterAuditable(auditRec, "scheduledPost", &scheduledPost)

	scheduledPostChecks("Api4.createSchedulePost", c, &scheduledPost)
	if c.Err != nil {
		return
	}

	createdScheduledPost, appErr := c.App.SaveScheduledPost(c.AppContext, &scheduledPost, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(createdScheduledPost)
	auditRec.AddEventObjectType("scheduledPost")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(createdScheduledPost); err != nil {
		mlog.Error("failed to encode scheduled post to return API response", mlog.Err(err))
		return
	}
}

func getTeamScheduledPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	requireScheduledPostsEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	teamId := c.Params.TeamId
	userId := c.AppContext.Session().UserId

	scheduledPosts, appErr := c.App.GetUserTeamScheduledPosts(c.AppContext, userId, teamId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	response := map[string][]*model.ScheduledPost{}
	response[teamId] = scheduledPosts

	if r.URL.Query().Get("includeDirectChannels") == "true" {
		directChannelScheduledPosts, appErr := c.App.GetUserTeamScheduledPosts(c.AppContext, userId, "")
		if appErr != nil {
			c.Err = appErr
			return
		}

		response["directChannels"] = directChannelScheduledPosts
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		mlog.Error("failed to encode scheduled posts to return API response", mlog.Err(err))
		return
	}
}

func updateScheduledPost(c *Context, w http.ResponseWriter, r *http.Request) {
	requireScheduledPostsEnabled(c)
	if c.Err != nil {
		return
	}

	connectionID := r.Header.Get(model.ConnectionId)

	scheduledPostId := mux.Vars(r)["scheduled_post_id"]
	if scheduledPostId == "" {
		c.SetInvalidURLParam("scheduled_post_id")
		return
	}

	var scheduledPost model.ScheduledPost
	if err := json.NewDecoder(r.Body).Decode(&scheduledPost); err != nil {
		c.SetInvalidParamWithErr("schedule_post", err)
		return
	}

	if scheduledPost.Id != scheduledPostId {
		c.SetInvalidURLParam("scheduled_post_id")
		return
	}

	auditRec := c.MakeAuditRecord("updateScheduledPost", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	audit.AddEventParameterAuditable(auditRec, "scheduledPost", &scheduledPost)

	scheduledPostChecks("Api4.updateScheduledPost", c, &scheduledPost)
	if c.Err != nil {
		return
	}

	userId := c.AppContext.Session().UserId
	updatedScheduledPost, appErr := c.App.UpdateScheduledPost(c.AppContext, userId, &scheduledPost, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedScheduledPost)
	auditRec.AddEventObjectType("scheduledPost")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(updatedScheduledPost); err != nil {
		mlog.Error("failed to encode scheduled post to return API response", mlog.Err(err))
		return
	}
}

func deleteScheduledPost(c *Context, w http.ResponseWriter, r *http.Request) {
	requireScheduledPostsEnabled(c)
	if c.Err != nil {
		return
	}

	scheduledPostId := mux.Vars(r)["scheduled_post_id"]
	if scheduledPostId == "" {
		c.SetInvalidURLParam("scheduled_post_id")
		return
	}

	auditRec := c.MakeAuditRecord("deleteScheduledPost", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	audit.AddEventParameter(auditRec, "scheduledPostId", scheduledPostId)

	userId := c.AppContext.Session().UserId
	connectionID := r.Header.Get(model.ConnectionId)
	deletedScheduledPost, appErr := c.App.DeleteScheduledPost(c.AppContext, userId, scheduledPostId, connectionID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(deletedScheduledPost)
	auditRec.AddEventObjectType("scheduledPost")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(deletedScheduledPost); err != nil {
		mlog.Error("failed to encode scheduled post to return API response", mlog.Err(err))
		return
	}
}
