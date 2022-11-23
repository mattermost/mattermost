// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/pkg/errors"
	"golang.org/x/tools/imports"
)

var excludedPluginHooks = []string{
	"FileWillBeUploaded",
	"Implemented",
	"LoadPluginConfiguration",
	"InstallPlugin",
	"LogDebug",
	"LogError",
	"LogInfo",
	"LogWarn",
	"MessageWillBePosted",
	"MessageWillBeUpdated",
	"OnActivate",
	"PluginHTTP",
	"ServeHTTP",
	"UploadData",
}

var excludedProductHooks = []string{
	"Implemented",
	"OnActivate",
	"OnDeactivate",
	"ServeHTTP",
}

type IHookEntry struct {
	FuncName string
	Args     *ast.FieldList
	Results  *ast.FieldList
}

type PluginInterfaceInfo struct {
	Hooks   []IHookEntry
	API     []IHookEntry
	FileSet *token.FileSet
}

func FieldListToFuncList(fieldList *ast.FieldList, fileset *token.FileSet) string {
	result := []string{}
	if fieldList == nil || len(fieldList.List) == 0 {
		return "()"
	}
	for _, field := range fieldList.List {
		typeNameBuffer := &bytes.Buffer{}
		err := printer.Fprint(typeNameBuffer, fileset, field.Type)
		if err != nil {
			panic(err)
		}
		typeName := typeNameBuffer.String()
		names := []string{}
		for _, name := range field.Names {
			names = append(names, name.Name)
		}
		result = append(result, strings.Join(names, ", ")+" "+typeName)
	}

	return "(" + strings.Join(result, ", ") + ")"
}

func FieldListToNames(fieldList *ast.FieldList, variadicForm bool) string {
	result := []string{}
	if fieldList == nil || len(fieldList.List) == 0 {
		return ""
	}
	for _, field := range fieldList.List {
		for _, name := range field.Names {
			paramName := name.Name
			if _, ok := field.Type.(*ast.Ellipsis); ok && variadicForm {
				paramName = fmt.Sprintf("%s...", paramName)
			}
			result = append(result, paramName)
		}
	}

	return strings.Join(result, ", ")
}

func FieldListToEncodedErrors(structPrefix string, fieldList *ast.FieldList, fileset *token.FileSet) string {
	result := []string{}
	if fieldList == nil {
		return ""
	}

	nextLetter := 'A'
	for _, field := range fieldList.List {
		typeNameBuffer := &bytes.Buffer{}
		err := printer.Fprint(typeNameBuffer, fileset, field.Type)
		if err != nil {
			panic(err)
		}

		if typeNameBuffer.String() != "error" {
			nextLetter++
			continue
		}

		name := ""
		if len(field.Names) == 0 {
			name = string(nextLetter)
			nextLetter++
		} else {
			for range field.Names {
				name += string(nextLetter)
				nextLetter++
			}
		}

		result = append(result, structPrefix+name+" = encodableError("+structPrefix+name+")")

	}

	return strings.Join(result, "\n")
}

func FieldListDestruct(structPrefix string, fieldList *ast.FieldList, fileset *token.FileSet) string {
	result := []string{}
	if fieldList == nil || len(fieldList.List) == 0 {
		return ""
	}
	nextLetter := 'A'
	for _, field := range fieldList.List {
		typeNameBuffer := &bytes.Buffer{}
		err := printer.Fprint(typeNameBuffer, fileset, field.Type)
		if err != nil {
			panic(err)
		}
		typeName := typeNameBuffer.String()
		suffix := ""
		if strings.HasPrefix(typeName, "...") {
			suffix = "..."
		}
		if len(field.Names) == 0 {
			result = append(result, structPrefix+string(nextLetter)+suffix)
			nextLetter++
		} else {
			for range field.Names {
				result = append(result, structPrefix+string(nextLetter)+suffix)
				nextLetter++
			}
		}
	}

	return strings.Join(result, ", ")
}

func FieldListToRecordSuccess(structPrefix string, fieldList *ast.FieldList) string {
	if fieldList == nil || len(fieldList.List) == 0 {
		return "true"
	}

	result := ""
	nextLetter := 'A'
	for _, field := range fieldList.List {
		typeName := baseTypeName(field.Type)
		if typeName == "error" || typeName == "AppError" {
			result = structPrefix + string(nextLetter)
			break
		}
		nextLetter++
	}

	if result == "" {
		return "true"
	}
	return fmt.Sprintf("%s == nil", result)
}

