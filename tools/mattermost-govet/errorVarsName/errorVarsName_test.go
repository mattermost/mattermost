// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package errorVarsName

import (
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func TestAll(t *testing.T) {
	testdata := analysistest.TestData()
	analysistest.Run(t, testdata, Analyzer, "a")
}
