package sentry

import (
	"go/build"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
)

const unknown string = "unknown"

// The module download is split into two parts: downloading the go.mod and downloading the actual code.
// If you have dependencies only needed for tests, then they will show up in your go.mod,
// and go get will download their go.mods, but it will not download their code.
// The test-only dependencies get downloaded only when you need it, such as the first time you run go test.
//
// https://github.com/golang/go/issues/26913#issuecomment-411976222

// Stacktrace holds information about the frames of the stack.
type Stacktrace struct {
	Frames        []Frame `json:"frames,omitempty"`
	FramesOmitted []uint  `json:"frames_omitted,omitempty"`
}

// NewStacktrace creates a stacktrace using `runtime.Callers`.
func NewStacktrace() *Stacktrace {
	pcs := make([]uintptr, 100)
	n := runtime.Callers(1, pcs)

	if n == 0 {
		return nil
	}

	frames := extractFrames(pcs[:n])
	frames = filterFrames(frames)

	stacktrace := Stacktrace{
		Frames: frames,
	}

	return &stacktrace
}

// ExtractStacktrace creates a new `Stacktrace` based on the given `error` object.
// TODO: Make it configurable so that anyone can provide their own implementation?
// Use of reflection allows us to not have a hard dependency on any given package, so we don't have to import it
func ExtractStacktrace(err error) *Stacktrace {
	method := extractReflectedStacktraceMethod(err)

	if !method.IsValid() {
		return nil
	}

	pcs := extractPcs(method)

	if len(pcs) == 0 {
		return nil
	}

	frames := extractFrames(pcs)
	frames = filterFrames(frames)

	stacktrace := Stacktrace{
		Frames: frames,
	}

	return &stacktrace
}

func extractReflectedStacktraceMethod(err error) reflect.Value {
	var method reflect.Value

	// https://github.com/pingcap/errors
	methodGetStackTracer := reflect.ValueOf(err).MethodByName("GetStackTracer")
	// https://github.com/pkg/errors
	methodStackTrace := reflect.ValueOf(err).MethodByName("StackTrace")
	// https://github.com/go-errors/errors
	methodStackFrames := reflect.ValueOf(err).MethodByName("StackFrames")

	if methodGetStackTracer.IsValid() {
		stacktracer := methodGetStackTracer.Call(make([]reflect.Value, 0))[0]
		stacktracerStackTrace := reflect.ValueOf(stacktracer).MethodByName("StackTrace")

		if stacktracerStackTrace.IsValid() {
			method = stacktracerStackTrace
		}
	}

	if methodStackTrace.IsValid() {
		method = methodStackTrace
	}

	if methodStackFrames.IsValid() {
		method = methodStackFrames
	}

	return method
}

func extractPcs(method reflect.Value) []uintptr {
	var pcs []uintptr

	stacktrace := method.Call(make([]reflect.Value, 0))[0]

	if stacktrace.Kind() != reflect.Slice {
		return nil
	}

	for i := 0; i < stacktrace.Len(); i++ {
		pc := stacktrace.Index(i)

		if pc.Kind() == reflect.Uintptr {
			pcs = append(pcs, uintptr(pc.Uint()))
			continue
		}

		if pc.Kind() == reflect.Struct {
			field := pc.FieldByName("ProgramCounter")
			if field.IsValid() && field.Kind() == reflect.Uintptr {
				pcs = append(pcs, uintptr(field.Uint()))
				continue
			}
		}
	}

	return pcs
}

// https://docs.sentry.io/development/sdk-dev/event-payloads/stacktrace/
type Frame struct {
	Function    string                 `json:"function,omitempty"`
	Symbol      string                 `json:"symbol,omitempty"`
	Module      string                 `json:"module,omitempty"`
	Package     string                 `json:"package,omitempty"`
	Filename    string                 `json:"filename,omitempty"`
	AbsPath     string                 `json:"abs_path,omitempty"`
	Lineno      int                    `json:"lineno,omitempty"`
	Colno       int                    `json:"colno,omitempty"`
	PreContext  []string               `json:"pre_context,omitempty"`
	ContextLine string                 `json:"context_line,omitempty"`
	PostContext []string               `json:"post_context,omitempty"`
	InApp       bool                   `json:"in_app,omitempty"`
	Vars        map[string]interface{} `json:"vars,omitempty"`
}

