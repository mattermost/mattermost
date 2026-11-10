// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package emptyStrCmp

import (
	"go/ast"
	"go/token"
	"strings"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "emptyStrCmp",
	Doc:  "check for len(s) == 0 and len(s) != 0 where s is string",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	const bindataHeader = "by go-bindata DO NOT EDIT. (@generated)"

	for _, file := range pass.Files {
		if len(file.Comments) > 0 && strings.HasSuffix(file.Comments[0].List[0].Text, bindataHeader) {
			continue
		}

		ast.Inspect(file, func(node ast.Node) bool {
			switch n := node.(type) {
			case *ast.BinaryExpr:
				callExpr, ok := n.X.(*ast.CallExpr)
				if !ok {
					return true
				}
				idt, ok := callExpr.Fun.(*ast.Ident)
				if !ok {
					return true
				}
				if idt.Name == "len" && (n.Op == token.EQL || n.Op == token.NEQ || n.Op == token.GTR || n.Op == token.LEQ) {
					if len(callExpr.Args) < 1 {
						return true
					}
					arg0 := callExpr.Args[0]
					typ, ok := pass.TypesInfo.Types[arg0]
					if ok && typ.Type.String() == "string" {
						bLit, ok := n.Y.(*ast.BasicLit)
						if !ok {
							return true
						}
						if bLit.Value == "0" {
							switch n.Op {
							case token.EQL:
								pass.Reportf(callExpr.Pos(), "calling len(s) == 0 where s is string, please use s == \"\" instead")
							case token.NEQ:
								pass.Reportf(callExpr.Pos(), "calling len(s) != 0 where s is string, please use s != \"\" instead")
							case token.GTR:
								pass.Reportf(callExpr.Pos(), "calling len(s) > 0 where s is string, please use s != \"\" instead")
							case token.LEQ:
								pass.Reportf(callExpr.Pos(), "calling len(s) <= 0 where s is string, please use s == \"\" instead")
							}
							return false
						}
					}
				}
			}
			return true
		})
	}
	return nil, nil
}
