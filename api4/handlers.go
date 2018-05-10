// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/web"
)

type Context = web.Context

func (api *API) ApiHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &web.Handler{
		App:            api.App,
		HandleFunc:     h,
		RequireSession: false,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
	}
}

func (api *API) ApiSessionRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &web.Handler{
		App:            api.App,
		HandleFunc:     h,
		RequireSession: true,
		TrustRequester: false,
		RequireMfa:     true,
		IsStatic:       false,
	}
}

func (api *API) ApiSessionRequiredMfa(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &web.Handler{
		App:            api.App,
		HandleFunc:     h,
		RequireSession: true,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
	}
}

func (api *API) ApiHandlerTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &web.Handler{
		App:            api.App,
		HandleFunc:     h,
		RequireSession: false,
		TrustRequester: true,
		RequireMfa:     false,
		IsStatic:       false,
	}
}

func (api *API) ApiSessionRequiredTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &web.Handler{
		App:            api.App,
		HandleFunc:     h,
		RequireSession: true,
		TrustRequester: true,
		RequireMfa:     true,
		IsStatic:       false,
	}
}