// NewFrame assembles a stacktrace frame out of `runtime.Frame`.
func NewFrame(f runtime.Frame) Frame {
	abspath := f.File
	filename := f.File
	function := f.Function
	var pkg string

	if filename != "" {
		filename = filepath.Base(filename)
	} else {
		filename = unknown
	}

	if abspath == "" {
		abspath = unknown
	}

	if function != "" {
		pkg, function = splitQualifiedFunctionName(function)
	}

	frame := Frame{
		AbsPath:  abspath,
		Filename: filename,
		Lineno:   f.Line,
		Module:   pkg,
		Function: function,
	}

	frame.InApp = isInAppFrame(frame)

	return frame
}

// splitQualifiedFunctionName splits a package path-qualified function name into
// package name and function name. Such qualified names are found in
// runtime.Frame.Function values.
func splitQualifiedFunctionName(name string) (pkg string, fun string) {
	pkg = packageName(name)
	fun = strings.TrimPrefix(name, pkg+".")
	return
}

func extractFrames(pcs []uintptr) []Frame {
	var frames []Frame
	callersFrames := runtime.CallersFrames(pcs)

	for {
		callerFrame, more := callersFrames.Next()

		frames = append([]Frame{
			NewFrame(callerFrame),
		}, frames...)

		if !more {
			break
		}
	}

	return frames
}

// filterFrames filters out stack frames that are not meant to be reported to
// Sentry. Those are frames internal to the SDK or Go.
func filterFrames(frames []Frame) []Frame {
	if len(frames) == 0 {
		return nil
	}

	filteredFrames := make([]Frame, 0, len(frames))

	for _, frame := range frames {
		// Skip Go internal frames.
		if frame.Module == "runtime" || frame.Module == "testing" {
			continue
		}
		// Skip Sentry internal frames, except for frames in _test packages (for
		// testing).
		if strings.HasPrefix(frame.Module, "github.com/getsentry/sentry-go") &&
			!strings.HasSuffix(frame.Module, "_test") {
			continue
		}
		filteredFrames = append(filteredFrames, frame)
	}

	return filteredFrames
}

func isInAppFrame(frame Frame) bool {
	if strings.HasPrefix(frame.AbsPath, build.Default.GOROOT) ||
		strings.Contains(frame.Module, "vendor") ||
		strings.Contains(frame.Module, "third_party") {
		return false
	}

	return true
}

func callerFunctionName() string {
	pcs := make([]uintptr, 1)
	runtime.Callers(3, pcs)
	callersFrames := runtime.CallersFrames(pcs)
	callerFrame, _ := callersFrames.Next()
	return baseName(callerFrame.Function)
}

// packageName returns the package part of the symbol name, or the empty string
// if there is none.
// It replicates https://golang.org/pkg/debug/gosym/#Sym.PackageName, avoiding a
// dependency on debug/gosym.
func packageName(name string) string {
	// A prefix of "type." and "go." is a compiler-generated symbol that doesn't belong to any package.
	// See variable reservedimports in cmd/compile/internal/gc/subr.go
	if strings.HasPrefix(name, "go.") || strings.HasPrefix(name, "type.") {
		return ""
	}

	pathend := strings.LastIndex(name, "/")
	if pathend < 0 {
		pathend = 0
	}

	if i := strings.Index(name[pathend:], "."); i != -1 {
		return name[:pathend+i]
	}
	return ""
}

// baseName returns the symbol name without the package or receiver name.
// It replicates https://golang.org/pkg/debug/gosym/#Sym.BaseName, avoiding a
// dependency on debug/gosym.
func baseName(name string) string {
	if i := strings.LastIndex(name, "."); i != -1 {
		return name[i+1:]
	}
	return name
}
