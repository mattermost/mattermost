// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/ioutil"
	"os"
	"path"
	"strings"
	"text/template"

	"golang.org/x/tools/imports"
)

var reserved = []string{"AcceptLanguage", "AccountMigration", "Cluster", "Compliance", "Context", "DataRetention", "Elasticsearch", "HTTPService", "ImageProxy", "IpAddress", "Ldap", "Log", "MessageExport", "Metrics", "Notification", "NotificationsLog", "Path", "RequestId", "Saml", "Session", "SetIpAddress", "SetRequestId", "SetSession", "SetStore", "SetT", "Srv", "Store", "T", "Timezones", "UserAgent", "SetUserAgent", "SetAcceptLanguage", "SetPath", "SetContext", "SetServer", "GetT"}

func main() {
	BuildOpenTracingAppLayer()
}

func BuildOpenTracingAppLayer() {
	code := GenerateLayer("OpenTracingAppLayer", "opentracing_layer.go.tmpl")
	outputFile := path.Join("..", "opentracing_layer.go")
	formattedCode, err := imports.Process(outputFile, []byte(code), &imports.Options{Comments: true})
	if err != nil {
		panic(err)
	}

	err = ioutil.WriteFile(outputFile, formattedCode, 0644)
	if err != nil {
		panic(err)
	}
}

type Param struct {
	Name string
	Type string
}

type Method struct {
	Params  []Param
	Results []string
}

type StoreMetadata struct {
	Name    string
	Methods map[string]Method
}

func formatNode(src []byte, node ast.Expr) string {
	return string(src[node.Pos()-1 : node.End()-1])
}

func ExtractStoreMetadata() StoreMetadata {

	// Create the AST by parsing src.
	fset := token.NewFileSet() // positions are relative to fset

	file, err := os.Open("../app_iface.go")
	if err != nil {
		panic("Unable to open app/app_iface.go file")
	}
	src, err := ioutil.ReadAll(file)
	if err != nil {
		panic(err)
	}
	defer file.Close()
	f, err := parser.ParseFile(fset, "../app_iface.go", src, 0)
	if err != nil {
		panic(err)
	}

	metadata := StoreMetadata{Methods: map[string]Method{}}

	ast.Inspect(f, func(n ast.Node) bool {
		switch x := n.(type) {
		case *ast.TypeSpec:
			if x.Name.Name == "AppIface" {
				for _, method := range x.Type.(*ast.InterfaceType).Methods.List {
					methodName := method.Names[0].Name
					found := false
					for _, reservedMethod := range reserved {
						if methodName == reservedMethod {
							found = true
							break
						}
					}
					if found {
						continue
					}
					params := []Param{}
					results := []string{}
					e := method.Type.(*ast.FuncType)
					if e.Params != nil {
						for _, param := range e.Params.List {
							for _, paramName := range param.Names {
								paramType := (formatNode(src, param.Type))
								params = append(params, Param{Name: paramName.Name, Type: paramType})
							}
						}
					}
					if e.Results != nil {
						for _, result := range e.Results.List {
							results = append(results, formatNode(src, result.Type))
						}
					}
					metadata.Methods[methodName] = Method{Params: params, Results: results}

				}
			}
		}

		return true
	})
	return metadata
}

func GenerateLayer(name, templateFile string) string {
	out := bytes.NewBufferString("")
	metadata := ExtractStoreMetadata()
	metadata.Name = name

	myFuncs := template.FuncMap{
		"joinResults": func(results []string) string {
			return strings.Join(results, ", ")
		},
		"joinResultsForSignature": func(results []string) string {
			if len(results) == 0 {
				return ""
			}
			if len(results) == 1 {
				return strings.Join(results, ", ")
			}
			return fmt.Sprintf("(%s)", strings.Join(results, ", "))
		},
		"genResultsVars": func(results []string) string {
			vars := []string{}
			for idx := range results {
				vars = append(vars, fmt.Sprintf("resultVar%d", idx))
			}
			return strings.Join(vars, ", ")
		},
		"errorToBoolean": func(results []string) string {
			for idx, typeName := range results {
				if typeName == "*model.AppError" {
					return fmt.Sprintf("resultVar%d == nil", idx)
				}
			}
			return "true"
		},
		"joinParams": func(params []Param) string {
			paramsNames := []string{}
			for _, param := range params {
				s := param.Name
				if strings.HasPrefix(param.Type, "...") {
					s += "..."
				}
				paramsNames = append(paramsNames, s)
			}
			return strings.Join(paramsNames, ", ")
		},
		"joinParamsWithType": func(params []Param) string {
			paramsWithType := []string{}
			for _, param := range params {
				paramsWithType = append(paramsWithType, fmt.Sprintf("%s %s", param.Name, param.Type))
			}
			return strings.Join(paramsWithType, ", ")
		},
	}

	t := template.Must(template.New(templateFile).Funcs(myFuncs).ParseFiles(templateFile))
	err := t.Execute(out, metadata)
	if err != nil {
		panic(err)
	}
	return out.String()
}
