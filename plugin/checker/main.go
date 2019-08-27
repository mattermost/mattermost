// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"go/ast"

	"golang.org/x/tools/go/packages"

	"github.com/pkg/errors"
)

func main() {
	output := os.Stderr

	pkg, err := getPackage("github.com/mattermost/mattermost-server/plugin")
	if err != nil {
		fmt.Fprintln(output, err)
		os.Exit(1)
	}

	apiInterface := findAPIInterface(pkg.Syntax)
	if apiInterface == nil {
		fmt.Fprintf(output, "could not find API interface in package path %s\n", pkg.PkgPath)
		os.Exit(1)
	}

	invalidMethods := findInvalidMethods(apiInterface.Methods.List)
	if len(invalidMethods) > 0 {
		printErrorMessage(output, pkg, invalidMethods)
		os.Exit(1)
	}
}

func getPackage(pkgPath string) (*packages.Package, error) {
	cfg := &packages.Config{
		Mode: packages.NeedName | packages.NeedTypes | packages.NeedSyntax,
	}
	pkgs, err := packages.Load(cfg, pkgPath)
	if err != nil {
		return nil, err
	}

	if len(pkgs) == 0 {
		return nil, errors.Errorf("could not find package %s", pkgPath)
	}
	return pkgs[0], nil
}

func findAPIInterface(files []*ast.File) *ast.InterfaceType {
	for _, f := range files {
		var iface *ast.InterfaceType

		ast.Inspect(f, func(n ast.Node) bool {
			if t, ok := n.(*ast.TypeSpec); ok {
				if i, ok := t.Type.(*ast.InterfaceType); ok && t.Name.Name == "API" {
					iface = i
					return false
				}
			}
			return true
		})

		if iface != nil {
			return iface
		}
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

var versionRequirementRE = regexp.MustCompile(`^Minimum server version: \d+\.\d+(\.\d+)?$`)

func hasValidMinimumVersionComment(s string) bool {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	if len(lines) > 0 {
		lastLine := lines[len(lines)-1]
		return versionRequirementRE.MatchString(lastLine)
	}
	return false
}

func printErrorMessage(out io.Writer, pkg *packages.Package, methods []*ast.Field) {
	fmt.Printf("# %s\n\n", pkg.PkgPath)

	cwd, _ := os.Getwd()

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
	fmt.Fprintln(out)
}
