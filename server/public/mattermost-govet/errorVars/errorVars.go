// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package errorVars

import (
	"go/ast"
	"strings"

	"github.com/mattermost/mattermost/server/public/mattermost-govet/util"
	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "errorVars",
	Doc:  "check for non valid type assignments to err and appErr prefixed variables",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			switch x := node.(type) {
			case *ast.AssignStmt:
				for idx, lhsExpr := range x.Lhs {
					if typeAndValue, ok := pass.TypesInfo.Types[lhsExpr]; ok && typeAndValue.Type.String() == "error" {
						if len(x.Rhs) == 1 {
							// This is needed to extract the type name string a multi-value return type
							if typeAndValue, ok := pass.TypesInfo.Types[x.Rhs[0]]; ok {
								returnTypes := strings.Split(strings.Trim(typeAndValue.Type.String(), "()"), ", ")
								if len(returnTypes) > idx && returnTypes[idx] == util.AppErrType {
									pass.Reportf(x.Pos(), "assigning a *model.AppError to a `error` type variable, please create a new variable to store this value.")
								}
							}
						} else if len(x.Rhs) == len(x.Lhs) {
							if typeAndValue, ok := pass.TypesInfo.Types[x.Rhs[idx]]; ok && typeAndValue.Type.String() == util.AppErrType {
								pass.Reportf(x.Pos(), "assigning a *model.AppError to a `error` type variable, please create a new variable to store this value.")
							}
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
