// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitPost() {
	api.BaseRoutes.Posts.Handle("", api.ApiSessionRequired(createPost)).Methods("POST")
	api.BaseRoutes.Post.Handle("", api.ApiSessionRequired(getPost)).Methods("GET")
	api.BaseRoutes.Post.Handle("", api.ApiSessionRequired(deletePost)).Methods("DELETE")
	api.BaseRoutes.Posts.Handle("/ephemeral", api.ApiSessionRequired(createEphemeralPost)).Methods("POST")
	api.BaseRoutes.Post.Handle("/thread", api.ApiSessionRequired(getPostThread)).Methods("GET")
	api.BaseRoutes.Post.Handle("/files/info", api.ApiSessionRequired(getFileInfosForPost)).Methods("GET")
	api.BaseRoutes.PostsForChannel.Handle("", api.ApiSessionRequired(getPostsForChannel)).Methods("GET")
	api.BaseRoutes.PostsForUser.Handle("/flagged", api.ApiSessionRequired(getFlaggedPostsForUser)).Methods("GET")

	api.BaseRoutes.Team.Handle("/posts/search", api.ApiSessionRequired(searchPosts)).Methods("POST")
	api.BaseRoutes.Post.Handle("", api.ApiSessionRequired(updatePost)).Methods("PUT")
	api.BaseRoutes.Post.Handle("/patch", api.ApiSessionRequired(patchPost)).Methods("PUT")
	api.BaseRoutes.Post.Handle("/pin", api.ApiSessionRequired(pinPost)).Methods("POST")
	api.BaseRoutes.Post.Handle("/unpin", api.ApiSessionRequired(unpinPost)).Methods("POST")
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)
	if post == nil {
		c.SetInvalidParam("post")
		return
	}

	post.UserId = c.Session.UserId

	hasPermission := false
	if c.App.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_CREATE_POST) {
		hasPermission = true
	} else if channel, err := c.App.GetChannel(post.ChannelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.CHANNEL_OPEN && c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_CREATE_POST_PUBLIC) {
			hasPermission = true
		}
	}

	if !hasPermission {
		c.SetPermissionError(model.PERMISSION_CREATE_POST)
		return
	}

	if post.CreateAt != 0 && !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		post.CreateAt = 0
	}

	rp, err := c.App.CreatePostAsUser(c.App.PostWithProxyRemovedFromImageURLs(post), !c.Session.IsMobileApp())
	if err != nil {
		c.Err = err
		return
	}

	c.App.SetStatusOnline(c.Session.UserId, false)
	c.App.UpdateLastActivityAtIfNeeded(c.Session)

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(c.App.PostWithProxyAddedToImageURLs(rp).ToJson()))
}

func createEphemeralPost(c *Context, w http.ResponseWriter, r *http.Request) {
	ephRequest := model.PostEphemeral{}

	json.NewDecoder(r.Body).Decode(&ephRequest)
	if ephRequest.UserID == "" {
		c.SetInvalidParam("user_id")
		return
	}

	if ephRequest.Post == nil {
		c.SetInvalidParam("post")
		return
	}

	ephRequest.Post.UserId = c.Session.UserId
	ephRequest.Post.CreateAt = model.GetMillis()

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_POST_EPHEMERAL) {
		c.SetPermissionError(model.PERMISSION_CREATE_POST_EPHEMERAL)
		return
	}

	rp := c.App.SendEphemeralPost(ephRequest.UserID, c.App.PostWithProxyRemovedFromImageURLs(ephRequest.Post))

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(c.App.PostWithProxyAddedToImageURLs(rp).ToJson()))
}

func getPostsForChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	afterPost := r.URL.Query().Get("after")
	beforePost := r.URL.Query().Get("before")
	sinceString := r.URL.Query().Get("since")

	var since int64
	var parseError error

	if len(sinceString) > 0 {
		since, parseError = strconv.ParseInt(sinceString, 10, 64)
		if parseError != nil {
			c.SetInvalidParam("since")
			return
		}
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	var list *model.PostList
	var err *model.AppError
	etag := ""

	if since > 0 {
		list, err = c.App.GetPostsSince(c.Params.ChannelId, since)
	} else if len(afterPost) > 0 {
		etag = c.App.GetPostsEtag(c.Params.ChannelId)

		if c.HandleEtag(etag, "Get Posts After", w, r) {
			return
		}

		list, err = c.App.GetPostsAfterPost(c.Params.ChannelId, afterPost, c.Params.Page, c.Params.PerPage)
	} else if len(beforePost) > 0 {
		etag = c.App.GetPostsEtag(c.Params.ChannelId)

		if c.HandleEtag(etag, "Get Posts Before", w, r) {
			return
		}

		list, err = c.App.GetPostsBeforePost(c.Params.ChannelId, beforePost, c.Params.Page, c.Params.PerPage)
	} else {
		etag = c.App.GetPostsEtag(c.Params.ChannelId)

		if c.HandleEtag(etag, "Get Posts", w, r) {
			return
		}

		list, err = c.App.GetPostsPage(c.Params.ChannelId, c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	if len(etag) > 0 {
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	}
	w.Write([]byte(c.App.PostListWithProxyAddedToImageURLs(list).ToJson()))
}

func getFlaggedPostsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	channelId := r.URL.Query().Get("channel_id")
	teamId := r.URL.Query().Get("team_id")

	var posts *model.PostList
	var err *model.AppError

	if len(channelId) > 0 {
		posts, err = c.App.GetFlaggedPostsForChannel(c.Params.UserId, channelId, c.Params.Page, c.Params.PerPage)
	} else if len(teamId) > 0 {
		posts, err = c.App.GetFlaggedPostsForTeam(c.Params.UserId, teamId, c.Params.Page, c.Params.PerPage)
	} else {
		posts, err = c.App.GetFlaggedPosts(c.Params.UserId, c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(c.App.PostListWithProxyAddedToImageURLs(posts).ToJson()))
}

func getPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var post *model.Post
	var err *model.AppError
	if post, err = c.App.GetSinglePost(c.Params.PostId); err != nil {
		c.Err = err
		return
	}

	var channel *model.Channel
	if channel, err = c.App.GetChannel(post.ChannelId); err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		if channel.Type == model.CHANNEL_OPEN {
			if !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) {
				c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
				return
			}
		} else {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	if c.HandleEtag(post.Etag(), "Get Post", w, r) {
		return
	}

	w.Header().Set(model.HEADER_ETAG_SERVER, post.Etag())
	w.Write([]byte(c.App.PostWithProxyAddedToImageURLs(post).ToJson()))
}

func deletePost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	post, err := c.App.GetSinglePost(c.Params.PostId)
	if err != nil {
		c.SetPermissionError(model.PERMISSION_DELETE_POST)
		return
	}

	if c.Session.UserId == post.UserId {
		if !c.App.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_DELETE_POST) {
			c.SetPermissionError(model.PERMISSION_DELETE_POST)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_DELETE_OTHERS_POSTS) {
			c.SetPermissionError(model.PERMISSION_DELETE_OTHERS_POSTS)
			return
		}
	}

	if _, err := c.App.DeletePost(c.Params.PostId, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getPostThread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var list *model.PostList
	var err *model.AppError
	if list, err = c.App.GetPostThread(c.Params.PostId); err != nil {
		c.Err = err
		return
	}

	var post *model.Post
	if val, ok := list.Posts[c.Params.PostId]; ok {
		post = val
	} else {
		c.SetInvalidUrlParam("post_id")
		return
	}

	var channel *model.Channel
	if channel, err = c.App.GetChannel(post.ChannelId); err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		if channel.Type == model.CHANNEL_OPEN {
			if !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) {
				c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
				return
			}
		} else {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	if c.HandleEtag(list.Etag(), "Get Post Thread", w, r) {
		return
	}

	w.Header().Set(model.HEADER_ETAG_SERVER, list.Etag())
	w.Write([]byte(c.App.PostListWithProxyAddedToImageURLs(list).ToJson()))
}

func searchPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	params := model.SearchParameterFromJson(r.Body)

	if params.Terms == nil || len(*params.Terms) == 0 {
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

	startTime := time.Now()

	results, err := c.App.SearchPostsInTeam(terms, c.Session.UserId, c.Params.TeamId, isOrSearch, includeDeletedChannels, int(timeZoneOffset), page, perPage)

	elapsedTime := float64(time.Since(startTime)) / float64(time.Second)
	metrics := c.App.Metrics
	if metrics != nil {
		metrics.IncrementPostsSearchCounter()
		metrics.ObservePostsSearchDuration(elapsedTime)
	}

	if err != nil {
		c.Err = err
		return
	}

	results = model.MakePostSearchResults(c.App.PostListWithProxyAddedToImageURLs(results.PostList), results.Matches)

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(results.ToJson()))
}

func updatePost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	post := model.PostFromJson(r.Body)

	if post == nil {
		c.SetInvalidParam("post")
		return
	}

	// The post being updated in the payload must be the same one as indicated in the URL.
	if post.Id != c.Params.PostId {
		c.SetInvalidParam("post_id")
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_EDIT_POST) {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	originalPost, err := c.App.GetSinglePost(c.Params.PostId)
	if err != nil {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	if c.Session.UserId != originalPost.UserId {
		if !c.App.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_EDIT_OTHERS_POSTS) {
			c.SetPermissionError(model.PERMISSION_EDIT_OTHERS_POSTS)
			return
		}
	}

	post.Id = c.Params.PostId

	rpost, err := c.App.UpdatePost(c.App.PostWithProxyRemovedFromImageURLs(post), false)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(c.App.PostWithProxyAddedToImageURLs(rpost).ToJson()))
}

func patchPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	post := model.PostPatchFromJson(r.Body)

	if post == nil {
		c.SetInvalidParam("post")
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_EDIT_POST) {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	originalPost, err := c.App.GetSinglePost(c.Params.PostId)
	if err != nil {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	if c.Session.UserId != originalPost.UserId {
		if !c.App.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_EDIT_OTHERS_POSTS) {
			c.SetPermissionError(model.PERMISSION_EDIT_OTHERS_POSTS)
			return
		}
	}

	patchedPost, err := c.App.PatchPost(c.Params.PostId, c.App.PostPatchWithProxyRemovedFromImageURLs(post))
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(c.App.PostWithProxyAddedToImageURLs(patchedPost).ToJson()))
}

func saveIsPinnedPost(c *Context, w http.ResponseWriter, r *http.Request, isPinned bool) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	patch := &model.PostPatch{}
	patch.IsPinned = model.NewBool(isPinned)

	_, err := c.App.PatchPost(c.Params.PostId, patch)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func pinPost(c *Context, w http.ResponseWriter, r *http.Request) {
	saveIsPinnedPost(c, w, r, true)
}

func unpinPost(c *Context, w http.ResponseWriter, r *http.Request) {
	saveIsPinnedPost(c, w, r, false)
}

func getFileInfosForPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	infos, err := c.App.GetFileInfosForPost(c.Params.PostId, false)
	if err != nil {
		c.Err = err
		return
	}

	if c.HandleEtag(model.GetEtagForFileInfos(infos), "Get File Infos For Post", w, r) {
		return
	}

	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Header().Set(model.HEADER_ETAG_SERVER, model.GetEtagForFileInfos(infos))
	w.Write([]byte(model.FileInfosToJson(infos)))
}
