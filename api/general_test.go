// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
)

func TestGetClientProperties(t *testing.T) {
	th := Setup().InitBasic()

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

	if ret, _ := th.BasicClient.LogClient("this is a test"); !ret {
		t.Fatal("failed to log")
	}
}

func TestGetPing(t *testing.T) {
	th := Setup().InitBasic()

	if m, err := th.BasicClient.GetPing(); err != nil {
		t.Fatal(err)
	} else {
		if len(m["version"]) == 0 {
			t.Fatal()
		}
	}
}
