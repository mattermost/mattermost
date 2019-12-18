// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"go/ast"
	"go/token"
	"go/types"

	"github.com/mattermost/mattermost-server/v5/plugin/checker/internal/asthelpers"
	"github.com/mattermost/mattermost-server/v5/plugin/checker/internal/version"

	"github.com/pkg/errors"
)

func checkHelpersVersionComments(pkgPath string) (result, error) {
	pkg, err := asthelpers.GetPackage(pkgPath)
	if err != nil {
		return result{}, err
	}

	api, apiIdent, err := asthelpers.FindInterfaceWithIdent("API", pkg.Syntax)
	if err != nil {
		return result{}, err
	}

	apiObj := pkg.TypesInfo.ObjectOf(apiIdent)
	if apiObj == nil {
		return result{}, errors.New("could not find type object for API interface")
	}

	helpers, err := asthelpers.FindInterface("Helpers", pkg.Syntax)
	if err != nil {
		return result{}, err
	}

	apiVersions := mapMinimumVersionsByMethodName(api.Methods.List)

	helpersPositions := mapPositionsByMethodName(helpers.Methods.List)
	helpersVersions := mapMinimumVersionsByMethodName(helpers.Methods.List)

	implMethods := asthelpers.FindReceiverMethods("HelpersImpl", pkg.Syntax)
	implVersions := mapEffectiveVersionByMethod(pkg.TypesInfo, apiObj.Type(), apiVersions, implMethods)

	return validateMethods(pkg.Fset, helpersPositions, helpersVersions, implVersions), nil
}

func validateMethods(
	fset *token.FileSet,
	helpersPositions map[string]token.Pos,
	helpersVersions map[string]version.V,
	implVersions map[string]version.V,
) result {
	var res result

	for name, helperVer := range helpersVersions {
		pos := helpersPositions[name]

		implVer, ok := implVersions[name]
		if !ok {
			res.Errors = append(res.Errors, renderWithFilePosition(
				fset,
				pos,
				fmt.Sprintf("missing implementation for method %s", name)),
			)
			continue
		}

		if helperVer == "" {
			res.Errors = append(res.Errors, renderWithFilePosition(
				fset,
				pos,
				fmt.Sprintf("missing a minimum server version comment on method %s", name)),
			)
			continue
		}

		if helperVer == implVer {
			continue
		}

		if helperVer.LessThan(implVer) {
			res.Errors = append(res.Errors, renderWithFilePosition(
				fset,
				pos,
				fmt.Sprintf("documented minimum server version too low on method %s", name)),
			)
		} else {
			res.Warnings = append(res.Warnings, renderWithFilePosition(
				fset,
				pos,
				fmt.Sprintf("documented minimum server version too high on method %s", name)),
			)
		}
	}

	return res
}

func mapEffectiveVersionByMethod(info *types.Info, apiType types.Type, versions map[string]version.V, methods []*ast.FuncDecl) map[string]version.V {
	effectiveVersions := map[string]version.V{}
	for _, m := range methods {
		apiMethodsCalled := asthelpers.FindMethodsCalledOnType(info, apiType, m)
		effectiveVersions[m.Name.Name] = getEffectiveMinimumVersion(versions, apiMethodsCalled)
	}
	return effectiveVersions
}

func mapMinimumVersionsByMethodName(methods []*ast.Field) map[string]version.V {
	versions := map[string]version.V{}
	for _, m := range methods {
		versions[m.Names[0].Name] = version.V(version.ExtractMinimumVersionFromComment(m.Doc.Text()))
	}
	return versions
}

func mapPositionsByMethodName(methods []*ast.Field) map[string]token.Pos {
	pos := map[string]token.Pos{}
	for _, m := range methods {
		pos[m.Names[0].Name] = m.Pos()
	}
	return pos
}

func getEffectiveMinimumVersion(info map[string]version.V, methods []string) version.V {
	var highest version.V
	for _, m := range methods {
		if current, ok := info[m]; ok {
			if current.GreaterThanOrEqualTo(highest) {
				highest = current
			}
		}
	}
	return highest
}
