// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sortSlices

import (
	"go/ast"
	"go/token"
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
	// aliases tracks local variables that were assigned one of the forbidden
	// sort functions directly (e.g. `sorter := sort.Slice`), so that indirect
	// calls through the alias can also be flagged.
	aliases := map[*types.Var]*types.Func{}

	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			switch n := node.(type) {
			case *ast.AssignStmt:
				collectAliases(pass, aliases, n.Lhs, n.Rhs)
			case *ast.ValueSpec:
				collectAliases(pass, aliases, identsToExprs(n.Names), n.Values)
			}

			return true
		})
	}

	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}

			if fn, ok := forbiddenFuncFromExpr(pass, call.Fun); ok {
				report(pass, call.Pos(), fn)
				return true
			}

			if ident, ok := call.Fun.(*ast.Ident); ok {
				if v, ok := pass.TypesInfo.Uses[ident].(*types.Var); ok {
					if fn, ok := aliases[v]; ok {
						report(pass, call.Pos(), fn)
					}
				}
			}

			return true
		})
	}

	return nil, nil
}

// collectAliases records local variables that are assigned a direct
// reference to one of the forbidden sort functions, e.g.
// `sorter := sort.Slice` or, with a dot import, `sorter := Slice`.
func collectAliases(pass *analysis.Pass, aliases map[*types.Var]*types.Func, lhs, rhs []ast.Expr) {
	if len(lhs) != len(rhs) {
		return
	}

	for i, r := range rhs {
		fn, ok := forbiddenFuncFromExpr(pass, r)
		if !ok {
			continue
		}

		ident, ok := lhs[i].(*ast.Ident)
		if !ok {
			continue
		}

		v, ok := pass.TypesInfo.Defs[ident].(*types.Var)
		if !ok {
			v, ok = pass.TypesInfo.Uses[ident].(*types.Var)
			if !ok {
				continue
			}
		}

		aliases[v] = fn
	}
}

func identsToExprs(idents []*ast.Ident) []ast.Expr {
	exprs := make([]ast.Expr, len(idents))
	for i, ident := range idents {
		exprs[i] = ident
	}

	return exprs
}

// forbiddenFuncFromExpr resolves expr to one of the forbidden sort package
// functions, whether it's referenced through a selector (sort.Slice), a
// dot-imported identifier (Slice), or any other expression that ultimately
// refers to the *types.Func symbol.
func forbiddenFuncFromExpr(pass *analysis.Pass, expr ast.Expr) (*types.Func, bool) {
	var ident *ast.Ident

	switch e := expr.(type) {
	case *ast.Ident:
		ident = e
	case *ast.SelectorExpr:
		ident = e.Sel
	default:
		return nil, false
	}

	fn, ok := pass.TypesInfo.Uses[ident].(*types.Func)
	if !ok || fn.Pkg() == nil || fn.Pkg().Path() != sortPkgPath {
		return nil, false
	}

	if _, ok := replacements[fn.Name()]; !ok {
		return nil, false
	}

	return fn, true
}

func report(pass *analysis.Pass, pos token.Pos, fn *types.Func) {
	pass.Reportf(pos, "sort.%s is not allowed, use %s from the slices package instead", fn.Name(), replacements[fn.Name()])
}
