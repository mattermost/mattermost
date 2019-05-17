package maker

import (
	"fmt"
	"go/ast"
	"go/doc"
	"go/parser"
	"go/token"
	"io/ioutil"
	"strings"

	"golang.org/x/tools/imports"
)

// Method describes the code and documentation
// tied into a method
type Method struct {
	Code string
	Docs []string
}

// Lines return a []string consisting of
// the documentation and code appended
// in chronological order
func (m *Method) Lines() []string {
	var lines []string
	lines = append(lines, m.Docs...)
	lines = append(lines, m.Code)
	return lines
}

// GetReceiverTypeName takes in the entire
// source code and a single declaration.
// It then checks if the declaration is a
// function declaration, if it is, it uses
// the GetReceiverType to check whether
// the declaration is a method or a function
// if it is a function we fatally stop.
// If it is a method we retrieve the type
// of the receiver based on the types
// start and end pos in combination with
// the actual source code.
// It then returns the name of the
// receiver type and the function declaration
//
// Behavior is undefined for a src []byte that
// isn't the source of the possible FuncDecl fl
func GetReceiverTypeName(src []byte, fl interface{}) (string, *ast.FuncDecl) {
	fd, ok := fl.(*ast.FuncDecl)
	if !ok {
		return "", nil
	}
	t, err := GetReceiverType(fd)
	if err != nil {
		return "", nil
	}
	st := string(src[t.Pos()-1 : t.End()-1])
	if len(st) > 0 && st[0] == '*' {
		st = st[1:]
	}
	return st, fd
}

// GetReceiverType checks if the FuncDecl
// is a function or a method. If it is a
// function it returns a nil ast.Expr and
// a non-nil err. If it is a method it uses
// a hardcoded 0 index to fetch the receiver
// because a method can only have 1 receiver.
// Which can make you wonder why it is a
// list in the first place, but this type
// from the `ast` pkg is used in other
// places than for receivers
func GetReceiverType(fd *ast.FuncDecl) (ast.Expr, error) {
	if fd.Recv == nil {
		return nil, fmt.Errorf("fd is not a method, it is a function")
	}
	return fd.Recv.List[0].Type, nil
}

// FormatFieldList takes in the source code
// as a []byte and a FuncDecl parameters or
// return values as a FieldList.
// It then returns a []string with each
// param or return value as a single string.
// If the FieldList input is nil, it returns
// nil
func FormatFieldList(src []byte, fl *ast.FieldList, pkgName string) []string {
	if fl == nil {
		return nil
	}
	var parts []string
	for _, l := range fl.List {
		names := make([]string, len(l.Names))
		for i, n := range l.Names {
			names[i] = n.Name
		}
		t := string(src[l.Type.Pos()-1 : l.Type.End()-1])
		t = strings.ReplaceAll(t, pkgName+".", "")
		if len(names) > 0 {
			typeSharingArgs := strings.Join(names, ", ")
			parts = append(parts, fmt.Sprintf("%s %s", typeSharingArgs, t))
		} else {
			parts = append(parts, t)
		}
	}
	return parts
}

// FormatCode sets the options of the imports
// pkg and then applies the Process method
// which by default removes all of the imports
// not used and formats the remaining docs,
// imports and code like `gofmt`. It will
// e.g. remove paranthesis around a unnamed
// single return type
func FormatCode(code string) ([]byte, error) {
	opts := &imports.Options{
		TabIndent: true,
		TabWidth:  2,
		Fragment:  true,
		Comments:  true,
	}
	return imports.Process("", []byte(code), opts)
}

