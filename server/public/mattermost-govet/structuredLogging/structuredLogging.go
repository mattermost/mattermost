// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package structuredLogging

import (
	"go/ast"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "structuredLogging",
	Doc:  "check invalid usage of logging",
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

				if (fun.Sel.Name != "Debug" && fun.Sel.Name != "Info" && fun.Sel.Name != "Warn" && fun.Sel.Name != "Error" && fun.Sel.Name != "Critical") || module.Name != "mlog" {
					return true
				}

				if len(x.Args) == 0 {
					return true
				}

				firstArg, ok := x.Args[0].(*ast.CallExpr)
				if !ok {
					return true
				}

				firstArgFun, ok := firstArg.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}

				firstArgModule, ok := firstArgFun.X.(*ast.Ident)
				if !ok {
					return true
				}

				if (firstArgFun.Sel.Name != "Sprintf" && firstArgFun.Sel.Name != "Sprint") || firstArgModule.Name != "fmt" {
					return true
				}

				pass.Reportf(node.Pos(), "Using fmt inside mlog function, use structured logging instead (example: mlog.Debug(\"Log message\", mlog.String(\"data_name\", data))).")
			}
			return true
		})
	}
	return nil, nil
}
