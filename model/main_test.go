// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model_test

import (
	"fmt"
	"github.com/mattermost/mattermost-server/model"
	"testing"

	"github.com/mattermost/mattermost-server/testlib"
)

var mainHelper *testlib.MainHelper

func TestMain(m *testing.M) {
	fmt.Println(model.SqlSettings{})
	mainHelper = testlib.NewMainHelper()
	defer mainHelper.Close()

	mainHelper.Main(m)
}
