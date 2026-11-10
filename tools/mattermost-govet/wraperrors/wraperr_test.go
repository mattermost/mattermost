package wraperrors

import (
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func Test(t *testing.T) {
	appErrorType = "*model.AppError"
	testdata := analysistest.TestData()
	analysistest.Run(t, testdata, Analyzer, "model", "wraperrors")
}
