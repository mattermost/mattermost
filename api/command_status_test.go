// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"
	//"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	//"github.com/mattermost/platform/store"
)

func TestStatusCommand(t *testing.T) {
	Setup()

	user := createTestUser()
	user.loginByEmail()
	channel := user.team.createChannel("aa")

	l4g.Debug("-> /away command")
	channel.command("/away", t)
	user.assertStatusIs(model.USER_AWAY, t)
	post := channel.latestChatterPost()
	if !strings.Contains(post, "away") {
		t.Fatal("invalid reponse: " + post)
	}

	l4g.Debug("-> /offline command")
	channel.command("/offline", t)
	user.assertStatusIs(model.USER_OFFLINE, t)
	post = channel.latestChatterPost()
	if !strings.Contains(post, "offline") {
		t.Fatal("invalid reponse: " + post)
	}

	l4g.Debug("-> /online command")
	channel.command("/online", t)
	user.assertStatusIs(model.USER_ONLINE, t)
	post = channel.latestChatterPost()
	if !strings.Contains(post, "online") {
		t.Fatal("invalid reponse: " + post)
	}
}
