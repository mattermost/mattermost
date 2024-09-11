// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitScheduledPost() {
	api.BaseRoutes.Posts.Handle("/schedule", api.APISessionRequired(createSchedulePost)).Methods(http.MethodPost)
	api.BaseRoutes.Posts.Handle("/scheduled/team/{team_id:[A-Za-z0-9]+}", api.APISessionRequired(getTeamScheduledPosts)).Methods(http.MethodGet)
}

func createSchedulePost(c *Context, w http.ResponseWriter, r *http.Request) {
	var scheduledPost model.ScheduledPost
	if err := json.NewDecoder(r.Body).Decode(&scheduledPost); err != nil {
		c.SetInvalidParamWithErr("schedule_post", err)
		return
	}
	scheduledPost.UserId = c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord("createSchedulePost", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	audit.AddEventParameterAuditable(auditRec, "scheduledPost", &scheduledPost)

	hasPermissionToCreatePostInChannel := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), scheduledPost.ChannelId, model.PermissionCreatePost)
	if !hasPermissionToCreatePostInChannel {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	createdScheduledPost, appErr := c.App.SaveScheduledPost(c.AppContext, &scheduledPost)
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
	c.RequireTeamId()
	if c.Err != nil {
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

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		mlog.Error("failed to encode scheduled posts to return API response", mlog.Err(err))
		return
	}
}
