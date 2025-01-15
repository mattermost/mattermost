// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package equalLenAsserts

import (
	"go/ast"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "equalLenAsserts",
	Doc:  "check for (require/assert).Equal(t, X, len(Y))",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			switch x := node.(type) {
			case *ast.CallExpr:
				callExpr, _ := node.(*ast.CallExpr)
				fun, ok := x.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}

				module, ok := fun.X.(*ast.Ident)
				if !ok {
					return true
				}

				if fun.Sel.Name == "Equal" && (module.Name == "require" || module.Name == "assert") {
					hasLen := false
					hasZero := false
					for _, arg := range callExpr.Args {
						literal, ok := arg.(*ast.BasicLit)
						if ok {
							if literal.Value == "0" {
								hasZero = true
							}
						}

						call, ok := arg.(*ast.CallExpr)
						if ok {
							callFun, ok := call.Fun.(*ast.Ident)
							if ok {
								if callFun.Name == "len" {
									hasLen = true
								}
							}
						}
					}
					if hasLen && hasZero {
						pass.Reportf(callExpr.Pos(), "calling len inside require/assert.Equal and comparing to 0, please use require/assert.Empty instead")
						return false
					}
					if hasLen {
						pass.Reportf(callExpr.Pos(), "calling len inside require/assert.Equal, please use require/assert.Len instead")
						return false
					}
				}

				if fun.Sel.Name == "Len" && (module.Name == "require" || module.Name == "assert") {
					if len(callExpr.Args) < 3 {
						return true
					}

					literal, ok := callExpr.Args[2].(*ast.BasicLit)
					if ok {
						if literal.Value == "0" {
							pass.Reportf(callExpr.Pos(), "calling require/assert.Len comparing to 0, please use require/assert.Empty instead")
						}
					}
				}

				return true
			}
			return true
		})
	}
	return nil, nil
}
