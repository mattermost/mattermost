// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const OPEN_GRAPH_METADATA_CACHE_SIZE = 10000

var openGraphDataCache = utils.NewLru(OPEN_GRAPH_METADATA_CACHE_SIZE)

func (api *API) InitPost() {
	api.BaseRoutes.ApiRoot.Handle("/get_opengraph_metadata", api.ApiUserRequired(getOpenGraphMetadata)).Methods("POST")

	api.BaseRoutes.NeedTeam.Handle("/posts/search", api.ApiUserRequiredActivity(searchPosts, true)).Methods("POST")
	api.BaseRoutes.NeedTeam.Handle("/posts/flagged/{offset:[0-9]+}/{limit:[0-9]+}", api.ApiUserRequired(getFlaggedPosts)).Methods("GET")
	api.BaseRoutes.NeedTeam.Handle("/posts/{post_id}", api.ApiUserRequired(getPostById)).Methods("GET")
	api.BaseRoutes.NeedTeam.Handle("/pltmp/{post_id}", api.ApiUserRequired(getPermalinkTmp)).Methods("GET")

	api.BaseRoutes.Posts.Handle("/create", api.ApiUserRequiredActivity(createPost, true)).Methods("POST")
	api.BaseRoutes.Posts.Handle("/update", api.ApiUserRequiredActivity(updatePost, true)).Methods("POST")
	api.BaseRoutes.Posts.Handle("/page/{offset:[0-9]+}/{limit:[0-9]+}", api.ApiUserRequired(getPosts)).Methods("GET")
	api.BaseRoutes.Posts.Handle("/since/{time:[0-9]+}", api.ApiUserRequired(getPostsSince)).Methods("GET")

	api.BaseRoutes.NeedPost.Handle("/get", api.ApiUserRequired(getPost)).Methods("GET")
	api.BaseRoutes.NeedPost.Handle("/delete", api.ApiUserRequiredActivity(deletePost, true)).Methods("POST")
	api.BaseRoutes.NeedPost.Handle("/before/{offset:[0-9]+}/{num_posts:[0-9]+}", api.ApiUserRequired(getPostsBefore)).Methods("GET")
	api.BaseRoutes.NeedPost.Handle("/after/{offset:[0-9]+}/{num_posts:[0-9]+}", api.ApiUserRequired(getPostsAfter)).Methods("GET")
	api.BaseRoutes.NeedPost.Handle("/get_file_infos", api.ApiUserRequired(getFileInfosForPost)).Methods("GET")
	api.BaseRoutes.NeedPost.Handle("/pin", api.ApiUserRequired(pinPost)).Methods("POST")
	api.BaseRoutes.NeedPost.Handle("/unpin", api.ApiUserRequired(unpinPost)).Methods("POST")
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)
	if post == nil {
		c.SetInvalidParam("createPost", "post")
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

	rp, err := c.App.CreatePostAsUser(post)
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

	if !c.App.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_EDIT_POST) {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	post.UserId = c.Session.UserId

	rpost, err := c.App.UpdatePost(post, true)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(rpost.ToJson()))
}

func saveIsPinnedPost(c *Context, w http.ResponseWriter, r *http.Request, isPinned bool) {
	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("savedIsPinnedPost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("savedIsPinnedPost", "postId")
		return
	}

	pchan := c.App.Srv.Store.Post().Get(postId)

	var oldPost *model.Post
	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		oldPost = result.Data.(*model.PostList).Posts[postId]
		newPost := &model.Post{}
		*newPost = *oldPost
		newPost.IsPinned = isPinned

		if result := <-c.App.Srv.Store.Post().Update(newPost, oldPost); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			rpost := result.Data.(*model.Post)

			message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_EDITED, "", rpost.ChannelId, "", nil)
			message.Add("post", rpost.ToJson())

			c.App.Go(func() {
				c.App.Publish(message)
			})

			c.App.InvalidateCacheForChannelPosts(rpost.ChannelId)

			w.Write([]byte(rpost.ToJson()))
		}
	}
}

func pinPost(c *Context, w http.ResponseWriter, r *http.Request) {
	saveIsPinnedPost(c, w, r, true)
}

