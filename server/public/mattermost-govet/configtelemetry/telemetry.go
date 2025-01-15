// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package configtelemetry

import (
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/types"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost/server/public/mattermost-govet/util"
	"golang.org/x/tools/go/analysis"
)

var (
	telemetryPkgPath = util.ServerModulePath + "/platform/telemetry"
	modelPkgPath     = util.ModelPkgPath
)

const (
	configStructName = "Config"
	telemetryPkgName = "telemetry"
)

// Analyzer reports config fields where telemetry is not sent
var Analyzer = &analysis.Analyzer{
	Name:       "configtelemetry",
	Doc:        "reports config fields where telemetry is not sent (unless it is specifically indicated  that no telemetry will be sent for that field)",
	Run:        run,
	ResultType: reflect.TypeOf(&analysis.Pass{}),
}

func run(pass *analysis.Pass) (interface{}, error) {
	if pass.Pkg.Path() != telemetryPkgPath {
		return nil, nil
	}

	// we need to find model.Config definition to parse its Type Spec
	var configObject *types.TypeName
	for _, obj := range pass.TypesInfo.Uses {
		if tn, ok := obj.(*types.TypeName); ok && obj.Name() == configStructName && obj.Pkg().Path() == modelPkgPath {
			configObject = tn
			break
		}
	}

	if configObject == nil {
		return nil, errors.New("could not find model.Config type")
	}

	if !configObject.Pos().IsValid() {
		return nil, errors.New("model.Config position is not valid")
	}

	srcFile := pass.Fset.PositionFor(configObject.Pos(), false).Filename
	file, err := parser.ParseFile(pass.Fset, srcFile, nil, parser.AllErrors|parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("could parse file %q: %w", srcFile, err)
	}

	pass.Files = append(pass.Files, file)

	configMap, err := typeFieldMap(file, configObject.Name())
	if err != nil {
		return nil, fmt.Errorf("could generate fields map: %w", err)
	}

	var allExpressions []string

	// We look at every expression in the file so that we can
	// check if the expected references exist in this package.

	// NOTE: this approach does not check if the reference (config field) is added
	// to telemetry queue, it assumes that if a config field is used in the file,
	// it probably added to the telemetry. This is a naive approach but should work.
	// Also, we can narrow down this for specific function calls, declarations etc.
	// so that we can be sure if the config field is added to telemetry but all these
	// fine tuning will require extra maintenance cost and yet, it is still possible to
	// trick the checker. Hence, it is decided to go with this broader check. This check
	// can be considered as a reminder to developers when they forget to add a field to
	// telemetry. Fortunately, further verification can be done at code reviews.
	for _, file := range pass.Files {
		if file.Name.Name != telemetryPkgName {
			continue
		}

		ast.Inspect(file, func(n ast.Node) bool {
			expr, ok := n.(ast.Expr)
			if !ok {
				return true
			}

			sel, ok := expr.(*ast.SelectorExpr)
			if !ok {
				return true
			}

			allExpressions = append(allExpressions, getFieldAccessSequence(sel))
			return true
		})
	}

	// now remove the expresions from what's expected
	for _, ref := range allExpressions {
		delete(configMap, ref)
	}

	// report remaining fields from the map
	for k, v := range configMap {
		pass.Reportf(v, "%v is not used in telemetry", k)
	}

	return pass, nil
}

// getFieldAccessSequence is used recursively to get string representation of
// a selector expression sequence. e.g. config.ServiceSettings.SiteURL
func getFieldAccessSequence(sel *ast.SelectorExpr) string {
	switch v := sel.X.(type) {
	case *ast.SelectorExpr:
		return strings.Join([]string{getFieldAccessSequence(v), sel.Sel.Name}, ".")
	default:
		return sel.Sel.Name
	}
}
