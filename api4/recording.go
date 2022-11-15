// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"bytes"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitRecording() {
	// GET /api/v4/posts/recordings/{post_id: [A-Za-z0-9]}
	api.BaseRoutes.Recording.Handle("", api.APISessionRequired(getRecording)).Methods("GET")
}

func getRecording(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	post, err := c.App.GetSinglePost(c.Params.PostId, false)
	if err != nil || post.DeleteAt > 0 || post.Type != "custom_voice" {
		http.NotFound(w, r)
		return
	}


	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), post.ChannelId, model.PermissionReadChannel) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	fileID, ok := post.Props["fileId"].(string)
	if !ok {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	info, err := c.App.GetFileInfo(fileID)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	file, err := c.App.GetFile(fileID)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if info.MimeType != "" {
		w.Header().Set("Content-Type", info.MimeType)
	}
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Content-Security-Policy", "Frame-ancestors 'none'")

	reader := bytes.NewReader(file)
	secs := int64(info.UpdateAt / 1000)
	ns := int64((info.UpdateAt - (secs * 1000)) * 1000000)
	http.ServeContent(w, r, info.Name, time.Unix(secs, ns), reader)

	return
}
