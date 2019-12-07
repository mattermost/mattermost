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
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/pkg/errors"
)

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

func FieldListToNames(fieldList *ast.FieldList, fileset *token.FileSet) string {
	result := []string{}
	if fieldList == nil || len(fieldList.List) == 0 {
		return ""
	}
	for _, field := range fieldList.List {
		for _, name := range field.Names {
			result = append(result, name.Name)
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
	hookNameToId["{{.Name}}"] = {{.Name}}Id
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
	if g.implemented[{{.Name}}Id] {
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
		{{if .Return}}{{encodeErrors "returns." .Return}}{{end}}
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
	} else {
		return encodableError(fmt.Errorf("API {{.Name}} called but not implemented."))
	}
	return nil
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

func generateGlue(info *PluginInterfaceInfo) {
	templateFunctions := map[string]interface{}{
		"funcStyle":   func(fields *ast.FieldList) string { return FieldListToFuncList(fields, info.FileSet) },
		"structStyle": func(fields *ast.FieldList) string { return FieldListToStructList(fields, info.FileSet) },
		"valuesOnly":  func(fields *ast.FieldList) string { return FieldListToNames(fields, info.FileSet) },
		"encodeErrors": func(structPrefix string, fields *ast.FieldList) string {
			return FieldListToEncodedErrors(structPrefix, fields, info.FileSet)
		},
		"destruct": func(structPrefix string, fields *ast.FieldList) string {
			return FieldListDestruct(structPrefix, fields, info.FileSet)
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

	importsBuffer := &bytes.Buffer{}
	cmd := exec.Command("goimports")
	cmd.Stdin = templateResult
	cmd.Stdout = importsBuffer
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		panic(err)
	}

	if err := ioutil.WriteFile(filepath.Join(getPluginPackageDir(), "client_rpc_generated.go"), importsBuffer.Bytes(), 0664); err != nil {
		panic(err)
	}
}

func getPluginPackageDir() string {
	dirs, err := goList("github.com/mattermost/mattermost-server/v5/plugin")
	if err != nil {
		panic(err)
	} else if len(dirs) != 1 {
		panic("More than one package dir, or no dirs!")
	}

	return dirs[0]
}

func removeExcluded(info *PluginInterfaceInfo) *PluginInterfaceInfo {
	toBeExcluded := func(item string) bool {
		excluded := []string{
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
		}
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
	info.Hooks = hooksResult

	apiResult := make([]IHookEntry, 0, len(info.API))
	for _, api := range info.API {
		if !toBeExcluded(api.FuncName) {
			apiResult = append(apiResult, api)
		}
	}
	info.API = apiResult

	return info
}

func main() {
	pluginPackageDir := getPluginPackageDir()

	log.Println("Generating plugin glue")
	info, err := getPluginInfo(pluginPackageDir)
	if err != nil {
		fmt.Println("Unable to get plugin info: " + err.Error())
	}

	info = removeExcluded(info)

	generateGlue(info)
}
