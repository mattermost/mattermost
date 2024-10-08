// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitPostLocal() {
	api.BaseRoutes.Post.Handle("", api.APILocal(getPost)).Methods(http.MethodGet)

	api.BaseRoutes.PostsForChannel.Handle("", api.APILocal(getPostsForChannel)).Methods(http.MethodGet)
}
