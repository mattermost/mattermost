// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"reflect"
	"runtime"
	"testing"

	"github.com/mattermost/mattermost-server/v6/boards/model"
)

func TestGetServerMetadata(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	th.Store.EXPECT().DBType().Return("TEST_DB_TYPE")
	th.Store.EXPECT().DBVersion().Return("TEST_DB_VERSION")

	t.Run("Get Server Metadata", func(t *testing.T) {
		got := th.App.GetServerMetadata()
		want := &ServerMetadata{
			Version:     model.CurrentVersion,
			BuildNumber: model.BuildNumber,
			BuildDate:   model.BuildDate,
			Commit:      model.BuildHash,
			Edition:     model.Edition,
			DBType:      "TEST_DB_TYPE",
			DBVersion:   "TEST_DB_VERSION",
			OSType:      runtime.GOOS,
			OSArch:      runtime.GOARCH,
			SKU:         "personal_server",
		}

		if !reflect.DeepEqual(got, want) {
			t.Errorf("got: %q, want: %q", got, want)
		}
	})
}
