// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
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
