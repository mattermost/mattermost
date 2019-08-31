// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"go/ast"
	"os"
	"regexp"
	"strings"

	"github.com/pkg/errors"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/singlechecker"
)

const pluginPackagePath = "github.com/mattermost/mattermost-server/plugin"

func main() {
	// Force CLI args to run against plugin package
	os.Args = []string{os.Args[0], pluginPackagePath}

	singlechecker.Main(&analysis.Analyzer{
		Doc:  "Checks if API commens contain a minimum server version",
		Name: "plugin_api_comment_checker",
		Run:  run,
	})
}

func run(p *analysis.Pass) (interface{}, error) {
	// The analyzer does separate passes against only the test files in the package,
	// so we skip them because the API interface won't be found there.
	if p.Pkg.Path() != pluginPackagePath {
		return nil, nil
	}

	apiInterface := findAPIInterface(p.Files)
	if apiInterface == nil {
		return nil, errors.New("could not find API interface")
	}

	invalidMethods := findInvalidMethods(apiInterface.Methods.List)
	if len(invalidMethods) > 0 {
		for _, m := range invalidMethods {
			p.Reportf(m.Pos(), "missing a minimum server version comment")
		}
	}
	return nil, nil
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
