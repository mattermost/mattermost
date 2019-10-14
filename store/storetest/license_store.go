// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
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
	assert.Nil(t, err, "couldn't save license record")

	_, err = ss.License().Save(&l1)
	assert.Nil(t, err, "shouldn't fail on trying to save existing license record")

	l1.Id = ""

	_, err = ss.License().Save(&l1)
	assert.NotNil(t, err, "should fail on invalid license")
}

func testLicenseStoreGet(t *testing.T, ss store.Store) {
	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	_, err := ss.License().Save(&l1)
	assert.Nil(t, err)

	record, err := ss.License().Get(l1.Id)
	assert.Nil(t, err, "couldn't get license")

	assert.Equal(t, record.Bytes, l1.Bytes, "license bytes didn't match")

	_, err = ss.License().Get("missing")
	assert.NotNil(t, err, "should fail on get license")
}
