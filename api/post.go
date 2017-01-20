// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
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

	cchan := app.Srv.Store.Channel().Get(post.ChannelId, true)

	if !app.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_CREATE_POST) {
		c.SetPermissionError(model.PERMISSION_CREATE_POST)
		return
	}

	// Check that channel has not been deleted
	var channel *model.Channel
	if result := <-cchan; result.Err != nil {
		c.SetInvalidParam("createPost", "post.channelId")
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewLocAppError("createPost", "api.post.create_post.can_not_post_to_deleted.error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if post.CreateAt != 0 && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		post.CreateAt = 0
	}

	if rp, err := app.CreatePost(post, c.TeamId, true); err != nil {
		c.Err = err

		if c.Err.Id == "api.post.create_post.root_id.app_error" ||
			c.Err.Id == "api.post.create_post.channel_root_id.app_error" ||
			c.Err.Id == "api.post.create_post.parent_id.app_error" {
			c.Err.StatusCode = http.StatusBadRequest
		}

		return
	} else {
		// Update the LastViewAt only if the post does not have from_webhook prop set (eg. Zapier app)
		if _, ok := post.Props["from_webhook"]; !ok {
			if result := <-app.Srv.Store.Channel().UpdateLastViewedAt([]string{post.ChannelId}, c.Session.UserId); result.Err != nil {
				l4g.Error(utils.T("api.post.create_post.last_viewed.error"), post.ChannelId, c.Session.UserId, result.Err)
			}
		}

		w.Write([]byte(rp.ToJson()))
	}
}

