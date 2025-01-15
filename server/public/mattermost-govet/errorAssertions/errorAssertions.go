// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package errorAssertions

import (
	"go/ast"

	"github.com/mattermost/mattermost/server/public/mattermost-govet/util"
	"golang.org/x/tools/go/analysis"
)

var appErrorType = util.AppErrType

var Analyzer = &analysis.Analyzer{
	Name: "errorAssertions",
	Doc:  "check for (require/assert).Nil/NotNil(t, error)",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	checks := []struct {
		AssertionName     string
		ForbiddenTypeName string
		ExpectedAssertion string
	}{
		{"Nil", "error", "NoError"},
		{"NotNil", "error", "Error"},
		{"Nilf", "error", "NoErrorf"},
		{"NotNilf", "error", "Errorf"},
		{"Error", appErrorType, "NotNil"},
		{"NoError", appErrorType, "Nil"},
		{"Errorf", appErrorType, "NotNilf"},
		{"NoErrorf", appErrorType, "Nilf"},
	}

	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			switch x := node.(type) {
			case *ast.CallExpr:
				callExpr, _ := node.(*ast.CallExpr)
				fun, ok := x.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}

				idnt, ok := fun.X.(*ast.Ident)
				if !ok {
					return true
				}

				if (idnt.Name == "require" || idnt.Name == "assert") && len(callExpr.Args) > 1 {
					for _, check := range checks {
						if fun.Sel.Name == check.AssertionName {
							if typeAndValue, ok := pass.TypesInfo.Types[callExpr.Args[1]]; ok && typeAndValue.Type.String() == check.ForbiddenTypeName {
								pass.Reportf(callExpr.Pos(), "calling %s.%s on %s, please use %s.%s instead", idnt.Name, check.AssertionName, check.ForbiddenTypeName, idnt.Name, check.ExpectedAssertion)
								return false
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