func FieldListToStructList(fieldList *ast.FieldList, fileset *token.FileSet) string {
	result := []string{}
	if fieldList == nil || len(fieldList.List) == 0 {
		return ""
	}
	nextLetter := 'A'
	for _, field := range fieldList.List {
		typeNameBuffer := &bytes.Buffer{}
		err := printer.Fprint(typeNameBuffer, fileset, field.Type)
		if err != nil {
			panic(err)
		}
		typeName := typeNameBuffer.String()
		if strings.HasPrefix(typeName, "...") {
			typeName = strings.Replace(typeName, "...", "[]", 1)
		}
		if len(field.Names) == 0 {
			result = append(result, string(nextLetter)+" "+typeName)
			nextLetter++
		} else {
			for range field.Names {
				result = append(result, string(nextLetter)+" "+typeName)
				nextLetter++
			}
		}
	}

	return strings.Join(result, "\n\t")
}

func baseTypeName(x ast.Expr) string {
	switch t := x.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.SelectorExpr:
		if _, ok := t.X.(*ast.Ident); ok {
			// only possible for qualified type names;
			// assume type is imported
			return t.Sel.Name
		}
	case *ast.ParenExpr:
		return baseTypeName(t.X)
	case *ast.StarExpr:
		return baseTypeName(t.X)
	}
	return ""
}

func goList(dir string) ([]string, error) {
	cmd := exec.Command("go", "list", "-f", "{{.Dir}}", dir)
	bytes, err := cmd.Output()
	if err != nil {
		return nil, errors.Wrap(err, "Can't list packages")
	}

	return strings.Fields(string(bytes)), nil
}

func (info *PluginInterfaceInfo) addHookMethod(method *ast.Field) {
	info.Hooks = append(info.Hooks, IHookEntry{
		FuncName: method.Names[0].Name,
		Args:     method.Type.(*ast.FuncType).Params,
		Results:  method.Type.(*ast.FuncType).Results,
	})
}

func (info *PluginInterfaceInfo) addAPIMethod(method *ast.Field) {
	info.API = append(info.API, IHookEntry{
		FuncName: method.Names[0].Name,
		Args:     method.Type.(*ast.FuncType).Params,
		Results:  method.Type.(*ast.FuncType).Results,
	})
}

func (info *PluginInterfaceInfo) makeHookInspector() func(node ast.Node) bool {
	return func(node ast.Node) bool {
		if typeSpec, ok := node.(*ast.TypeSpec); ok {
			if typeSpec.Name.Name == "Hooks" {
				for _, method := range typeSpec.Type.(*ast.InterfaceType).Methods.List {
					info.addHookMethod(method)
				}
				return false
			} else if typeSpec.Name.Name == "API" {
				for _, method := range typeSpec.Type.(*ast.InterfaceType).Methods.List {
					info.addAPIMethod(method)
				}
				return false
			}
		}
		return true
	}
}

func getPluginInfo(dir string) (*PluginInterfaceInfo, error) {
	pluginInfo := &PluginInterfaceInfo{
		Hooks:   make([]IHookEntry, 0),
		FileSet: token.NewFileSet(),
	}

	packages, err := parser.ParseDir(pluginInfo.FileSet, dir, nil, parser.ParseComments)
	if err != nil {
		log.Println("Parser error in dir "+dir+": ", err)
		return nil, err
	}

	for _, pkg := range packages {
		if pkg.Name != "plugin" {
			continue
		}

		for _, file := range pkg.Files {
			ast.Inspect(file, pluginInfo.makeHookInspector())
		}
	}

	return pluginInfo, nil
}

