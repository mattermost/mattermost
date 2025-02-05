// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

func (api *API) InitPost() {
	api.BaseRoutes.Posts.Handle("", api.APISessionRequired(createPost)).Methods(http.MethodPost)
	api.BaseRoutes.Post.Handle("", api.APISessionRequired(getPost)).Methods(http.MethodGet)
	api.BaseRoutes.Post.Handle("", api.APISessionRequired(deletePost)).Methods(http.MethodDelete)
	api.BaseRoutes.Posts.Handle("/ids", api.APISessionRequired(getPostsByIds)).Methods(http.MethodPost)
	api.BaseRoutes.Posts.Handle("/ephemeral", api.APISessionRequired(createEphemeralPost)).Methods(http.MethodPost)
	api.BaseRoutes.Post.Handle("/edit_history", api.APISessionRequired(getEditHistoryForPost)).Methods(http.MethodGet)
	api.BaseRoutes.Post.Handle("/thread", api.APISessionRequired(getPostThread)).Methods(http.MethodGet)
	api.BaseRoutes.Post.Handle("/info", api.APISessionRequired(getPostInfo)).Methods(http.MethodGet)
	api.BaseRoutes.Post.Handle("/files/info", api.APISessionRequired(getFileInfosForPost)).Methods(http.MethodGet)
	api.BaseRoutes.PostsForChannel.Handle("", api.APISessionRequired(getPostsForChannel)).Methods(http.MethodGet)
	api.BaseRoutes.PostsForUser.Handle("/flagged", api.APISessionRequired(getFlaggedPostsForUser)).Methods(http.MethodGet)

	api.BaseRoutes.ChannelForUser.Handle("/posts/unread", api.APISessionRequired(getPostsForChannelAroundLastUnread)).Methods(http.MethodGet)

	api.BaseRoutes.Team.Handle("/posts/search", api.APISessionRequiredDisableWhenBusy(searchPostsInTeam)).Methods(http.MethodPost)
	api.BaseRoutes.Posts.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchPostsInAllTeams)).Methods(http.MethodPost)
	api.BaseRoutes.Post.Handle("", api.APISessionRequired(updatePost)).Methods(http.MethodPut)
	api.BaseRoutes.Post.Handle("/patch", api.APISessionRequired(patchPost)).Methods(http.MethodPut)
	api.BaseRoutes.Post.Handle("/restore/{restore_version_id:[A-Za-z0-9]+}", api.APISessionRequired(restorePostVersion)).Methods(http.MethodPost)
	api.BaseRoutes.PostForUser.Handle("/set_unread", api.APISessionRequired(setPostUnread)).Methods(http.MethodPost)
	api.BaseRoutes.PostForUser.Handle("/reminder", api.APISessionRequired(setPostReminder)).Methods(http.MethodPost)

	api.BaseRoutes.Post.Handle("/pin", api.APISessionRequired(pinPost)).Methods(http.MethodPost)
	api.BaseRoutes.Post.Handle("/unpin", api.APISessionRequired(unpinPost)).Methods(http.MethodPost)

	api.BaseRoutes.PostForUser.Handle("/ack", api.APISessionRequired(acknowledgePost)).Methods(http.MethodPost)
	api.BaseRoutes.PostForUser.Handle("/ack", api.APISessionRequired(unacknowledgePost)).Methods(http.MethodDelete)

	api.BaseRoutes.Post.Handle("/move", api.APISessionRequired(moveThread)).Methods(http.MethodPost)
}

