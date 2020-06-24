// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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

	_, err := ss.License().Save(&l1)
	require.Nil(t, err, "couldn't save license record")

	_, err = ss.License().Save(&l1)
	require.Nil(t, err, "shouldn't fail on trying to save existing license record")

	l1.Id = ""

	_, err = ss.License().Save(&l1)
	require.NotNil(t, err, "should fail on invalid license")
}

func testLicenseStoreGet(t *testing.T, ss store.Store) {
	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	_, err := ss.License().Save(&l1)
	require.Nil(t, err)

	record, err := ss.License().Get(l1.Id)
	require.Nil(t, err, "couldn't get license")

	require.Equal(t, record.Bytes, l1.Bytes, "license bytes didn't match")

	_, err = ss.License().Get("missing")
	require.NotNil(t, err, "should fail on get license")
	require.IsType(t, &store.ErrNotFound{}, err)
}
