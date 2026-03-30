// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package openApiSync

import (
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func Test(t *testing.T) {
	testdata := analysistest.TestData()
	specFile = analysistest.TestData() + "/spec.yaml"
	analysistest.Run(t, testdata, Analyzer, "api")
}