// MakeInterface takes in all of the items
// required for generating the interface,
// it then simply concatenates them all
// to an array, joins this array to a string
// with newline and passes it on to FormatCode
// which then directly returns the result
func MakeInterface(comment, pkgName, ifaceName, ifaceComment string, methods []string, imports []string) ([]byte, error) {
	output := []string{
		"// " + comment,
		"",
		"package " + pkgName,
		"import (",
	}
	output = append(output, imports...)
	output = append(output,
		")",
		"",
	)
	if len(ifaceComment) > 0 {
		output = append(output, fmt.Sprintf("// %s", strings.Replace(ifaceComment, "\n", "\n// ", -1)))
	}
	output = append(output, fmt.Sprintf("type %s interface {", ifaceName))
	output = append(output, methods...)
	output = append(output, "}")
	code := strings.Join(output, "\n")
	return FormatCode(code)
}

// ParseStruct takes in a piece of source code as a
// []byte, the name of the struct it should base the
// interface on and a bool saying whether it should
// include docs.  It then returns an []Method where
// Method contains the method declaration(not the code)
// that is required for the interface and any documentation
// if included.
// It also returns a []string containing all of the imports
// including their aliases regardless of them being used or
// not, the imports not used will be removed later using the
// 'imports' pkg If anything goes wrong, this method will
// fatally stop the execution
func ParseStruct(src []byte, structName string, copyDocs bool, copyTypeDocs bool, pkgName string) (methods []Method, imports []string, typeDoc string, err error) {
	fset := token.NewFileSet()
	a, err := parser.ParseFile(fset, "", src, parser.ParseComments)
	if err != nil {
		return nil, nil, "", err
	}

	for _, i := range a.Imports {
		if i.Name != nil {
			imports = append(imports, fmt.Sprintf("%s %s", i.Name.String(), i.Path.Value))
		} else {
			imports = append(imports, fmt.Sprintf("%s", i.Path.Value))
		}
	}

	for _, d := range a.Decls {
		if a, fd := GetReceiverTypeName(src, d); a == structName {
			if !fd.Name.IsExported() {
				continue
			}
			params := FormatFieldList(src, fd.Type.Params, pkgName)
			ret := FormatFieldList(src, fd.Type.Results, pkgName)
			method := fmt.Sprintf("%s(%s) (%s)", fd.Name.String(), strings.Join(params, ", "), strings.Join(ret, ", "))
			var docs []string
			if fd.Doc != nil && copyDocs {
				for _, d := range fd.Doc.List {
					docs = append(docs, string(src[d.Pos()-1:d.End()-1]))
				}
			}
			methods = append(methods, Method{
				Code: method,
				Docs: docs,
			})
		}
	}

	if copyTypeDocs {
		pkg := &ast.Package{Files: map[string]*ast.File{"": a}}
		doc := doc.New(pkg, "", doc.AllDecls)
		for _, t := range doc.Types {
			if t.Name == structName {
				typeDoc = strings.TrimSuffix(t.Doc, "\n")
			}
		}
	}

	return
}

func Make(files []string, structType, comment, pkgName, ifaceName, ifaceComment string, copyDocs, copyTypeDoc bool) ([]byte, error) {
	allMethods := []string{}
	allImports := []string{}
	mset := make(map[string]struct{})
	iset := make(map[string]struct{})
	var typeDoc string
	for _, f := range files {
		src, err := ioutil.ReadFile(f)
		if err != nil {
			return nil, err
		}
		methods, imports, parsedTypeDoc, err := ParseStruct(src, structType, copyDocs, copyTypeDoc, pkgName)
		if err != nil {
			return nil, err
		}
		for _, m := range methods {
			if _, ok := mset[m.Code]; !ok {
				allMethods = append(allMethods, m.Lines()...)
				mset[m.Code] = struct{}{}
			}
		}
		for _, i := range imports {
			if _, ok := iset[i]; !ok {
				allImports = append(allImports, i)
				iset[i] = struct{}{}
			}
		}
		if typeDoc == "" {
			typeDoc = parsedTypeDoc
		}
	}

	if typeDoc != "" {
		ifaceComment = fmt.Sprintf("%s\n%s", ifaceComment, typeDoc)
	}

	result, err := MakeInterface(comment, pkgName, ifaceName, ifaceComment, allMethods, allImports)
	if err != nil {
		return nil, err
	}

	return result, nil
}
