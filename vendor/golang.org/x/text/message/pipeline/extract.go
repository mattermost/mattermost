// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package pipeline

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/constant"
	"go/format"
	"go/token"
	"go/types"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"

	fmtparser "golang.org/x/text/internal/format"
	"golang.org/x/tools/go/callgraph"
	"golang.org/x/tools/go/callgraph/cha"
	"golang.org/x/tools/go/loader"
	"golang.org/x/tools/go/ssa"
	"golang.org/x/tools/go/ssa/ssautil"
)

const debug = false

// TODO:
// - merge information into existing files
// - handle different file formats (PO, XLIFF)
// - handle features (gender, plural)
// - message rewriting

// - %m substitutions
// - `msg:"etc"` tags
// - msg/Msg top-level vars and strings.

// Extract extracts all strings form the package defined in Config.
func Extract(c *Config) (*State, error) {
	x, err := newExtracter(c)
	if err != nil {
		return nil, wrap(err, "")
	}

	x.seedEndpoints()
	x.extractMessages()

	return &State{
		Config:  *c,
		program: x.iprog,
		Extracted: Messages{
			Language: c.SourceLanguage,
			Messages: x.messages,
		},
	}, nil
}

type extracter struct {
	conf      loader.Config
	iprog     *loader.Program
	prog      *ssa.Program
	callGraph *callgraph.Graph

	// Calls and other expressions to collect.
	exprs    map[token.Pos]ast.Expr
	funcs    map[token.Pos]*callData
	messages []Message
}

func newExtracter(c *Config) (x *extracter, err error) {
	x = &extracter{
		conf:  loader.Config{},
		exprs: map[token.Pos]ast.Expr{},
		funcs: map[token.Pos]*callData{},
	}

	x.iprog, err = loadPackages(&x.conf, c.Packages)
	if err != nil {
		return nil, wrap(err, "")
	}

	x.prog = ssautil.CreateProgram(x.iprog, 0)
	x.prog.Build()

	x.callGraph = cha.CallGraph(x.prog)

	return x, nil
}

func (x *extracter) seedEndpoints() {
	pkg := x.prog.Package(x.iprog.Package("golang.org/x/text/message").Pkg)
	typ := types.NewPointer(pkg.Type("Printer").Type())

	x.handleFunc(x.prog.LookupMethod(typ, pkg.Pkg, "Printf"), &callData{
		formatPos: 1,
		argPos:    2,
		isMethod:  true,
	})
	x.handleFunc(x.prog.LookupMethod(typ, pkg.Pkg, "Sprintf"), &callData{
		formatPos: 1,
		argPos:    2,
		isMethod:  true,
	})
	x.handleFunc(x.prog.LookupMethod(typ, pkg.Pkg, "Fprintf"), &callData{
		formatPos: 2,
		argPos:    3,
		isMethod:  true,
	})
}

type callData struct {
	call    ssa.CallInstruction
	formats []constant.Value

	callee    *callData
	isMethod  bool
	formatPos int
	argPos    int   // varargs at this position in the call
	argTypes  []int // arguments extractable from this position
}

func (c *callData) callFormatPos() int {
	c = c.callee
	if c.isMethod {
		return c.formatPos - 1
	}
	return c.formatPos
}

func (c *callData) callArgsStart() int {
	c = c.callee
	if c.isMethod {
		return c.argPos - 1
	}
	return c.argPos
}

func (c *callData) Pos() token.Pos      { return c.call.Pos() }
func (c *callData) Pkg() *types.Package { return c.call.Parent().Pkg.Pkg }