func unpinPost(c *Context, w http.ResponseWriter, r *http.Request) {
	saveIsPinnedPost(c, w, r, false)
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

	if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if posts, err := c.App.GetFlaggedPostsForTeam(c.Session.UserId, c.TeamId, offset, limit); err != nil {
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

	if !c.App.SessionHasPermissionToChannel(c.Session, id, model.PERMISSION_CREATE_POST) {
		c.SetPermissionError(model.PERMISSION_CREATE_POST)
		return
	}

	etag := c.App.GetPostsEtag(id)

	if c.HandleEtag(etag, "Get Posts", w, r) {
		return
	}

	if list, err := c.App.GetPosts(id, offset, limit); err != nil {
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

	if !c.App.SessionHasPermissionToChannel(c.Session, id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if list, err := c.App.GetPostsSince(id, time); err != nil {
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

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if list, err := c.App.GetPostThread(postId); err != nil {
		c.Err = err
		return
	} else if c.HandleEtag(list.Etag(), "Get Post", w, r) {
		return
	} else {
		if !list.IsChannelId(channelId) {
			c.Err = model.NewAppError("getPost", "api.post.get_post.permissions.app_error", nil, "", http.StatusForbidden)
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

	if list, err := c.App.GetPostThread(postId); err != nil {
		c.Err = err
		return
	} else {
		if len(list.Order) != 1 {
			c.Err = model.NewAppError("getPostById", "api.post_get_post_by_id.get.app_error", nil, "", http.StatusInternalServerError)
			return
		}
		post := list.Posts[list.Order[0]]

		if !c.App.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}

		if c.HandleEtag(list.Etag(), "Get Post By Id", w, r) {
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

	var channel *model.Channel
	if result := <-c.App.Srv.Store.Channel().GetForPost(postId); result.Err == nil {
		channel = result.Data.(*model.Channel)
	} else {
		c.SetInvalidParam("getPermalinkTmp", "postId")
		return
	}

	if channel.Type == model.CHANNEL_OPEN {
		if !c.App.HasPermissionToChannelByPost(c.Session.UserId, postId, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
			c.SetPermissionError(model.PERMISSION_JOIN_PUBLIC_CHANNELS)
			return
		}
	} else {
		if !c.App.HasPermissionToChannelByPost(c.Session.UserId, postId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	if list, err := c.App.GetPermalinkPost(postId, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else if c.HandleEtag(list.Etag(), "Get Permalink TMP", w, r) {
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

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_DELETE_POST) {
		c.SetPermissionError(model.PERMISSION_DELETE_POST)
		return
	}

	if !c.App.SessionHasPermissionToPost(c.Session, postId, model.PERMISSION_DELETE_OTHERS_POSTS) {
		c.SetPermissionError(model.PERMISSION_DELETE_OTHERS_POSTS)
		return
	}

	if post, err := c.App.DeletePost(postId); err != nil {
		c.Err = err
		return
	} else {
		if post.ChannelId != channelId {
			c.Err = model.NewAppError("deletePost", "api.post.delete_post.permissions.app_error", nil, "", http.StatusForbidden)
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

	if !c.App.SessionHasPermissionToChannel(c.Session, id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	// We can do better than this etag in this situation
	etag := c.App.GetPostsEtag(id)

	if c.HandleEtag(etag, "Get Posts Before or After", w, r) {
		return
	}

	if list, err := c.App.GetPostsAroundPost(postId, id, offset, numPosts, before); err != nil {
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

	startTime := time.Now()

	posts, err := c.App.SearchPostsInTeam(terms, c.Session.UserId, c.TeamId, isOrSearch)

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

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if infos, err := c.App.GetFileInfosForPost(postId, false); err != nil {
		c.Err = err
		return
	} else if c.HandleEtag(model.GetEtagForFileInfos(infos), "Get File Infos For Post", w, r) {
		return
	} else {
		if len(infos) > 0 {
			w.Header().Set("Cache-Control", "max-age=2592000, public")
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, model.GetEtagForFileInfos(infos))
		w.Write([]byte(model.FileInfosToJson(infos)))
	}
}

func getOpenGraphMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableLinkPreviews {
		c.Err = model.NewAppError("getOpenGraphMetadata", "api.post.link_preview_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	props := model.StringInterfaceFromJson(r.Body)

	ogJSONGeneric, ok := openGraphDataCache.Get(props["url"])
	if ok {
		w.Write(ogJSONGeneric.([]byte))
		return
	}

	url := ""
	ok = false
	if url, ok = props["url"].(string); len(url) == 0 || !ok {
		c.SetInvalidParam("getOpenGraphMetadata", "url")
		return
	}

	og := c.App.GetOpenGraphMetadata(url)

	ogJSON, err := og.ToJSON()
	openGraphDataCache.AddWithExpiresInSecs(props["url"], ogJSON, 3600) // Cache would expire after 1 hour
	if err != nil {
		w.Write([]byte(`{"url": ""}`))
		return
	}

	w.Write(ogJSON)
}
