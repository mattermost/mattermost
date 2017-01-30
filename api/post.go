// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitPost() {
	l4g.Debug(utils.T("api.post.init.debug"))

	BaseRoutes.ApiRoot.Handle("/get_opengraph_metadata", ApiUserRequired(getOpenGraphMetadata)).Methods("POST")

	BaseRoutes.NeedTeam.Handle("/posts/search", ApiUserRequiredActivity(searchPosts, true)).Methods("POST")
	BaseRoutes.NeedTeam.Handle("/posts/flagged/{offset:[0-9]+}/{limit:[0-9]+}", ApiUserRequired(getFlaggedPosts)).Methods("GET")
	BaseRoutes.NeedTeam.Handle("/posts/{post_id}", ApiUserRequired(getPostById)).Methods("GET")
	BaseRoutes.NeedTeam.Handle("/pltmp/{post_id}", ApiUserRequired(getPermalinkTmp)).Methods("GET")

	BaseRoutes.Posts.Handle("/create", ApiUserRequiredActivity(createPost, true)).Methods("POST")
	BaseRoutes.Posts.Handle("/update", ApiUserRequiredActivity(updatePost, true)).Methods("POST")
	BaseRoutes.Posts.Handle("/page/{offset:[0-9]+}/{limit:[0-9]+}", ApiUserRequired(getPosts)).Methods("GET")
	BaseRoutes.Posts.Handle("/since/{time:[0-9]+}", ApiUserRequired(getPostsSince)).Methods("GET")

	BaseRoutes.NeedPost.Handle("/get", ApiUserRequired(getPost)).Methods("GET")
	BaseRoutes.NeedPost.Handle("/delete", ApiUserRequiredActivity(deletePost, true)).Methods("POST")
	BaseRoutes.NeedPost.Handle("/before/{offset:[0-9]+}/{num_posts:[0-9]+}", ApiUserRequired(getPostsBefore)).Methods("GET")
	BaseRoutes.NeedPost.Handle("/after/{offset:[0-9]+}/{num_posts:[0-9]+}", ApiUserRequired(getPostsAfter)).Methods("GET")
	BaseRoutes.NeedPost.Handle("/get_file_infos", ApiUserRequired(getFileInfosForPost)).Methods("GET")
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)
	if post == nil {
		c.SetInvalidParam("createPost", "post")
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

	rp, err := app.CreatePostAsUser(post, c.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(rp.ToJson()))
}

func updatePost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)

	if post == nil {
		c.SetInvalidParam("updatePost", "post")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_EDIT_POST) {
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

func getFlaggedPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	offset, err := strconv.Atoi(params["offset"])
	if err != nil {
		c.SetInvalidParam("getFlaggedPosts", "offset")
		return
	}

	limit, err := strconv.Atoi(params["limit"])
	if err != nil {
		c.SetInvalidParam("getFlaggedPosts", "limit")
		return
	}

	if posts, err := app.GetFlaggedPosts(c.Session.UserId, offset, limit); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(posts.ToJson()))
	}
}

func getPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	id := params["channel_id"]
	if len(id) != 26 {
		c.SetInvalidParam("getPosts", "channelId")
		return
	}

	offset, err := strconv.Atoi(params["offset"])
	if err != nil {
		c.SetInvalidParam("getPosts", "offset")
		return
	}

	limit, err := strconv.Atoi(params["limit"])
	if err != nil {
		c.SetInvalidParam("getPosts", "limit")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, id, model.PERMISSION_CREATE_POST) {
		c.SetPermissionError(model.PERMISSION_CREATE_POST)
		return
	}

	etag := app.GetPostsEtag(id)

	if HandleEtag(etag, "Get Posts", w, r) {
		return
	}

	if list, err := app.GetPosts(id, offset, limit); err != nil {
		c.Err = err
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(list.ToJson()))
	}

}

func getPostsSince(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	id := params["channel_id"]
	if len(id) != 26 {
		c.SetInvalidParam("getPostsSince", "channelId")
		return
	}

	time, err := strconv.ParseInt(params["time"], 10, 64)
	if err != nil {
		c.SetInvalidParam("getPostsSince", "time")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if list, err := app.GetPostsSince(id, time); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(list.ToJson()))
	}

}

