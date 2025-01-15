package configtelemetry

import (
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func Test(t *testing.T) {
	telemetryPkgPath = "telemetry"
	modelPkgPath = "model"
	testdata := analysistest.TestData()
	analysistest.Run(t, testdata, Analyzer, "telemetry")
}
