// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package requestCtxNaming

import (
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func TestAll(t *testing.T) {
	analysistest.Run(t, analysistest.TestData(), Analyzer, "valid", "invalid")
}
