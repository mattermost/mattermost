// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
	"time"

	"github.com/mattermost/platform/model"
)

func TestMeCommand(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel := th.BasicChannel

	testString := "/me hello"

	r1 := Client.Must(Client.Command(channel.Id, testString, false)).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPosts(channel.Id, 0, 2, "")).Data.(*model.PostList)
	if len(p1.Order) != 2 {
		t.Fatal("Command failed to send")
	} else {
		if p1.Posts[p1.Order[0]].Message != `*hello*` {
			t.Log(p1.Posts[p1.Order[0]].Message)
			t.Fatal("invalid shrug reponse")
		}
	}
}
