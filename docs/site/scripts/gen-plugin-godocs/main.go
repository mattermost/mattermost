// Command gen-plugin-godocs generates docs/site/data/plugin-godocs.json, the data source consumed
// by the <PluginGoDocs /> and <PluginGoExample /> React components that render the server plugin
// SDK reference (docs/develop/integrate/reference/server/index.md).
//
// It reads the server/public/plugin package directly from this monorepo. It deliberately parses
// the package with go/parser + go/doc rather than type-checking it via golang.org/x/tools/go/packages,
// so it has no dependency on the Go toolchain version required by server/public/go.mod (the docs
// site's build environment may lag behind it).
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/doc"
	"go/parser"
	"go/printer"
	"go/token"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
)

const pluginImportPath = "github.com/mattermost/mattermost/server/public/plugin"

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

func pluginPackageDir() string {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("unable to determine source file location")
	}
	repoRoot := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "..", ".."))
	return filepath.Join(repoRoot, "server", "public", "plugin")
}

func docHTML(text string) string {
	buf := &bytes.Buffer{}
	doc.ToHTML(buf, text, nil)
	return buf.String()
}

func removeDuplicates(items []string) []string {
	seen := make(map[string]bool, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			out = append(out, item)
		}
	}
	return out
}

var tagRegexp = regexp.MustCompile(`@tag\s+(\w+)\s*`)

func tags(text string) []string {
	submatches := tagRegexp.FindAllStringSubmatch(text, -1)
	out := make([]string, len(submatches))
	for i, submatch := range submatches {
		out[i] = submatch[1]
	}
	return removeDuplicates(out)
}

// builtinTypes is the set of predeclared Go types documented at https://pkg.go.dev/builtin.
var builtinTypes = map[string]bool{
	"bool": true, "byte": true, "complex128": true, "complex64": true, "error": true,
	"float32": true, "float64": true, "int": true, "int16": true, "int32": true, "int64": true,
	"int8": true, "rune": true, "string": true, "uint": true, "uint16": true, "uint32": true,
	"uint64": true, "uint8": true, "uintptr": true, "any": true,
}

// importAliases maps the local identifier a file uses for an imported package (its alias, or the
// last path segment when unaliased) to that package's full import path.
func importAliases(file *ast.File) map[string]string {
	aliases := make(map[string]string)
	for _, imp := range file.Imports {
		path := strings.Trim(imp.Path.Value, `"`)
		alias := path[strings.LastIndex(path, "/")+1:]
		if imp.Name != nil {
			alias = imp.Name.Name
		}
		aliases[alias] = path
	}
	return aliases
}

// typeString renders a field's type expression as a dotted, fully-qualified string, e.g.
// "[]*github.com/mattermost/mattermost/server/public/model.Manifest", the same shape the old
// go/types-based generator produced. Types local to the plugin package are qualified with
// pluginImportPath so the renderer can link to them the same way it links to imported types.
func typeString(expr ast.Expr, aliases map[string]string) string {
	switch x := expr.(type) {
	case *ast.StarExpr:
		return "*" + typeString(x.X, aliases)
	case *ast.ArrayType:
		return "[]" + typeString(x.Elt, aliases)
	case *ast.Ellipsis:
		return "[]" + typeString(x.Elt, aliases)
	case *ast.MapType:
		return "map[" + typeString(x.Key, aliases) + "]" + typeString(x.Value, aliases)
	case *ast.ChanType:
		return "chan " + typeString(x.Value, aliases)
	case *ast.InterfaceType:
		if x.Methods == nil || len(x.Methods.List) == 0 {
			return "interface{}"
		}
		return "interface{ ... }"
	case *ast.SelectorExpr:
		pkgIdent, ok := x.X.(*ast.Ident)
		if !ok {
			return x.Sel.Name
		}
		if path, ok := aliases[pkgIdent.Name]; ok {
			return path + "." + x.Sel.Name
		}
		return pkgIdent.Name + "." + x.Sel.Name
	case *ast.Ident:
		if builtinTypes[x.Name] || x.Name == "byte" || x.Name == "rune" {
			return x.Name
		}
		// A bare identifier that isn't a builtin must refer to a type declared in this same
		// package (plugin), since any imported type is always qualified with a selector.
		return pluginImportPath + "." + x.Name
	default:
		buf := &bytes.Buffer{}
		_ = printer.Fprint(buf, token.NewFileSet(), expr)
		return buf.String()
	}
}

