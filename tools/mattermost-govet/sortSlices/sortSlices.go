// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sortSlices

import (
	"go/ast"
	"go/types"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "sortSlices",
	Doc:  "check for sort.Strings/sort.Ints/sort.Slice/sort.SliceStable calls, which should use the slices package instead",
	Run:  run,
}

const sortPkgPath = "sort"

// replacements maps the forbidden sort package functions to their slices
// package equivalent.
var replacements = map[string]string{
	"Strings":     "slices.Sort",
	"Ints":        "slices.Sort",
	"Slice":       "slices.SortFunc",
	"SliceStable": "slices.SortStableFunc",
}

func run(pass *analysis.Pass) (any, error) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}

			sel, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}

			replacement, ok := replacements[sel.Sel.Name]
			if !ok || !isSortPackage(pass, sel.X) {
				return true
			}

			pass.Reportf(call.Pos(), "sort.%s is not allowed, use %s from the slices package instead", sel.Sel.Name, replacement)

			return true
		})
	}

	return nil, nil
}

func isSortPackage(pass *analysis.Pass, expr ast.Expr) bool {
	ident, ok := expr.(*ast.Ident)
	if !ok {
		return false
	}

	pkgName, ok := pass.TypesInfo.Uses[ident].(*types.PkgName)
	if !ok {
		return false
	}

	return pkgName.Imported().Path() == sortPkgPath
}
