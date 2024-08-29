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
