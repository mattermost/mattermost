// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrationstests

import (
	"testing"

	"github.com/mgdelacroix/foundation"
)

type TestHelper struct {
	t *testing.T
	f *foundation.Foundation
}

func (th *TestHelper) IsPostgres() bool {
	return th.f.DB().DriverName() == "postgres"
}

func (th *TestHelper) IsMySQL() bool {
	return th.f.DB().DriverName() == "mysql"
}

func SetupTestHelper(t *testing.T) (*TestHelper, func()) {
	f := foundation.New(t, NewBoardsMigrator())

	th := &TestHelper{
		t: t,
		f: f,
	}

	tearDown := func() {
		th.f.TearDown()
	}

	return th, tearDown
}
