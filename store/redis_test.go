// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"testing"
)

func TestRedis(t *testing.T) {
	utils.LoadConfig("config.json")

	c := RedisClient()

	if c == nil {
		t.Fatal("should have a valid redis connection")
	}

	pubsub := c.PubSub()
	defer pubsub.Close()

	m := model.NewMessage(model.NewId(), model.NewId(), model.NewId(), model.ACTION_TYPING)
	m.Add("RootId", model.NewId())

	err := pubsub.Subscribe(m.TeamId)
	if err != nil {
		t.Fatal(err)
	}

	// should be the subscribe success message
	// lets gobble that up
	if _, err := pubsub.Receive(); err != nil {
		t.Fatal(err)
	}

	PublishAndForget(m)

	fmt.Println("here1")

	if msg, err := pubsub.Receive(); err != nil {
		t.Fatal(err)
	} else {

		rmsg := GetMessageFromPayload(msg)

		if m.TeamId != rmsg.TeamId {
			t.Fatal("Ids do not match")
		}

		if m.Props["RootId"] != rmsg.Props["RootId"] {
			t.Fatal("Ids do not match")
		}
	}

	RedisClose()
}
