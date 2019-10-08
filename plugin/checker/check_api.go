// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/token"

	"github.com/mattermost/mattermost-server/plugin/checker/internal/asthelpers"
	"github.com/mattermost/mattermost-server/plugin/checker/internal/version"

	"github.com/pkg/errors"
)

func checkAPIVersionComments(pkgPath string) error {
	pkg, err := asthelpers.GetPackage(pkgPath)
	if err != nil {
		return err
	}

	apiInterface, err := asthelpers.FindInterface("API", pkg.Syntax)
	if err != nil {
		return err
	}

	invalidMethods := findInvalidMethods(apiInterface.Methods.List)
	if len(invalidMethods) > 0 {
		return errors.New(renderErrorMessage(pkg.Fset, invalidMethods))
	}
	return nil
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

func renderErrorMessage(fset *token.FileSet, methods []*ast.Field) string {
	out := &bytes.Buffer{}
	for _, m := range methods {
		fmt.Fprintln(out, renderWithFilePosition(fset, m.Pos(), "missing a minimum server version comment"))
	}
	return out.String()
}
