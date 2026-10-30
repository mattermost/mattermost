// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"net/http"
)

func (a *API) InitUsers() {
	a.BaseRoutes.Users.Handle("/ids", a.ApiSessionRequired(getUsersByIds)).Methods(http.MethodPost)                                                                            // want `Cannot find /api/v4/userzs/ids method: POST in OpenAPI 3 spec. \(maybe you meant: \[/api/v4/users/ids\]\)`
	a.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channelz}/{syncable_id:[A-Za-z0-9]+}/link", a.ApiSessionRequired(getUsersByIds)).Methods("POST") // want `Cannot find /api/v4/groups/{group_id}/channelz/{syncable_id}/link method: POST in OpenAPI 3 spec.`
	if true {
		a.BaseRoutes.Users.Handle("/flagged", a.ApiSessionRequired(getUsersByIds)).Methods(http.MethodGet) // want `Cannot find /api/v4/userzs/flagged method: GET in OpenAPI 3 spec.`
	}
}

func (a *API) InitGroups() {
	a.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/teams/{syncable_id:[A-Za-z0-9]+}/link", a.ApiSessionRequired(getUsersByIds)).Methods(http.MethodPost, http.MethodHead) // want `Handler /api/v4/groups/{group_id}/teams/{syncable_id}/link is defined with method HEAD, but it's not in the spec`
	a.BaseRoutes.Groups.Handle("/unflagged", a.ApiSessionRequired(getUsersByIds)).Methods(http.MethodGet)                                                                       // want `Cannot find /api/v4/groups/unflagged method: GET in OpenAPI 3 spec.`
}

func getUsersByIds(c *context.Context, w http.ResponseWriter, r *http.Request) {
}
