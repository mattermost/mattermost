// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package openApiSync

import (
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func Test(t *testing.T) {
	testdata := analysistest.TestData()
	specFile = "../../api/v4/html/static/mattermost-openapi-v4.yaml"
	analysistest.Run(t, testdata, Analyzer, "api")
}
