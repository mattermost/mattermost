package uniqueMigrationNumber

import (
	"go/token"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/tools/go/analysis"
)

func TestDuplicateMigrationNumbers(t *testing.T) {
	migrationsDir := filepath.Join("testdata", "migrations")

	fset := token.NewFileSet()
	var diags []analysis.Diagnostic
	pass := &analysis.Pass{
		Analyzer: Analyzer,
		Fset:     fset,
		Report: func(d analysis.Diagnostic) {
			diags = append(diags, d)
		},
	}

	err := checkMigrationDir(pass, migrationsDir)
	require.NoError(t, err)

	require.Len(t, diags, 1)
	assert.Contains(t, diags[0].Message, "duplicate migration number 000002")
	assert.Contains(t, diags[0].Message, "000002_bar.up.sql")
	assert.Contains(t, diags[0].Message, "000002_baz.up.sql")
}

func TestNoDuplicates(t *testing.T) {
	// testdata/unique has only unique migration numbers
	migrationsDir := filepath.Join("testdata", "unique")

	fset := token.NewFileSet()
	var diags []analysis.Diagnostic
	pass := &analysis.Pass{
		Analyzer: Analyzer,
		Fset:     fset,
		Report: func(d analysis.Diagnostic) {
			diags = append(diags, d)
		},
	}

	err := checkMigrationDir(pass, migrationsDir)
	require.NoError(t, err)
	assert.Empty(t, diags)
}

func TestBadPath(t *testing.T) {
	fset := token.NewFileSet()
	pass := &analysis.Pass{
		Analyzer: Analyzer,
		Fset:     fset,
		Report:   func(d analysis.Diagnostic) {},
	}

	err := checkMigrationDir(pass, "/nonexistent/path")
	assert.NoError(t, err)
}

func TestGetMigrationNumberFromFilename(t *testing.T) {
	tests := []struct {
		filename string
		want     int
	}{
		{"000001_create_teams.up.sql", 1},
		{"000167_create_views.up.sql", 167},
		{"no_number.up.sql", -1},
		{"000000_zero.up.sql", 0},
	}
	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			assert.Equal(t, tt.want, getMigrationNumberFromFilename(tt.filename))
		})
	}
}
