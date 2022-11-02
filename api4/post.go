// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/web"
)

func (api *API) InitPost() {
	api.BaseRoutes.Posts.Handle("", api.APISessionRequired(createPost)).Methods("POST")
	api.BaseRoutes.Post.Handle("", api.APISessionRequired(getPost)).Methods("GET")
	api.BaseRoutes.Post.Handle("", api.APISessionRequired(deletePost)).Methods("DELETE")
	api.BaseRoutes.Posts.Handle("/ids", api.APISessionRequired(getPostsByIds)).Methods("POST")
	api.BaseRoutes.Posts.Handle("/ephemeral", api.APISessionRequired(createEphemeralPost)).Methods("POST")
	api.BaseRoutes.Post.Handle("/thread", api.APISessionRequired(getPostThread)).Methods("GET")
	api.BaseRoutes.Post.Handle("/files/info", api.APISessionRequired(getFileInfosForPost)).Methods("GET")
	api.BaseRoutes.PostsForChannel.Handle("", api.APISessionRequired(getPostsForChannel)).Methods("GET")
	api.BaseRoutes.PostsForUser.Handle("/flagged", api.APISessionRequired(getFlaggedPostsForUser)).Methods("GET")

	api.BaseRoutes.ChannelForUser.Handle("/posts/unread", api.APISessionRequired(getPostsForChannelAroundLastUnread)).Methods("GET")

	api.BaseRoutes.Team.Handle("/posts/search", api.APISessionRequiredDisableWhenBusy(searchPostsInTeam)).Methods("POST")
	api.BaseRoutes.Posts.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchPostsInAllTeams)).Methods("POST")
	api.BaseRoutes.Post.Handle("", api.APISessionRequired(updatePost)).Methods("PUT")
	api.BaseRoutes.Post.Handle("/patch", api.APISessionRequired(patchPost)).Methods("PUT")
	api.BaseRoutes.PostForUser.Handle("/set_unread", api.APISessionRequired(setPostUnread)).Methods("POST")
	api.BaseRoutes.PostForUser.Handle("/reminder", api.APISessionRequired(setPostReminder)).Methods("POST")
	api.BaseRoutes.PostForUser.Handle("/ack", api.APISessionRequired(acknowledgePost)).Methods("POST")
	api.BaseRoutes.PostForUser.Handle("/ack", api.APISessionRequired(unacknowledgePost)).Methods("DELETE")

	api.BaseRoutes.Post.Handle("/pin", api.APISessionRequired(pinPost)).Methods("POST")
	api.BaseRoutes.Post.Handle("/unpin", api.APISessionRequired(unpinPost)).Methods("POST")
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	var post model.Post
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		c.SetInvalidParamWithErr("post", jsonErr)
		return
	}

	// Strip away delete_at if passed
	post.DeleteAt = 0

	post.UserId = c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord("createPost", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventParameter("post", &post)

	hasPermission := false
	if c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionCreatePost) {
		hasPermission = true
	} else if channel, err := c.App.GetChannel(c.AppContext, post.ChannelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}

	if post.CreateAt != 0 && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		post.CreateAt = 0
	}

	setOnline := r.URL.Query().Get("set_online")
	setOnlineBool := true // By default, always set online.
	var err2 error
	if setOnline != "" {
		setOnlineBool, err2 = strconv.ParseBool(setOnline)
		if err2 != nil {
			mlog.Warn("Failed to parse set_online URL query parameter from createPost request", mlog.Err(err2))
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

	c.App.UpdateLastActivityAtIfNeeded(*c.AppContext.Session())
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
		mlog.Warn("Error while writing response", mlog.Err(err))
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
			c.SetInvalidParam("since")
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

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	if !*c.App.Config().TeamSettings.ExperimentalViewArchivedChannels {
		channel, err := c.App.GetChannel(c.AppContext, channelId)
		if err != nil {
			c.Err = err
			return
		}
		if channel.DeleteAt != 0 {
			c.Err = model.NewAppError("Api4.getPostsForChannel", "api.user.view_archived_channels.get_posts_for_channel.app_error", nil, "", http.StatusForbidden)
			return
		}
	}

	var list *model.PostList
	var err *model.AppError
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
		mlog.Warn("Error while writing response", mlog.Err(err))
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
	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
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
		mlog.Warn("Error while writing response", mlog.Err(err))
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

	pl := model.NewPostList()
	channelReadPermission := make(map[string]bool)

	for _, post := range posts.Posts {
		allowed, ok := channelReadPermission[post.ChannelId]

		if !ok {
			allowed = false

			if c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionReadChannel) {
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
		mlog.Warn("Error while writing response", mlog.Err(err))
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
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

// getPostsByIds also sets a header to indicate, if posts were truncated as per the cloud plan's limit.
func getPostsByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	postIDs := model.ArrayFromJSON(r.Body)

	if len(postIDs) == 0 {
		c.SetInvalidParam("post_ids")
		return
	}

	if len(postIDs) > 1000 {
		c.Err = model.NewAppError("getPostsByIds", "api.post.posts_by_ids.invalid_body.request_error", map[string]any{"MaxLength": 1000}, "", http.StatusBadRequest)
		return
	}

	postsList, firstInaccessiblePostTime, err := c.App.GetPostsByIds(postIDs)
	if err != nil {
		c.Err = err
		return
	}

	var posts = []*model.Post{}
	channelMap := make(map[string]*model.Channel)

	for _, post := range postsList {
		var channel *model.Channel
		if val, ok := channelMap[post.ChannelId]; ok {
			channel = val
		} else {
			channel, err = c.App.GetChannel(c.AppContext, post.ChannelId)
			if err != nil {
				c.Err = err
				return
			}
			channelMap[channel.Id] = channel
		}

		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionReadChannel) {
			if channel.Type != model.ChannelTypeOpen || (channel.Type == model.ChannelTypeOpen && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionReadPublicChannel)) {
				continue
			}
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

func deletePost(c *Context, w http.ResponseWriter, _ *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deletePost", audit.Fail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	auditRec.AddEventParameter("post_id", c.Params.PostId)

	post, err := c.App.GetSinglePost(c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionDeletePost)
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

	if _, err := c.App.DeletePost(c.AppContext, c.Params.PostId, c.AppContext.Session().UserId); err != nil {
		c.Err = err
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
			c.SetInvalidParam("perPage")
			return
		}
	}

	var fromCreateAt int64
	if fromCreateAtStr := r.URL.Query().Get("fromCreateAt"); fromCreateAtStr != "" {
		var err error
		fromCreateAt, err = strconv.ParseInt(fromCreateAtStr, 10, 64)
		if err != nil {
			c.SetInvalidParam("fromCreateAt")
			return
		}
	}

	fromPost := r.URL.Query().Get("fromPost")
	// Either only fromCreateAt must be set, or both fromPost and fromCreateAt must be set
	if fromPost != "" && fromCreateAt == 0 {
		c.SetInvalidParam("if fromPost is set, then fromCreatAt must also be set")
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
		mlog.Warn("Error while writing response", mlog.Err(err))
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

	modifier := ""
	if params.Modifier != nil {
		modifier = *params.Modifier
	}
	if modifier != "" && modifier != model.ModifierFiles && modifier != model.ModifierMessages {
		c.SetInvalidParam("modifier")
		return
	}

	startTime := time.Now()

	results, err := c.App.SearchPostsForUser(c.AppContext, terms, c.AppContext.Session().UserId, teamId, isOrSearch, includeDeletedChannels, timeZoneOffset, page, perPage, modifier)

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

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	if err := results.EncodeJSON(w); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
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
	auditRec.AddEventParameter("post", post.Auditable())
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	// The post being updated in the payload must be the same one as indicated in the URL.
	if post.Id != c.Params.PostId {
		c.SetInvalidParam("id")
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionEditPost) {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}

	originalPost, err := c.App.GetSinglePost(c.Params.PostId, false)
	if err != nil {
		c.SetPermissionError(model.PermissionEditPost)
		return
	}
	auditRec.AddEventPriorState(originalPost)
	auditRec.AddEventObjectType("post")

	// Updating the file_ids of a post is not a supported operation and will be ignored
	post.FileIds = originalPost.FileIds

	if c.AppContext.Session().UserId != originalPost.UserId {
		if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionEditOthersPosts) {
			c.SetPermissionError(model.PermissionEditOthersPosts)
			return
		}
	}

	post.Id = c.Params.PostId

	rpost, err := c.App.UpdatePost(c.AppContext, c.App.PostWithProxyRemovedFromImageURLs(&post), false)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rpost)

	if err := rpost.EncodeJSON(w); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
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
	auditRec.AddEventParameter("patch", post)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	// Updating the file_ids of a post is not a supported operation and will be ignored
	post.FileIds = nil

	originalPost, err := c.App.GetSinglePost(c.Params.PostId, false)
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

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, permission) {
		c.SetPermissionError(permission)
		return
	}

	patchedPost, err := c.App.PatchPost(c.AppContext, c.Params.PostId, c.App.PostPatchWithProxyRemovedFromImageURLs(&post))
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(patchedPost)

	if err := patchedPost.EncodeJSON(w); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
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
	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
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
	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	var reminder model.PostReminder
	if jsonErr := json.NewDecoder(r.Body).Decode(&reminder); jsonErr != nil {
		c.SetInvalidParamWithErr("target_time", jsonErr)
		return
	}

	appErr := c.App.SetPostReminder(c.Params.PostId, c.Params.UserId, reminder.TargetTime)
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
	auditRec.AddEventParameter("post_id", c.Params.PostId)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	post, err := c.App.GetSinglePost(c.Params.PostId, false)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(post)
	auditRec.AddEventObjectType("post")

	patch := &model.PostPatch{}
	patch.IsPinned = model.NewBool(isPinned)

	patchedPost, err := c.App.PatchPost(c.AppContext, c.Params.PostId, patch)
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

func acknowledgePost(c *Context, w http.ResponseWriter, _ *http.Request) {
	c.RequirePostId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	_, appErr := c.App.GetSinglePost(c.Params.PostId, false)
	if appErr != nil {
		c.Err = appErr
		return
	}

	acknowledgement, appErr := c.App.SaveAcknowledgementForPost(c.AppContext, c.Params.UserId, c.Params.PostId)

	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(acknowledgement)
	if err != nil {
		c.Err = model.NewAppError("acknowledgePost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func unacknowledgePost(c *Context, w http.ResponseWriter, _ *http.Request) {
	c.RequirePostId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	_, err := c.App.GetSinglePost(c.Params.PostId, false)
	if err != nil {
		c.Err = err
		return
	}

	appErr := c.App.DeleteAcknowledgementForPost(c.AppContext, c.Params.UserId, c.Params.PostId)

	if appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func getFileInfosForPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(*c.AppContext.Session(), c.Params.PostId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	if includeDeleted && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	infos, appErr := c.App.GetFileInfosForPostWithMigration(c.Params.PostId, includeDeleted)
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
	w.Write(js)
}
