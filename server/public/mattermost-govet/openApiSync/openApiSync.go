// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package openApiSync

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/printer"
	"go/token"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/pkg/errors"
	"github.com/sajari/fuzzy"
	"golang.org/x/tools/go/analysis"
)

var (
	Analyzer = &analysis.Analyzer{
		Name: "openApiSync",
		Doc:  "check for inconsistencies between OpenAPI spec and the source code",
		Run:  run,
	}

	specFile         string
	groupSplitRegexp = regexp.MustCompile(`{([a-z_]*):([a-z_]*)\|([a-z_]*)}`)
	IgnoredCases     = []string{"websocket:websocket", "api/v4/remotecluster"}
)

func init() {
	Analyzer.Flags.StringVar(&specFile, "spec", "", "Path to the OpenAPI 3 YAML spec file")
}

// formatNode converts AST node to string
func formatNode(fset *token.FileSet, node interface{}) string {
	var typeNameBuf bytes.Buffer
	printer.Fprint(&typeNameBuf, fset, node)
	return typeNameBuf.String()
}

// stringInSlice checks presence of a string in a slice
func stringInSlice(str string, slice []string, partial bool) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
		if partial && strings.Contains(str, s) {
			return true
		}
	}
	return false
}

// cleanRegexp removes parts of URL path regexp to be compatible with OpenAPI paths
func cleanRegexp(s string) string {
	return strings.Replace(s, ":[A-Za-z0-9]+", "", -1)
}

// splitHandlerByGroup checks if URL path regexp contains named groups, and splits them in separate paths to be compatible with OpenAPI paths
func splitHandlerByGroup(str string) []string {
	matches := groupSplitRegexp.FindAllStringSubmatch(str, -1)
	if len(matches) != 1 {
		return []string{str}
	}
	group := matches[0][0]
	part1 := matches[0][2]
	part2 := matches[0][3]
	return []string{strings.Replace(str, group, part1, 1), strings.Replace(str, group, part2, 1)}
}

// processRouterInit checks that all Init functions defined in `names` are properly documented
func processRouterInit(pass *analysis.Pass, names []string, routerPrefixes map[string]string, swagger *openapi3.T, cm *fuzzy.Model) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(n ast.Node) bool {
			decl, ok := n.(*ast.FuncDecl)
			if !ok || !stringInSlice(decl.Name.Name, names, false) {
				return true
			}
			for _, stmt := range decl.Body.List {
				expr, ok := stmt.(*ast.ExprStmt)
				if !ok {
					continue
				}
				aexpr, ok := expr.X.(*ast.CallExpr).Fun.(*ast.SelectorExpr).X.(*ast.CallExpr)
				if !ok || len(aexpr.Args) != 2 {
					continue
				}
				prefix, _ := strconv.Unquote(aexpr.Args[0].(*ast.BasicLit).Value)
				method := getMethodFromExpr(expr)

				name := aexpr.Fun.(*ast.SelectorExpr).X.(*ast.SelectorExpr).Sel.Name
				handler := cleanRegexp(routerPrefixes[name]) + cleanRegexp(prefix)
				if stringInSlice(handler, IgnoredCases, true) { // ignore special cases
					continue
				}
				if !strings.HasPrefix(handler, "/") {
					handler = "/" + handler
				}
				for _, h := range splitHandlerByGroup(handler) {
					if path := swagger.Paths.Find(h); path == nil {
						suffix := ""
						if suggestions := cm.Suggestions(h, false); len(suggestions) > 0 {
							suffix = fmt.Sprintf(" (maybe you meant: %v)", suggestions)
						}
						pass.Reportf(aexpr.Pos(), "Cannot find %v method: %v in OpenAPI 3 spec.%s", h, method, suffix)

					} else if path.GetOperation(method) == nil {
						pass.Reportf(aexpr.Pos(), "Handler %v is defined with method %s, but it's not in the spec", h, method)
					}
				}
			}

			return true
		})
	}
}

// parseRoutesStruct scans Routes struct for mux.Router fields and scans their comments
func parseRoutesStruct(pass *analysis.Pass, decl *ast.GenDecl, routerPrefixes map[string]string) {
	spec, ok := decl.Specs[0].(*ast.TypeSpec)
	if !ok || spec.Name.String() != "Routes" {
		return
	}
	for _, f := range spec.Type.(*ast.StructType).Fields.List {
		typeName := formatNode(pass.Fset, f.Type)
		if typeName != "*mux.Router" {
			continue
		}
		routerName := f.Names[0].Name
		if routerName == "ApiRoot" || routerName == "Root" {
			continue
		}
		if f.Comment != nil && len(f.Comment.List) > 0 {
			comment := f.Comment.List[0].Text
			if strings.HasPrefix(comment, "// '") && strings.HasSuffix(comment, "'") {
				routerPrefixes[routerName] = comment[4 : len(comment)-1]
			} else {
				pass.Reportf(f.Comment.List[0].Pos(), "Comment for field %s is not formatted correctly\n", routerName)
			}
		} else {
			pass.Reportf(f.Comment.Pos(), "Router field %s in Router struct is not commented properly\n", routerName)
		}
	}
}