func fields(list *ast.FieldList, aliases map[string]string) (out []*Field) {
	if list == nil {
		return nil
	}
	for _, x := range list.List {
		field := &Field{}
		for _, name := range x.Names {
			field.Names = append(field.Names, name.Name)
		}

		t := typeString(x.Type, aliases)
		if _, ok := x.Type.(*ast.Ellipsis); ok {
			t = "..." + strings.TrimPrefix(t, "[]")
		}
		field.Type = t

		out = append(out, field)
	}
	return out
}

func fileForPos(fset *token.FileSet, files map[string]*ast.File, pos token.Pos) *ast.File {
	name := fset.Position(pos).Filename
	return files[name]
}

func generateDocs() (*Docs, error) {
	pluginDir := pluginPackageDir()

	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, pluginDir, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	docs := &Docs{
		Examples: make(map[string]*ExampleDocs),
	}

	// Files keyed by absolute path, across both the "plugin" and "plugin_test" (external test)
	// packages, so we can recover which file a given interface method came from and resolve its
	// imports, and so examples defined in either package are picked up.
	filesByPath := make(map[string]*ast.File)
	var allFiles []*ast.File
	for _, pkg := range pkgs {
		for path, file := range pkg.Files {
			filesByPath[path] = file
			allFiles = append(allFiles, file)
		}
	}

	for _, example := range doc.Examples(allFiles...) {
		// Play is a synthesized, standalone runnable program and is preferred when available;
		// it's nil when go/doc can't build one (e.g. the example can't be wrapped as a whole
		// program), in which case Code — the example function's body, always non-nil — is used
		// instead.
		var node ast.Node = example.Play
		if example.Play == nil {
			node = example.Code
		}

		buf := &bytes.Buffer{}
		if err := printer.Fprint(buf, fset, node); err != nil {
			return nil, fmt.Errorf("failed to print example %q: %w", example.Name, err)
		}
		docs.Examples[example.Name] = &ExampleDocs{
			HTML: docHTML(example.Doc),
			Code: buf.String(),
		}
	}

	pluginPkg, ok := pkgs["plugin"]
	if !ok {
		return nil, os.ErrNotExist
	}

	godocs := doc.New(pluginPkg, pluginImportPath, doc.Mode(0))

	if godocs.Name == "plugin" && godocs.Doc != "" {
		docs.HTML = docHTML(godocs.Doc)
	}

	for _, t := range godocs.Types {
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

			file := fileForPos(fset, filesByPath, typeSpec.Pos())
			var aliases map[string]string
			if file != nil {
				aliases = importAliases(file)
			}

			allTags := make([]string, 0)
			for _, method := range iface.Methods.List {
				funcType, ok := method.Type.(*ast.FuncType)
				if !ok || len(method.Names) == 0 {
					continue
				}
				methodDocs := &MethodDocs{
					Name:       method.Names[0].Name,
					Tags:       tags(method.Doc.Text()),
					HTML:       docHTML(method.Doc.Text()),
					Parameters: fields(funcType.Params, aliases),
					Results:    fields(funcType.Results, aliases),
				}
				interfaceDocs.Methods = append(interfaceDocs.Methods, methodDocs)
				allTags = append(allTags, methodDocs.Tags...)
			}
			allTags = removeDuplicates(allTags)
			sort.Strings(allTags)
			interfaceDocs.Tags = allTags
		}
	}

	return docs, nil
}

func main() {
	docs, err := generateDocs()
	if err != nil {
		log.Fatal(err)
	}

	b, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		log.Fatal(err)
	}

	if _, err := os.Stdout.Write(b); err != nil {
		log.Fatal(err)
	}
	if _, err := os.Stdout.Write([]byte("\n")); err != nil {
		log.Fatal(err)
	}
}
