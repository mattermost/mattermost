// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestStoreUpgrade(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		saveSchemaVersion(ss.(*store.LayeredStore).DatabaseLayer.(SqlStore), VERSION_3_0_0)
		UpgradeDatabase(ss.(*store.LayeredStore).DatabaseLayer.(SqlStore))

		saveSchemaVersion(ss.(*store.LayeredStore).DatabaseLayer.(SqlStore), "")
		UpgradeDatabase(ss.(*store.LayeredStore).DatabaseLayer.(SqlStore))
	})
}

func TestSaveSchemaVersion(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		saveSchemaVersion(ss.(*store.LayeredStore).DatabaseLayer.(SqlStore), VERSION_3_0_0)
		if result := <-ss.System().Get(); result.Err != nil {
			t.Fatal(result.Err)
		} else {
			props := result.Data.(model.StringMap)
			if props["Version"] != VERSION_3_0_0 {
				t.Fatal("version not updated")
			}
		}

		if ss.(*store.LayeredStore).DatabaseLayer.(SqlStore).GetCurrentSchemaVersion() != VERSION_3_0_0 {
			t.Fatal("version not updated")
		}

		saveSchemaVersion(ss.(*store.LayeredStore).DatabaseLayer.(SqlStore), model.CurrentVersion)
	})
}
