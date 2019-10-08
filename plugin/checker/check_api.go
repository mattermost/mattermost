// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost-server/plugin/checker/internal/asthelpers"
	"github.com/mattermost/mattermost-server/plugin/checker/internal/version"

	"github.com/pkg/errors"
	"golang.org/x/tools/go/packages"
)

func checkAPIVersionComments(pkgPath string) error {
	pkg, err := asthelpers.GetPackage(pkgPath)
	if err != nil {
		return err
	}

	apiInterface := asthelpers.FindAPIInterface(pkg.Syntax)
	if apiInterface == nil {
		return errors.Errorf("could not find API interface in package %s", pkgPath)
	}

	invalidMethods := findInvalidMethods(apiInterface.Methods.List)
	if len(invalidMethods) > 0 {
		return errors.New(renderErrorMessage(pkg, invalidMethods))
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

func renderErrorMessage(pkg *packages.Package, methods []*ast.Field) string {
	cwd, _ := os.Getwd()
	out := &bytes.Buffer{}

	for _, m := range methods {
		pos := pkg.Fset.Position(m.Pos())
		filename, err := filepath.Rel(cwd, pos.Filename)
		if err != nil {
			// If deriving a relative path fails for some reason,
			// we prefer to still print the absolute path to the file.
			filename = pos.Filename
		}
		fmt.Fprintf(out,
			"%s:%d:%d: missing a minimum server version comment\n",
			filename,
			pos.Line,
			pos.Column,
		)
	}
	return out.String()
}