var hooksTemplate = `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Code generated by "make pluginapi"
// DO NOT EDIT

package plugin

{{range .HooksMethods}}

func init() {
	hookNameToId["{{.Name}}"] = {{.Name}}ID
}

type {{.Name | obscure}}Args struct {
	{{structStyle .Params}}
}

type {{.Name | obscure}}Returns struct {
	{{structStyle .Return}}
}

func (g *hooksRPCClient) {{.Name}}{{funcStyle .Params}} {{funcStyle .Return}} {
	_args := &{{.Name | obscure}}Args{ {{valuesOnly .Params}} }
	_returns := &{{.Name | obscure}}Returns{}
	if g.implemented[{{.Name}}ID] {
		if err := g.client.Call("Plugin.{{.Name}}", _args, _returns); err != nil {
			g.log.Error("RPC call {{.Name}} to plugin failed.", mlog.Err(err))
		}
	}
	{{ if .Return }} return {{destruct "_returns." .Return}} {{ end }}
}

func (s *hooksRPCServer) {{.Name}}(args *{{.Name | obscure}}Args, returns *{{.Name | obscure}}Returns) error {
	if hook, ok := s.impl.(interface {
		{{.Name}}{{funcStyle .Params}} {{funcStyle .Return}}
	}); ok {
		{{if .Return}}{{destruct "returns." .Return}} = {{end}}hook.{{.Name}}({{destruct "args." .Params}})
		{{if .Return}}{{encodeErrors "returns." .Return}}{{end -}}
	} else {
		return encodableError(fmt.Errorf("Hook {{.Name}} called but not implemented."))
	}
	return nil
}
{{end}}

{{range .APIMethods}}

type {{.Name | obscure}}Args struct {
	{{structStyle .Params}}
}

type {{.Name | obscure}}Returns struct {
	{{structStyle .Return}}
}

func (g *apiRPCClient) {{.Name}}{{funcStyle .Params}} {{funcStyle .Return}} {
	_args := &{{.Name | obscure}}Args{ {{valuesOnly .Params}} }
	_returns := &{{.Name | obscure}}Returns{}
	if err := g.client.Call("Plugin.{{.Name}}", _args, _returns); err != nil {
		log.Printf("RPC call to {{.Name}} API failed: %s", err.Error())
	}
	{{ if .Return }} return {{destruct "_returns." .Return}} {{ end }}
}

func (s *apiRPCServer) {{.Name}}(args *{{.Name | obscure}}Args, returns *{{.Name | obscure}}Returns) error {
	if hook, ok := s.impl.(interface {
		{{.Name}}{{funcStyle .Params}} {{funcStyle .Return}}
	}); ok {
		{{if .Return}}{{destruct "returns." .Return}} = {{end}}hook.{{.Name}}({{destruct "args." .Params}})
		{{if .Return}}{{encodeErrors "returns." .Return}}{{end -}}
	} else {
		return encodableError(fmt.Errorf("API {{.Name}} called but not implemented."))
	}
	return nil
}
{{end}}
`

var productHooksTemplate = `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Code generated by "make pluginapi"
// DO NOT EDIT

package plugin

{{range .HooksMethods}}
type {{.Name}}IFace interface {
	{{.Name}}{{funcStyle .Params}} {{funcStyle .Return}}
}

{{end}}

type hooksAdapter struct {
	implemented  map[int]struct{}
	productHooks any
}

func newAdapter(productHooks any) (*hooksAdapter, error) {
	a := &hooksAdapter{
		implemented:  make(map[int]struct{}),
		productHooks: productHooks,
	}
	var tt reflect.Type
	ft := reflect.TypeOf(productHooks)
	{{range .HooksMethods}}
	// Assessing the type of the productHooks if it individually implements {{.Name}} interface.
	tt = reflect.TypeOf((*{{.Name}}IFace)(nil)).Elem()

    if ft.Implements(tt) {
		a.implemented[{{.Name}}ID] = struct{}{}
	} else if _, ok := ft.MethodByName("{{.Name}}"); ok{
		return nil, errors.New("hook has {{.Name}} method but does not implement plugin.{{.Name}} interface")
	}

	{{end}}

	return a, nil
}

{{range .HooksMethods}}
func (a *hooksAdapter) {{.Name}}{{funcStyle .Params}} {{funcStyle .Return}} {
	if _, ok := a.implemented[{{.Name}}ID]; !ok {
		panic("product hooks must implement {{.Name}}")
	}

	{{if .Return}}return a.productHooks.({{.Name}}IFace).{{.Name}}({{valuesOnly .Params}}){{else}}a.productHooks.({{.Name}}IFace).{{.Name}}({{valuesOnly .Params}}){{end}}

}

{{end}}

`

var apiTimerLayerTemplate = `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Code generated by "make pluginapi"
// DO NOT EDIT

package plugin

import (
	"io"
	"net/http"
	timePkg "time"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
)

type apiTimerLayer struct {
	pluginID string
	apiImpl  API
	metrics  einterfaces.MetricsInterface
}

func (api *apiTimerLayer) recordTime(startTime timePkg.Time, name string, success bool) {
	if api.metrics != nil {
		elapsedTime := float64(timePkg.Since(startTime)) / float64(timePkg.Second)
		api.metrics.ObservePluginAPIDuration(api.pluginID, name, success, elapsedTime)
	}
}

{{range .APIMethods}}

func (api *apiTimerLayer) {{.Name}}{{funcStyle .Params}} {{funcStyle .Return}} {
	startTime := timePkg.Now()
	{{ if .Return }} {{destruct "_returns" .Return}} := {{ end }} api.apiImpl.{{.Name}}({{valuesOnly .Params}})
	api.recordTime(startTime, "{{.Name}}", {{ shouldRecordSuccess "_returns" .Return }})
	{{ if .Return }} return {{destruct "_returns" .Return}} {{ end -}}
}

{{end}}
`

