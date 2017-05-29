// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const OPEN_GRAPH_METADATA_CACHE_SIZE = 10000

var openGraphDataCache = utils.NewLru(OPEN_GRAPH_METADATA_CACHE_SIZE)

func InitOpenGraph() {
	l4g.Debug(utils.T("api.opengraph.init.debug"))

	BaseRoutes.OpenGraph.Handle("", ApiSessionRequired(getOpenGraphMetadata)).Methods("POST")
}

func getOpenGraphMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableLinkPreviews {
		c.Err = model.NewAppError("getOpenGraphMetadata", "api.post.link_preview_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	props := model.StringInterfaceFromJson(r.Body)

	url := ""
	ok := false
	if url, ok = props["url"].(string); len(url) == 0 || !ok {
		c.SetInvalidParam("url")
		return
	}

	ogJSONGeneric, ok := openGraphDataCache.Get(url)
	if ok {
		w.Write(ogJSONGeneric.([]byte))
		return
	}

	og := app.GetOpenGraphMetadata(url)

	ogJSON, err := og.ToJSON()
	openGraphDataCache.AddWithExpiresInSecs(props["url"], ogJSON, 3600) // Cache would expire after 1 hour
	if err != nil {
		w.Write([]byte(`{"url": ""}`))
		return
	}

	w.Write(ogJSON)
}
