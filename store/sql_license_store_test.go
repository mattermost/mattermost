// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestLicenseStoreSave(t *testing.T) {
	Setup()

	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	if err := (<-store.License().Save(&l1)).Err; err != nil {
		t.Fatal("couldn't save license record", err)
	}

	if err := (<-store.License().Save(&l1)).Err; err != nil {
		t.Fatal("shouldn't fail on trying to save existing license record", err)
	}

	l1.Id = ""

	if err := (<-store.License().Save(&l1)).Err; err == nil {
		t.Fatal("should fail on invalid license", err)
	}
}

func TestLicenseStoreGet(t *testing.T) {
	Setup()

	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	Must(store.License().Save(&l1))

	if r := <-store.License().Get(l1.Id); r.Err != nil {
		t.Fatal("couldn't get license", r.Err)
	} else {
		if r.Data.(*model.LicenseRecord).Bytes != l1.Bytes {
			t.Fatal("license bytes didn't match")
		}
	}

	if err := (<-store.License().Get("missing")).Err; err == nil {
		t.Fatal("should fail on get license", err)
	}
}
