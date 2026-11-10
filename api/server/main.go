package main

import (
	"bytes"
	"log"
	"os"
	"text/template"

	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"

	"github.com/pb33f/libopenapi"
	v3high "github.com/pb33f/libopenapi/datamodel/high/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"go.yaml.in/yaml/v4"
	"golang.org/x/tools/imports"
)

// exampleText defines the template in which the corresponding ExampleClient4_* body is wrapped.
const exampleText = `
package main

import (
{{- range .Imports -}}
{{- if .}}
{{"\t"}}{{.}}
{{- else}}
{{"\t"}}{{end -}}
{{- end}}
)

func main() {
{{.Body -}}
}`

func main() {
	var exampleTmpl = template.Must(template.New("example").Parse(exampleText))

	if len(os.Args) <= 1 {
		log.Fatal("Expected filename to APIv4 spec as argument")
	}

	filename := os.Args[1]
	data, err := os.ReadFile(filename)
	if err != nil {
		log.Fatalf("failed to read %s: %s", filename, err)
	}

	// Parse the Open APIv4 Spec
	document, err := libopenapi.NewDocument(data)
	if err != nil {
		log.Fatalf("Failed to parse OpenAPI spec: %s", err)
	}

	v3Model, err := document.BuildV3Model()
	if err != nil {
		log.Fatalf("cannot create v3 model from document: %s", err)
	}

	applyExamples(v3Model, exampleTmpl)

	// Re-render the file with the injected examples.
	newDocument, _, _, err := document.RenderAndReload()
	if err != nil {
		log.Fatalf("cannot render document: %s", err)
	}

	err = os.WriteFile(filename, newDocument, 0644)
	if err != nil {
		log.Fatal(err)
	}
}

func applyExamples(v3Model *libopenapi.DocumentModel[v3high.Document], tmpl *template.Template) {
	fileSet, modelFuncs, err := getModelFuncs()
	if err != nil {
		log.Fatalf("Failed to parse example funcs: %s", err)
	}

	for path := range v3Model.Model.Paths.PathItems.ValuesFromOldest() {
		applyExample(tmpl, fileSet, modelFuncs, path.Get)
		applyExample(tmpl, fileSet, modelFuncs, path.Post)
		applyExample(tmpl, fileSet, modelFuncs, path.Delete)
		applyExample(tmpl, fileSet, modelFuncs, path.Options)
		applyExample(tmpl, fileSet, modelFuncs, path.Head)
		applyExample(tmpl, fileSet, modelFuncs, path.Patch)
		applyExample(tmpl, fileSet, modelFuncs, path.Trace)
	}
}

// applyExample looks through the functions in model_test to find an ExampleClient4_* matching the
// operation's unique identifier.
func applyExample(tmpl *template.Template, fileSet *token.FileSet, exampleFuncs []modelFunc, operation *v3high.Operation) {
	// Not all of GET, POST, OPTIONS, etc. are defined for each operation.
	if operation == nil {
		return
	}

	var exampleFunction modelFunc
	var found = false
	for _, e := range exampleFuncs {
		if e.FuncDecl.Name.Name == "ExampleClient4_"+operation.OperationId {
			exampleFunction = e
			found = true
			break
		}
	}
	if !found {
		return
	}

	// Find all the imports used by the function so we can re-create a minimal example.
	var fileImports []string
	for _, i := range exampleFunction.File.Imports {
		fileImports = append(fileImports, i.Path.Value)
	}

	// Render the example body using the template.
	var body bytes.Buffer
	err := printer.Fprint(&body, fileSet, exampleFunction.FuncDecl.Body.List)
	if err != nil {
		log.Fatal(err)
	}

	data := struct {
		Imports []string
		Body    string
	}{
		fileImports,
		body.String(),
	}

	// Process the resulting Go file to get the right indention, minimal set of imports, etc.
	var unformattedExample bytes.Buffer
	if err := tmpl.Execute(&unformattedExample, data); err != nil {
		log.Fatalf("failed to render template: %v", err)
	}

	ignoredFilePath := "path"
	example, err := imports.Process(ignoredFilePath, unformattedExample.Bytes(), nil)
	if err != nil {
		log.Fatal(err)
	}

	// Inject the resulting code sample
	type codeSample struct {
		Lang   string `yaml:"lang"`
		Source string `yaml:"source"`
	}
	yamlBytes, err := yaml.Marshal([]codeSample{{Lang: "Go", Source: string(example)}})
	if err != nil {
		log.Fatalf("failed to marshal x-codeSamples: %v", err)
	}
	var samplesNode yaml.Node
	if err := yaml.Unmarshal(yamlBytes, &samplesNode); err != nil {
		log.Fatalf("failed to create yaml node for x-codeSamples: %v", err)
	}
	if operation.Extensions == nil {
		operation.Extensions = orderedmap.New[string, *yaml.Node]()
	}
	operation.Extensions.Set("x-codeSamples", samplesNode.Content[0])
}

type modelFunc struct {
	File     *ast.File
	FuncDecl *ast.FuncDecl
}

// getModelFuncs builds a fileset and function declaration set for the model/model_test packages.
func getModelFuncs() (*token.FileSet, []modelFunc, error) {
	fileSet := token.NewFileSet()
	packs, err := parser.ParseDir(fileSet, "../../server/public/model", nil, 0)
	if err != nil {
		return nil, nil, err
	}

	var examples []modelFunc
	for _, pack := range packs {
		for _, f := range pack.Files {
			for _, d := range f.Decls {
				if fn, isFn := d.(*ast.FuncDecl); isFn {
					examples = append(examples, modelFunc{f, fn})
				}
			}
		}
	}

	return fileSet, examples, nil
}
