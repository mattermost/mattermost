// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
	"time"

	"github.com/mattermost/platform/model"
)

func TestEchoCommand(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	echoTestString := "/echo test"

	r1 := Client.Must(Client.Command(channel1.Id, echoTestString, false)).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Echo command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Data.(*model.PostList)
	if len(p1.Order) != 2 {
		t.Fatal("Echo command failed to send")
	}
}
