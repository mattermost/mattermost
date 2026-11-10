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

	"github.com/pb33f/libopenapi"
	v3high "github.com/pb33f/libopenapi/datamodel/high/v3"
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
	// Excludes | so group-alternation patterns like {type:a|b} are left intact for splitHandlerByGroup.
	pathParamConstraintRegex = regexp.MustCompile(`\{([^:}]+):[^|}]+\}`)
	openAPIParamRegex        = regexp.MustCompile(`\{[^}]+\}`)
	IgnoredCases             = []string{"{websocket}", "api/v4/remotecluster"}
)

func init() {
	Analyzer.Flags.StringVar(&specFile, "spec", "", "Path to the OpenAPI 3 YAML spec file")
}

// formatNode converts AST node to string
func formatNode(fset *token.FileSet, node any) string {
	var typeNameBuf bytes.Buffer
	_ = printer.Fprint(&typeNameBuf, fset, node)
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

// cleanRegexp strips regex constraints from Go router path parameters so they
// can be matched against OpenAPI path templates.
// e.g., "/users/{user_id:[0-9]+}" → "/users/{user_id}"
func cleanRegexp(s string) string {
	return pathParamConstraintRegex.ReplaceAllString(s, "{$1}")
}

// matchesTemplate returns true if the OpenAPI specPath template matches handlerPath.
// Spec path parameters (e.g., {foo}) match any single non-slash segment, mirroring
// the behavior of kin-openapi's Paths.Find().
func matchesTemplate(specPath, handlerPath string) bool {
	specParts := strings.Split(strings.Trim(specPath, "/"), "/")
	handlerParts := strings.Split(strings.Trim(handlerPath, "/"), "/")
	if len(specParts) != len(handlerParts) {
		return false
	}
	for i, specPart := range specParts {
		if openAPIParamRegex.MatchString(specPart) {
			continue
		}
		if specPart != handlerParts[i] {
			return false
		}
	}
	return true
}

// findPathItem returns the path item matching handlerPath in the spec.
// It first tries exact key lookup, then falls back to template matching.
func findPathItem(paths *v3high.Paths, handlerPath string) *v3high.PathItem {
	if item := paths.PathItems.GetOrZero(handlerPath); item != nil {
		return item
	}
	for specPath, item := range paths.PathItems.FromOldest() {
		if matchesTemplate(specPath, handlerPath) {
			return item
		}
	}
	return nil
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

// getOperation returns the operation for the given HTTP method on a path item, or nil if not defined.
func getOperation(pathItem *v3high.PathItem, method string) *v3high.Operation {
	switch strings.ToUpper(method) {
	case http.MethodGet:
		return pathItem.Get
	case http.MethodPost:
		return pathItem.Post
	case http.MethodPut:
		return pathItem.Put
	case http.MethodDelete:
		return pathItem.Delete
	case http.MethodPatch:
		return pathItem.Patch
	case http.MethodHead:
		return pathItem.Head
	case http.MethodOptions:
		return pathItem.Options
	case http.MethodTrace:
		return pathItem.Trace
	}
	return nil
}

// processRouterInit checks that all Init functions defined in `names` are properly documented
func processRouterInit(pass *analysis.Pass, names []string, routerPrefixes map[string]string, paths *v3high.Paths, cm *fuzzy.Model) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(n ast.Node) bool {
			decl, ok := n.(*ast.FuncDecl)
			if !ok || !stringInSlice(decl.Name.Name, names, false) {
				return true
			}
			ast.Inspect(decl.Body, func(n ast.Node) bool {
				call, ok := n.(*ast.CallExpr)
				if !ok {
					return true
				}
				name, prefix, handle, ok := parseHandleCall(call)
				if !ok {
					return true
				}

				handler := cleanRegexp(routerPrefixes[name]) + cleanRegexp(prefix)
				if stringInSlice(handler, IgnoredCases, true) { // ignore special cases
					return true
				}
				if !strings.HasPrefix(handler, "/") {
					handler = "/" + handler
				}
				for _, h := range splitHandlerByGroup(handler) {
					for _, method := range getMethodsFromCall(call) {
						pathItem := findPathItem(paths, h)
						if pathItem == nil {
							suffix := ""
							if suggestions := cm.Suggestions(h, false); len(suggestions) > 0 {
								suffix = fmt.Sprintf(" (maybe you meant: %v)", suggestions)
							}
							pass.Reportf(handle.Pos(), "Cannot find %v method: %v in OpenAPI 3 spec.%s", h, method, suffix)
						} else if getOperation(pathItem, method) == nil {
							pass.Reportf(handle.Pos(), "Handler %v is defined with method %s, but it's not in the spec", h, method)
						}
					}
				}
				return true
			})

			return true
		})
	}
}

