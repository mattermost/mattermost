// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"os"
	"os/exec"
	"testing"

	"github.com/mattermost/platform/model"
)

func TestStoreUpgrade(t *testing.T) {
	Setup()

	saveSchemaVersion(store.(*LayeredStore).DatabaseLayer, VERSION_3_0_0)
	UpgradeDatabase(store.(*LayeredStore).DatabaseLayer)

	saveSchemaVersion(store.(*LayeredStore).DatabaseLayer, "")
	UpgradeDatabase(store.(*LayeredStore).DatabaseLayer)
}

func TestSaveSchemaVersion(t *testing.T) {
	Setup()

	saveSchemaVersion(store.(*LayeredStore).DatabaseLayer, VERSION_3_0_0)
	if result := <-store.System().Get(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		props := result.Data.(model.StringMap)
		if props["Version"] != VERSION_3_0_0 {
			t.Fatal("version not updated")
		}
	}

	if store.(*LayeredStore).DatabaseLayer.GetCurrentSchemaVersion() != VERSION_3_0_0 {
		t.Fatal("version not updated")
	}

	saveSchemaVersion(store.(*LayeredStore).DatabaseLayer, model.CurrentVersion)
}

func TestUnsupportedSchemaVersion(t *testing.T) {
	// when the TEST_EXIT environment variable is set, we'll actually run the test
	if os.Getenv("TEST_EXIT") == "1" {
		Setup()

		// attempting to upgrade from database 1.0.0 will cause the application to exit
		saveSchemaVersion(store.(*LayeredStore).DatabaseLayer, "1.0.0")
		UpgradeDatabase(store.(*LayeredStore).DatabaseLayer)
	}

	// when it isn't we'll shell the test out to another process, including the environment variable that causes the test to be executed
	cmd := exec.Command(os.Args[0], "-test.run=TestUnsupportedSchemaVersion")
	cmd.Env = append(os.Environ(), "TEST_EXIT=1")
	err := cmd.Run()
	if e, ok := err.(*exec.ExitError); ok && !e.Success() {
		// unfortunately, it isn't possible to verify that the correct error code was set in a platform-independent way :(
		return
	}
	t.Fatalf("Process returned error code %v. Expected error code %v", err, EXIT_TOO_OLD)
}
