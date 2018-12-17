// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
)

func (api *API) InitImage() {
	api.BaseRoutes.Image.Handle("", api.ApiSessionRequiredTrustRequester(getImage)).Methods("GET")
}

func getImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ImageProxySettings.Enable {
		http.NotFound(w, r)
		return
	}

	c.App.ImageProxy.GetImage(w, r, r.URL.Query().Get("url"))
}
