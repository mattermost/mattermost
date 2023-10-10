// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"go/ast"
	"go/token"

	"github.com/mattermost/mattermost/server/public/plugin/checker/internal/asthelpers"
	"github.com/mattermost/mattermost/server/public/plugin/checker/internal/version"
)

func checkAPIVersionComments(pkgPath string) (result, error) {
	pkg, err := asthelpers.GetPackage(pkgPath)
	if err != nil {
		return result{}, err
	}

	apiInterface, err := asthelpers.FindInterface("API", pkg.Syntax)
	if err != nil {
		return result{}, err
	}

	invalidMethods := findInvalidMethods(apiInterface.Methods.List)
	return result{Errors: renderErrors(pkg.Fset, invalidMethods)}, nil
}

func findInvalidMethods(methods []*ast.Field) []*ast.Field {
	var invalid []*ast.Field
	for _, m := range methods {
		if !hasValidMinimumVersionComment(m.Doc.Text()) {
			invalid = append(invalid, m)
		}
	}
	return invalid
}

func hasValidMinimumVersionComment(s string) bool {
	return version.ExtractMinimumVersionFromComment(s) != ""
}

func renderErrors(fset *token.FileSet, methods []*ast.Field) []string {
	var out []string
	for _, m := range methods {
		out = append(out, renderWithFilePosition(fset, m.Pos(), fmt.Sprintf("missing a minimum server version comment on method %s", m.Names[0].Name)))
	}
	return out
}
