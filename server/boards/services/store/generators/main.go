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
	"io"
	"log"
	"os"
	"path"
	"strings"
	"text/template"
)

const (
	WithTransactionComment = "@withTransaction"
	ErrorType              = "error"
	StringType             = "string"
	IntType                = "int"
	Int32Type              = "int32"
	Int64Type              = "int64"
	BoolType               = "bool"
)

func isError(typeName string) bool {
	return strings.Contains(typeName, ErrorType)
}

func isString(typeName string) bool {
	return typeName == StringType
}

func isInt(typeName string) bool {
	return typeName == IntType || typeName == Int32Type || typeName == Int64Type
}

func isBool(typeName string) bool {
	return typeName == BoolType
}

func main() {
	if err := buildTransactionalStore(); err != nil {
		log.Fatal(err)
	}
}

func buildTransactionalStore() error {
	code, err := generateLayer("TransactionalStore", "transactional_store.go.tmpl")
	if err != nil {
		return err
	}
	formatedCode, err := format.Source(code)
	if err != nil {
		return err
	}

	return os.WriteFile(path.Join("sqlstore/public_methods.go"), formatedCode, 0644) //nolint:gosec
}

type methodParam struct {
	Name string
	Type string
}

type methodData struct {
	Params          []methodParam
	Results         []string
	WithTransaction bool
}

type storeMetadata struct {
	Name    string
	Methods map[string]methodData
}

var blacklistedStoreMethodNames = map[string]bool{
	"Shutdown":  true,
	"DBType":    true,
	"DBVersion": true,
}

func extractMethodMetadata(method *ast.Field, src []byte) methodData {
	params := []methodParam{}
	results := []string{}
	withTransaction := false
	ast.Inspect(method.Type, func(expr ast.Node) bool {
		//nolint:gocritic
		switch e := expr.(type) {
		case *ast.FuncType:
			if method.Doc != nil {
				for _, comment := range method.Doc.List {
					if strings.Contains(comment.Text, WithTransactionComment) {
						withTransaction = true
						break
					}
				}
			}
			if e.Params != nil {
				for _, param := range e.Params.List {
					for _, paramName := range param.Names {
						params = append(params, methodParam{Name: paramName.Name, Type: string(src[param.Type.Pos()-1 : param.Type.End()-1])})
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
	return methodData{Params: params, Results: results, WithTransaction: withTransaction}
}

func extractStoreMetadata() (*storeMetadata, error) {
	// Create the AST by parsing src.
	fset := token.NewFileSet() // positions are relative to fset

	file, err := os.Open("store.go")
	if err != nil {
		return nil, fmt.Errorf("unable to open store/store.go file: %w", err)
	}
	src, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}
	file.Close()
	f, err := parser.ParseFile(fset, "", src, parser.AllErrors|parser.ParseComments)
	if err != nil {
		return nil, err
	}

	metadata := storeMetadata{Methods: map[string]methodData{}}

	ast.Inspect(f, func(n ast.Node) bool {
		//nolint:gocritic
		switch x := n.(type) {
		case *ast.TypeSpec:
			if x.Name.Name == "Store" {
				for _, method := range x.Type.(*ast.InterfaceType).Methods.List {
					methodName := method.Names[0].Name
					if _, ok := blacklistedStoreMethodNames[methodName]; ok {
						continue
					}

					metadata.Methods[methodName] = extractMethodMetadata(method, src)
				}
			}
		}
		return true
	})

	return &metadata, nil
}

func generateLayer(name, templateFile string) ([]byte, error) {
	out := bytes.NewBufferString("")
	metadata, err := extractStoreMetadata()
	if err != nil {
		return nil, err
	}
	metadata.Name = name

	myFuncs := template.FuncMap{
		"joinResultsForSignature": func(results []string) string {
			if len(results) == 0 {
				return ""
			}
			if len(results) == 1 {
				return strings.Join(results, ", ")
			}
			return fmt.Sprintf("(%s)", strings.Join(results, ", "))
		},
		"genResultsVars": func(results []string, withNilError bool) string {
			vars := []string{}
			for i, typeName := range results {
				switch {
				case isError(typeName):
					if withNilError {
						vars = append(vars, "nil")
					} else {
						vars = append(vars, "err")
					}
				case i == 0:
					vars = append(vars, "result")
				default:
					vars = append(vars, fmt.Sprintf("resultVar%d", i))
				}
			}
			return strings.Join(vars, ", ")
		},
		"errorPresent": func(results []string) bool {
			for _, typeName := range results {
				if isError(typeName) {
					return true
				}
			}
			return false
		},
		"errorVar": func(results []string) string {
			for _, typeName := range results {
				if isError(typeName) {
					return "err"
				}
			}
			return ""
		},
		"joinParams": func(params []methodParam) string {
			paramsNames := make([]string, 0, len(params))
			for _, param := range params {
				tParams := ""
				if strings.HasPrefix(param.Type, "...") {
					tParams = "..."
				}
				paramsNames = append(paramsNames, param.Name+tParams)
			}
			return strings.Join(paramsNames, ", ")
		},
		"joinParamsWithType": func(params []methodParam) string {
			paramsWithType := []string{}
			for _, param := range params {
				switch param.Type {
				case "Container":
					paramsWithType = append(paramsWithType, fmt.Sprintf("%s store.%s", param.Name, param.Type))
				default:
					paramsWithType = append(paramsWithType, fmt.Sprintf("%s %s", param.Name, param.Type))
				}
			}
			return strings.Join(paramsWithType, ", ")
		},
		"renameStoreMethod": func(methodName string) string {
			return strings.ToLower(methodName[0:1]) + methodName[1:]
		},
		"genErrorResultsVars": func(results []string, errName string) string {
			vars := []string{}
			for _, typeName := range results {
				switch {
				case isError(typeName):
					vars = append(vars, errName)
				case isString(typeName):
					vars = append(vars, "\"\"")
				case isInt(typeName):
					vars = append(vars, "0")
				case isBool(typeName):
					vars = append(vars, "false")
				default:
					vars = append(vars, "nil")
				}
			}
			return strings.Join(vars, ", ")
		},
	}

	t := template.Must(template.New(templateFile).Funcs(myFuncs).ParseFiles("generators/" + templateFile))
	if err = t.Execute(out, metadata); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}
