// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package appErrorReturn

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/tools/go/analysis/analysistest"
)

func setFlags(t *testing.T, flags map[string]string) {
	t.Helper()
	for name, value := range flags {
		prev := Analyzer.Flags.Lookup(name).Value.String()
		require.NoError(t, Analyzer.Flags.Set(name, value))
		t.Cleanup(func() {
			require.NoError(t, Analyzer.Flags.Set(name, prev))
		})
	}
}

func TestBaseline(t *testing.T) {
	testdata := analysistest.TestData()
	setFlags(t, map[string]string{
		"baseline": filepath.Join(testdata, "baseline.txt"),
		"scope":    "example.com/app",
	})

	analysistest.Run(t, testdata, Analyzer, "example.com/app", "example.com/app/sub", "example.com/app/clean", "example.com/other")
}

func TestList(t *testing.T) {
	setFlags(t, map[string]string{
		"list":  "true",
		"scope": "example.com/listed",
	})

	analysistest.Run(t, analysistest.TestData(), Analyzer, "example.com/listed")
}

func TestDisabledWithoutBaseline(t *testing.T) {
	setFlags(t, map[string]string{
		"scope": "example.com/other",
	})

	analysistest.Run(t, analysistest.TestData(), Analyzer, "example.com/other")
}

func TestBaselineDigestMismatch(t *testing.T) {
	setFlags(t, map[string]string{
		"baselineDigest": "0000",
	})

	_, err := loadBaseline(filepath.Join(analysistest.TestData(), "baseline.txt"))
	require.ErrorContains(t, err, "-appErrorReturn.baselineDigest is 0000")
}