// expandInitFunctions adds the methods transitively called on the receiver from the given Init functions,
// so routes registered in helpers like InitChannel -> initChannelJoinRequestRoutes are checked too.
func expandInitFunctions(pass *analysis.Pass, names []string) []string {
	methods := map[string]*ast.FuncDecl{}
	for _, file := range pass.Files {
		for _, d := range file.Decls {
			if decl, ok := d.(*ast.FuncDecl); ok && decl.Recv != nil && decl.Body != nil {
				methods[decl.Name.Name] = decl
			}
		}
	}

	seen := map[string]bool{}
	queue := append([]string{}, names...)
	for len(queue) > 0 {
		name := queue[0]
		queue = queue[1:]
		if seen[name] {
			continue
		}
		seen[name] = true

		decl, ok := methods[name]
		if !ok || len(decl.Recv.List) == 0 || len(decl.Recv.List[0].Names) == 0 {
			continue
		}
		recv := decl.Recv.List[0].Names[0].Name
		ast.Inspect(decl.Body, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			sel, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			if ident, ok := sel.X.(*ast.Ident); ok && ident.Name == recv && methods[sel.Sel.Name] != nil {
				queue = append(queue, sel.Sel.Name)
			}
			return true
		})
	}

	expanded := make([]string, 0, len(seen))
	for name := range seen {
		expanded = append(expanded, name)
	}
	return expanded
}

// parseHandleCall matches calls of the form `x.BaseRoutes.<Router>.Handle("<path>", h).Methods(...)`,
// returning the router field name, the path, and the inner Handle call.
func parseHandleCall(call *ast.CallExpr) (string, string, *ast.CallExpr, bool) {
	methods, ok := call.Fun.(*ast.SelectorExpr)
	if !ok || methods.Sel.Name != "Methods" {
		return "", "", nil, false
	}
	handle, ok := methods.X.(*ast.CallExpr)
	if !ok || len(handle.Args) != 2 {
		return "", "", nil, false
	}
	handleSel, ok := handle.Fun.(*ast.SelectorExpr)
	if !ok || handleSel.Sel.Name != "Handle" {
		return "", "", nil, false
	}
	router, ok := handleSel.X.(*ast.SelectorExpr)
	if !ok {
		return "", "", nil, false
	}
	lit, ok := handle.Args[0].(*ast.BasicLit)
	if !ok {
		return "", "", nil, false
	}
	prefix, err := strconv.Unquote(lit.Value)
	if err != nil {
		return "", "", nil, false
	}
	return router.Sel.Name, prefix, handle, true
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
	ast.Inspect(decl.Body, func(n ast.Node) bool {
		stmt, ok := n.(*ast.ExprStmt)
		if !ok {
			return true
		}
		call, ok := stmt.X.(*ast.CallExpr)
		if !ok {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		ident, ok := selector.X.(*ast.Ident)
		if ok && ident.Name == "api" {
			initFunctions = append(initFunctions, selector.Sel.Name)
		}
		return true
	})

	for _, stmt := range decl.Body.List {
		switch node := stmt.(type) {
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

func run(pass *analysis.Pass) (any, error) {
	if specFile == "" {
		return nil, errors.New("Please supply a path to OpenAPI spec yaml file via -openApiSync.spec")
	}
	if _, err := os.Stat(specFile); err != nil {
		return nil, errors.Wrapf(err, "spec file does not exist")
	}
	data, err := os.ReadFile(specFile)
	if err != nil {
		return nil, errors.Wrapf(err, "Unable to read spec file")
	}
	doc, err := libopenapi.NewDocument(data)
	if err != nil {
		return nil, errors.Wrapf(err, "Unable to parse spec file. Expected OpenAPI3 format.")
	}
	model, err := doc.BuildV3Model()
	if err != nil {
		return nil, errors.Wrapf(err, "Unable to build OpenAPI3 model")
	}

	initFunctions, routerPrefixes := validateComments(pass)

	var swaggerPaths []string
	for p := range model.Model.Paths.PathItems.KeysFromOldest() {
		swaggerPaths = append(swaggerPaths, p)
	}
	fuzzyModel := fuzzy.NewModel()
	fuzzyModel.Train(swaggerPaths)

	processRouterInit(pass, expandInitFunctions(pass, initFunctions), routerPrefixes, model.Model.Paths, fuzzyModel)

	return nil, nil
}

func getMethodsFromCall(call *ast.CallExpr) []string {
	methods := make([]string, 0, len(call.Args))
	for _, arg := range call.Args {
		methods = append(methods, getMethodFromArg(arg))
	}
	return methods
}

func getMethodFromArg(methodArg ast.Expr) string {
	var method string

	if methodSelectorExpr, ok := methodArg.(*ast.SelectorExpr); ok {
		if ident, ok := methodSelectorExpr.X.(*ast.Ident); ok && ident.Name == "http" {
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
