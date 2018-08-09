// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/model"
)

func TestAssignRole(t *testing.T) {
	th := api4.Setup().InitBasic()
	defer th.TearDown()

	CheckCommand(t, "roles", "system_admin", th.BasicUser.Email)

	if result := <-th.App.Srv.Store.User().GetByEmail(th.BasicUser.Email); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		user := result.Data.(*model.User)
		if user.Roles != "system_user system_admin" {
			t.Fatal("Got wrong roles:", user.Roles)
		}
	}

	CheckCommand(t, "roles", "member", th.BasicUser.Email)

	if result := <-th.App.Srv.Store.User().GetByEmail(th.BasicUser.Email); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		user := result.Data.(*model.User)
		if user.Roles != "system_user" {
			t.Fatal("Got wrong roles:", user.Roles, user.Id)
		}
	}
}
