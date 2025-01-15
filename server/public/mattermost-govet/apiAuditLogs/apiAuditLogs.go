// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package apiAuditLogs

import (
	"go/ast"
	"go/token"
	"go/types"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/mattermost-govet/facts"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/util"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/passes/inspect"
	"golang.org/x/tools/go/ast/inspector"
)

const mattermostPackagePath = "github.com/mattermost/mattermost-server/v6/"

var Analyzer = &analysis.Analyzer{
	Name:     "apiAuditLogs",
	Doc:      "check that audit records are properly created in the API layer.",
	Requires: []*analysis.Analyzer{inspect.Analyzer, facts.ApiHandlerFacts},
	Run:      run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	if pass.Pkg.Path() != util.API4PkgPath {
		return nil, nil
	}

	inspect := pass.ResultOf[inspect.Analyzer].(*inspector.Inspector)
	nodeFilter := []ast.Node{
		(*ast.FuncDecl)(nil),
	}
	inspect.Preorder(nodeFilter, func(n ast.Node) {
		funDecl := n.(*ast.FuncDecl)

		filename := pass.Fset.File(n.Pos()).Name()
		if strings.HasSuffix(filename, "_test.go") || strings.HasSuffix(filename, "apitestlib.go") {
			return
		}

		if whiteList[funDecl.Name.Name] {
			return
		}

		if obj, ok := pass.TypesInfo.Defs[funDecl.Name].(*types.Func); ok {
			var fact facts.IsApiHandler
			if !pass.ImportObjectFact(obj, &fact) {
				return
			}
		}
		initializationFound := false
		logCallFound := false
		successCallFound := false
		ast.Inspect(funDecl, func(node ast.Node) bool {
			switch n := node.(type) {
			case *ast.CallExpr:
				fun, ok := n.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}

				instanceType, ok := pass.TypesInfo.Types[fun.X]
				if !ok {
					return true
				}

				if instanceType.Type.String() == "*"+util.ServerModulePath+"/channels/audit.Record" && fun.Sel.Name == "Success" {
					successCallFound = true
				}
				if instanceType.Type.String() == "*"+mattermostPackagePath+"/channels/web.Context" && (fun.Sel.Name == "LogAuditRec" || fun.Sel.Name == "LogAuditRecWithLevel") {
					logCallFound = true
				}

				if instanceType.Type.String() == "*"+mattermostPackagePath+"/channels/web.Context" && fun.Sel.Name == "MakeAuditRecord" {
					initializationFound = true
					if len(n.Args) < 2 {
						pass.Reportf(n.Pos(), "Invalid record initialization, expected at least 2 parameters")
						return true
					}

					arg0, ok := n.Args[0].(*ast.BasicLit)
					if !ok {
						pass.Reportf(n.Args[0].Pos(), "Invalid record name, expected \"%s\", found \"%v\"", funDecl.Name.Name, n.Args[0])
						return true
					}

					arg1, ok := n.Args[1].(*ast.SelectorExpr)
					if !ok {
						pass.Reportf(n.Args[1].Pos(), "Invalid initial state for record, expected \"audit.Fail\", found \"%v\"", n.Args[1])
						return true
					}

					if arg0.Kind != token.STRING {
						pass.Reportf(n.Args[0].Pos(), "Invalid record name, expected \"%s\", found \"%v\"", funDecl.Name.Name, arg0)
						return true
					}

					arg0Val, err := strconv.Unquote(arg0.Value)
					if err != nil {
						pass.Reportf(n.Args[0].Pos(), "Invalid record name, expected \"%s\", found \"%v\"", funDecl.Name.Name, arg0.Value)
						return true
					}

					if arg0Val != funDecl.Name.Name {
						pass.Reportf(n.Args[0].Pos(), "Invalid record name, expected \"%s\", found \"%s\"", funDecl.Name.Name, arg0Val)
						return true
					}

					arg1X, ok := arg1.X.(*ast.Ident)
					if !ok {
						pass.Reportf(n.Args[1].Pos(), "Invalid initial state for record, expected \"audit.Fail\", found \"%v\"", arg1.X)
						return true
					}

					if arg1X.Name != "audit" || arg1.Sel.Name != "Fail" {
						pass.Reportf(n.Args[1].Pos(), "Invalid initial state for record, expected \"audit.Fail\", found \"%s.%s\"", arg1X.Name, arg1.Sel.Name)
						return true
					}
				}
			}
			return true
		})
		if !initializationFound {
			pass.Reportf(funDecl.Pos(), "Expected audit log in this function, but not found, please add the audit logs or add the \"%s\" function to the white list", funDecl.Name.Name)
			return
		}
		if !logCallFound {
			pass.Reportf(funDecl.Pos(), "Expected LogAuditRec or LogAuditRecWithLevel call, but not found")
		}
		if !successCallFound {
			pass.Reportf(funDecl.Pos(), "Expected Success call, but not found")
		}
	})
	return nil, nil
}