var hooksTimerLayerTemplate = `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Code generated by "make pluginapi"
// DO NOT EDIT

package plugin

import (
	"io"
	"net/http"
	timePkg "time"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
)

type hooksTimerLayer struct {
	pluginID  string
	hooksImpl Hooks
	metrics   einterfaces.MetricsInterface
}

func (hooks *hooksTimerLayer) recordTime(startTime timePkg.Time, name string, success bool) {
	if hooks.metrics != nil {
		elapsedTime := float64(timePkg.Since(startTime)) / float64(timePkg.Second)
		hooks.metrics.ObservePluginHookDuration(hooks.pluginID, name, success, elapsedTime)
	}
}

{{range .HooksMethods}}

func (hooks *hooksTimerLayer) {{.Name}}{{funcStyle .Params}} {{funcStyle .Return}} {
	startTime := timePkg.Now()
	{{ if .Return }} {{destruct "_returns" .Return}} := {{ end }} hooks.hooksImpl.{{.Name}}({{valuesOnly .Params}})
	hooks.recordTime(startTime, "{{.Name}}", {{ shouldRecordSuccess "_returns" .Return }})
	{{ if .Return }} return {{destruct "_returns" .Return}} {{end -}}
}

{{end}}
`

type MethodParams struct {
	Name   string
	Params *ast.FieldList
	Return *ast.FieldList
}

type HooksTemplateParams struct {
	HooksMethods []MethodParams
	APIMethods   []MethodParams
}

func generateHooksGlue(info *PluginInterfaceInfo) {
	templateFunctions := map[string]any{
		"funcStyle":   func(fields *ast.FieldList) string { return FieldListToFuncList(fields, info.FileSet) },
		"structStyle": func(fields *ast.FieldList) string { return FieldListToStructList(fields, info.FileSet) },
		"valuesOnly":  func(fields *ast.FieldList) string { return FieldListToNames(fields, false) },
		"encodeErrors": func(structPrefix string, fields *ast.FieldList) string {
			return FieldListToEncodedErrors(structPrefix, fields, info.FileSet)
		},
		"destruct": func(structPrefix string, fields *ast.FieldList) string {
			return FieldListDestruct(structPrefix, fields, info.FileSet)
		},
		"shouldRecordSuccess": func(structPrefix string, fields *ast.FieldList) string {
			return FieldListToRecordSuccess(structPrefix, fields)
		},
		"obscure": func(name string) string {
			return "Z_" + name
		},
	}

	hooksTemplate, err := template.New("hooks").Funcs(templateFunctions).Parse(hooksTemplate)
	if err != nil {
		panic(err)
	}

	templateParams := HooksTemplateParams{}
	for _, hook := range info.Hooks {
		templateParams.HooksMethods = append(templateParams.HooksMethods, MethodParams{
			Name:   hook.FuncName,
			Params: hook.Args,
			Return: hook.Results,
		})
	}
	for _, api := range info.API {
		templateParams.APIMethods = append(templateParams.APIMethods, MethodParams{
			Name:   api.FuncName,
			Params: api.Args,
			Return: api.Results,
		})
	}
	templateResult := &bytes.Buffer{}
	hooksTemplate.Execute(templateResult, &templateParams)

	formatted, err := imports.Process("", templateResult.Bytes(), nil)
	if err != nil {
		panic(err)
	}

	if err := os.WriteFile(filepath.Join(getPluginPackageDir(), "client_rpc_generated.go"), formatted, 0664); err != nil {
		panic(err)
	}
}

func generateProductHooksInterfaces(info *PluginInterfaceInfo) {
	templateFunctions := map[string]any{
		"funcStyle":  func(fields *ast.FieldList) string { return FieldListToFuncList(fields, info.FileSet) },
		"valuesOnly": func(fields *ast.FieldList) string { return FieldListToNames(fields, false) },
	}

	templateParams := HooksTemplateParams{}
	for _, hook := range info.Hooks {
		templateParams.HooksMethods = append(templateParams.HooksMethods, MethodParams{
			Name:   hook.FuncName,
			Params: hook.Args,
			Return: hook.Results,
		})
	}

	productHooksTemplate, err := template.New("hooks").Funcs(templateFunctions).Parse(productHooksTemplate)
	if err != nil {
		panic(err)
	}

	templateResult := &bytes.Buffer{}
	productHooksTemplate.Execute(templateResult, &templateParams)

	formatted, err := imports.Process("", templateResult.Bytes(), nil)
	if err != nil {
		panic(err)
	}

	if err := os.WriteFile(filepath.Join(getPluginPackageDir(), "product_hooks_generated.go"), formatted, 0664); err != nil {
		panic(err)
	}
}

