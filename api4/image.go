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
	// Only redirect to our image proxy if one is enabled. Arbitrary redirects are not allowed for
	// security reasons.
	if transform := c.App.ImageProxyAdder(); transform != nil {
		http.Redirect(w, r, transform(r.URL.Query().Get("url")), http.StatusFound)
		return
	}

	http.NotFound(w, r)
}
