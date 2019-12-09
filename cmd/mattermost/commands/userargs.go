// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

func getUsersFromUserArgs(a *app.App, userArgs []string) []*model.User {
	users := make([]*model.User, 0, len(userArgs))
	for _, userArg := range userArgs {
		user := getUserFromUserArg(a, userArg)
		users = append(users, user)
	}
	return users
}

func getUserFromUserArg(a *app.App, userArg string) *model.User {
	user, _ := a.Srv.Store.User().GetByEmail(userArg)

	if user == nil {
		var err *model.AppError
		if user, err = a.Srv.Store.User().GetByUsername(userArg); err == nil {
			return user
		}
	}

	if user == nil {
		user, _ = a.Srv.Store.User().Get(userArg)
	}

	return user
}
