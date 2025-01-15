// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package openApiSync

import (
	"math/rand"
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func Test(t *testing.T) {
	rand.Seed(1)
	testdata := analysistest.TestData()
	specFile = "../../mattermost/api/v4/html/static/mattermost-openapi-v4.yaml"
	analysistest.Run(t, testdata, Analyzer, "api")
}
