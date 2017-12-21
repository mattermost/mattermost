// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestGetClientProperties(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if props, err := th.BasicClient.GetClientProperties(); err != nil {
		t.Fatal(err)
	} else {
		if len(props["Version"]) == 0 {
			t.Fatal()
		}
	}
}

func TestLogClient(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if ret, _ := th.BasicClient.LogClient("this is a test"); !ret {
		t.Fatal("failed to log")
	}

	enableDeveloper := *th.App.Config().ServiceSettings.EnableDeveloper
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = enableDeveloper })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = false })

	th.BasicClient.Logout()

	if _, err := th.BasicClient.LogClient("this is a test"); err == nil {
		t.Fatal("should have failed")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = true })

	if ret, _ := th.BasicClient.LogClient("this is a test"); !ret {
		t.Fatal("failed to log")
	}
}

func TestGetPing(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if m, err := th.BasicClient.GetPing(); err != nil {
		t.Fatal(err)
	} else {
		if len(m["version"]) == 0 {
			t.Fatal()
		}
	}
}
