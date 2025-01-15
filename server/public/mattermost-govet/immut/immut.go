// Package immut implements immutable types.
package immut

/*
A type T may be marked as immutable. Being immutable means that

- none of its fields may be written to
- none of its elements (for slices or maps) may be written to, and elements may not be deleted (for maps)
- references stored in the struct may not be modified and have the same protections as explicitly marked immutable types

This makes immutability inherently recursive, and we can't rely
strictly on type analysis. Instead, we must track values, across
function calls.

It also means that we need to track non-reference types. A
dereferenced struct might contain fields of reference types (e.g.
slices), and these stay immutable even if the struct itself is no
longer mutable.

Immutable types can only be constructed in whitelisted functions,
typically one for creation and one for cloning.

Because we have to track values in an analysis model that analyses one
package at a time, we need to compute summaries for functions and
whether they modify any of their arguments. For example, a function

	func modify(x []int) { x[0] = 1 }

by itself is perfectly fine, unless it gets called with a slice
derived from an immutable type. This analysis has to occur recursively.

This analysis can inherently not be free of false negatives, unless we
used some form of expensive alias analysis, which would have false
positives instead. As such, the check happens on a best effort basis.
Where more accuracy is desired, the user can opt for using more types
with annotations, but even the type-based analysis can be defeated by
interfaces and other dynamic behavior.

We should also track immutability across type conversions.
*/

import (
	"fmt"
	"go/token"
	"go/types"
	"strings"

	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/analysis/passes/buildssa"
	"golang.org/x/tools/go/ssa"
)

const debug = false

func debugf(f string, v ...interface{}) {
	if debug {
		fmt.Printf(f+"\n", v...)
	}
}

var Analyzer = &analysis.Analyzer{
	Name:      "mutates",
	Doc:       "Annotates functions that mutate their parameters",
	Run:       run,
	Requires:  []*analysis.Analyzer{buildssa.Analyzer},
	FactTypes: []analysis.Fact{(*mutatesParametersFact)(nil), (*isImmutable)(nil), (*isConstructor)(nil)},
}

type isImmutable struct{}
type isConstructor struct{}
type mutatesParametersFact struct {
	Params []mutationStack
}

func (*isImmutable) AFact()           {}
func (*isConstructor) AFact()         {}
func (*mutatesParametersFact) AFact() {}

// Functions that are known mutators, but that static analysis can't
// detect, for example because of syscalls.
var knownMutators = map[string]struct{}{
	"(*os.File).Read": {},
}

func run(pass *analysis.Pass) (interface{}, error) {
	// mark immutable types and constructors
	parseDirectives(pass)
	// mark all functions that mutate their arguments
	markMutators(pass)
	// now find immutability violations
	checkTypes(pass)

	return nil, nil
}

func parseDirectives(pass *analysis.Pass) {
	const (
		prefixType = "//immut:type "
		prefixCtr  = "//immut:constructor "
	)

	for _, f := range pass.Files {
		for _, cg := range f.Comments {
			for _, c := range cg.List {
				if strings.HasPrefix(c.Text, prefixType) {
					name := c.Text[len(prefixType):]
					obj := pass.Pkg.Scope().Lookup(name)
					if obj == nil {
						pass.Reportf(c.Pos(), "couldn't find type named %q", name)
					} else if tname, ok := obj.(*types.TypeName); ok {
						debugf("mark %s immutable", obj)
						pass.ExportObjectFact(tname, &isImmutable{})
					} else {
						// TODO(dh): user friendly output instead of %T
						pass.Reportf(c.Pos(), "object %q is a %T, not a type name", name, obj)
					}
				} else if strings.HasPrefix(c.Text, prefixCtr) {
					// TODO(dh): verify that the constructor actually returns a type that is immutable

					parts := strings.Split(c.Text[len(prefixCtr):], ".")
					switch len(parts) {
					case 1:
						fnName := parts[0]
						obj := pass.Pkg.Scope().Lookup(fnName)
						if obj == nil {
							// TODO(dh): flag comment
							continue
						}
						fn, ok := obj.(*types.Func)
						if !ok {
							// TODO(dh): flag comment
							continue
						}
						debugf("mark %s as constructor", fn)
						pass.ExportObjectFact(fn, &isConstructor{})
					case 2:
						typ := parts[0]
						methName := parts[1]
						obj := pass.Pkg.Scope().Lookup(typ)
						if obj == nil {
							// TODO(dh): flag comment
							continue
						}
						tname, ok := obj.(*types.TypeName)
						if !ok {
							// TODO(dh): flag comment
							continue
						}
						named := tname.Type().(*types.Named)
						for n, i := named.NumMethods(), 0; i < n; i++ {
							if meth := named.Method(i); meth.Name() == methName {
								debugf("mark %s as constructor", meth)
								pass.ExportObjectFact(meth, &isConstructor{})
								break
							}
						}
					default:
						pass.Reportf(c.Pos(), "malformed //immut:constructor directive: expected 'FuncName' or 'Type.MethodName'")
						continue
					}
				}
			}
		}
	}
}