func generatePluginTimerLayer(info *PluginInterfaceInfo) {
	templateFunctions := map[string]any{
		"funcStyle":   func(fields *ast.FieldList) string { return FieldListToFuncList(fields, info.FileSet) },
		"structStyle": func(fields *ast.FieldList) string { return FieldListToStructList(fields, info.FileSet) },
		"valuesOnly":  func(fields *ast.FieldList) string { return FieldListToNames(fields, true) },
		"destruct": func(structPrefix string, fields *ast.FieldList) string {
			return FieldListDestruct(structPrefix, fields, info.FileSet)
		},
		"shouldRecordSuccess": func(structPrefix string, fields *ast.FieldList) string {
			return FieldListToRecordSuccess(structPrefix, fields)
		},
	}

	// Prepare template params
	templateParams := HooksTemplateParams{}
	for _, hook := range info.Hooks {
		templateParams.HooksMethods = append(templateParams.HooksMethods, MethodParams{
			Name:   hook.FuncName,
			Params: hook.Args,
			Return: hook.Results,
		})
	}
	for _, api := range info.API {
		templateParams.APIMethods = append(templateParams.APIMethods, MethodParams{
			Name:   api.FuncName,
			Params: api.Args,
			Return: api.Results,
		})
	}

	pluginTemplates := map[string]string{
		"api_timer_layer_generated.go":   apiTimerLayerTemplate,
		"hooks_timer_layer_generated.go": hooksTimerLayerTemplate,
	}

	for fileName, presetTemplate := range pluginTemplates {
		parsedTemplate, err := template.New("hooks").Funcs(templateFunctions).Parse(presetTemplate)
		if err != nil {
			panic(err)
		}

		templateResult := &bytes.Buffer{}
		parsedTemplate.Execute(templateResult, &templateParams)

		formatted, err := imports.Process("", templateResult.Bytes(), nil)
		if err != nil {
			panic(err)
		}

		if err := os.WriteFile(filepath.Join(getPluginPackageDir(), fileName), formatted, 0664); err != nil {
			panic(err)
		}
	}
}

func getPluginPackageDir() string {
	dirs, err := goList("github.com/mattermost/mattermost-server/v6/plugin")
	if err != nil {
		panic(err)
	} else if len(dirs) != 1 {
		panic("More than one package dir, or no dirs!")
	}

	return dirs[0]
}

func removeExcluded(info *PluginInterfaceInfo, excluded []string) *PluginInterfaceInfo {
	newIface := &PluginInterfaceInfo{
		FileSet: info.FileSet,
	}
	toBeExcluded := func(item string) bool {
		for _, exclusion := range excluded {
			if exclusion == item {
				return true
			}
		}
		return false
	}
	hooksResult := make([]IHookEntry, 0, len(info.Hooks))
	for _, hook := range info.Hooks {
		if !toBeExcluded(hook.FuncName) {
			hooksResult = append(hooksResult, hook)
		}
	}
	newIface.Hooks = hooksResult

	apiResult := make([]IHookEntry, 0, len(info.API))
	for _, api := range info.API {
		if !toBeExcluded(api.FuncName) {
			apiResult = append(apiResult, api)
		}
	}
	newIface.API = apiResult

	return newIface
}

func main() {
	pluginPackageDir := getPluginPackageDir()

	forRPC, err := getPluginInfo(pluginPackageDir)
	if err != nil {
		fmt.Println("Unable to get plugin info: " + err.Error())
	}
	log.Println("Generating product hooks interfaces")
	generateProductHooksInterfaces(removeExcluded(forRPC, excludedProductHooks))

	log.Println("Generating plugin hooks glue")
	generateHooksGlue(removeExcluded(forRPC, excludedPluginHooks))

	// Generate plugin timer layers
	log.Println("Generating plugin timer glue")
	forPlugins, err := getPluginInfo(pluginPackageDir)
	if err != nil {
		fmt.Println("Unable to get plugin info: " + err.Error())
	}
	generatePluginTimerLayer(forPlugins)
}
