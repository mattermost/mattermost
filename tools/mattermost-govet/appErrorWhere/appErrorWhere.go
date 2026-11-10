// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package appErrorWhere

import (
	"fmt"
	"go/ast"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "appErrorWhere",
	Doc:  "check for invalid where value in the appError",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			switch funDecl := node.(type) {
			case *ast.FuncDecl:
				ast.Inspect(funDecl, func(node ast.Node) bool {
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

						if fun.Sel.Name != "NewAppError" || module.Name != "model" {
							return true
						}

						if len(x.Args) == 0 {
							return true
						}

						firstArg, ok := x.Args[0].(*ast.BasicLit)
						if !ok {
							return true
						}

						if firstArg.Value == fmt.Sprintf("\"%s\"", funDecl.Name.Name) {
							return true
						}

						pass.Reportf(node.Pos(), "The first NewAppError parameter must be the name of the function, seen: %s, expected: %s", firstArg.Value, fmt.Sprintf("\"%s\"", funDecl.Name.Name))
					}
					return true
				})
			}
			return true
		})
	}
	return nil, nil
}
