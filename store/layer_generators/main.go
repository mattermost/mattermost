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

func main() {
	code := GenerateTimerLayer()

	formatedCode, err := format.Source([]byte(code))
	if err != nil {
		panic(err)
	}

	err = ioutil.WriteFile(path.Join("timer_layer.go"), formatedCode, 0644)
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
	f, err := parser.ParseFile(fset, "", src, 0)
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

						ast.Inspect(method.Type, func(expr ast.Node) bool {
							switch e := expr.(type) {
							case *ast.FuncType:
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
						metadata.Methods[methodName] = Method{Params: params, Results: results}
					}
				}
			} else if strings.HasSuffix(x.Name.Name, "Store") {
				subStoreName := strings.TrimSuffix(x.Name.Name, "Store")
				metadata.SubStores[subStoreName] = SubStore{Methods: map[string]Method{}}
				for _, method := range x.Type.(*ast.InterfaceType).Methods.List {
					methodName := method.Names[0].Name

					params := []Param{}
					results := []string{}

					ast.Inspect(method.Type, func(expr ast.Node) bool {
						switch e := expr.(type) {
						case *ast.FuncType:
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
					metadata.SubStores[subStoreName].Methods[methodName] = Method{Params: params, Results: results}
				}
			}
		}

		return true
	})

	return metadata
}

func GenerateTimerLayer() string {
	out := bytes.NewBufferString("")
	metadata := ExtractStoreMetadata()
	metadata.Name = "TimerLayer"

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

	t, err := template.New("timer-layer").Funcs(myFuncs).Parse(`
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Code generated by "make store-layers"
// DO NOT EDIT

package store

import (
	timemodule "time"

    "github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
)

type {{.Name}} struct {
	Store
	Metrics einterfaces.MetricsInterface
{{range $index, $element := .SubStores}}	{{$index}}Store {{$index}}Store
{{end}}
}

{{range $index, $element := .SubStores}}func (s *{{$.Name}}) {{$index}}() {{$index}}Store {
	return s.{{$index}}Store
}

{{end}}

{{range $index, $element := .SubStores}}type {{$.Name}}{{$index}}Store struct {
	{{$index}}Store
	Root *{{$.Name}}
}

{{end}}

{{range $substoreName, $substore := .SubStores}}
{{range $index, $element := $substore.Methods}}
func (s *{{$.Name}}{{$substoreName}}Store) {{$index}}({{$element.Params | joinParamsWithType}}) {{$element.Results | joinResultsForSignature}} {
	start := timemodule.Now()
	{{if $element.Results | len | eq 0}}
	s.{{$substoreName}}Store.{{$index}}({{$element.Params | joinParams}})
	{{ else }}
	{{$element.Results | genResultsVars}} := s.{{$substoreName}}Store.{{$index}}({{$element.Params | joinParams}})
	{{ end }}
	elapsed := float64(timemodule.Since(start)) / float64(timemodule.Second)
	if s.Root.Metrics != nil {
		success := "false"
		if {{$element.Results | errorToBoolean}} {
			success = "true"
		}
		s.Root.Metrics.ObserveStoreMethodDuration("{{$substoreName}}Store.{{$index}}", success, elapsed)
	{{ with ($element.Results | genResultsVars) -}}
	}
	return {{ . }}
	{{- else -}}
	}
	{{- end }}
}
{{end}}
{{end}}

{{range $index, $element := .Methods}}
func (s *{{$.Name}}) {{$index}}({{$element.Params | joinParamsWithType}}) {{$element.Results | joinResultsForSignature}} {
	{{if $element.Results | len | eq 0}}s.Store.{{$index}}({{$element.Params | joinParams}})
	{{ else }}return s.Store.{{$index}}({{$element.Params | joinParams}})
	{{ end}}}
{{end}}

func New{{.Name}}(childStore Store, metrics einterfaces.MetricsInterface) *{{.Name}} {
	newStore := {{.Name}}{
		Store: childStore,
		Metrics: metrics,
	}
	{{range $substoreName, $substore := .SubStores}}
	newStore.{{$substoreName}}Store = &{{$.Name}}{{$substoreName}}Store{{"{"}}{{$substoreName}}Store: childStore.{{$substoreName}}(), Root: &newStore}{{end}}
	return &newStore
}
`)
	if err != nil {
		panic(err)
	}
	err = t.Execute(out, metadata)
	if err != nil {
		panic(err)
	}
	return out.String()
}
