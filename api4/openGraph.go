// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitOpenGraph() {
	api.BaseRoutes.OpenGraph.Handle("", api.APISessionRequired(getOpenGraphMetadata)).Methods("POST")
}

func getOpenGraphMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableLinkPreviews {
		c.Err = model.NewAppError("getOpenGraphMetadata", "api.post.link_preview_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)

	url := ""
	ok := false
	if url, ok = props["url"].(string); url == "" || !ok {
		c.SetInvalidParam("url")
		return
	}

	buf, err := c.App.GetOpenGraphMetadata(url)
	if err != nil {
		mlog.Warn("GetOpenGraphMetadata request failed",
			mlog.String("requestURL", url),
			mlog.Err(err))
		w.Write([]byte(`{"url": ""}`))
		return
	}
	w.Write(buf)
}