// parseInitFunction checks a specific Init function for proper documentation of registered API handlers
func parseInitFunction(pass *analysis.Pass, decl *ast.FuncDecl, routerPrefixes map[string]string, initFunctions []string) []string {
	for _, stmt := range decl.Body.List {
		switch node := stmt.(type) {
		case *ast.ExprStmt:
			call, ok := node.X.(*ast.CallExpr)
			if !ok {
				continue
			}
			selector, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				continue
			}
			ident, ok := selector.X.(*ast.Ident)
			if ok && ident.Name == "api" {
				initFunctions = append(initFunctions, selector.Sel.Name)
			}
		case *ast.AssignStmt:
			if len(node.Lhs) != 1 || !strings.HasPrefix(formatNode(pass.Fset, node.Lhs[0]), "api.BaseRoutes") {
				continue
			}
			subRouterName := formatNode(pass.Fset, node.Lhs[0])[15:]
			if subRouterName == "APIRoot" || subRouterName == "APIRoot5" || subRouterName == "Root" {
				continue
			}

			rhs := formatNode(pass.Fset, node.Rhs[0])[15:]
			router := rhs[:strings.Index(rhs, ".")]
			path := rhs[strings.Index(rhs, ".")+13 : strings.LastIndex(rhs, ".")-2]
			prefix := ""
			switch router {
			case "APIRoot":
				prefix = "api/v4"
			case "Root":
				prefix = ""
			default:
				if s, ok := routerPrefixes[router]; ok {
					prefix = s
				} else {
					pass.Reportf(node.Rhs[0].Pos(), "cannot find prefix for %s\n", router)
				}
			}
			s := fmt.Sprintf("%v%v", prefix, path)
			s2 := routerPrefixes[subRouterName]
			if s2 != s {
				pass.Reportf(node.Rhs[0].Pos(), "PathPrefix doesn't match field comment for field '%s': '%s' vs '%s'\n", subRouterName, s, s2)
			}
		}
	}
	return initFunctions
}

func validateComments(pass *analysis.Pass) ([]string, map[string]string) {
	initFunctions := []string{}
	routerPrefixes := map[string]string{}
	for _, file := range pass.Files {
		ast.Inspect(file, func(n ast.Node) bool {
			if decl, ok := n.(*ast.GenDecl); ok && len(decl.Specs) == 1 {
				parseRoutesStruct(pass, decl, routerPrefixes)
			} else if decl, ok := n.(*ast.FuncDecl); ok && decl.Name.Name == "Init" {
				initFunctions = parseInitFunction(pass, decl, routerPrefixes, initFunctions)
			}
			return true
		})
	}
	return initFunctions, routerPrefixes
}

func run(pass *analysis.Pass) (interface{}, error) {
	if specFile == "" {
		return nil, errors.New("Please supply a path to OpenAPI spec yaml file via -openApiSync.spec")
	}
	if _, err := os.Stat(specFile); err != nil {
		return nil, errors.Wrapf(err, "spec file does not exist")
	}
	swagger, err := openapi3.NewLoader().LoadFromFile(specFile)
	if err != nil {
		return nil, errors.Wrapf(err, "Unable to parse spec file. Expected OpenAPI3 format.")
	}

	initFunctions, routerPrefixes := validateComments(pass)

	var swaggerPaths []string
	for p := range swagger.Paths.Map() {
		swaggerPaths = append(swaggerPaths, p)
	}
	model := fuzzy.NewModel()
	model.Train(swaggerPaths)

	processRouterInit(pass, initFunctions, routerPrefixes, swagger, model)

	return nil, nil
}

func getMethodFromExpr(expr *ast.ExprStmt) string {
	var method string
	methodArg := expr.X.(*ast.CallExpr).Args[0]

	if methodSelectorExpr, ok := methodArg.(*ast.SelectorExpr); ok {
		if methodSelectorExpr.X.(*ast.Ident).Name == "http" {
			switch methodSelectorExpr.Sel.Name {
			case "MethodGet":
				method = http.MethodGet
			case "MethodHead":
				method = http.MethodHead
			case "MethodPost":
				method = http.MethodPost
			case "MethodPut":
				method = http.MethodPut
			case "MethodPatch":
				method = http.MethodPatch
			case "MethodDelete":
				method = http.MethodDelete
			case "MethodConnect":
				method = http.MethodConnect
			case "MethodOptions":
				method = http.MethodOptions
			case "MethodTrace":
				method = http.MethodTrace
			}
		}
	} else if methodBasicLit, ok := methodArg.(*ast.BasicLit); ok {
		method, _ = strconv.Unquote(methodBasicLit.Value)
	}

	return method
}
