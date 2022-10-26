// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"log"
	"os"
	"path"
	"regexp"
	"strings"
	"text/template"

	"golang.org/x/tools/imports"
)

var (
	reserved           = []string{"AcceptLanguage", "AccountMigration", "Cluster", "Compliance", "Context", "DataRetention", "Elasticsearch", "HTTPService", "ImageProxy", "IpAddress", "Ldap", "Log", "MessageExport", "Metrics", "Notification", "NotificationsLog", "Path", "RequestId", "Saml", "Session", "SetIpAddress", "SetRequestId", "SetSession", "SetStore", "SetT", "Srv", "Store", "T", "Timezones", "UserAgent", "SetUserAgent", "SetAcceptLanguage", "SetPath", "SetContext", "SetServer", "GetT"}
	outputFile         string
	inputFiles         string
	outputFileTemplate string
	basicTypes         = map[string]bool{"int": true, "uint": true, "string": true, "float": true, "bool": true, "byte": true, "int64": true, "uint64": true, "error": true}
	textRegexp         = regexp.MustCompile(`\w+$`)
)

const (
	OpenTracingParamsMarker = "@openTracingParams"
	AppErrorType            = "*model.AppError"
	ErrorType               = "error"
)

func isError(typeName string) bool {
	return strings.Contains(typeName, AppErrorType) || strings.Contains(typeName, ErrorType)
}

func init() {
	flag.StringVar(&inputFiles, "in", path.Join("..", "app_iface.go"), "App interface file")
	flag.StringVar(&outputFile, "out", path.Join("..", "opentracing_layer.go"), "Output file")
	flag.StringVar(&outputFileTemplate, "template", "opentracing_layer.go.tmpl", "Output template file")
}

func main() {
	flag.Parse()

	code, err := generateLayer("OpenTracingAppLayer", outputFileTemplate)
	if err != nil {
		log.Fatal(err)
	}
	formattedCode, err := imports.Process(outputFile, code, &imports.Options{Comments: true})
	if err != nil {
		log.Fatal(err)
	}

	err = os.WriteFile(outputFile, formattedCode, 0644)
	if err != nil {
		log.Fatal(err)
	}
}

type methodParam struct {
	Name string
	Type string
}

type methodData struct {
	ParamsToTrace map[string]bool
	Params        []methodParam
	Results       []string
}

type storeMetadata struct {
	Name    string
	Methods map[string]methodData
}

func fixTypeName(t string) string {
	// don't want to dive into AST to parse this, add exception
	if t == "...func(*UploadFileTask)" {
		t = "...func(*suite.UploadFileTask)"
	}
	if strings.Contains(t, ".") || strings.Contains(t, "{}") || t == "map[string]any" {
		return t
	}
	typeOnly := textRegexp.FindString(t)

	if _, basicType := basicTypes[typeOnly]; !basicType {
		t = t[:len(t)-len(typeOnly)] + "app." + typeOnly
	}
	return t
}

func formatNode(src []byte, node ast.Expr) string {
	return string(src[node.Pos()-1 : node.End()-1])
}

func extractMethodMetadata(method *ast.Field, src []byte) methodData {
	params := []methodParam{}
	paramsToTrace := map[string]bool{}
	results := []string{}
	e := method.Type.(*ast.FuncType)
	if method.Doc != nil {
		for _, comment := range method.Doc.List {
			s := comment.Text
			if idx := strings.Index(s, OpenTracingParamsMarker); idx != -1 {
				for _, p := range strings.Split(s[idx+len(OpenTracingParamsMarker):], ",") {
					paramsToTrace[strings.TrimSpace(p)] = true
				}
			}

		}
	}
	if e.Params != nil {
		for _, param := range e.Params.List {
			for _, paramName := range param.Names {
				paramType := fixTypeName(formatNode(src, param.Type))
				params = append(params, methodParam{Name: paramName.Name, Type: paramType})
			}
		}
	}

	if e.Results != nil {
		for _, r := range e.Results.List {
			typeStr := fixTypeName(formatNode(src, r.Type))

			if len(r.Names) > 0 {
				for _, k := range r.Names {
					results = append(results, fmt.Sprintf("%s %s", k.Name, typeStr))
				}
			} else {
				results = append(results, typeStr)
			}
		}
	}

	for paramName := range paramsToTrace {
		found := false
		for _, param := range params {
			if param.Name == paramName || strings.HasPrefix(paramName, param.Name+".") {
				found = true
				break
			}
		}
		if !found {
			log.Fatalf("Unable to find a parameter called '%s' (method '%s') that is mentioned in the '%s' comment. Maybe it was renamed?", paramName, method.Names[0].Name, OpenTracingParamsMarker)
		}
	}
	return methodData{Params: params, Results: results, ParamsToTrace: paramsToTrace}
}

