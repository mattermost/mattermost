// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func TestEchoCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel1 := th.BasicChannel

	echoTestString := "/echo test"

	if r1 := Client.Must(Client.Command(channel1.Id, echoTestString)).Data.(*model.CommandResponse); r1 == nil {
		t.Fatal("Echo command failed to execute")
	}

	if r1 := Client.Must(Client.Command(channel1.Id, "/echo ")).Data.(*model.CommandResponse); r1 == nil {
		t.Fatal("Echo command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Data.(*model.PostList)
	if len(p1.Order) != 2 {
		t.Fatal("Echo command failed to send")
	}
}
