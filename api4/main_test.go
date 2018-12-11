// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/mattermost-server/testlib"
)

var mainHelper *testlib.MainHelper

func TestMain(m *testing.M) {
	mainHelper = testlib.NewMainHelper()
	defer mainHelper.Close()
	UseTestStore(mainHelper.Store)

	mainHelper.Main(m)
}
