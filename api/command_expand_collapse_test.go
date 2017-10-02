// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func TestExpandCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	r1 := Client.Must(Client.Command(channel.Id, "/expand")).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPreference(model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_COLLAPSE_SETTING)).Data.(*model.Preference)
	if p1.Value != "false" {
		t.Fatal("preference not updated correctly")
	}
}

func TestCollapseCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	r1 := Client.Must(Client.Command(channel.Id, "/collapse")).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPreference(model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_COLLAPSE_SETTING)).Data.(*model.Preference)
	if p1.Value != "true" {
		t.Fatal("preference not updated correctly")
	}
}
