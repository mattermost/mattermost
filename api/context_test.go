// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestContext(t *testing.T) {
	context := Context{}

	context.IpAddress = "127.0.0.1"
	context.Session.UserId = "5"

	if !context.HasPermissionsToUser("5", "") {
		t.Fatal("should have permissions")
	}

	if context.HasPermissionsToUser("6", "") {
		t.Fatal("shouldn't have permissions")
	}

	context.Session.Roles = model.ROLE_SYSTEM_ADMIN
	if !context.HasPermissionsToUser("6", "") {
		t.Fatal("should have permissions")
	}
}
