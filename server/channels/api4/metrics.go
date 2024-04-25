// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitMetrics() {
	api.BaseRoutes.Metrics.Handle("/", api.APISessionRequired(submitMetrics)).Methods("POST")
}

func submitMetrics(c *Context, w http.ResponseWriter, r *http.Request) {

}
