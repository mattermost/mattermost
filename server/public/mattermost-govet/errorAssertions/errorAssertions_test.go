// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package errorAssertions

import (
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func Test(t *testing.T) {
	appErrorType = "*model.AppError"
	testdata := analysistest.TestData()
	analysistest.Run(t, testdata, Analyzer, "model", "assert", "errorAssertions")
}
