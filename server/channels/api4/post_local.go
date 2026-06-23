// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
)

func (api *API) InitPostLocal() {
	api.BaseRoutes.Posts.Handle("", api.APILocal(localCreatePost)).Methods(http.MethodPost)
	api.BaseRoutes.Post.Handle("", api.APILocal(getPost)).Methods(http.MethodGet)
	api.BaseRoutes.PostsForChannel.Handle("", api.APILocal(getPostsForChannel)).Methods(http.MethodGet)
	api.BaseRoutes.Post.Handle("", api.APILocal(localDeletePost)).Methods(http.MethodDelete)
}

func localCreatePostChecks(where string, c *Context, post *model.Post) {
	postHardenedModeCheckWithContext(where, c, post.GetProps())
	if c.Err != nil {
		return
	}

	appErr := app.PostPriorityCheckWithApp(where, c.App, post.UserId, post.GetPriority(), post.RootId)
	if appErr != nil {
		appErr.Where = where
		c.Err = appErr
		return
	}

	postCardTypeCheckWithContext(where, c, post.Type)
	if c.Err != nil {
		return
	}

	postBurnOnReadCheckWithContext(where, c, post, nil)
}

func localCreatePost(c *Context, w http.ResponseWriter, r *http.Request) {
	var post model.Post
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	post.SanitizeInput()

	if post.UserId == "" || !model.IsValidId(post.UserId) {
		c.SetInvalidParam("user_id")
		return
	}

	if _, appErr := c.App.GetUser(post.UserId); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalCreatePost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterAuditableToAuditRec(auditRec, "post", &post)

	localCreatePostChecks("Api4.localCreatePost", c, &post)
	if c.Err != nil {
		return
	}

	setOnline := r.URL.Query().Get("set_online")
	setOnlineBool := true
	var err2 error
	if setOnline != "" {
		setOnlineBool, err2 = strconv.ParseBool(setOnline)
		if err2 != nil {
			c.Logger.Warn("Failed to parse set_online URL query parameter from localCreatePost request", mlog.Err(err2))
			setOnlineBool = true
		}
	}

	rp, isMemberForPreviews, err := c.App.CreatePostAsUser(c.AppContext, c.App.PostWithProxyRemovedFromImageURLs(&post), "", setOnlineBool)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	auditRec.AddEventResultState(rp)
	auditRec.AddEventObjectType("post")

	if !isMemberForPreviews {
		previewPost := rp.GetPreviewPost()
		if previewPost != nil {
			model.AddEventParameterToAuditRec(auditRec, "preview_post_id", previewPost.Post.Id)
		}
		model.AddEventParameterToAuditRec(auditRec, "non_channel_member_access", true)
	}

	if setOnlineBool {
		c.App.SetStatusOnline(post.UserId, false)
	}

	if rp.Type == model.PostTypeBurnOnRead && rp.UserId == post.UserId {
		masterCtx := sqlstore.RequestContextWithMaster(c.AppContext)
		revealedPost, appErr := c.App.GetSinglePost(masterCtx, rp.Id, false)
		if appErr != nil {
			c.Err = appErr
			return
		}
		rp = c.App.PreparePostForClient(masterCtx, revealedPost, &model.PreparePostForClientOpts{
			IsNewPost: true,
		})
		rp.PendingPostId = post.PendingPostId
	}

	w.WriteHeader(http.StatusCreated)

	if err := rp.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localDeletePost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	permanent := c.Params.Permanent

	auditRec := c.MakeAuditRecord(model.AuditEventLocalDeletePost, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "post_id", c.Params.PostId)
	model.AddEventParameterToAuditRec(auditRec, "permanent", permanent)

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
