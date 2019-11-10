// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"github.com/mattermost/mattermost-server/services/tracing"
	"io/ioutil"
	"net/http"
)

func (api *API) InitImage() {
	api.BaseRoutes.Image.Handle("", api.ApiSessionRequiredTrustRequester(getImage)).Methods("GET")
}

func getImage(c *Context, w http.ResponseWriter, r *http.Request) {
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:image:getImage")
	c.App.Context = ctx
	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, _ = ioutil.ReadAll(r.Body)
		r.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
		span.SetTag("body", string(bodyBytes))
	}

	defer span.Finish()
	url := r.URL.Query().Get("url")

	if *c.App.Config().ImageProxySettings.Enable {
		c.App.ImageProxy.GetImage(w, r, url)
	} else {
		http.Redirect(w, r, url, http.StatusFound)
	}
}
