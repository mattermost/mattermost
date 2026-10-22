// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tFatal

import (
	"go/ast"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "tFatal",
	Doc:  "check invalid usage of t.Fatal assertions",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			switch x := node.(type) {
			case *ast.CallExpr:
				fun, ok := x.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}

				module, ok := fun.X.(*ast.Ident)
				if !ok {
					return true
				}

				if fun.Sel.Name != "Fatal" || module.Name != "t" {
					return true
				}

				pass.Reportf(node.Pos(), "t.Fatal usage is not allowed. Use semantic assertions with require or assert modules from testify package.")
			}
			return true
		})
	}
	return nil, nil
}