func markMutators(pass *analysis.Pass) {
	seen := map[*ssa.Function]struct{}{}
	for _, fn := range pass.ResultOf[buildssa.Analyzer].(*buildssa.SSA).SrcFuncs {
		markMutator(pass, fn, seen)
	}
}

func markMutator(pass *analysis.Pass, fn *ssa.Function, seenFns map[*ssa.Function]struct{}) (out []mutationStack) {
	if _, ok := knownMutators[fn.String()]; ok {
		return []mutationStack{{{Kind: "well-known"}}}
	}

	if fn.Object() == nil {
		// TODO(dh): support closures
		return nil
	}
	if fact := new(mutatesParametersFact); pass.ImportObjectFact(fn.Object(), fact) {
		return fact.Params
	}
	if fn.Pkg != pass.ResultOf[buildssa.Analyzer].(*buildssa.SSA).Pkg {
		return nil
	}
	if fn.Blocks == nil {
		return nil
	}
	if seenFns == nil {
		// impl is being called in the context of impl2, which relies
		// on facts having been computed already.
		return nil
	}

	if _, ok := seenFns[fn]; ok {
		return nil
	}

	seenFns[fn] = struct{}{}
	defer func() {
		for _, v := range out {
			if len(v) > 0 {
				pass.ExportObjectFact(fn.Object(), &mutatesParametersFact{out})
				break
			}
		}
	}()

	isMethod := fn.Signature.Recv() != nil
	out = make([]mutationStack, len(fn.Params))
	params := fn.Params
	if isMethod {
		out = out[1:]
		params = params[1:]
	}
	seen := map[ssa.Value]struct{}{}
	for i, param := range params {
		if stack, ok := mutates(pass, param, seen, seenFns, nil); ok {
			out[i] = stack
		}
	}
	return out
}

type mutationStack []mutationStackEntry

type mutationStackEntry struct {
	Kind     string
	Position token.Position
}

func newMutationStackEntry(pass *analysis.Pass, instr ssa.Instruction) mutationStackEntry {
	var kind string
	switch instr.(type) {
	case *ssa.Store:
		kind = "store"
	case *ssa.IndexAddr:
		kind = "pointer to slice element"
	case *ssa.Slice:
		kind = "slice"
	case *ssa.Call:
		kind = "call"
	case *ssa.UnOp:
		kind = "dereference"
	case *ssa.FieldAddr:
		kind = "field address"
	case *ssa.Phi:
		kind = "phi"
	case *ssa.TypeAssert:
		kind = "type assert"
	case *ssa.MapUpdate:
		kind = "map write"
	case *ssa.ChangeType:
		kind = "type change"
	case *ssa.Lookup:
		kind = "lookup"
	default:
		panic(fmt.Sprintf("internal error: %T", instr))
	}
	return mutationStackEntry{
		Kind:     kind,
		Position: pass.Fset.Position(instr.Pos()),
	}
}

func checkValue(pass *analysis.Pass, v ssa.Value) {
	if ptr, ok := v.Type().(*types.Pointer); ok {
		if named, ok := ptr.Elem().(*types.Named); ok {
			if pass.ImportObjectFact(named.Obj(), &isImmutable{}) {
				if m, ok := mutates(pass, v, map[ssa.Value]struct{}{}, nil, nil); ok {
					pos := v.Pos()
					if pos == token.NoPos {
						switch v := v.(type) {
						case *ssa.Extract:
							pos = v.Tuple.Pos()
						}
					}
					posn := pass.Fset.Position(pos)
					// TODO(dh): we skip tests for now, because of absurd amounts of (false?) positives
					if !strings.HasSuffix(posn.Filename, "_test.go") {
						// We can't use RelatedInformation here, because we don't have token.Pos for our mutation stack, we have token.Position.
						diag := analysis.Diagnostic{
							Pos:     v.Pos(),
							Message: "this immutable value gets modified\n",
						}
						for _, mm := range m {
							diag.Message += fmt.Sprintf("\t%s at %s\n", mm.Kind, mm.Position.String())
						}
						pass.Report(diag)
					}
				}
			}
		}
	}
}

func checkTypes(pass *analysis.Pass) {
	for _, fn := range pass.ResultOf[buildssa.Analyzer].(*buildssa.SSA).SrcFuncs {
		for _, param := range fn.Params {
			checkValue(pass, param)
		}
		for _, b := range fn.Blocks {
			for _, instr := range b.Instrs {
				v, ok := instr.(ssa.Value)
				if !ok {
					continue
				}
				checkValue(pass, v)
			}
		}
	}
}

