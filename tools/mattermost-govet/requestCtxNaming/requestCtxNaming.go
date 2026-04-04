// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package requestCtxNaming

import (
	"go/ast"
	"strings"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "requestCtxNaming",
	Doc:  "check that request.CTX parameters are consistently named 'rctx'",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			switch funcDecl := node.(type) {
			case *ast.FuncDecl:
				if funcDecl.Type != nil && funcDecl.Type.Params != nil {
					checkParameters(pass, funcDecl.Type.Params.List)
				}
			}
			return true
		})
	}
	return nil, nil
}

func checkParameters(pass *analysis.Pass, params []*ast.Field) {
	for _, param := range params {
		// Check if this parameter's type is request.CTX
		if isRequestCtxType(param.Type) {
			// Check each parameter name
			for _, name := range param.Names {
				if name.Name != "rctx" && !strings.HasPrefix(name.Name, "_") {
					pass.Reportf(
						name.Pos(),
						"parameter of type request.CTX should be named 'rctx', got '%s'",
						name.Name,
					)
				}
			}
		}
	}
}

func isRequestCtxType(expr ast.Expr) bool {
	switch t := expr.(type) {
	case *ast.SelectorExpr:
		// Handle request.CTX
		if ident, ok := t.X.(*ast.Ident); ok {
			return ident.Name == "request" && t.Sel.Name == "CTX"
		}
	case *ast.StarExpr:
		// Handle *request.CTX (pointer to request.CTX)
		return isRequestCtxType(t.X)
	}
	return false
}
