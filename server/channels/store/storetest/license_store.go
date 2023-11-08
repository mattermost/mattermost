// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestLicenseStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testLicenseStoreSave(t, rctx, ss) })
	t.Run("Get", func(t *testing.T) { testLicenseStoreGet(t, rctx, ss) })
}

func testLicenseStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	err := ss.License().Save(&l1)
	require.NoError(t, err, "couldn't save license record")

	err = ss.License().Save(&l1)
	require.NoError(t, err, "shouldn't fail on trying to save existing license record")

	l1.Id = ""

	err = ss.License().Save(&l1)
	require.Error(t, err, "should fail on invalid license")
}

func testLicenseStoreGet(t *testing.T, rctx request.CTX, ss store.Store) {
	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	err := ss.License().Save(&l1)
	require.NoError(t, err)

	record, err := ss.License().Get(rctx, l1.Id)
	require.NoError(t, err, "couldn't get license")

	require.Equal(t, record.Bytes, l1.Bytes, "license bytes didn't match")

	_, err = ss.License().Get(rctx, "missing")
	require.Error(t, err, "should fail on get license")
}