func (x *extracter) handleFunc(f *ssa.Function, fd *callData) {
	for _, e := range x.callGraph.Nodes[f].In {
		if e.Pos() == 0 {
			continue
		}

		call := e.Site
		caller := x.funcs[call.Pos()]
		if caller != nil {
			// TODO: theoretically a format string could be passed to multiple
			// arguments of a function. Support this eventually.
			continue
		}
		x.debug(call, "CALL", f.String())

		caller = &callData{
			call:      call,
			callee:    fd,
			formatPos: -1,
			argPos:    -1,
		}
		// Offset by one if we are invoking an interface method.
		offset := 0
		if call.Common().IsInvoke() {
			offset = -1
		}
		x.funcs[call.Pos()] = caller
		if fd.argPos >= 0 {
			x.visitArgs(caller, call.Common().Args[fd.argPos+offset])
		}
		x.visitFormats(caller, call.Common().Args[fd.formatPos+offset])
	}
}

type posser interface {
	Pos() token.Pos
	Parent() *ssa.Function
}

func (x *extracter) debug(v posser, header string, args ...interface{}) {
	if debug {
		pos := ""
		if p := v.Parent(); p != nil {
			pos = posString(&x.conf, p.Package().Pkg, v.Pos())
		}
		if header != "CALL" && header != "INSERT" {
			header = "  " + header
		}
		fmt.Printf("%-32s%-10s%-15T ", pos+fmt.Sprintf("@%d", v.Pos()), header, v)
		for _, a := range args {
			fmt.Printf(" %v", a)
		}
		fmt.Println()
	}
}

// visitFormats finds the original source of the value. The returned index is
// position of the argument if originated from a function argument or -1
// otherwise.
func (x *extracter) visitFormats(call *callData, v ssa.Value) {
	if v == nil {
		return
	}
	x.debug(v, "VALUE", v)

	switch v := v.(type) {
	case *ssa.Phi:
		for _, e := range v.Edges {
			x.visitFormats(call, e)
		}

	case *ssa.Const:
		// Only record strings with letters.
		if isMsg(constant.StringVal(v.Value)) {
			x.debug(call.call, "FORMAT", v.Value.ExactString())
			call.formats = append(call.formats, v.Value)
		}
		// TODO: handle %m-directive.

	case *ssa.Global:
		// TODO: record value if a string and try to determine a possible
		// constant value from the ast data.

	case *ssa.FieldAddr, *ssa.Field:
		// TODO: mark field index v.Field of v.X.Type() for extraction. extract
		// an example args as to give parameters for the translator.

	case *ssa.Slice:
		if v.Low == nil && v.High == nil && v.Max == nil {
			x.visitFormats(call, v.X)
		}

	case *ssa.Parameter:
		// TODO: handle the function for the index parameter.
		f := v.Parent()
		for i, p := range f.Params {
			if p == v {
				if call.formatPos < 0 {
					call.formatPos = i
					// TODO: is there a better way to detect this is calling
					// a method rather than a function?
					call.isMethod = len(f.Params) > f.Signature.Params().Len()
					x.handleFunc(v.Parent(), call)
				} else if debug && i != call.formatPos {
					// TODO: support this.
					fmt.Printf("WARNING:%s: format string passed to arg %d and %d\n",
						posString(&x.conf, call.Pkg(), call.Pos()),
						call.formatPos, i)
				}
			}
		}

	case *ssa.Alloc:
		if ref := v.Referrers(); ref == nil {
			for _, r := range *ref {
				values := []ssa.Value{}
				for _, o := range r.Operands(nil) {
					if o == nil || *o == v {
						continue
					}
					values = append(values, *o)
				}
				// TODO: return something different if we care about multiple
				// values as well.
				if len(values) == 1 {
					x.visitFormats(call, values[0])
				}
			}
		}

		// TODO:
	// case *ssa.Index:
	// 	// Get all values in the array if applicable
	// case *ssa.IndexAddr:
	// 	// Get all values in the slice or *array if applicable.
	// case *ssa.Lookup:
	// 	// Get all values in the map if applicable.

	case *ssa.FreeVar:
		// TODO: find the link between free variables and parameters:
		//
		// func freeVar(p *message.Printer, str string) {
		// 	fn := func(p *message.Printer) {
		// 		p.Printf(str)
		// 	}
		// 	fn(p)
		// }

	case ssa.Instruction:
		rands := v.Operands(nil)
		if len(rands) == 1 && rands[0] != nil {
			x.visitFormats(call, *rands[0])
		}
	case *ssa.Call:
	}
}

