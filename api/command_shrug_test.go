// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func TestShrugCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	testString := "/shrug"

	r1 := Client.Must(Client.Command(channel.Id, testString)).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPosts(channel.Id, 0, 2, "")).Data.(*model.PostList)
	if len(p1.Order) != 2 {
		t.Fatal("Command failed to send")
	} else {
		if p1.Posts[p1.Order[0]].Message != `¯\\\_(ツ)\_/¯` {
			t.Log(p1.Posts[p1.Order[0]].Message)
			t.Fatal("invalid shrug reponse")
		}
	}
}