func mutates(pass *analysis.Pass, v ssa.Value, seen map[ssa.Value]struct{}, seenFns map[*ssa.Function]struct{}, allowed map[ssa.Instruction]struct{}) (mutationStack, bool) {
	if !isInterestingType(v.Type()) {
		return nil, false
	}

	if _, ok := seen[v]; ok {
		return nil, false
	}
	seen[v] = struct{}{}

	refs := v.Referrers()
	if refs == nil {
		return nil, false
	}

	// TODO(dh): support functions that act as constructors
	if alloc, ok := v.(*ssa.Alloc); ok {
		// Allow struct initializers. We detect struct initializers by
		// looking for stores into fields of an alloc that occur in
		// the same block as the alloc.
		// XXX allow assignments in more than a single block
		allowed = map[ssa.Instruction]struct{}{}
		for _, instr := range alloc.Block().Instrs {
			switch instr := instr.(type) {
			case *ssa.Store:
				// XXX don't allow stores if the alloc has been used in the meantime
				switch addr := instr.Addr.(type) {
				case *ssa.IndexAddr:
					if addr.X == alloc {
						allowed[instr] = struct{}{}
					}
				case *ssa.FieldAddr:
					if addr.X == alloc {
						allowed[instr] = struct{}{}
					}
				}
			}
		}
	}

	for _, ref := range *refs {
		if _, ok := allowed[ref]; ok {
			continue
		}
		switch ref := ref.(type) {
		case *ssa.Call:
			// TODO(dh): check if the function modifies its parameter
			callee := ref.Call.StaticCallee()
			if callee == nil {
				continue
			}
			isMethod := callee.Signature.Recv() != nil
			args := ref.Call.Args
			if isMethod {
				args = args[1:]
			}
			for i, arg := range args {
				if arg == v {
					ret := markMutator(pass, callee, seenFns)
					if len(ret) == 0 {
						continue
					}
					if len(ret[i]) > 0 {
						return append(mutationStack{newMutationStackEntry(pass, ref)}, ret[i]...), true
					}
				}
			}
		case *ssa.Extract, *ssa.Index:
			// XXX implement
		case *ssa.IndexAddr, *ssa.Lookup, *ssa.Slice, *ssa.FieldAddr:
			ops := ref.Operands(nil)
			if len(ops) > 0 && ops[0] != nil && *ops[0] == v {
				if m, ok := mutates(pass, ref.(ssa.Value), seen, seenFns, allowed); ok {
					return append(mutationStack{newMutationStackEntry(pass, ref)}, m...), true
				}
			}
		case *ssa.UnOp:
			if _, ok := ref.X.Type().Underlying().(*types.Pointer); ok && ref.Op == token.MUL {
				if m, ok := mutates(pass, ref, seen, seenFns, allowed); ok {
					return append(mutationStack{newMutationStackEntry(pass, ref)}, m...), true
				}
			}
		case *ssa.Field, *ssa.MakeInterface, *ssa.ChangeType, *ssa.Phi, *ssa.Convert:
			if m, ok := mutates(pass, ref.(ssa.Value), seen, seenFns, allowed); ok {
				return append(mutationStack{newMutationStackEntry(pass, ref)}, m...), true
			}
		case *ssa.Store:
			if ref.Addr == v {
				return mutationStack{newMutationStackEntry(pass, ref)}, true
			}
		case *ssa.MapUpdate:
			if ref.Map == v {
				return mutationStack{newMutationStackEntry(pass, ref)}, true
			}
		case *ssa.Defer, *ssa.Go, *ssa.MakeClosure:
			// TODO(dh): do we have to do anything here?
		case *ssa.ChangeInterface:
			if m, ok := mutates(pass, ref, seen, seenFns, allowed); ok {
				return append(mutationStack{newMutationStackEntry(pass, ref)}, m...), true
			}
		case *ssa.Range:
			// TODO(dh): support this
		case *ssa.Return, *ssa.BinOp, *ssa.Select, *ssa.Send, *ssa.If, *ssa.Panic, *ssa.MakeSlice, *ssa.MakeChan, *ssa.MakeMap:
			// do nothing
		case *ssa.TypeAssert:
			if m, ok := mutates(pass, ref, seen, seenFns, allowed); ok {
				return append(mutationStack{newMutationStackEntry(pass, ref)}, m...), true
			}
		default:
			panic(fmt.Sprintf("unhandled type %T", ref))
		}
	}
	return nil, false
}

func isInterestingType(typ types.Type) bool {
	switch typ.Underlying().(type) {
	case *types.Struct:
	case *types.Slice:
	case *types.Map:
	case *types.Pointer:
	case *types.Interface:
	default:
		return false
	}
	return true
}
