// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package rawSql

import (
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func TestAll(t *testing.T) {
	// The analyzer only runs on the sqlstore package with full path
	testdata := analysistest.TestData()
	analysistest.Run(t, testdata, Analyzer, "github.com/mattermost/mattermost/server/v8/channels/store/sqlstore")
}
