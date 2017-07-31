// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitPost() {
	l4g.Debug(utils.T("api.post.init.debug"))

	BaseRoutes.Posts.Handle("", ApiSessionRequired(createPost)).Methods("POST")
	BaseRoutes.Post.Handle("", ApiSessionRequired(getPost)).Methods("GET")
	BaseRoutes.Post.Handle("", ApiSessionRequired(deletePost)).Methods("DELETE")
	BaseRoutes.Post.Handle("/thread", ApiSessionRequired(getPostThread)).Methods("GET")
	BaseRoutes.Post.Handle("/files/info", ApiSessionRequired(getFileInfosForPost)).Methods("GET")
	BaseRoutes.PostsForChannel.Handle("", ApiSessionRequired(getPostsForChannel)).Methods("GET")
	BaseRoutes.PostsForUser.Handle("/flagged", ApiSessionRequired(getFlaggedPostsForUser)).Methods("GET")

	BaseRoutes.Team.Handle("/posts/search", ApiSessionRequired(searchPosts)).Methods("POST")
	BaseRoutes.Post.Handle("", ApiSessionRequired(updatePost)).Methods("PUT")
	BaseRoutes.Post.Handle("/patch", ApiSessionRequired(patchPost)).Methods("PUT")
	BaseRoutes.Post.Handle("/pin", ApiSessionRequired(pinPost)).Methods("POST")
	BaseRoutes.Post.Handle("/unpin", ApiSessionRequired(unpinPost)).Methods("POST")
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)
	if post == nil {
		c.SetInvalidParam("post")
		return
	}

	post.UserId = c.Session.UserId

	hasPermission := false
	if app.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_CREATE_POST) {
		hasPermission = true
	} else if channel, err := app.GetChannel(post.ChannelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.CHANNEL_OPEN && app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_CREATE_POST_PUBLIC) {
			hasPermission = true
		}
	}

	if !hasPermission {
		c.SetPermissionError(model.PERMISSION_CREATE_POST)
		return
	}

	if post.CreateAt != 0 && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		post.CreateAt = 0
	}

	rp, err := app.CreatePostAsUser(post)
	if err != nil {
		c.Err = err
		return
	}

	app.SetStatusOnline(c.Session.UserId, c.Session.Id, false)

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(rp.ToJson()))
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

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	var list *model.PostList
	var err *model.AppError
	etag := ""

	if since > 0 {
		list, err = app.GetPostsSince(c.Params.ChannelId, since)
	} else if len(afterPost) > 0 {
		etag = app.GetPostsEtag(c.Params.ChannelId)

		if HandleEtag(etag, "Get Posts After", w, r) {
			return
		}

		list, err = app.GetPostsAfterPost(c.Params.ChannelId, afterPost, c.Params.Page, c.Params.PerPage)
	} else if len(beforePost) > 0 {
		etag = app.GetPostsEtag(c.Params.ChannelId)

		if HandleEtag(etag, "Get Posts Before", w, r) {
			return
		}

		list, err = app.GetPostsBeforePost(c.Params.ChannelId, beforePost, c.Params.Page, c.Params.PerPage)
	} else {
		etag = app.GetPostsEtag(c.Params.ChannelId)

		if HandleEtag(etag, "Get Posts", w, r) {
			return
		}

		list, err = app.GetPostsPage(c.Params.ChannelId, c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	if len(etag) > 0 {
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	}
	w.Write([]byte(list.ToJson()))
}

func getFlaggedPostsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	channelId := r.URL.Query().Get("channel_id")
	teamId := r.URL.Query().Get("team_id")

	var posts *model.PostList
	var err *model.AppError

	if len(channelId) > 0 {
		posts, err = app.GetFlaggedPostsForChannel(c.Params.UserId, channelId, c.Params.Page, c.Params.PerPage)
	} else if len(teamId) > 0 {
		posts, err = app.GetFlaggedPostsForTeam(c.Params.UserId, teamId, c.Params.Page, c.Params.PerPage)
	} else {
		posts, err = app.GetFlaggedPosts(c.Params.UserId, c.Params.Page, c.Params.PerPage)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(posts.ToJson()))
}

func getPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var post *model.Post
	var err *model.AppError
	if post, err = app.GetSinglePost(c.Params.PostId); err != nil {
		c.Err = err
		return
	}

	var channel *model.Channel
	if channel, err = app.GetChannel(post.ChannelId); err != nil {
		c.Err = err
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		if channel.Type == model.CHANNEL_OPEN {
			if !app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) {
				c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
				return
			}
		} else {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	if HandleEtag(post.Etag(), "Get Post", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, post.Etag())
		w.Write([]byte(post.ToJson()))
	}
}

func deletePost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToPost(c.Session, c.Params.PostId, model.PERMISSION_DELETE_OTHERS_POSTS) {
		c.SetPermissionError(model.PERMISSION_DELETE_OTHERS_POSTS)
		return
	}

	if _, err := app.DeletePost(c.Params.PostId); err != nil {
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
	if list, err = app.GetPostThread(c.Params.PostId); err != nil {
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
	if channel, err = app.GetChannel(post.ChannelId); err != nil {
		c.Err = err
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		if channel.Type == model.CHANNEL_OPEN {
			if !app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) {
				c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
				return
			}
		} else {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	if HandleEtag(list.Etag(), "Get Post Thread", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, list.Etag())
		w.Write([]byte(list.ToJson()))
	}
}

func searchPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	props := model.StringInterfaceFromJson(r.Body)
	terms, ok := props["terms"].(string)
	if !ok || len(terms) == 0 {
		c.SetInvalidParam("terms")
		return
	}

	isOrSearch, _ := props["is_or_search"].(bool)

	posts, err := app.SearchPostsInTeam(terms, c.Session.UserId, c.Params.TeamId, isOrSearch)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(posts.ToJson()))
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

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_EDIT_POST) {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	if !app.SessionHasPermissionToPost(c.Session, c.Params.PostId, model.PERMISSION_EDIT_OTHERS_POSTS) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHERS_POSTS)
		return
	}

	post.Id = c.Params.PostId

	rpost, err := app.UpdatePost(post, false)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(rpost.ToJson()))
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

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_EDIT_POST) {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	if !app.SessionHasPermissionToPost(c.Session, c.Params.PostId, model.PERMISSION_EDIT_OTHERS_POSTS) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHERS_POSTS)
		return
	}

	patchedPost, err := app.PatchPost(c.Params.PostId, post)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(patchedPost.ToJson()))
}

func saveIsPinnedPost(c *Context, w http.ResponseWriter, r *http.Request, isPinned bool) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	patch := &model.PostPatch{}
	patch.IsPinned = new(bool)
	*patch.IsPinned = isPinned

	_, err := app.PatchPost(c.Params.PostId, patch)
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

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if infos, err := app.GetFileInfosForPost(c.Params.PostId, false); err != nil {
		c.Err = err
		return
	} else if HandleEtag(model.GetEtagForFileInfos(infos), "Get File Infos For Post", w, r) {
		return
	} else {
		w.Header().Set("Cache-Control", "max-age=2592000, public")
		w.Header().Set(model.HEADER_ETAG_SERVER, model.GetEtagForFileInfos(infos))
		w.Write([]byte(model.FileInfosToJson(infos)))
	}
}
