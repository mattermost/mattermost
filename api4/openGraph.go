// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/cache/lru"
)

const OPEN_GRAPH_METADATA_CACHE_SIZE = 10000

var openGraphDataCache = lru.New(OPEN_GRAPH_METADATA_CACHE_SIZE)

func (api *API) InitOpenGraph() {
	api.BaseRoutes.OpenGraph.Handle("", api.ApiSessionRequired(getOpenGraphMetadata)).Methods("POST")

	// Dump the image cache if the proxy settings have changed. (need switch URLs to the correct proxy)
	api.ConfigService.AddConfigListener(func(before, after *model.Config) {
		if (before.ImageProxySettings.Enable != after.ImageProxySettings.Enable) ||
			(before.ImageProxySettings.ImageProxyType != after.ImageProxySettings.ImageProxyType) ||
			(before.ImageProxySettings.RemoteImageProxyURL != after.ImageProxySettings.RemoteImageProxyURL) ||
			(before.ImageProxySettings.RemoteImageProxyOptions != after.ImageProxySettings.RemoteImageProxyOptions) {
			openGraphDataCache.Purge()
		}
	})
}

func getOpenGraphMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableLinkPreviews {
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

	og := c.App.GetOpenGraphMetadata(url)
	ogJSON, err := og.ToJSON()
	openGraphDataCache.AddWithExpiresInSecs(url, ogJSON, 3600) // Cache would expire after 1 hour
	if err != nil {
		w.Write([]byte(`{"url": ""}`))
		return
	}

	w.Write(ogJSON)
}
