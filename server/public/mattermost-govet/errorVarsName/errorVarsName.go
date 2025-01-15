// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package errorVarsName

import (
	"go/ast"
	"strings"

	"github.com/mattermost/mattermost/server/public/mattermost-govet/util"
	"golang.org/x/tools/go/analysis"
)

const (
	appErrorString = "*" + util.ModelPkgPath + ".AppError"
)

var Analyzer = &analysis.Analyzer{
	Name: "errorVarsName",
	Doc:  "check for err and appErr var names corresponding to the expected types",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			switch x := node.(type) {
			case *ast.AssignStmt:
				for idx, lhsExpr := range x.Lhs {
					idnt, ok := lhsExpr.(*ast.Ident)
					if !ok {
						return true
					}

					if strings.HasPrefix(idnt.Name, "err") {
						if len(x.Rhs) == 1 {
							if typeAndValue, ok := pass.TypesInfo.Types[x.Rhs[0]]; ok {
								// This is needed to extract the type name string a multi-value return type
								returnTypes := strings.Split(strings.Trim(typeAndValue.Type.String(), "()"), ", ")
								if len(returnTypes) > idx && returnTypes[idx] == appErrorString {
									pass.Reportf(x.Pos(), "assigning a *model.AppError variable to a `err` prefixed variable, please use `appErr` prefixed variable name instead.")
								}
							}
						} else if len(x.Rhs) == len(x.Lhs) {
							if typeAndValue, ok := pass.TypesInfo.Types[x.Rhs[idx]]; ok && typeAndValue.Type.String() == appErrorString {
								pass.Reportf(x.Pos(), "assigning a *model.AppError variable to a `err` prefixed variable, please use `appErr` prefixed variable name instead.")
							}
						}
					} else if strings.HasPrefix(idnt.Name, "appErr") {
						if len(x.Rhs) == 1 {
							if typeAndValue, ok := pass.TypesInfo.Types[x.Rhs[0]]; ok {
								// This is needed to extract the type name string a multi-value return type
								returnTypes := strings.Split(strings.Trim(typeAndValue.Type.String(), "()"), ", ")
								if len(returnTypes) > idx && returnTypes[idx] == "error" {
									pass.Reportf(x.Pos(), "assigning a error variable to an `appErr` prefixed variable, please use `err` prefixed variable name instead.")
								}
							}
						} else if len(x.Rhs) == len(x.Lhs) {
							if typeAndValue, ok := pass.TypesInfo.Types[x.Rhs[idx]]; ok && typeAndValue.Type.String() == "error" {
								pass.Reportf(x.Pos(), "assigning a error variable to an `appErr` prefixed variable, please use `err` prefixed variable name instead.")
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
