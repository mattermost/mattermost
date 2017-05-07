// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
	"testing"
)

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

	ClearSessionCacheForUser(session.UserId)

	rkeys := sessionCache.Keys()
	if len(rkeys) != len(keys)-1 {
		t.Fatal("should have one less")
	}
}
