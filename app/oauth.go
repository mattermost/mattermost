// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
)

func RevokeAccessToken(token string) *model.AppError {

	session, _ := GetSession(token)
	schan := Srv.Store.Session().Remove(token)

	if result := <-Srv.Store.OAuth().GetAccessData(token); result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.get.app_error", nil, "")
	}

	tchan := Srv.Store.OAuth().RemoveAccessData(token)

	if result := <-tchan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_token.app_error", nil, "")
	}

	if result := <-schan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_session.app_error", nil, "")
	}

	if session != nil {
		ClearSessionCacheForUser(session.UserId)
	}

	return nil
}
