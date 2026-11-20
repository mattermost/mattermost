// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package appErrorReturn

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/tools/go/analysis"
)

const (
	modelPkgPath = "github.com/mattermost/mattermost/server/public/model"

	// ListPrefix starts every diagnostic in -list mode, so the baseline can be regenerated from vet output.
	ListPrefix = "appErrorReturn baseline entry: "
)

var Analyzer = &analysis.Analyzer{
	Name: "appErrorReturn",
	Doc:  "reports functions that return *model.AppError unless they are listed in a baseline, and baseline entries that no longer do",
	Run:  run,
}

var (
	baselinePath   string
	baselineDigest string
	scope          string
	list           bool
)

func init() {
	Analyzer.Flags.StringVar(&baselinePath, "baseline", "", "Path to the baseline file of functions still allowed to return *model.AppError; the check is disabled when empty")
	Analyzer.Flags.StringVar(&baselineDigest, "baselineDigest", "", "SHA-256 of the baseline file; go vet caches results by flags rather than file contents, so pass it to re-check when only the baseline changes")
	Analyzer.Flags.StringVar(&scope, "scope", "github.com/mattermost/mattermost/server/v8/channels/app", "Import path of the package tree to check")
	Analyzer.Flags.BoolVar(&list, "list", false, "Report every function returning *model.AppError as a baseline entry instead of checking the baseline")
}

func inScope(pkgPath string) bool {
	return pkgPath == scope || strings.HasPrefix(pkgPath, scope+"/")
}

func run(pass *analysis.Pass) (any, error) {
	if baselinePath == "" && !list {
		return nil, nil
	}

	pkgPath := pass.Pkg.Path()
	if !inScope(pkgPath) || strings.HasSuffix(pkgPath, "_test") {
		return nil, nil
	}

	found := map[string]*ast.FuncDecl{}
	var anchor token.Pos
	var pkgDir string
	for _, file := range pass.Files {
		filename := pass.Fset.Position(file.Package).Filename
		if strings.HasSuffix(filename, "_test.go") {
			continue
		}
		if !anchor.IsValid() {
			anchor = file.Name.Pos()
			pkgDir = filepath.Dir(filename)
		}
		if ast.IsGenerated(file) || filepath.Base(filename) == "plugin_api.go" {
			continue
		}
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if ok && returnsAppError(pass.TypesInfo, fn) {
				found[funcID(pkgPath, fn)] = fn
			}
		}
	}
	if !anchor.IsValid() {
		return nil, nil
	}

	if list {
		for id, fn := range found {
			pass.Reportf(fn.Name.Pos(), "%s%s", ListPrefix, id)
		}
		return nil, nil
	}

	baseline, err := loadBaseline(baselinePath)
	if err != nil {
		return nil, err
	}

	for id, fn := range found {
		if !baseline[id] {
			pass.Reportf(fn.Name.Pos(), "%s returns *model.AppError: declare the result as error instead, still returning *model.AppError values and adapting unmigrated callers with model.AsAppError, as in the \"drip: AppError -> error\" PRs", strings.TrimPrefix(id, pkgPath+"."))
		}
	}

	for id := range baseline {
		entryPkg := packageOf(id)
		switch {
		case entryPkg == pkgPath:
			if found[id] == nil {
				pass.Reportf(anchor, "baseline entry %s no longer returns *model.AppError (or no longer exists): remove it from %s", id, baselinePath)
			}
		case pkgPath == scope && inScope(entryPkg) && !hasGoFiles(filepath.Join(pkgDir, strings.TrimPrefix(entryPkg, scope+"/"))):
			pass.Reportf(anchor, "baseline entry %s belongs to a package that no longer exists: remove it from %s", id, baselinePath)
		}
	}

	return nil, nil
}

func returnsAppError(info *types.Info, fn *ast.FuncDecl) bool {
	if fn.Type.Results == nil {
		return false
	}
	for _, field := range fn.Type.Results.List {
		if isAppErrorPtr(info.TypeOf(field.Type)) {
			return true
		}
	}
	return false
}

func isAppErrorPtr(t types.Type) bool {
	ptr, ok := types.Unalias(t).(*types.Pointer)
	if !ok {
		return false
	}
	named, ok := types.Unalias(ptr.Elem()).(*types.Named)
	if !ok {
		return false
	}
	obj := named.Obj()
	return obj.Pkg() != nil && obj.Pkg().Path() == modelPkgPath && obj.Name() == "AppError"
}

// funcID returns an identifier such as "example.com/app.(*App).Foo" that survives moving code between files.
func funcID(pkgPath string, fn *ast.FuncDecl) string {
	if fn.Recv == nil || len(fn.Recv.List) == 0 {
		return pkgPath + "." + fn.Name.Name
	}

	expr := fn.Recv.List[0].Type
	pointer := false
	for {
		switch e := expr.(type) {
		case *ast.ParenExpr:
			expr = e.X
			continue
		case *ast.StarExpr:
			pointer = true
			expr = e.X
			continue
		case *ast.IndexExpr:
			expr = e.X
			continue
		case *ast.IndexListExpr:
			expr = e.X
			continue
		}
		break
	}

	recv := "?"
	if ident, ok := expr.(*ast.Ident); ok {
		recv = ident.Name
	}
	if pointer {
		recv = "(*" + recv + ")"
	}
	return pkgPath + "." + recv + "." + fn.Name.Name
}

func packageOf(id string) string {
	slash := strings.LastIndex(id, "/")
	dot := strings.Index(id[slash+1:], ".")
	if dot < 0 {
		return id
	}
	return id[:slash+1+dot]
}

func hasGoFiles(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		name := e.Name()
		if !e.IsDir() && strings.HasSuffix(name, ".go") && !strings.HasSuffix(name, "_test.go") {
			return true
		}
	}
	return false
}

func loadBaseline(path string) (map[string]bool, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read appErrorReturn baseline: %w", err)
	}
	if baselineDigest != "" {
		sum := sha256.Sum256(data)
		if got := hex.EncodeToString(sum[:]); got != baselineDigest {
			return nil, fmt.Errorf("appErrorReturn baseline %q has SHA-256 %s, but -appErrorReturn.baselineDigest is %s", path, got, baselineDigest)
		}
	}

	baseline := map[string]bool{}
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			baseline[line] = true
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read appErrorReturn baseline %q: %w", path, err)
	}
	return baseline, nil
}
