package configtelemetry

import (
	"strings"
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

// stubT is a minimal testing.T implementation that doesn't fail
// Used to capture analysistest results without test failures
type stubT struct {
	testing.TB
}

func (s *stubT) Errorf(format string, args ...any) {
	// Ignore errors from analysistest about unexpected diagnostics
	// We validate diagnostics manually below
}

func Test(t *testing.T) {
	telemetryPkgPath = "telemetry"
	modelPkgPath = "model"
	testdata := analysistest.TestData()

	// Run analyzer using a stub to prevent analysistest from failing on cross-package diagnostics
	// (diagnostics are reported on model package from telemetry package analysis)
	stub := &stubT{TB: t}
	results := analysistest.Run(stub, testdata, Analyzer, "telemetry")

	// Manually verify expected diagnostics
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	result := results[0]
	if len(result.Diagnostics) == 0 {
		t.Fatal("expected diagnostics but got none")
	}

	// Expected diagnostics: fields in model/config.go that are NOT used in telemetry
	expectedDiagnostics := map[string]bool{
		"ServiceSettings.WebsocketURL is not used in telemetry":                                false,
		"ServiceSettings.LicenseFileLocation is not used in telemetry":                         false,
		"MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout is not used in telemetry": false,
		"CloudSettings.CWSUrl is not used in telemetry":                                        false,
	}

	// Check that we got all expected diagnostics
	for _, diag := range result.Diagnostics {
		msg := diag.Message
		if _, ok := expectedDiagnostics[msg]; ok {
			expectedDiagnostics[msg] = true
			// Verify diagnostic is in model/config.go
			pos := result.Pass.Fset.Position(diag.Pos)
			if !strings.Contains(pos.Filename, "model/config.go") {
				t.Errorf("diagnostic %q should be in model/config.go, got %s", msg, pos.Filename)
			}
		}
	}

	// Verify all expected diagnostics were found
	for msg, found := range expectedDiagnostics {
		if !found {
			t.Errorf("expected diagnostic not found: %s", msg)
		}
	}

	// Verify we don't have unexpected diagnostics
	if len(result.Diagnostics) != len(expectedDiagnostics) {
		var unexpectedMsgs []string
		for _, diag := range result.Diagnostics {
			if _, ok := expectedDiagnostics[diag.Message]; !ok {
				unexpectedMsgs = append(unexpectedMsgs, diag.Message)
			}
		}
		if len(unexpectedMsgs) > 0 {
			t.Errorf("got %d unexpected diagnostics: %v", len(unexpectedMsgs), unexpectedMsgs)
		}
	}
}
