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
	url := r.URL.Query().Get("url")
	if transform := c.App.ImageProxyAdder(); transform != nil {
		url = transform(url)
	}
	http.Redirect(w, r, url, http.StatusFound)
}