func getPost(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("getPost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getPost", "postId")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if list, err := app.GetPostThread(postId); err != nil {
		c.Err = err
		return
	} else if HandleEtag(list.Etag(), "Get Post", w, r) {
		return
	} else {
		if !list.IsChannelId(channelId) {
			c.Err = model.NewLocAppError("getPost", "api.post.get_post.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, list.Etag())
		w.Write([]byte(list.ToJson()))
	}
}

func getPostById(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getPostById", "postId")
		return
	}

	if list, err := app.GetPostThread(postId); err != nil {
		c.Err = err
		return
	} else {
		if len(list.Order) != 1 {
			c.Err = model.NewLocAppError("getPostById", "api.post_get_post_by_id.get.app_error", nil, "")
			return
		}
		post := list.Posts[list.Order[0]]

		if !app.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}

		if HandleEtag(list.Etag(), "Get Post By Id", w, r) {
			return
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, list.Etag())
		w.Write([]byte(list.ToJson()))
	}
}

func getPermalinkTmp(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getPermalinkTmp", "postId")
		return
	}

	if !app.HasPermissionToChannelByPost(c.Session.UserId, postId, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_JOIN_PUBLIC_CHANNELS)
		return
	}

	if list, err := app.GetPermalinkPost(postId, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else if HandleEtag(list.Etag(), "Get Permalink TMP", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, list.Etag())
		w.Write([]byte(list.ToJson()))
	}
}

func deletePost(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("deletePost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("deletePost", "postId")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_DELETE_POST) {
		c.SetPermissionError(model.PERMISSION_DELETE_POST)
		return
	}

	if !app.SessionHasPermissionToPost(c.Session, postId, model.PERMISSION_DELETE_OTHERS_POSTS) {
		c.SetPermissionError(model.PERMISSION_DELETE_OTHERS_POSTS)
		return
	}

	if post, err := app.DeletePost(postId); err != nil {
		c.Err = err
		return
	} else {
		if post.ChannelId != channelId {
			c.Err = model.NewLocAppError("deletePost", "api.post.delete_post.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		result := make(map[string]string)
		result["id"] = postId
		w.Write([]byte(model.MapToJson(result)))
	}
}

func getPostsBefore(c *Context, w http.ResponseWriter, r *http.Request) {
	getPostsBeforeOrAfter(c, w, r, true)
}

func getPostsAfter(c *Context, w http.ResponseWriter, r *http.Request) {
	getPostsBeforeOrAfter(c, w, r, false)
}

func getPostsBeforeOrAfter(c *Context, w http.ResponseWriter, r *http.Request, before bool) {
	params := mux.Vars(r)

	id := params["channel_id"]
	if len(id) != 26 {
		c.SetInvalidParam("getPostsBeforeOrAfter", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getPostsBeforeOrAfter", "postId")
		return
	}

	numPosts, err := strconv.Atoi(params["num_posts"])
	if err != nil || numPosts <= 0 {
		c.SetInvalidParam("getPostsBeforeOrAfter", "numPosts")
		return
	}

	offset, err := strconv.Atoi(params["offset"])
	if err != nil || offset < 0 {
		c.SetInvalidParam("getPostsBeforeOrAfter", "offset")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	// We can do better than this etag in this situation
	etag := app.GetPostsEtag(id)

	if HandleEtag(etag, "Get Posts Before or After", w, r) {
		return
	}

	if list, err := app.GetPostsAroundPost(postId, id, offset, numPosts, before); err != nil {
		c.Err = err
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(list.ToJson()))
	}
}

func searchPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJson(r.Body)

	terms := props["terms"].(string)
	if len(terms) == 0 {
		c.SetInvalidParam("search", "terms")
		return
	}

	isOrSearch := false
	if val, ok := props["is_or_search"]; ok && val != nil {
		isOrSearch = val.(bool)
	}

	posts, err := app.SearchPostsInTeam(terms, c.Session.UserId, c.TeamId, isOrSearch)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(posts.ToJson()))
}

func getFileInfosForPost(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("getFileInfosForPost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getFileInfosForPost", "postId")
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if infos, err := app.GetFileInfosForPost(postId); err != nil {
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

func getOpenGraphMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJson(r.Body)

	url := ""
	ok := false
	if url, ok = props["url"].(string); len(url) == 0 || !ok {
		c.SetInvalidParam("getOpenGraphMetadata", "url")
		return
	}

	og := app.GetOpenGraphMetadata(url)

	ogJson, err := og.ToJSON()
	if err != nil {
		w.Write([]byte(`{"url": ""}`))
	}
	w.Write(ogJson)
}
