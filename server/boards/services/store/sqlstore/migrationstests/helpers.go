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

func (th *TestHelper) F() *foundation.Foundation {
	return th.f
}

func SetupTestHelper(t *testing.T, f *foundation.Foundation) (*TestHelper, func()) {
	th := &TestHelper{t, f}

	tearDown := func() {
		th.f.TearDown()
	}

	return th, tearDown
}
