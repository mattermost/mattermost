// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
)

func getUsersFromUserArgs(userArgs []string) []*model.User {
	users := make([]*model.User, 0, len(userArgs))
	for _, userArg := range userArgs {
		user := getUserFromUserArg(userArg)
		users = append(users, user)
	}
	return users
}

func getUserFromUserArg(userArg string) *model.User {
	var user *model.User
	if result := <-app.Global().Srv.Store.User().GetByEmail(userArg); result.Err == nil {
		user = result.Data.(*model.User)
	}

	if user == nil {
		if result := <-app.Global().Srv.Store.User().GetByUsername(userArg); result.Err == nil {
			user = result.Data.(*model.User)
		}
	}

	if user == nil {
		if result := <-app.Global().Srv.Store.User().Get(userArg); result.Err == nil {
			user = result.Data.(*model.User)
		}
	}

	return user
}
