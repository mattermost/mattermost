// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"testing"
)

func TestAssignRole(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.CheckCommand(t, "roles", "system_admin", th.BasicUser.Email)

	if user, err := th.App.Srv.Store.User().GetByEmail(th.BasicUser.Email); err != nil {
		t.Fatal(err)
	} else {
		if user.Roles != "system_user system_admin" {
			t.Fatal("Got wrong roles:", user.Roles)
		}
	}

	th.CheckCommand(t, "roles", "member", th.BasicUser.Email)

	if user, err := th.App.Srv.Store.User().GetByEmail(th.BasicUser.Email); err != nil {
		t.Fatal(err)
	} else {
		if user.Roles != "system_user" {
			t.Fatal("Got wrong roles:", user.Roles, user.Id)
		}
	}
}
