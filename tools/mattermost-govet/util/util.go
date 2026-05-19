// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package util

import (
	"go/ast"
	"strings"

	"golang.org/x/tools/go/analysis"
)

const (
	ServerModulePath = "github.com/mattermost/mattermost/server/v8"
	API4PkgPath      = ServerModulePath + "/channels/api4"

	PublicModulePath = "github.com/mattermost/mattermost/server/public"
	ModelPkgPath     = PublicModulePath + "/model"

	AppErrType = "*" + ModelPkgPath + ".AppError"
)

func FunctionName(expr *ast.CallExpr) (string, string, bool) {
	switch t := expr.Fun.(type) {
	case *ast.SelectorExpr:
		receiver, ok := t.X.(*ast.Ident)
		if !ok {
			return "", "", false
		}

		return receiver.Name, t.Sel.Name, true

	case *ast.Ident:
		return "", t.Name, true
	}

	return "", "", false
}

func CheckReturnType(pass *analysis.Pass, expr ast.Expr, sample string) int {
	sample = strings.TrimSpace(sample)

	typ, ok := pass.TypesInfo.Types[expr]
	if !ok {
		return -1
	}

	list := typ.Type.String()
	list = strings.Trim(list, "()")
	parts := strings.Split(list, ",")
	for i, part := range parts {
		if sample == strings.TrimSpace(part) {
			return i
		}
	}

	return -1
}