// Note: a function may have an argument marked as both format and passthrough.

// visitArgs collects information on arguments. For wrapped functions it will
// just determine the position of the variable args slice.
func (x *extracter) visitArgs(fd *callData, v ssa.Value) {
	if v == nil {
		return
	}
	x.debug(v, "ARGV", v)
	switch v := v.(type) {

	case *ssa.Slice:
		if v.Low == nil && v.High == nil && v.Max == nil {
			x.visitArgs(fd, v.X)
		}

	case *ssa.Parameter:
		// TODO: handle the function for the index parameter.
		f := v.Parent()
		for i, p := range f.Params {
			if p == v {
				fd.argPos = i
			}
		}

	case *ssa.Alloc:
		if ref := v.Referrers(); ref == nil {
			for _, r := range *ref {
				values := []ssa.Value{}
				for _, o := range r.Operands(nil) {
					if o == nil || *o == v {
						continue
					}
					values = append(values, *o)
				}
				// TODO: return something different if we care about
				// multiple values as well.
				if len(values) == 1 {
					x.visitArgs(fd, values[0])
				}
			}
		}

	case ssa.Instruction:
		rands := v.Operands(nil)
		if len(rands) == 1 && rands[0] != nil {
			x.visitArgs(fd, *rands[0])
		}
	}
}

func (x *extracter) extractMessages() {
	// print returns Go syntax for the specified node.
	print := func(n ast.Node) string {
		var buf bytes.Buffer
		format.Node(&buf, x.conf.Fset, n)
		return buf.String()
	}
	prog := x.iprog
	for _, info := range x.iprog.AllPackages {
		for _, f := range info.Files {
			// Associate comments with nodes.
			cmap := ast.NewCommentMap(prog.Fset, f, f.Comments)
			getComment := func(n ast.Node) string {
				cs := cmap.Filter(n).Comments()
				if len(cs) > 0 {
					return strings.TrimSpace(cs[0].Text())
				}
				return ""
			}

			// Find function calls.
			ast.Inspect(f, func(n ast.Node) bool {
				call, ok := n.(*ast.CallExpr)
				if !ok {
					return true
				}
				data := x.funcs[call.Lparen]
				if data == nil || len(data.formats) == 0 {
					return true
				}
				x.debug(data.call, "INSERT", data.formats)

				argn := data.callFormatPos()
				if argn >= len(call.Args) {
					return true
				}
				format := call.Args[argn]

				comment := ""
				key := []string{}
				if ident, ok := format.(*ast.Ident); ok {
					key = append(key, ident.Name)
					if v, ok := ident.Obj.Decl.(*ast.ValueSpec); ok && v.Comment != nil {
						// TODO: get comment above ValueSpec as well
						comment = v.Comment.Text()
					}
				}

				arguments := []argument{}
				simArgs := []interface{}{}
				if data.callArgsStart() >= 0 {
					args := call.Args[data.callArgsStart():]
					simArgs = make([]interface{}, len(args))
					for i, arg := range args {
						expr := print(arg)
						val := ""
						if v := info.Types[arg].Value; v != nil {
							val = v.ExactString()
							simArgs[i] = val
							switch arg.(type) {
							case *ast.BinaryExpr, *ast.UnaryExpr:
								expr = val
							}
						}
						arguments = append(arguments, argument{
							ArgNum:         i + 1,
							Type:           info.Types[arg].Type.String(),
							UnderlyingType: info.Types[arg].Type.Underlying().String(),
							Expr:           expr,
							Value:          val,
							Comment:        getComment(arg),
							Position:       posString(&x.conf, info.Pkg, arg.Pos()),
							// TODO report whether it implements
							// interfaces plural.Interface,
							// gender.Interface.
						})
					}
				}

				formats := data.formats
				for _, c := range formats {
					key := append([]string{}, key...)
					fmtMsg := constant.StringVal(c)
					msg := ""

					ph := placeholders{index: map[string]string{}}

					trimmed, _, _ := trimWS(fmtMsg)

					p := fmtparser.Parser{}
					p.Reset(simArgs)
					for p.SetFormat(trimmed); p.Scan(); {
						switch p.Status {
						case fmtparser.StatusText:
							msg += p.Text()
						case fmtparser.StatusSubstitution,
							fmtparser.StatusBadWidthSubstitution,
							fmtparser.StatusBadPrecSubstitution:
							arguments[p.ArgNum-1].used = true
							arg := arguments[p.ArgNum-1]
							sub := p.Text()
							if !p.HasIndex {
								r, sz := utf8.DecodeLastRuneInString(sub)
								sub = fmt.Sprintf("%s[%d]%c", sub[:len(sub)-sz], p.ArgNum, r)
							}
							msg += fmt.Sprintf("{%s}", ph.addArg(&arg, sub))
						}
					}
					key = append(key, msg)

					// Add additional Placeholders that can be used in translations
					// that are not present in the string.
					for _, arg := range arguments {
						if arg.used {
							continue
						}
						ph.addArg(&arg, fmt.Sprintf("%%[%d]v", arg.ArgNum))
					}

					if c := getComment(call.Args[0]); c != "" {
						comment = c
					}

					x.messages = append(x.messages, Message{
						ID:      key,
						Key:     fmtMsg,
						Message: Text{Msg: msg},
						// TODO(fix): this doesn't get the before comment.
						Comment:      comment,
						Placeholders: ph.slice,
						Position:     posString(&x.conf, info.Pkg, call.Lparen),
					})
				}
				return true
			})
		}
	}
}