func updatePost(c *Context, w http.ResponseWriter, r *http.Request) {

	if utils.IsLicensed {
		if *utils.Cfg.ServiceSettings.AllowEditPost == model.ALLOW_EDIT_POST_NEVER {
			c.Err = model.NewLocAppError("updatePost", "api.post.update_post.permissions.app_error", nil,
				c.T("api.post.update_post.permissions_denied.app_error"))
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	post := model.PostFromJson(r.Body)

	if post == nil {
		c.SetInvalidParam("updatePost", "post")
		return
	}

	pchan := app.Srv.Store.Post().Get(post.Id)

	if !app.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_EDIT_POST) {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	var oldPost *model.Post
	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		oldPost = result.Data.(*model.PostList).Posts[post.Id]

		if oldPost == nil {
			c.Err = model.NewLocAppError("updatePost", "api.post.update_post.find.app_error", nil, "id="+post.Id)
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if oldPost.UserId != c.Session.UserId {
			c.Err = model.NewLocAppError("updatePost", "api.post.update_post.permissions.app_error", nil, "oldUserId="+oldPost.UserId)
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if oldPost.DeleteAt != 0 {
			c.Err = model.NewLocAppError("updatePost", "api.post.update_post.permissions.app_error", nil,
				c.T("api.post.update_post.permissions_details.app_error", map[string]interface{}{"PostId": post.Id}))
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if oldPost.IsSystemMessage() {
			c.Err = model.NewLocAppError("updatePost", "api.post.update_post.system_message.app_error", nil, "id="+post.Id)
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if utils.IsLicensed {
			if *utils.Cfg.ServiceSettings.AllowEditPost == model.ALLOW_EDIT_POST_TIME_LIMIT && model.GetMillis() > oldPost.CreateAt+int64(*utils.Cfg.ServiceSettings.PostEditTimeLimit*1000) {
				c.Err = model.NewLocAppError("updatePost", "api.post.update_post.permissions.app_error", nil,
					c.T("api.post.update_post.permissions_time_limit.app_error", map[string]interface{}{"timeLimit": *utils.Cfg.ServiceSettings.PostEditTimeLimit}))
				c.Err.StatusCode = http.StatusForbidden
				return
			}
		}
	}

	newPost := &model.Post{}
	*newPost = *oldPost

	newPost.Message = post.Message
	newPost.EditAt = model.GetMillis()
	newPost.Hashtags, _ = model.ParseHashtags(post.Message)

	if result := <-app.Srv.Store.Post().Update(newPost, oldPost); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		rpost := result.Data.(*model.Post)

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_EDITED, "", rpost.ChannelId, "", nil)
		message.Add("post", rpost.ToJson())

		go app.Publish(message)

		app.InvalidateCacheForChannelPosts(rpost.ChannelId)

		w.Write([]byte(rpost.ToJson()))
	}
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

	posts := &model.PostList{}

	if result := <-app.Srv.Store.Post().GetFlaggedPosts(c.Session.UserId, offset, limit); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		posts = result.Data.(*model.PostList)
	}

	w.Write([]byte(posts.ToJson()))
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

	etagChan := app.Srv.Store.Post().GetEtag(id, true)

	if !app.SessionHasPermissionToChannel(c.Session, id, model.PERMISSION_EDIT_POST) {
		c.SetPermissionError(model.PERMISSION_EDIT_POST)
		return
	}

	etag := (<-etagChan).Data.(string)

	if HandleEtag(etag, "Get Posts", w, r) {
		return
	}

	pchan := app.Srv.Store.Post().GetPosts(id, offset, limit, true)

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

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

	pchan := app.Srv.Store.Post().GetPostsSince(id, time, true)

	if !app.SessionHasPermissionToChannel(c.Session, id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

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

	pchan := app.Srv.Store.Post().Get(postId)

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.PostList).Etag(), "Get Post", w, r) {
		return
	} else {
		list := result.Data.(*model.PostList)

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

	if result := <-app.Srv.Store.Post().Get(postId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

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

	if result := <-app.Srv.Store.Post().Get(postId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

		if len(list.Order) != 1 {
			c.Err = model.NewLocAppError("getPermalinkTmp", "api.post_get_post_by_id.get.app_error", nil, "")
			return
		}
		post := list.Posts[list.Order[0]]

		var channel *model.Channel
		var err *model.AppError
		if channel, err = app.GetChannel(post.ChannelId); err != nil {
			c.Err = err
			return
		}

		if !app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
			c.SetPermissionError(model.PERMISSION_JOIN_PUBLIC_CHANNELS)
			return
		}

		if err = app.JoinChannel(channel, c.Session.UserId); err != nil {
			c.Err = err
			return
		}

		if HandleEtag(list.Etag(), "Get Permalink TMP", w, r) {
			return
		}

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

	pchan := app.Srv.Store.Post().Get(postId)

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {

		post := result.Data.(*model.PostList).Posts[postId]

		if post == nil {
			c.SetInvalidParam("deletePost", "postId")
			return
		}

		if post.ChannelId != channelId {
			c.Err = model.NewLocAppError("deletePost", "api.post.delete_post.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if post.UserId != c.Session.UserId && !app.SessionHasPermissionToChannel(c.Session, post.ChannelId, model.PERMISSION_DELETE_OTHERS_POSTS) {
			c.Err = model.NewLocAppError("deletePost", "api.post.delete_post.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if dresult := <-app.Srv.Store.Post().Delete(postId, model.GetMillis()); dresult.Err != nil {
			c.Err = dresult.Err
			return
		}

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_DELETED, "", post.ChannelId, "", nil)
		message.Add("post", post.ToJson())

		go app.Publish(message)
		go DeletePostFiles(post)
		go DeleteFlaggedPost(c.Session.UserId, post)

		app.InvalidateCacheForChannelPosts(post.ChannelId)

		result := make(map[string]string)
		result["id"] = postId
		w.Write([]byte(model.MapToJson(result)))
	}
}

func DeleteFlaggedPost(userId string, post *model.Post) {
	if result := <-app.Srv.Store.Preference().Delete(userId, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id); result.Err != nil {
		l4g.Warn(utils.T("api.post.delete_flagged_post.app_error.warn"), result.Err)
		return
	}
}

func DeletePostFiles(post *model.Post) {
	if len(post.FileIds) != 0 {
		return
	}

	if result := <-app.Srv.Store.FileInfo().DeleteForPost(post.Id); result.Err != nil {
		l4g.Warn(utils.T("api.post.delete_post_files.app_error.warn"), post.Id, result.Err)
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

	// We can do better than this etag in this situation
	etagChan := app.Srv.Store.Post().GetEtag(id, true)

	if !app.SessionHasPermissionToChannel(c.Session, id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	etag := (<-etagChan).Data.(string)
	if HandleEtag(etag, "Get Posts Before or After", w, r) {
		return
	}

	var pchan store.StoreChannel
	if before {
		pchan = app.Srv.Store.Post().GetPostsBefore(id, postId, numPosts, offset)
	} else {
		pchan = app.Srv.Store.Post().GetPostsAfter(id, postId, numPosts, offset)
	}

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

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

	paramsList := model.ParseSearchParams(terms)
	channels := []store.StoreChannel{}

	for _, params := range paramsList {
		params.OrTerms = isOrSearch
		// don't allow users to search for everything
		if params.Terms != "*" {
			channels = append(channels, app.Srv.Store.Post().Search(c.TeamId, c.Session.UserId, params))
		}
	}

	posts := &model.PostList{}
	for _, channel := range channels {
		if result := <-channel; result.Err != nil {
			c.Err = result.Err
			return
		} else {
			data := result.Data.(*model.PostList)
			posts.Extend(data)
		}
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

	pchan := app.Srv.Store.Post().Get(postId)
	fchan := app.Srv.Store.FileInfo().GetForPost(postId)

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	var infos []*model.FileInfo
	if result := <-fchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		infos = result.Data.([]*model.FileInfo)
	}

	if len(infos) == 0 {
		// No FileInfos were returned so check if they need to be created for this post
		var post *model.Post
		if result := <-pchan; result.Err != nil {
			c.Err = result.Err
			return
		} else {
			post = result.Data.(*model.PostList).Posts[postId]
		}

		if len(post.Filenames) > 0 {
			// The post has Filenames that need to be replaced with FileInfos
			infos = app.MigrateFilenamesToFileInfos(post)
		}
	}

	etag := model.GetEtagForFileInfos(infos)

	if HandleEtag(etag, "Get File Infos For Post", w, r) {
		return
	} else {
		w.Header().Set("Cache-Control", "max-age=2592000, public")
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(model.FileInfosToJson(infos)))
	}
}

func getOpenGraphMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJson(r.Body)
	og := opengraph.NewOpenGraph()

	res, err := http.Get(props["url"].(string))
	if err != nil {
		writeOpenGraphToResponse(w, og)
		return
	}

	if err := og.ProcessHTML(res.Body); err != nil {
		writeOpenGraphToResponse(w, og)
		return
	}

	writeOpenGraphToResponse(w, og)
}

func writeOpenGraphToResponse(w http.ResponseWriter, og *opengraph.OpenGraph) {
	ogJson, err := og.ToJSON()
	if err != nil {
		w.Write([]byte(`{"url": ""}`))
	}
	w.Write(ogJson)
}
