package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/doc"
	"go/printer"
	"go/types"
	"log"
	"os"
	"regexp"
	"sort"
	"strings"

	"github.com/pkg/errors"
	"golang.org/x/tools/go/packages"

	_ "github.com/mattermost/mattermost/server/public/plugin"
)

type Field struct {
	Names []string `json:"Names,omitempty"`
	Type  string
}

type MethodDocs struct {
	Name       string
	Tags       []string `json:"Tags,omitempty"`
	HTML       string
	Parameters []*Field `json:"Parameters,omitempty"`
	Results    []*Field `json:"Results,omitempty"`
}

type InterfaceDocs struct {
	HTML    string
	Tags    []string `json:"Tags,omitempty"`
	Methods []*MethodDocs
}

type ExampleDocs struct {
	HTML string
	Code string
}

type Docs struct {
	HTML     string
	API      InterfaceDocs
	Hooks    InterfaceDocs
	Helpers  InterfaceDocs
	Examples map[string]*ExampleDocs
}

func docHTML(text string) string {
	buf := &bytes.Buffer{}
	doc.ToHTML(buf, text, nil)
	return buf.String()
}

func removeDuplicates(array []string) []string {
	keys := make(map[string]bool)
	set := []string{}
	for _, element := range array {
		if _, ok := keys[element]; !ok {
			keys[element] = true
			set = append(set, element)
		}
	}
	return set
}

func tags(doc string) []string {
	tagRegexp := regexp.MustCompile(`@tag\s+(\w+)\s*`)
	submatches := tagRegexp.FindAllStringSubmatch(doc, -1)
	tags := make([]string, len(submatches))
	for i, submatch := range submatches {
		tags[i] = submatch[1]
	}
	return removeDuplicates(tags)
}

func fields(list *ast.FieldList, info *types.Info) (fields []*Field) {
	if info == nil {
		panic("nil")
	}
	if list != nil {
		for _, x := range list.List {
			field := &Field{}
			for _, name := range x.Names {
				field.Names = append(field.Names, name.Name)
			}

			xType := info.TypeOf(x.Type)
			if xType == nil {
				panic(fmt.Sprintf("type of %s is nil", field.Names))
			}

			t := xType.String()

			// If type is "...", t will start with [] instead of ...
			// Replace it manually
			if _, ok := x.Type.(*ast.Ellipsis); ok {
				t = strings.Replace(t, "[]", "...", 1)
			}
			field.Type = t

			fields = append(fields, field)
		}
	}
	return
}

func generateDocs() (*Docs, error) {
	packageName := "github.com/mattermost/mattermost/server/public/plugin"
	config := &packages.Config{
		Mode:  packages.LoadSyntax,
		Tests: true,
	}
	pkgs, err := packages.Load(config, packageName)
	if err != nil {
		return nil, errors.Wrapf(err, "Error loading package %s", packageName)
	}

	docs := Docs{
		Examples: make(map[string]*ExampleDocs),
	}

	// With Tests enabled in the config above, we see up to four duplicate packages. Keep
	// track of the types seen to avoid rendering them more than once.
	seenTypes := make(map[string]bool)

	for _, pkg := range pkgs {
		for _, example := range doc.Examples(pkg.Syntax...) {
			buf := &bytes.Buffer{}
			printer.Fprint(buf, pkg.Fset, example.Play)
			docs.Examples[example.Name] = &ExampleDocs{
				HTML: docHTML(example.Doc),
				Code: buf.String(),
			}
		}

		fileMap := map[string]*ast.File{}
		for i, file := range pkg.Syntax {
			fileMap[pkg.CompiledGoFiles[i]] = file
		}

		astPkg := &ast.Package{
			Name:  pkg.Name,
			Files: fileMap,
		}

		godocs := doc.New(astPkg, pkg.PkgPath, doc.Mode(0))

		if godocs.Name == "plugin" && godocs.Doc != "" {
			docs.HTML = docHTML(godocs.Doc)
		}

		for _, t := range godocs.Types {
			if seenTypes[t.Name] {
				continue
			}
			seenTypes[t.Name] = true

			var interfaceDocs *InterfaceDocs
			switch t.Name {
			case "API":
				interfaceDocs = &docs.API
			case "Hooks":
				interfaceDocs = &docs.Hooks
			case "Helpers":
				interfaceDocs = &docs.Helpers
			default:
				continue
			}
			if t.Doc != "" {
				interfaceDocs.HTML = docHTML(t.Doc)
			}
			for _, spec := range t.Decl.Specs {
				typeSpec, ok := spec.(*ast.TypeSpec)
				if !ok {
					continue
				}
				iface, ok := typeSpec.Type.(*ast.InterfaceType)
				if !ok {
					continue
				}
				allTags := make([]string, 0)
				for _, method := range iface.Methods.List {
					f := method.Type.(*ast.FuncType)
					methodDocs := &MethodDocs{
						Name:       method.Names[0].Name,
						Tags:       tags(method.Doc.Text()),
						HTML:       docHTML(method.Doc.Text()),
						Parameters: fields(f.Params, pkg.TypesInfo),
						Results:    fields(f.Results, pkg.TypesInfo),
					}
					interfaceDocs.Methods = append(interfaceDocs.Methods, methodDocs)
					allTags = append(allTags, methodDocs.Tags...)
				}
				allTags = removeDuplicates(allTags)
				sort.Strings(allTags)
				interfaceDocs.Tags = allTags
			}
		}
	}

	return &docs, nil
}

func main() {
	docs, err := generateDocs()
	if err != nil {
		log.Fatal(err)
	}

	b, err := json.MarshalIndent(docs, "", "    ")
	if err != nil {
		log.Fatal(err)
	}

	os.Stdout.Write(b)
}
