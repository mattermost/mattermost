// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wraperrors

import (
	"fmt"
	"go/ast"

	"github.com/mattermost/mattermost/server/public/mattermost-govet/util"
	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "wrapError",
	Doc:  "check for errors that are being passed in the details field of model.AppError",
	Run:  run,
}

var appErrorType = util.AppErrType

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			// Skip empty or non-CallExpr nodes
			if node == nil {
				return true
			}

			callExpr, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}

			_, function, ok := util.FunctionName(callExpr)
			if !ok || function != "NewAppError" {
				return true
			}
			if util.CheckReturnType(pass, callExpr, appErrorType) < 0 {
				return true
			}

			// make sure there are enough arguments
			if len(callExpr.Args) <= 4 {
				return true
			}

			// check the fourth argument (details)
			errorCall, ok := callExpr.Args[3].(*ast.CallExpr)
			if !ok {
				return true
			}

			receiver, function, ok := util.FunctionName(errorCall)
			if !ok || function != "Error" {
				return true
			}

			msg := fmt.Sprintf("Don't use the details field to report the original error, call model.NewAppError(...).Wrap(%s) instead", receiver)
			pass.Report(analysis.Diagnostic{
				Pos:     node.Pos(),
				End:     node.End(),
				Message: msg,
				SuggestedFixes: []analysis.SuggestedFix{
					{
						Message: "Pass the error via .Wrap(...)",
						TextEdits: []analysis.TextEdit{
							{
								Pos:     errorCall.Pos(),
								End:     errorCall.End(),
								NewText: []byte("\"\""),
							},
							{
								Pos:     callExpr.Rparen,
								End:     callExpr.Rparen,
								NewText: []byte(fmt.Sprintf(".Wrap(%s)", receiver)),
							},
						},
					},
				},
			})

			return true
		})
	}

	return nil, nil
}
