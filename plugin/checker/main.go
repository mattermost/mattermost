package main

import (
	"fmt"
	"io"
	"os"
	"path"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"text/tabwriter"

	"go/ast"
	"go/parser"
	"go/token"

	"github.com/pkg/errors"
)

func main() {
	output := os.Stderr

	fmt.Fprint(output, "Validating plugin API minimum version comments ...\n\n")

	fset := token.NewFileSet()
	packagePath := "plugin/"

	files, err := getPackageFiles(fset, packagePath)
	if err != nil {
		fmt.Fprintln(output, err)
		os.Exit(1)
	}

	apiInterface := findAPIInterface(files)
	if apiInterface == nil {
		fmt.Fprintf(output, "could not find API interface in package path %s\n", packagePath)
		os.Exit(1)
	}

	invalidMethods := findInvalidMethods(apiInterface.Methods.List)
	if len(invalidMethods) > 0 {
		fmt.Fprintln(output, "[FAILED] Some method comments are invalid.")
		printErrorMessage(output, fset, invalidMethods)
		os.Exit(1)
	}

	fmt.Fprintln(output, "[PASSED] All method comments are valid.")
}

func getPackageFiles(fset *token.FileSet, packagePath string) ([]*ast.File, error) {
	// Switch to project root so we can have clean relative paths in the parser output
	if err := chdirToProjectRoot(); err != nil {
		return nil, errors.Wrap(err, "error changing working directory to project root")
	}

	pkgs, err := parser.ParseDir(fset, packagePath, nil, parser.ParseComments|parser.AllErrors)
	if err != nil {
		return nil, errors.Wrapf(err, "error parsing files in package path `%s`", packagePath)
	}

	var files []*ast.File
	for _, pkg := range pkgs {
		for _, f := range pkg.Files {
			files = append(files, f)
		}
	}
	return files, nil
}

func findAPIInterface(files []*ast.File) *ast.InterfaceType {
	for _, f := range files {
		if iface := findAPIInterfaceInFile(f); iface != nil {
			return iface
		}
	}
	return nil
}

func findAPIInterfaceInFile(f *ast.File) *ast.InterfaceType {
	var iface *ast.InterfaceType
	ast.Inspect(f, func(n ast.Node) bool {
		if t, ok := n.(*ast.TypeSpec); ok {
			if i, ok := t.Type.(*ast.InterfaceType); ok && t.Name.Name == "API" {
				iface = i
				return false
			}
		}
		return true
	})
	return iface
}

func findInvalidMethods(methods []*ast.Field) []*ast.Field {
	var invalid []*ast.Field
	for _, m := range methods {
		if !hasValidMinimumVersionComment(m.Doc.Text()) {
			invalid = append(invalid, m)
		}
	}
	return invalid
}

var versionRequirementRE = regexp.MustCompile(`^Minimum server version: \d+\.\d+(\.\d+)?$`)

func hasValidMinimumVersionComment(s string) bool {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	if len(lines) > 0 {
		lastLine := lines[len(lines)-1]
		return versionRequirementRE.MatchString(lastLine)
	}
	return false
}

func printErrorMessage(out io.Writer, fset *token.FileSet, methods []*ast.Field) {
	filename := fset.Position(methods[0].Pos()).Filename

	fmt.Fprintf(out, `
Some API interface methods in %s are missing a valid minimum version comment.
This comment should be on the last line of the method doc, following this example:

    // CreateTeam creates a team.
    //
    // Minimum server version: 5.2
    CreateTeam(team *model.Team) (*model.Team, *model.AppError)

Affected methods:

`, filename)

	byMethodName := func(i, j int) bool {
		return strings.Compare(methods[i].Names[0].Name, methods[j].Names[0].Name) < 0
	}
	sort.Slice(methods, byMethodName)
	printMethods(out, fset, methods)
	fmt.Fprintln(out)
}

func printMethods(out io.Writer, f *token.FileSet, methods []*ast.Field) {
	w := tabwriter.NewWriter(out, 0, 1, 4, ' ', 0)
	for _, m := range methods {
		pos := f.Position(m.Pos())
		fmt.Fprintf(w,
			"    %s\t%s:%d:%d\n",
			m.Names[0].Name,
			pos.Filename,
			pos.Line,
			pos.Column,
		)
	}
	w.Flush()
}

func chdirToProjectRoot() error {
	_, filename, _, ok := runtime.Caller(1)
	if !ok {
		return errors.New("could not determine current executable's path")
	}

	dir := path.Dir(filename)
	if err := os.Chdir(path.Join(dir, "..", "..")); err != nil {
		return err
	}
	return nil
}
