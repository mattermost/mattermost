// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package facts

import (
	"go/ast"
	"go/types"

	"github.com/mattermost/mattermost/server/public/mattermost-govet/util"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/passes/inspect"
	"golang.org/x/tools/go/ast/inspector"
)

type IsApiHandler struct{}

func (*IsApiHandler) AFact()         {}
func (*IsApiHandler) String() string { return "isApiHandler" }

var ApiHandlerFacts = &analysis.Analyzer{
	Name:      "apiHandlers",
	Doc:       "check for API handlers and label them with facts",
	Requires:  []*analysis.Analyzer{inspect.Analyzer},
	Run:       apiHandlers,
	FactTypes: []analysis.Fact{new(IsApiHandler)},
}

func apiHandlers(pass *analysis.Pass) (interface{}, error) {
	if pass.Pkg.Path() != util.API4PkgPath {
		return nil, nil
	}

	inspect := pass.ResultOf[inspect.Analyzer].(*inspector.Inspector)
	nodeFilter := []ast.Node{
		(*ast.FuncDecl)(nil),
	}
	inspect.Preorder(nodeFilter, func(n ast.Node) {
		x := n.(*ast.FuncDecl)
		if isApiHandler(x) {
			if obj, ok := pass.TypesInfo.Defs[x.Name].(*types.Func); ok {
				pass.ExportObjectFact(obj, new(IsApiHandler))
			}
		}
	})
	return nil, nil
}

func isApiHandler(funDecl *ast.FuncDecl) bool {
	funcType := funDecl.Type
	if len(funcType.Params.List) < 3 {
		return false
	}
	arg0Type, ok := funcType.Params.List[0].Type.(*ast.StarExpr)
	if !ok {
		return false
	}
	arg0X, ok := arg0Type.X.(*ast.Ident)
	if !ok {
		return false
	}
	if arg0X.Name != "Context" {
		return false
	}

	arg1Type, ok := funcType.Params.List[1].Type.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	arg1X, ok := arg1Type.X.(*ast.Ident)
	if !ok {
		return false
	}
	if arg1X.Name != "http" || arg1Type.Sel.Name != "ResponseWriter" {
		return false
	}

	arg2Type, ok := funcType.Params.List[2].Type.(*ast.StarExpr)
	if !ok {
		return false
	}
	arg2X, ok := arg2Type.X.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	arg2XX, ok := arg2X.X.(*ast.Ident)
	if !ok {
		return false
	}

	if arg2XX.Name != "http" || arg2X.Sel.Name != "Request" {
		return false
	}
	return true
}