func createPostChecks(where string, c *Context, post *model.Post) {
	// ***************************************************************
	// NOTE - if you make any change here, please make sure to apply the
	//	      same change for scheduled posts as well in the `scheduledPostChecks()` function
	//	      in API layer.
	// ***************************************************************

	userCreatePostPermissionCheckWithContext(c, post.ChannelId)
	if c.Err != nil {
		return
	}

	postHardenedModeCheckWithContext(where, c, post.GetProps())
	if c.Err != nil {
		return
	}

	postPriorityCheckWithContext(where, c, post.GetPriority(), post.RootId)
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	var post model.Post
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	post.SanitizeInput()
	post.UserId = c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord("createPost", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	audit.AddEventParameterAuditable(auditRec, "post", &post)

	if post.CreateAt != 0 && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		post.CreateAt = 0
	}

	createPostChecks("Api4.createPost", c, &post)
	if c.Err != nil {
		return
	}

	setOnline := r.URL.Query().Get("set_online")
	setOnlineBool := true // By default, always set online.
	var err2 error
	if setOnline != "" {
		setOnlineBool, err2 = strconv.ParseBool(setOnline)
		if err2 != nil {
			c.Logger.Warn("Failed to parse set_online URL query parameter from createPost request", mlog.Err(err2))
			setOnlineBool = true // Set online nevertheless.
		}
	}

	rp, err := c.App.CreatePostAsUser(c.AppContext, c.App.PostWithProxyRemovedFromImageURLs(&post), c.AppContext.Session().Id, setOnlineBool)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	auditRec.AddEventResultState(rp)
	auditRec.AddEventObjectType("post")

	if setOnlineBool {
		c.App.SetStatusOnline(c.AppContext.Session().UserId, false)
	}

	c.App.Srv().Platform().UpdateLastActivityAtIfNeeded(*c.AppContext.Session())
	c.ExtendSessionExpiryIfNeeded(w, r)

	w.WriteHeader(http.StatusCreated)

	// Note that rp has already had PreparePostForClient called on it by App.CreatePost
	if err := rp.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createEphemeralPost(c *Context, w http.ResponseWriter, r *http.Request) {
	ephRequest := model.PostEphemeral{}

	jsonErr := json.NewDecoder(r.Body).Decode(&ephRequest)
	if jsonErr != nil {
		c.SetInvalidParamWithErr("body", jsonErr)
		return
	}

	if ephRequest.UserID == "" {
		c.SetInvalidParam("user_id")
		return
	}

	if ephRequest.Post == nil {
		c.SetInvalidParam("post")
		return
	}

	ephRequest.Post.UserId = c.AppContext.Session().UserId
	ephRequest.Post.CreateAt = model.GetMillis()

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreatePostEphemeral) {
		c.SetPermissionError(model.PermissionCreatePostEphemeral)
		return
	}

	rp := c.App.SendEphemeralPost(c.AppContext, ephRequest.UserID, c.App.PostWithProxyRemovedFromImageURLs(ephRequest.Post))

	w.WriteHeader(http.StatusCreated)
	rp = model.AddPostActionCookies(rp, c.App.PostActionCookieSecret())
	rp = c.App.PreparePostForClientWithEmbedsAndImages(c.AppContext, rp, true, false, true)
	rp, err := c.App.SanitizePostMetadataForUser(c.AppContext, rp, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}
	if err := rp.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPostsForChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	afterPost := r.URL.Query().Get("after")
	if afterPost != "" && !model.IsValidId(afterPost) {
		c.SetInvalidParam("after")
		return
	}

	beforePost := r.URL.Query().Get("before")
	if beforePost != "" && !model.IsValidId(beforePost) {
		c.SetInvalidParam("before")
		return
	}

	sinceString := r.URL.Query().Get("since")
	var since int64
	var parseError error
	if sinceString != "" {
		since, parseError = strconv.ParseInt(sinceString, 10, 64)
		if parseError != nil {
			c.SetInvalidParamWithErr("since", parseError)
			return
		}
	}
	skipFetchThreads := r.URL.Query().Get("skipFetchThreads") == "true"
	collapsedThreads := r.URL.Query().Get("collapsedThreads") == "true"
	collapsedThreadsExtended := r.URL.Query().Get("collapsedThreadsExtended") == "true"
	includeDeleted := r.URL.Query().Get("include_deleted") == "true"
	channelId := c.Params.ChannelId
	page := c.Params.Page
	perPage := c.Params.PerPage

	if !c.IsSystemAdmin() && includeDeleted {
		c.SetPermissionError(model.PermissionReadDeletedPosts)
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, channelId)
	if err != nil {
		c.Err = err
		return
	}
	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	if !*c.App.Config().TeamSettings.ExperimentalViewArchivedChannels {
		channel, appErr := c.App.GetChannel(c.AppContext, channelId)
		if appErr != nil {
			c.Err = appErr
			return
		}
		if channel.DeleteAt != 0 {
			c.Err = model.NewAppError("Api4.getPostsForChannel", "api.user.view_archived_channels.get_posts_for_channel.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	var list *model.PostList
	etag := ""

	if since > 0 {
		list, err = c.App.GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelId, Time: since, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: c.AppContext.Session().UserId})
	} else if afterPost != "" {
		etag = c.App.GetPostsEtag(channelId, collapsedThreads)

		if c.HandleEtag(etag, "Get Posts After", w, r) {
			return
		}

		list, err = c.App.GetPostsAfterPost(model.GetPostsOptions{ChannelId: channelId, PostId: afterPost, Page: page, PerPage: perPage, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, UserId: c.AppContext.Session().UserId, IncludeDeleted: includeDeleted})
	} else if beforePost != "" {
		etag = c.App.GetPostsEtag(channelId, collapsedThreads)

		if c.HandleEtag(etag, "Get Posts Before", w, r) {
			return
		}

		list, err = c.App.GetPostsBeforePost(model.GetPostsOptions{ChannelId: channelId, PostId: beforePost, Page: page, PerPage: perPage, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: c.AppContext.Session().UserId, IncludeDeleted: includeDeleted})
	} else {
		etag = c.App.GetPostsEtag(channelId, collapsedThreads)

		if c.HandleEtag(etag, "Get Posts", w, r) {
			return
		}

		list, err = c.App.GetPostsPage(model.GetPostsOptions{ChannelId: channelId, Page: page, PerPage: perPage, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: c.AppContext.Session().UserId, IncludeDeleted: includeDeleted})
	}

	if err != nil {
		c.Err = err
		return
	}

	if etag != "" {
		w.Header().Set(model.HeaderEtagServer, etag)
	}

	c.App.AddCursorIdsForPostList(list, afterPost, beforePost, since, page, perPage, collapsedThreads)
	clientPostList := c.App.PreparePostListForClient(c.AppContext, list)
	clientPostList, err = c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPostsForChannelAroundLastUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireChannelId()
	if c.Err != nil {
		return
	}

	userId := c.Params.UserId
	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), userId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	channelId := c.Params.ChannelId
	channel, err := c.App.GetChannel(c.AppContext, channelId)
	if err != nil {
		c.Err = err
		return
	}
	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	if c.Params.LimitAfter == 0 {
		c.SetInvalidURLParam("limit_after")
		return
	}

	skipFetchThreads := r.URL.Query().Get("skipFetchThreads") == "true"
	collapsedThreads := r.URL.Query().Get("collapsedThreads") == "true"
	collapsedThreadsExtended := r.URL.Query().Get("collapsedThreadsExtended") == "true"

	postList, err := c.App.GetPostsForChannelAroundLastUnread(c.AppContext, channelId, userId, c.Params.LimitBefore, c.Params.LimitAfter, skipFetchThreads, collapsedThreads, collapsedThreadsExtended)
	if err != nil {
		c.Err = err
		return
	}

	etag := ""
	if len(postList.Order) == 0 {
		etag = c.App.GetPostsEtag(channelId, collapsedThreads)

		if c.HandleEtag(etag, "Get Posts", w, r) {
			return
		}

		postList, err = c.App.GetPostsPage(model.GetPostsOptions{ChannelId: channelId, Page: app.PageDefault, PerPage: c.Params.LimitBefore, SkipFetchThreads: skipFetchThreads, CollapsedThreads: collapsedThreads, CollapsedThreadsExtended: collapsedThreadsExtended, UserId: c.AppContext.Session().UserId})
		if err != nil {
			c.Err = err
			return
		}
	}

	postList.NextPostId = c.App.GetNextPostIdFromPostList(postList, collapsedThreads)
	postList.PrevPostId = c.App.GetPrevPostIdFromPostList(postList, collapsedThreads)

	clientPostList := c.App.PreparePostListForClient(c.AppContext, postList)
	clientPostList, err = c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if etag != "" {
		w.Header().Set(model.HeaderEtagServer, etag)
	}
	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getFlaggedPostsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	channelId := r.URL.Query().Get("channel_id")
	teamId := r.URL.Query().Get("team_id")

	var posts *model.PostList
	var err *model.AppError

	if channelId != "" {
		posts, err = c.App.GetFlaggedPostsForChannel(c.Params.UserId, channelId, c.Params.Page, c.Params.PerPage)
	} else if teamId != "" {
		posts, err = c.App.GetFlaggedPostsForTeam(c.Params.UserId, teamId, c.Params.Page, c.Params.PerPage)
	} else {
		posts, err = c.App.GetFlaggedPosts(c.Params.UserId, c.Params.Page, c.Params.PerPage)
	}
	if err != nil {
		c.Err = err
		return
	}

	channelMap := make(map[string]*model.Channel)
	channelIds := []string{}
	for _, post := range posts.Posts {
		channelIds = append(channelIds, post.ChannelId)
	}
	channels, err := c.App.GetChannels(c.AppContext, channelIds)
	if err != nil {
		c.Err = err
		return
	}
	for _, channel := range channels {
		channelMap[channel.Id] = channel
	}

	pl := model.NewPostList()
	channelReadPermission := make(map[string]bool)

	for _, post := range posts.Posts {
		allowed, ok := channelReadPermission[post.ChannelId]

		if !ok {
			allowed = false

			channel, ok := channelMap[post.ChannelId]
			if !ok {
				continue
			}
			if c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
				allowed = true
			}

			channelReadPermission[post.ChannelId] = allowed
		}

		if !allowed {
			continue
		}

		pl.AddPost(post)
		pl.AddOrder(post.Id)
	}

	pl.SortByCreateAt()
	clientPostList := c.App.PreparePostListForClient(c.AppContext, pl)
	clientPostList, err = c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}
	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getPost also sets a header to indicate, if post is inaccessible due to the cloud plan's limit.
func getPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	if includeDeleted && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	post, err := c.App.GetPostIfAuthorized(c.AppContext, c.Params.PostId, c.AppContext.Session(), includeDeleted)
	if err != nil {
		c.Err = err

		// Post is inaccessible due to cloud plan's limit.
		if err.Id == "app.post.cloud.get.app_error" {
			w.Header().Set(model.HeaderFirstInaccessiblePostTime, "1")
		}

		return
	}

	post = c.App.PreparePostForClientWithEmbedsAndImages(c.AppContext, post, false, false, true)
	post, err = c.App.SanitizePostMetadataForUser(c.AppContext, post, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	if c.HandleEtag(post.Etag(), "Get Post", w, r) {
		return
	}

	w.Header().Set(model.HeaderEtagServer, post.Etag())
	if err := post.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getPostsByIds also sets a header to indicate, if posts were truncated as per the cloud plan's limit.
func getPostsByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	postIDs, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getPostsByIds", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(postIDs) == 0 {
		c.SetInvalidParam("post_ids")
		return
	}

	if len(postIDs) > 1000 {
		c.Err = model.NewAppError("getPostsByIds", "api.post.posts_by_ids.invalid_body.request_error", map[string]any{"MaxLength": 1000}, "", http.StatusBadRequest)
		return
	}

	postsList, firstInaccessiblePostTime, appErr := c.App.GetPostsByIds(postIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channelMap := make(map[string]*model.Channel)
	channelIds := []string{}
	for _, post := range postsList {
		channelIds = append(channelIds, post.ChannelId)
	}
	channels, appErr := c.App.GetChannels(c.AppContext, channelIds)
	if appErr != nil {
		c.Err = appErr
		return
	}
	for _, channel := range channels {
		channelMap[channel.Id] = channel
	}

	var posts = []*model.Post{}
	for _, post := range postsList {
		channel, ok := channelMap[post.ChannelId]
		if !ok {
			continue
		}

		if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
			continue
		}

		post = c.App.PreparePostForClient(c.AppContext, post, false, false, true)
		post.StripActionIntegrations()
		posts = append(posts, post)
	}

	w.Header().Set(model.HeaderFirstInaccessiblePostTime, strconv.FormatInt(firstInaccessiblePostTime, 10))

	if err := json.NewEncoder(w).Encode(posts); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getEditHistoryForPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	originalPost, err := c.App.GetSinglePost(c.AppContext, c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditPost) {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	if c.AppContext.Session().UserId != originalPost.UserId {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	postsList, err := c.App.GetEditHistoryForPost(c.Params.PostId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(postsList); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deletePost(c *Context, w http.ResponseWriter, _ *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	permanent := c.Params.Permanent

	auditRec := c.MakeAuditRecord("deletePost", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	audit.AddEventParameter(auditRec, "post_id", c.Params.PostId)
	audit.AddEventParameter(auditRec, "permanent", permanent)

	includeDeleted := permanent

	if permanent && !*c.App.Config().ServiceSettings.EnableAPIPostDeletion {
		c.Err = model.NewAppError("deletePost", "api.post.delete_post.not_enabled.app_error", nil, "postId="+c.Params.PostId, http.StatusNotImplemented)
		return
	}

	if permanent && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	post, appErr := c.App.GetSinglePost(c.AppContext, c.Params.PostId, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventPriorState(post)
	auditRec.AddEventObjectType("post")

	if c.AppContext.Session().UserId == post.UserId {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionDeletePost) {
			c.SetPermissionError(model.PermissionDeletePost)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionDeleteOthersPosts) {
			c.SetPermissionError(model.PermissionDeleteOthersPosts)
			return
		}
	}

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

func getPostThread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	// For now, by default we return all items unless it's set to maintain
	// backwards compatibility with mobile. But when the next ESR passes, we need to
	// change this to web.PerPageDefault.
	perPage := 0
	if perPageStr := r.URL.Query().Get("perPage"); perPageStr != "" {
		var err error
		perPage, err = strconv.Atoi(perPageStr)
		if err != nil || perPage > web.PerPageMaximum {
			c.SetInvalidParamWithErr("perPage", err)
			return
		}
	}

	var fromCreateAt int64
	if fromCreateAtStr := r.URL.Query().Get("fromCreateAt"); fromCreateAtStr != "" {
		var err error
		fromCreateAt, err = strconv.ParseInt(fromCreateAtStr, 10, 64)
		if err != nil {
			c.SetInvalidParamWithErr("fromCreateAt", err)
			return
		}
	}

	fromPost := r.URL.Query().Get("fromPost")
	// Either only fromCreateAt must be set, or both fromPost and fromCreateAt must be set
	if fromPost != "" && fromCreateAt == 0 {
		c.SetInvalidParam("if fromPost is set, then fromCreateAt must also be set")
		return
	}

	direction := ""
	if dir := r.URL.Query().Get("direction"); dir != "" {
		if dir != "up" && dir != "down" {
			c.SetInvalidParam("direction")
			return
		}
		direction = dir
	}
	opts := model.GetPostsOptions{
		SkipFetchThreads:         r.URL.Query().Get("skipFetchThreads") == "true",
		CollapsedThreads:         r.URL.Query().Get("collapsedThreads") == "true",
		CollapsedThreadsExtended: r.URL.Query().Get("collapsedThreadsExtended") == "true",
		PerPage:                  perPage,
		Direction:                direction,
		FromPost:                 fromPost,
		FromCreateAt:             fromCreateAt,
	}
	list, err := c.App.GetPostThread(c.Params.PostId, opts, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}
	if list.FirstInaccessiblePostTime != 0 {
		// e.g. if root post is archived in a cloud plan,
		// we don't want to display the thread,
		// but at the same time the request was not bad,
		// so we return the time of archival and let the client
		// show an error
		if err := (&model.PostList{Order: []string{}, FirstInaccessiblePostTime: list.FirstInaccessiblePostTime}).EncodeJSON(w); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	post, ok := list.Posts[c.Params.PostId]
	if !ok {
		c.SetInvalidURLParam("post_id")
		return
	}

	if _, err = c.App.GetPostIfAuthorized(c.AppContext, post.Id, c.AppContext.Session(), false); err != nil {
		c.Err = err
		return
	}

	if c.HandleEtag(list.Etag(), "Get Post Thread", w, r) {
		return
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, list)
	clientPostList, err = c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set(model.HeaderEtagServer, clientPostList.Etag())

	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchPostsInTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	searchPosts(c, w, r, c.Params.TeamId)
}

func searchPostsInAllTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	searchPosts(c, w, r, "")
}

func searchPosts(c *Context, w http.ResponseWriter, r *http.Request, teamId string) {
	var params model.SearchParameter
	if jsonErr := json.NewDecoder(r.Body).Decode(&params); jsonErr != nil {
		c.Err = model.NewAppError("searchPosts", "api.post.search_posts.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(jsonErr)
		return
	}

	if params.Terms == nil || *params.Terms == "" {
		c.SetInvalidParam("terms")
		return
	}
	terms := *params.Terms

	timeZoneOffset := 0
	if params.TimeZoneOffset != nil {
		timeZoneOffset = *params.TimeZoneOffset
	}

	isOrSearch := false
	if params.IsOrSearch != nil {
		isOrSearch = *params.IsOrSearch
	}

	page := 0
	if params.Page != nil {
		page = *params.Page
	}

	perPage := 60
	if params.PerPage != nil {
		perPage = *params.PerPage
	}

	includeDeletedChannels := false
	if params.IncludeDeletedChannels != nil {
		includeDeletedChannels = *params.IncludeDeletedChannels
	}

	auditRec := c.MakeAuditRecord("searchPosts", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelAPI)
	audit.AddEventParameterAuditable(auditRec, "search_params", params)

	startTime := time.Now()

	results, err := c.App.SearchPostsForUser(c.AppContext, terms, c.AppContext.Session().UserId, teamId, isOrSearch, includeDeletedChannels, timeZoneOffset, page, perPage)

	elapsedTime := float64(time.Since(startTime)) / float64(time.Second)
	metrics := c.App.Metrics()
	if metrics != nil {
		metrics.IncrementPostsSearchCounter()
		metrics.ObservePostsSearchDuration(elapsedTime)
	}

	if err != nil {
		c.Err = err
		return
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, results.PostList)
	clientPostList, err = c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	results = model.MakePostSearchResults(clientPostList, results.Matches)
	audit.AddEventParameterAuditable(auditRec, "search_results", results)
	auditRec.Success()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if err := results.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updatePost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var post model.Post
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("updatePost", audit.Fail)
	audit.AddEventParameterAuditable(auditRec, "post", &post)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	// The post being updated in the payload must be the same one as indicated in the URL.
	if post.Id != c.Params.PostId {
		c.SetInvalidParam("id")
		return
	}

	postHardenedModeCheckWithContext("UpdatePost", c, post.GetProps())
	if c.Err != nil {
		return
	}

	originalPost, err := c.App.GetSinglePost(c.AppContext, c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditPost) {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	auditRec.AddEventPriorState(originalPost)
	auditRec.AddEventObjectType("post")

	// passing a nil fileIds should not have any effect on a post's file IDs
	// so, we restore the original file IDs in this case
	if post.FileIds == nil {
		post.FileIds = originalPost.FileIds
	}

	if c.AppContext.Session().UserId != originalPost.UserId {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditOthersPosts) {
			c.SetPermissionError(model.PermissionEditOthersPosts)
			return
		}
	}

	post.Id = c.Params.PostId

	if *c.App.Config().ServiceSettings.PostEditTimeLimit != -1 && model.GetMillis() > originalPost.CreateAt+int64(*c.App.Config().ServiceSettings.PostEditTimeLimit*1000) && post.Message != originalPost.Message {
		c.Err = model.NewAppError("UpdatePost", "api.post.update_post.permissions_time_limit.app_error", map[string]any{"timeLimit": *c.App.Config().ServiceSettings.PostEditTimeLimit}, "", http.StatusBadRequest)
		return
	}

	rpost, err := c.App.UpdatePost(c.AppContext, c.App.PostWithProxyRemovedFromImageURLs(&post), &model.UpdatePostOptions{SafeUpdate: false})
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rpost)

	if err := rpost.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var post model.PostPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("patchPost", audit.Fail)
	audit.AddEventParameter(auditRec, "id", c.Params.PostId)
	audit.AddEventParameterAuditable(auditRec, "patch", &post)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	if post.Props != nil {
		postHardenedModeCheckWithContext("patchPost", c, *post.Props)
		if c.Err != nil {
			return
		}
	}

	postPatchChecks(c, auditRec, post.Message)
	if c.Err != nil {
		return
	}

	patchedPost, err := c.App.PatchPost(c.AppContext, c.Params.PostId, c.App.PostPatchWithProxyRemovedFromImageURLs(&post), nil)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(patchedPost)

	if err := patchedPost.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func postPatchChecks(c *Context, auditRec *audit.Record, message *string) {
	originalPost, err := c.App.GetSinglePost(c.AppContext, c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}
	auditRec.AddEventPriorState(originalPost)
	auditRec.AddEventObjectType("post")

	var permission *model.Permission

	if c.AppContext.Session().UserId == originalPost.UserId {
		permission = model.PermissionEditPost
	} else {
		permission = model.PermissionEditOthersPosts
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, permission) {
		c.SetPermissionError(permission)
		return
	}

	if *c.App.Config().ServiceSettings.PostEditTimeLimit != -1 && model.GetMillis() > originalPost.CreateAt+int64(*c.App.Config().ServiceSettings.PostEditTimeLimit*1000) && message != nil {
		c.Err = model.NewAppError("patchPost", "api.post.update_post.permissions_time_limit.app_error", map[string]any{"timeLimit": *c.App.Config().ServiceSettings.PostEditTimeLimit}, "", http.StatusBadRequest)
		return
	}
}

func setPostUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId().RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapBoolFromJSON(r.Body)
	collapsedThreadsSupported := props["collapsed_threads_supported"]

	if c.AppContext.Session().UserId != c.Params.UserId && !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	state, err := c.App.MarkChannelAsUnreadFromPost(c.AppContext, c.Params.PostId, c.Params.UserId, collapsedThreadsSupported)
	if err != nil {
		c.Err = err
		return
	}
	if err := json.NewEncoder(w).Encode(state); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func setPostReminder(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId().RequireUserId()
	if c.Err != nil {
		return
	}

	if c.AppContext.Session().UserId != c.Params.UserId && !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}
	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	var reminder model.PostReminder
	if jsonErr := json.NewDecoder(r.Body).Decode(&reminder); jsonErr != nil {
		c.SetInvalidParamWithErr("target_time", jsonErr)
		return
	}

	appErr := c.App.SetPostReminder(c.AppContext, c.Params.PostId, c.Params.UserId, reminder.TargetTime)
	if appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func saveIsPinnedPost(c *Context, w http.ResponseWriter, isPinned bool) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("saveIsPinnedPost", audit.Fail)
	audit.AddEventParameter(auditRec, "post_id", c.Params.PostId)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	post, err := c.App.GetSinglePost(c.AppContext, c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}
	auditRec.AddEventPriorState(post)
	auditRec.AddEventObjectType("post")

	channel, err := c.App.GetChannel(c.AppContext, post.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	patch := &model.PostPatch{}
	patch.IsPinned = model.NewPointer(isPinned)

	patchedPost, err := c.App.PatchPost(c.AppContext, c.Params.PostId, patch, nil)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventResultState(patchedPost)

	auditRec.Success()
	ReturnStatusOK(w)
}

func pinPost(c *Context, w http.ResponseWriter, _ *http.Request) {
	saveIsPinnedPost(c, w, true)
}

func unpinPost(c *Context, w http.ResponseWriter, _ *http.Request) {
	saveIsPinnedPost(c, w, false)
}

func acknowledgePost(c *Context, w http.ResponseWriter, r *http.Request) {
	// license check
	permissionErr := minimumProfessionalLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequirePostId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	acknowledgement, appErr := c.App.SaveAcknowledgementForPost(c.AppContext, c.Params.PostId, c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(acknowledgement)
	if err != nil {
		c.Err = model.NewAppError("acknowledgePost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func unacknowledgePost(c *Context, w http.ResponseWriter, r *http.Request) {
	// license check
	permissionErr := minimumProfessionalLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequirePostId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	_, err := c.App.GetSinglePost(c.AppContext, c.Params.PostId, false)
	if err != nil {
		c.Err = err
		return
	}

	appErr := c.App.DeleteAcknowledgementForPost(c.AppContext, c.Params.PostId, c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func moveThread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !c.App.Config().FeatureFlags.MoveThreadsEnabled || c.App.License() == nil {
		c.Err = model.NewAppError("moveThread", "api.post.move_thread.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	var moveThreadParams model.MoveThreadParams
	if jsonErr := json.NewDecoder(r.Body).Decode(&moveThreadParams); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("moveThread", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	audit.AddEventParameter(auditRec, "original_post_id", c.Params.PostId)
	audit.AddEventParameter(auditRec, "to_channel_id", moveThreadParams.ChannelId)

	user, err := c.App.GetUser(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	posts, _, err := c.App.GetPostsByIds([]string{c.Params.PostId})
	if err != nil {
		c.Err = err
		return
	}

	channelMember, err := c.App.GetChannelMember(c.AppContext, posts[0].ChannelId, user.Id)
	if err != nil {
		c.Err = err
		return
	}

	userHasRole := hasPermittedWranglerRole(c, user, channelMember)

	// Sysadmins are always permitted
	if !userHasRole && !user.IsSystemAdmin() {
		c.Err = model.NewAppError("moveThread", "api.post.move_thread.no_permission", nil, "", http.StatusForbidden)
		return
	}

	userHasEmailDomain := len(c.App.Config().WranglerSettings.AllowedEmailDomain) == 0
	for _, domain := range c.App.Config().WranglerSettings.AllowedEmailDomain {
		if user.EmailDomain() == domain {
			userHasEmailDomain = true
			break
		}
	}

	if !userHasEmailDomain && !user.IsSystemAdmin() {
		c.Err = model.NewAppError("moveThread", "api.post.move_thread.no_permission", nil, fmt.Sprintf("User: %+v", user), http.StatusForbidden)
		return
	}

	sourcePost, err := c.App.GetPostIfAuthorized(c.AppContext, c.Params.PostId, c.AppContext.Session(), false)
	if err != nil {
		c.Err = err
		if err.Id == "app.post.cloud.get.app_error" {
			w.Header().Set(model.HeaderFirstInaccessiblePostTime, "1")
		}

		return
	}

	err = c.App.MoveThread(c.AppContext, c.Params.PostId, sourcePost.ChannelId, moveThreadParams.ChannelId, user)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}

func getFileInfosForPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannelContent) {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	if includeDeleted && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	infos, appErr := c.App.GetFileInfosForPostWithMigration(c.AppContext, c.Params.PostId, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if c.HandleEtag(model.GetEtagForFileInfos(infos), "Get File Infos For Post", w, r) {
		return
	}

	js, err := json.Marshal(infos)
	if err != nil {
		c.Err = model.NewAppError("getFileInfosForPost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Header().Set("Cache-Control", "max-age=2592000, private")
	w.Header().Set(model.HeaderEtagServer, model.GetEtagForFileInfos(infos))
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPostInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	info, appErr := c.App.GetPostInfo(c.AppContext, c.Params.PostId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(info)
	if err != nil {
		c.Err = model.NewAppError("getPostInfo", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func restorePostVersion(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	props := mux.Vars(r)
	restoreVersionId, ok := props["restore_version_id"]
	if !ok {
		c.SetInvalidParam("restore_version_id")
		return
	}

	auditRec := c.MakeAuditRecord("restorePostVersion", audit.Fail)
	audit.AddEventParameter(auditRec, "id", c.Params.PostId)
	audit.AddEventParameter(auditRec, "restore_version_id", restoreVersionId)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	toRestorePost, err := c.App.GetSinglePost(c.AppContext, restoreVersionId, true)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	// user can only restore their own posts
	if c.AppContext.Session().UserId != toRestorePost.UserId {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	postPatchChecks(c, auditRec, &toRestorePost.Message)
	if c.Err != nil {
		return
	}

	updatedPost, appErr := c.App.RestorePostVersion(c.AppContext, c.AppContext.Session().UserId, c.Params.PostId, restoreVersionId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedPost)

	if err := updatedPost.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func hasPermittedWranglerRole(c *Context, user *model.User, channelMember *model.ChannelMember) bool {
	// If there are no configured PermittedWranglerRoles, skip the check
	if len(c.App.Config().WranglerSettings.PermittedWranglerRoles) == 0 {
		return true
	}

	userRoles := user.Roles + " " + channelMember.Roles
	for _, role := range c.App.Config().WranglerSettings.PermittedWranglerRoles {
		if model.IsInRole(userRoles, role) {
			return true
		}
	}

	return false
}
