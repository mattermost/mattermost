// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"github.com/mattermost/mattermost-server/services/tracing"
	"net/http"
)

func (api *API) InitImage() {
	api.BaseRoutes.Image.Handle("", api.ApiSessionRequiredTrustRequester(getImage)).Methods("GET")
}

func getImage(c *Context, w http.ResponseWriter, r *http.Request) {
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:image:getImage")
	c.App.Context = ctx
	defer span.Finish()
	url := r.URL.Query().Get("url")

	if *c.App.Config().ImageProxySettings.Enable {
		c.App.ImageProxy.GetImage(w, r, url)
	} else {
		http.Redirect(w, r, url, http.StatusFound)
	}
}
