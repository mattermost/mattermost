// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitPostLocal() {
	api.BaseRoutes.Post.Handle("", api.APILocal(getPost)).Methods(http.MethodGet)
	api.BaseRoutes.PostsForChannel.Handle("", api.APILocal(getPostsForChannel)).Methods(http.MethodGet)
	api.BaseRoutes.Post.Handle("", api.APILocal(localDeletePost)).Methods(http.MethodDelete)
}

func localDeletePost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	permanent := c.Params.Permanent

	auditRec := c.MakeAuditRecord("localDeletePost", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	audit.AddEventParameter(auditRec, "post_id", c.Params.PostId)
	audit.AddEventParameter(auditRec, "permanent", permanent)

	includeDeleted := permanent

	post, appErr := c.App.GetSinglePost(c.AppContext, c.Params.PostId, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventPriorState(post)
	auditRec.AddEventObjectType("post")

	if permanent {
		appErr = c.App.PermanentDeletePost(c.AppContext, c.Params.PostId, c.AppContext.Session().UserId)
	} else {
		_, appErr = c.App.DeletePost(c.AppContext, c.Params.PostId, c.AppContext.Session().UserId)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
