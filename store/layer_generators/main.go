// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"io/ioutil"
	"os"
	"path"
	"strings"
	"text/template"
)

const OPEN_TRACING_PARAMS_MARKER = "@openTracingParams"

func main() {
	BuildTimerLayer()
	BuildOpenTracingLayer()
}

func BuildTimerLayer() {
	code := GenerateLayer("TimerLayer", "timer_layer.go.tmpl")

	formatedCode, err := format.Source([]byte(code))
	if err != nil {
		panic(err)
	}

	err = ioutil.WriteFile(path.Join("timer_layer.go"), formatedCode, 0644)
	if err != nil {
		panic(err)
	}
}

func BuildOpenTracingLayer() {
	code := GenerateLayer("OpenTracingLayer", "opentracing_layer.go.tmpl")

	formatedCode, err := format.Source([]byte(code))
	if err != nil {
		panic(err)
	}

	err = ioutil.WriteFile(path.Join("opentracing_layer.go"), formatedCode, 0644)
	if err != nil {
		panic(err)
	}
}

type Param struct {
	Name string
	Type string
}

type Method struct {
	Params        []Param
	Results       []string
	ParamsToTrace map[string]bool
}

type SubStore struct {
	Methods map[string]Method
}

type StoreMetadata struct {
	Name      string
	SubStores map[string]SubStore
	Methods   map[string]Method
}

func ExtractStoreMetadata() StoreMetadata {
	// Create the AST by parsing src.
	fset := token.NewFileSet() // positions are relative to fset

	file, err := os.Open("store.go")
	if err != nil {
		panic("Unable to open store/store.go file")
	}
	src, err := ioutil.ReadAll(file)
	if err != nil {
		panic(err)
	}
	file.Close()
	f, err := parser.ParseFile(fset, "", src, parser.AllErrors|parser.ParseComments)
	if err != nil {
		panic(err)
	}

	topLevelFunctions := map[string]bool{
		"MarkSystemRanUnitTests":   false,
		"Close":                    false,
		"LockToMaster":             false,
		"UnlockFromMaster":         false,
		"DropAllTables":            false,
		"TotalMasterDbConnections": true,
		"TotalReadDbConnections":   true,
		"SetContext":               true,
		"TotalSearchDbConnections": true,
		"GetCurrentSchemaVersion":  true,
	}

	metadata := StoreMetadata{Methods: map[string]Method{}, SubStores: map[string]SubStore{}}

	ast.Inspect(f, func(n ast.Node) bool {
		switch x := n.(type) {
		case *ast.TypeSpec:
			if x.Name.Name == "Store" {
				for _, method := range x.Type.(*ast.InterfaceType).Methods.List {
					methodName := method.Names[0].Name
					if _, ok := topLevelFunctions[methodName]; ok {
						params := []Param{}
						results := []string{}
						paramsToTrace := map[string]bool{}
						ast.Inspect(method.Type, func(expr ast.Node) bool {
							switch e := expr.(type) {
							case *ast.FuncType:
								if method.Doc != nil {
									for _, comment := range method.Doc.List {
										s := comment.Text
										if idx := strings.Index(s, OPEN_TRACING_PARAMS_MARKER); idx != -1 {
											for _, p := range strings.Split(s[idx+len(OPEN_TRACING_PARAMS_MARKER):], ",") {
												paramsToTrace[strings.TrimSpace(p)] = true
											}
										}
									}
								}
								if e.Params != nil {
									for _, param := range e.Params.List {
										for _, paramName := range param.Names {
											params = append(params, Param{Name: paramName.Name, Type: string(src[param.Type.Pos()-1 : param.Type.End()-1])})
										}
									}
								}
								if e.Results != nil {
									for _, result := range e.Results.List {
										results = append(results, string(src[result.Type.Pos()-1:result.Type.End()-1]))
									}
								}
							}
							return true
						})
						metadata.Methods[methodName] = Method{Params: params, Results: results, ParamsToTrace: paramsToTrace}
					}
				}
			} else if strings.HasSuffix(x.Name.Name, "Store") {
				subStoreName := strings.TrimSuffix(x.Name.Name, "Store")
				metadata.SubStores[subStoreName] = SubStore{Methods: map[string]Method{}}
				for _, method := range x.Type.(*ast.InterfaceType).Methods.List {
					methodName := method.Names[0].Name

					params := []Param{}
					results := []string{}
					paramsToTrace := map[string]bool{}

					ast.Inspect(method.Type, func(expr ast.Node) bool {
						switch e := expr.(type) {
						case *ast.FuncType:
							if method.Doc != nil {
								for _, comment := range method.Doc.List {
									s := comment.Text
									if idx := strings.Index(s, OPEN_TRACING_PARAMS_MARKER); idx != -1 {
										for _, p := range strings.Split(s[idx+len(OPEN_TRACING_PARAMS_MARKER):], ",") {
											paramsToTrace[strings.TrimSpace(p)] = true
										}
									}
								}
							}
							if e.Params != nil {
								for _, param := range e.Params.List {
									for _, paramName := range param.Names {
										params = append(params, Param{Name: paramName.Name, Type: string(src[param.Type.Pos()-1 : param.Type.End()-1])})
									}
								}
							}
							if e.Results != nil {
								for _, result := range e.Results.List {
									results = append(results, string(src[result.Type.Pos()-1:result.Type.End()-1]))
								}
							}
						}
						return true
					})
					metadata.SubStores[subStoreName].Methods[methodName] = Method{Params: params, Results: results, ParamsToTrace: paramsToTrace}
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
		"errorPresent": func(results []string) bool {
			for _, typeName := range results {
				if typeName == "*model.AppError" {
					return true
				}
			}
			return false
		},
		"errorVar": func(results []string) string {
			for idx, typeName := range results {
				if typeName == "*model.AppError" {
					return fmt.Sprintf("resultVar%d", idx)
				}
			}
			return ""
		},
		"joinParams": func(params []Param) string {
			paramsNames := []string{}
			for _, param := range params {
				paramsNames = append(paramsNames, param.Name)
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

	t := template.Must(template.New(templateFile).Funcs(myFuncs).ParseFiles("layer_generators/" + templateFile))
	err := t.Execute(out, metadata)
	if err != nil {
		panic(err)
	}
	return out.String()
}