func posString(conf *loader.Config, pkg *types.Package, pos token.Pos) string {
	p := conf.Fset.Position(pos)
	file := fmt.Sprintf("%s:%d:%d", filepath.Base(p.Filename), p.Line, p.Column)
	return filepath.Join(pkg.Path(), file)
}

func getID(arg *argument) string {
	s := getLastComponent(arg.Expr)
	s = strip(s)
	s = strings.Replace(s, " ", "", -1)
	// For small variable names, use user-defined types for more info.
	if len(s) <= 2 && arg.UnderlyingType != arg.Type {
		s = getLastComponent(arg.Type)
	}
	return strings.Title(s)
}

// strip is a dirty hack to convert function calls to placeholder IDs.
func strip(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) || r == '-' {
			return '_'
		}
		if !unicode.In(r, unicode.Letter, unicode.Mark, unicode.Number) {
			return -1
		}
		return r
	}, s)
	// Strip "Get" from getter functions.
	if strings.HasPrefix(s, "Get") || strings.HasPrefix(s, "get") {
		if len(s) > len("get") {
			r, _ := utf8.DecodeRuneInString(s)
			if !unicode.In(r, unicode.Ll, unicode.M) { // not lower or mark
				s = s[len("get"):]
			}
		}
	}
	return s
}

type placeholders struct {
	index map[string]string
	slice []Placeholder
}

func (p *placeholders) addArg(arg *argument, sub string) (id string) {
	id = getID(arg)
	id1 := id
	alt, ok := p.index[id1]
	for i := 1; ok && alt != sub; i++ {
		id1 = fmt.Sprintf("%s_%d", id, i)
		alt, ok = p.index[id1]
	}
	p.index[id1] = sub
	p.slice = append(p.slice, Placeholder{
		ID:             id1,
		String:         sub,
		Type:           arg.Type,
		UnderlyingType: arg.UnderlyingType,
		ArgNum:         arg.ArgNum,
		Expr:           arg.Expr,
		Comment:        arg.Comment,
	})
	return id1
}

func getLastComponent(s string) string {
	return s[1+strings.LastIndexByte(s, '.'):]
}

// isMsg returns whether s should be translated.
func isMsg(s string) bool {
	// TODO: parse as format string and omit strings that contain letters
	// coming from format verbs.
	for _, r := range s {
		if unicode.In(r, unicode.L) {
			return true
		}
	}
	return false
}
