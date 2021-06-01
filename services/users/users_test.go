// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"testing"
)

func TestIsUsernameTaken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	taken := th.service.IsUsernameTaken(user.Username)

	if !taken {
		t.Logf("the username '%v' should be taken", user.Username)
		t.FailNow()
	}

	newUsername := "randomUsername"
	taken = th.service.IsUsernameTaken(newUsername)

	if taken {
		t.Logf("the username '%v' should not be taken", newUsername)
		t.FailNow()
	}
}
