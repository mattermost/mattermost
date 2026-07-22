// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"net/http"
)

const userIDsPath = "/ids"

const syncableIDCharset = "[A-Za-z0-9]+"

func (a *API) InitUsers() {
	a.BaseRoutes.Users.Handle("/ids", a.ApiSessionRequired(getUsersByIds)).Methods(http.MethodPost)                                                                            // want `Cannot find /api/v4/userzs/ids method: POST in OpenAPI 3 spec. \(maybe you meant: \[/api/v4/users/ids\]\)`
	a.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channelz}/{syncable_id:[A-Za-z0-9]+}/link", a.ApiSessionRequired(getUsersByIds)).Methods("POST") // want `Cannot find /api/v4/groups/{group_id}/channelz/{syncable_id}/link method: POST in OpenAPI 3 spec.`

	// Compile-time const / concatenation paths must resolve without panicking the analyzer.
	a.BaseRoutes.Users.Handle(userIDsPath, a.ApiSessionRequired(getUsersByIds)).Methods(http.MethodPost) // want `Cannot find /api/v4/userzs/ids method: POST in OpenAPI 3 spec. \(maybe you meant: \[/api/v4/users/ids\]\)`
	a.BaseRoutes.Groups.Handle("/{group_id:"+syncableIDCharset+"}/{syncable_type:teams|channelz}/{syncable_id:"+syncableIDCharset+"}/link", a.ApiSessionRequired(getUsersByIds)).Methods("POST") // want `Cannot find /api/v4/groups/{group_id}/channelz/{syncable_id}/link method: POST in OpenAPI 3 spec.`

}
func getUsersByIds(c *context.Context, w http.ResponseWriter, r *http.Request) {
}
