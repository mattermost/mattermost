// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// AnalyticsPostCount with empty options reads every row of Posts, which takes seconds on large
// installations and evicts the database's working set from memory. Routine code paths use
// AnalyticsPostCountFast or AnalyticsPostCountUpTo instead.
func TestNoUnfilteredAnalyticsPostCountInProductionCode(t *testing.T) {
	serverRoot, err := filepath.Abs(filepath.Join("..", ".."))
	require.NoError(t, err)

	fset := token.NewFileSet()
	scanned := 0
	err = filepath.WalkDir(serverRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			switch d.Name() {
			case ".git", "node_modules", "vendor", "testdata", "storetest":
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}

		file, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
		if err != nil {
			return err
		}
		scanned++

		ast.Inspect(file, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok || len(call.Args) != 1 {
				return true
			}
			if sel, ok := call.Fun.(*ast.SelectorExpr); !ok || sel.Sel.Name != "AnalyticsPostCount" {
				return true
			}
			if isEmptyPostCountOptions(call.Args[0]) {
				rel, _ := filepath.Rel(serverRoot, path)
				assert.Failf(t, "unfiltered AnalyticsPostCount", "%s:%d counts every post; use AnalyticsPostCountFast or AnalyticsPostCountUpTo", rel, fset.Position(call.Pos()).Line)
			}
			return true
		})
		return nil
	})
	require.NoError(t, err)
	require.Greater(t, scanned, 1000, "expected to scan the whole server tree")
}

func TestIsEmptyPostCountOptions(t *testing.T) {
	for expr, want := range map[string]bool{
		"&model.PostCountOptions{}": true,
		"nil":                       true,
		"&model.PostCountOptions{TeamId: teamID}": false,
		"&model.AnalyticsPostCountsOptions{}":     false,
		"options":                                 false,
		"model.PostCountOptions{}":                false,
	} {
		parsed, err := parser.ParseExpr(expr)
		require.NoError(t, err)
		assert.Equal(t, want, isEmptyPostCountOptions(parsed), expr)
	}
}

func isEmptyPostCountOptions(arg ast.Expr) bool {
	if ident, ok := arg.(*ast.Ident); ok {
		return ident.Name == "nil"
	}

	unary, ok := arg.(*ast.UnaryExpr)
	if !ok || unary.Op != token.AND {
		return false
	}
	lit, ok := unary.X.(*ast.CompositeLit)
	if !ok || len(lit.Elts) > 0 {
		return false
	}
	sel, ok := lit.Type.(*ast.SelectorExpr)
	return ok && sel.Sel.Name == "PostCountOptions"
}
