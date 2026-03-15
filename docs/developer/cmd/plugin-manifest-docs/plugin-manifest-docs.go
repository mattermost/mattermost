package main

import (
	"bytes"
	"encoding/json"
	"go/ast"
	"go/doc"
	"go/importer"
	"go/token"
	"go/types"
	"log"
	"os"
	"reflect"
	"strings"

	_ "github.com/mattermost/mattermost/server/public/plugin"
	"github.com/pkg/errors"
	"golang.org/x/tools/go/packages"
)

type Type string

const (
	Array     Type = "array"
	Bool           = "bool"
	Dict           = "dict"
	Number         = "number"
	Object         = "object"
	String         = "string"
	Interface      = "interface"
)

type ObjectProperty struct {
	Name    string
	DocHTML string    `json:"DocHTML,omitempty"`
	Schema  *TypeDocs `json:"Schema,omitempty"`
}

type TypeDocs struct {
	Type             Type
	DocHTML          string            `json:"DocHTML,omitempty"`
	ObjectProperties []*ObjectProperty `json:"ObjectProperties,omitempty"`
	ValueSchema      *TypeDocs         `json:"ValueSchema,omitempty"`
}

type Docs struct {
	Schema *TypeDocs
}

func typeCheck(pkg *ast.Package, path string, fset *token.FileSet) (*types.Info, error) {
	typeConfig := types.Config{Importer: importer.For("source", nil)}
	info := &types.Info{
		Types: make(map[ast.Expr]types.TypeAndValue),
		Uses:  make(map[*ast.Ident]types.Object),
		Defs:  make(map[*ast.Ident]types.Object),
	}
	var files []*ast.File
	for _, file := range pkg.Files {
		files = append(files, file)
	}
	_, err := typeConfig.Check(path, fset, files, info)
	return info, err
}

func typeSpec(t *doc.Type) *ast.TypeSpec {
	for _, spec := range t.Decl.Specs {
		if typeSpec, ok := spec.(*ast.TypeSpec); ok {
			return typeSpec
		}
	}
	return nil
}

func docTypeDocs(t *doc.Type, typesByName map[string]*doc.Type, info *types.Info) *TypeDocs {
	ret := astTypeDocs(typeSpec(t).Type, typesByName, info)
	if ret != nil {
		buf := &bytes.Buffer{}
		doc.ToHTML(buf, t.Doc, nil)
		ret.DocHTML = buf.String()
	}
	return ret
}

func typesTypeDocs(t types.Type, typesByName map[string]*doc.Type, info *types.Info) *TypeDocs {
	switch x := t.(type) {
	case *types.Basic:
		switch x.Kind() {
		case types.String:
			return &TypeDocs{
				Type: String,
			}
		case types.Bool:
			return &TypeDocs{
				Type: Bool,
			}
		case types.Int, types.Int8, types.Int16, types.Int32, types.Int64, types.Uint,
			types.Uint8, types.Uint16, types.Uint32, types.Uint64, types.Float32, types.Float64:
			return &TypeDocs{
				Type: Number,
			}
		}
	case *types.Named:
		if obj := x.Obj(); obj.Pkg().Path() == "github.com/mattermost/mattermost/server/public/model" {
			if t, ok := typesByName[obj.Name()]; ok {
				return docTypeDocs(t, typesByName, info)
			}
		}
	}

	log.Printf("unrecognized types.Type: %T, %v", t, t)
	return nil
}

func astTypeDocs(expr ast.Expr, typesByName map[string]*doc.Type, info *types.Info) *TypeDocs {
	switch x := expr.(type) {
	case *ast.ArrayType:
		return &TypeDocs{
			Type:        Array,
			ValueSchema: astTypeDocs(x.Elt, typesByName, info),
		}
	case *ast.StructType:
		ret := &TypeDocs{
			Type: Object,
		}
		for _, field := range x.Fields.List {
			key := ""
			if tag := field.Tag; tag != nil {
				jsonTag := strings.Split(reflect.StructTag(strings.Trim(tag.Value, "`")).Get("json"), ",")
				key = jsonTag[0]
			}
			if key == "" || key == "-" {
				continue
			}
			buf := &bytes.Buffer{}
			doc.ToHTML(buf, field.Doc.Text(), nil)
			ret.ObjectProperties = append(ret.ObjectProperties, &ObjectProperty{
				Name:    key,
				DocHTML: buf.String(),
				Schema:  astTypeDocs(field.Type, typesByName, info),
			})
		}
		return ret
	case *ast.SelectorExpr:
		return astTypeDocs(x.Sel, typesByName, info)
	case *ast.StarExpr:
		return astTypeDocs(x.X, typesByName, info)
	case *ast.Ident:
		if t := info.TypeOf(x); t != nil {
			return typesTypeDocs(t, typesByName, info)
		}
	case *ast.MapType:
		return &TypeDocs{
			Type:        Dict,
			ValueSchema: astTypeDocs(x.Value, typesByName, info),
		}
	case *ast.InterfaceType:
		return &TypeDocs{
			Type: Interface,
		}
	}

	log.Printf("unrecognized ast.Expr: %T, %v", expr, expr)
	return nil
}

func generateDocs() (*Docs, error) {
	packageName := "github.com/mattermost/mattermost/server/public/model"
	config := &packages.Config{
		Mode: packages.LoadSyntax,
	}
	pkgs, err := packages.Load(config, packageName)
	if err != nil {
		return nil, errors.Wrapf(err, "Error loading package %s", packageName)
	}
	if len(pkgs) != 1 {
		return nil, errors.Errorf("Found %d packages when loading %s", len(pkgs), packageName)
	}
	pkg := pkgs[0]

	fileMap := map[string]*ast.File{}
	for i, file := range pkg.Syntax {
		fileMap[pkg.CompiledGoFiles[i]] = file
	}

	astPkg := &ast.Package{
		Name:  pkg.Name,
		Files: fileMap,
	}

	godocs := doc.New(astPkg, "model", 0)

	typesByName := make(map[string]*doc.Type)
	for _, t := range godocs.Types {
		typesByName[t.Name] = t
	}

	return &Docs{
		Schema: docTypeDocs(typesByName["Manifest"], typesByName, pkg.TypesInfo),
	}, nil
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
