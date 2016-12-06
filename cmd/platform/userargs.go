// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/model"
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
	if result := <-api.Srv.Store.User().GetByEmail(userArg); result.Err == nil {
		user = result.Data.(*model.User)
	}

	if user == nil {
		if result := <-api.Srv.Store.User().GetByUsername(userArg); result.Err == nil {
			user = result.Data.(*model.User)
		}
	}

	if user == nil {
		if result := <-api.Srv.Store.User().Get(userArg); result.Err == nil {
			user = result.Data.(*model.User)
		}
	}

	return user
}
