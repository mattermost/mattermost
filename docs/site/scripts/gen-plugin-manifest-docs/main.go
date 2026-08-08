// Command gen-plugin-manifest-docs generates docs/site/data/plugin-manifest-docs.json, the data
// source consumed by the <PluginManifestDocs /> component that renders the plugin manifest
// reference (docs/develop/integrate/plugins/manifest-reference.md).
//
// Port of the old mattermost-developer-documentation repo's
// cmd/plugin-manifest-docs/plugin-manifest-docs.go, adapted to read server/public/model directly
// from this monorepo instead of importing it as an external Go module, and to walk the AST with
// go/parser + go/doc instead of type-checking with golang.org/x/tools/go/packages (see
// gen-plugin-godocs for why: it avoids requiring a Go toolchain matching server/public/go.mod's
// declared version). Because of that, type resolution only follows types declared inside the
// model package's own source (which is all model.Manifest ever references) — it doesn't resolve
// identifiers to types from other packages.
package main

import (
	"bytes"
	"encoding/json"
	"go/ast"
	"go/doc"
	"go/parser"
	"go/token"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
)

type SchemaType string

const (
	Array     SchemaType = "array"
	Bool      SchemaType = "bool"
	Dict      SchemaType = "dict"
	Number    SchemaType = "number"
	Object    SchemaType = "object"
	String    SchemaType = "string"
	Interface SchemaType = "interface"
)

type ObjectProperty struct {
	Name    string
	DocHTML string    `json:"DocHTML,omitempty"`
	Schema  *TypeDocs `json:"Schema,omitempty"`
}

type TypeDocs struct {
	Type             SchemaType
	DocHTML          string            `json:"DocHTML,omitempty"`
	ObjectProperties []*ObjectProperty `json:"ObjectProperties,omitempty"`
	ValueSchema      *TypeDocs         `json:"ValueSchema,omitempty"`
}

type Docs struct {
	Schema *TypeDocs
}

var basicTypeKinds = map[string]SchemaType{
	"string": String,
	"bool":   Bool,
	"byte":   Number,
	"rune":   Number,
	"int":    Number, "int8": Number, "int16": Number, "int32": Number, "int64": Number,
	"uint": Number, "uint8": Number, "uint16": Number, "uint32": Number, "uint64": Number,
	"float32": Number, "float64": Number,
}

func modelPackageDir() string {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("unable to determine source file location")
	}
	repoRoot := filepath.Clean(filepath.Join(filepath.Dir(thisFile), "..", "..", "..", ".."))
	return filepath.Join(repoRoot, "server", "public", "model")
}

func docHTML(text string) string {
	buf := &bytes.Buffer{}
	doc.ToHTML(buf, text, nil)
	return buf.String()
}

func typeSpecOf(t *doc.Type) *ast.TypeSpec {
	for _, spec := range t.Decl.Specs {
		if typeSpec, ok := spec.(*ast.TypeSpec); ok {
			return typeSpec
		}
	}
	return nil
}

func namedTypeDocs(t *doc.Type, typesByName map[string]*doc.Type) *TypeDocs {
	spec := typeSpecOf(t)
	if spec == nil {
		return nil
	}
	ret := exprTypeDocs(spec.Type, typesByName)
	if ret != nil {
		ret.DocHTML = docHTML(t.Doc)
	}
	return ret
}

// jsonFieldName returns the field's JSON key from its struct tag, or "" if the field has no json
// tag, is tagged `json:"-"`, or is unexported (mirroring encoding/json's own visibility rules).
func jsonFieldName(field *ast.Field) string {
	if field.Tag == nil {
		return ""
	}
	tagValue := strings.Trim(field.Tag.Value, "`")
	jsonTag := reflect.StructTag(tagValue).Get("json")
	if jsonTag == "" {
		return ""
	}
	name := strings.Split(jsonTag, ",")[0]
	if name == "-" {
		return ""
	}
	return name
}

func exprTypeDocs(expr ast.Expr, typesByName map[string]*doc.Type) *TypeDocs {
	switch x := expr.(type) {
	case *ast.StarExpr:
		return exprTypeDocs(x.X, typesByName)
	case *ast.ArrayType:
		return &TypeDocs{
			Type:        Array,
			ValueSchema: exprTypeDocs(x.Elt, typesByName),
		}
	case *ast.MapType:
		return &TypeDocs{
			Type:        Dict,
			ValueSchema: exprTypeDocs(x.Value, typesByName),
		}
	case *ast.StructType:
		ret := &TypeDocs{Type: Object}
		for _, field := range x.Fields.List {
			name := jsonFieldName(field)
			if name == "" {
				continue
			}
			ret.ObjectProperties = append(ret.ObjectProperties, &ObjectProperty{
				Name:    name,
				DocHTML: docHTML(field.Doc.Text()),
				Schema:  exprTypeDocs(field.Type, typesByName),
			})
		}
		return ret
	case *ast.SelectorExpr:
		return exprTypeDocs(x.Sel, typesByName)
	case *ast.InterfaceType:
		return &TypeDocs{Type: Interface}
	case *ast.Ident:
		if x.Name == "any" {
			return &TypeDocs{Type: Interface}
		}
		if kind, ok := basicTypeKinds[x.Name]; ok {
			return &TypeDocs{Type: kind}
		}
		if t, ok := typesByName[x.Name]; ok {
			return namedTypeDocs(t, typesByName)
		}
		log.Printf("unrecognized identifier %q (not a builtin or a model package type)", x.Name)
		return nil
	}

	log.Printf("unrecognized ast.Expr: %T", expr)
	return nil
}

func generateDocs() (*Docs, error) {
	modelDir := modelPackageDir()

	fset := token.NewFileSet()
	notTest := func(info os.FileInfo) bool { return !strings.HasSuffix(info.Name(), "_test.go") }
	pkgs, err := parser.ParseDir(fset, modelDir, notTest, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	modelPkg, ok := pkgs["model"]
	if !ok {
		return nil, os.ErrNotExist
	}

	godocs := doc.New(modelPkg, "github.com/mattermost/mattermost/server/public/model", doc.Mode(0))

	typesByName := make(map[string]*doc.Type, len(godocs.Types))
	for _, t := range godocs.Types {
		typesByName[t.Name] = t
	}

	manifestType, ok := typesByName["Manifest"]
	if !ok {
		return nil, os.ErrNotExist
	}

	return &Docs{
		Schema: namedTypeDocs(manifestType, typesByName),
	}, nil
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

	os.Stdout.Write(b)
	os.Stdout.Write([]byte("\n"))
}
