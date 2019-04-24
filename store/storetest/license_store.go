// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/require"
)

func TestLicenseStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testLicenseStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testLicenseStoreGet(t, ss) })
}

func testLicenseStoreSave(t *testing.T, ss store.Store) {
	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	if _, err := ss.License().Save(&l1); err != nil {
		t.Fatal("couldn't save license record", err)
	}

	if _, err := ss.License().Save(&l1); err != nil {
		t.Fatal("shouldn't fail on trying to save existing license record", err)
	}

	l1.Id = ""

	if _, err := ss.License().Save(&l1); err == nil {
		t.Fatal("should fail on invalid license", err)
	}
}

func testLicenseStoreGet(t *testing.T, ss store.Store) {
	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	_, err := ss.License().Save(&l1)
	require.Nil(t, err)

	if record, err := ss.License().Get(l1.Id); err != nil {
		t.Fatal("couldn't get license", err)
	} else {
		if record.Bytes != l1.Bytes {
			t.Fatal("license bytes didn't match")
		}
	}

	if _, err := ss.License().Get("missing"); err == nil {
		t.Fatal("should fail on get license", err)
	}
}
