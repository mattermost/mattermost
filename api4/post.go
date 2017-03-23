// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
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

	BaseRoutes.Team.Handle("/posts/search", ApiSessionRequired(searchPosts)).Methods("POST")
	BaseRoutes.Post.Handle("", ApiSessionRequired(updatePost)).Methods("PUT")
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)
	if post == nil {
		c.SetInvalidParam("post")
		return
	}

	post.UserId = c.Session.UserId

	if !app.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_CREATE_POST) {
		c.SetPermissionError(model.PERMISSION_CREATE_POST)
		return
	}

	if post.CreateAt != 0 && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		post.CreateAt = 0
	}

	rp, err := app.CreatePostAsUser(post, c.GetSiteURL())
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(rp.ToJson()))
}

func getPostsForChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	etag := app.GetPostsEtag(c.Params.ChannelId)

	if HandleEtag(etag, "Get Posts", w, r) {
		return
	}

	if list, err := app.GetPostsPage(c.Params.ChannelId, c.Params.Page, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(list.ToJson()))
	}
}

func getPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if post, err := app.GetSinglePost(c.Params.PostId); err != nil {
		c.Err = err
		return
	} else if HandleEtag(post.Etag(), "Get Post", w, r) {
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

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if list, err := app.GetPostThread(c.Params.PostId); err != nil {
		c.Err = err
		return
	} else if HandleEtag(list.Etag(), "Get Post Thread", w, r) {
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

	props := model.MapFromJson(r.Body)
	terms := props["terms"]

	if len(terms) == 0 {
		c.SetInvalidParam("terms")
		return
	}

	isOrSearch := false
	if val, ok := props["is_or_search"]; ok && val != "" {
		isOrSearch, _ = strconv.ParseBool(val)
	}

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
	post := model.PostFromJson(r.Body)

	if post == nil {
		c.SetInvalidParam("post")
		return
	}

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_EDIT_POST) {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	post.UserId = c.Session.UserId

	rpost, err := app.UpdatePost(post)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(rpost.ToJson()))
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
