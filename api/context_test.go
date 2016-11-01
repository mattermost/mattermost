// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

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

	RemoveAllSessionsForUserId(session.UserId)

	rkeys := sessionCache.Keys()
	if len(rkeys) != len(keys)-1 {
		t.Fatal("should have one less")
	}
}

func TestSiteURL(t *testing.T) {
	c := &Context{}

	testCases := []struct {
		url  string
		want string
	}{
		{"http://mattermost.com/", "http://mattermost.com"},
		{"http://mattermost.com", "http://mattermost.com"},
	}

	for _, tc := range testCases {
		c.SetSiteURL(tc.url)

		if c.siteURL != tc.want {
			t.Fatalf("expected %s, got %s", tc.want, c.siteURL)
		}
	}

}
