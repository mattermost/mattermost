package logr

import (
	"runtime"
	"strings"
	"sync"
)

const (
	maximumStackDepth int = 30
)

var (
	logrPkg     string
	pkgCalcOnce sync.Once
)

// GetPackageName returns the root package name of Logr.
func GetLogrPackageName() string {
	pkgCalcOnce.Do(func() {
		logrPkg = GetPackageName("GetLogrPackageName")
	})
	return logrPkg
}

// GetPackageName returns the package name of the caller.
// `callingFuncName` should be the name of the calling function and
// should be unique enough not to collide with any runtime methods.
func GetPackageName(callingFuncName string) string {
	var pkgName string

	pcs := make([]uintptr, maximumStackDepth)
	_ = runtime.Callers(0, pcs)

	for _, pc := range pcs {
		funcName := runtime.FuncForPC(pc).Name()
		if strings.Contains(funcName, callingFuncName) {
			pkgName = ResolvePackageName(funcName)
			break
		}
	}
	return pkgName
}

// ResolvePackageName reduces a fully qualified function name to the package name
func ResolvePackageName(f string) string {
	for {
		lastPeriod := strings.LastIndex(f, ".")
		lastSlash := strings.LastIndex(f, "/")
		if lastPeriod > lastSlash {
			f = f[:lastPeriod]
		} else {
			break
		}
	}
	return f
}
