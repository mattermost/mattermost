// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"testing"

	"github.com/mattermost/mattermost-server/api"
	"github.com/mattermost/mattermost-server/model"
)

func TestAssignRole(t *testing.T) {
	th := api.Setup().InitBasic()
	defer th.TearDown()

	checkCommand(t, "roles", "system_admin", th.BasicUser.Email)

	if result := <-th.App.Srv.Store.User().GetByEmail(th.BasicUser.Email); result.Err != nil {
		t.Fatal()
	} else {
		user := result.Data.(*model.User)
		if user.Roles != "system_admin system_user" {
			t.Fatal()
		}
	}
}
