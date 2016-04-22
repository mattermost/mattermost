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

func TestCache(t *testing.T) {
	session := &model.Session{
		Id:     model.NewId(),
		Token:  model.NewId(),
		UserId: model.NewId(),
	}

	sessionCache.AddWithExpiresInSecs(session.Token, session, 5*60)

	keys := sessionCache.Keys()
	if len(keys) <= 0 {
		t.Fatal("should have items")
	}

	RemoveAllSessionsForUserId(session.UserId)

	rkeys := sessionCache.Keys()
	if len(rkeys) != len(keys)-1 {
		t.Fatal("should have one less")
	}
}
