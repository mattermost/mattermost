// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"net/http"

	"github.com/gorilla/mux"
)

type Routes struct {
	Root    *mux.Router // ''
	APIRoot *mux.Router // 'api/v4'

	Users  *mux.Router // 'api/v4/userzs'
	Groups *mux.Router // 'api/v4/groups'
}

type API struct {
	BaseRoutes *Routes
}

func (*API) ApiSessionRequired(h func(*context.Context, http.ResponseWriter, *http.Request)) http.Handler {
	return nil
}
func Init(root *mux.Router) *API {
	api := &API{
		BaseRoutes: &Routes{},
	}
	api.BaseRoutes.Root = root
	api.BaseRoutes.APIRoot = root.PathPrefix("api/v4").Subrouter()

	api.BaseRoutes.Users = api.BaseRoutes.APIRoot.PathPrefix("/users").Subrouter()   // want "PathPrefix doesn't match field comment for field 'Users': 'api/v4/users' vs 'api/v4/userzs'"
	api.BaseRoutes.Groups = api.BaseRoutes.APIRoot.PathPrefix("/gruops").Subrouter() // want "PathPrefix doesn't match field comment for field 'Groups': 'api/v4/gruops' vs 'api/v4/groups'"
	api.InitUsers()
	return api
}

func _() {
	_ = Init(nil)
}