func (m *storeMetadata) extractStoreMetadata(inputFile string) error {
	// Create the AST by parsing src.
	fset := token.NewFileSet() // positions are relative to fset

	file, err := os.Open(inputFile)
	if err != nil {
		return fmt.Errorf("unable to open %s file: %w", inputFile, err)
	}

	src, err := io.ReadAll(file)
	if err != nil {
		return err
	}
	defer file.Close()

	f, err := parser.ParseFile(fset, inputFile, nil, parser.AllErrors|parser.ParseComments)
	if err != nil {
		return err
	}

	ast.Inspect(f, func(n ast.Node) bool {
		switch x := n.(type) {
		case *ast.TypeSpec:
			if x.Name.Name == "AppIFaceLegacy" || x.Name.Name == "AppIFaceSuite" {
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
					m.Methods[methodName] = extractMethodMetadata(method, src)
				}
			}
		}

		return true
	})

	if err != nil {
		return err
	}

	return nil
}

func generateLayer(name, templateFile string) ([]byte, error) {
	out := bytes.NewBufferString("")
	metadata := storeMetadata{Methods: map[string]methodData{}}
	fs := strings.Split(inputFiles, " ")
	for _, inputFile := range fs {
		err := metadata.extractStoreMetadata(inputFile)
		if err != nil {
			return nil, err
		}
	}
	metadata.Name = name

	myFuncs := template.FuncMap{
		"joinResults": func(results []string) string {
			return strings.Join(results, ", ")
		},
		"joinResultsForSignature": func(results []string) string {
			return fmt.Sprintf("(%s)", strings.Join(results, ", "))
		},
		"genResultsVars": func(results []string) string {
			vars := make([]string, 0, len(results))
			for i := range results {
				vars = append(vars, fmt.Sprintf("resultVar%d", i))
			}
			return strings.Join(vars, ", ")
		},
		"errorToBoolean": func(results []string) string {
			for i, typeName := range results {
				if isError(typeName) {
					return fmt.Sprintf("resultVar%d == nil", i)
				}
			}
			return "true"
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
			for i, typeName := range results {
				if isError(typeName) {
					return fmt.Sprintf("resultVar%d", i)
				}
			}
			return ""
		},
		"shouldTrace": func(params map[string]bool, param string) string {
			if _, ok := params[param]; ok {
				return fmt.Sprintf(`span.SetTag("%s", %s)`, param, param)
			}
			for pName := range params {
				if strings.HasPrefix(pName, param+".") {
					return fmt.Sprintf(`span.SetTag("%s", %s)`, pName, pName)
				}
			}
			return ""
		},
		"joinParams": func(params []methodParam) string {
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
		"joinParamsWithType": func(params []methodParam) string {
			paramsWithType := []string{}
			for _, param := range params {
				paramsWithType = append(paramsWithType, fmt.Sprintf("%s %s", param.Name, param.Type))
			}
			return strings.Join(paramsWithType, ", ")
		},
	}

	t := template.Must(template.New("opentracing_layer.go.tmpl").Funcs(myFuncs).ParseFiles(templateFile))
	err := t.Execute(out, metadata)
	if err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}
