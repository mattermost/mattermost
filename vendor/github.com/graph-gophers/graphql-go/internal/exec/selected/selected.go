package selected

import (
	"fmt"
	"reflect"
	"sync"

	"github.com/graph-gophers/graphql-go/errors"
	"github.com/graph-gophers/graphql-go/internal/exec/packer"
	"github.com/graph-gophers/graphql-go/internal/exec/resolvable"
	"github.com/graph-gophers/graphql-go/internal/query"
	"github.com/graph-gophers/graphql-go/introspection"
	"github.com/graph-gophers/graphql-go/types"
)

type Request struct {
	Schema               *types.Schema
	Doc                  *types.ExecutableDefinition
	Vars                 map[string]interface{}
	Mu                   sync.Mutex
	Errs                 []*errors.QueryError
	DisableIntrospection bool
}

func (r *Request) AddError(err *errors.QueryError) {
	r.Mu.Lock()
	r.Errs = append(r.Errs, err)
	r.Mu.Unlock()
}

func ApplyOperation(r *Request, s *resolvable.Schema, op *types.OperationDefinition) []Selection {
	var obj *resolvable.Object
	switch op.Type {
	case query.Query:
		obj = s.Query.(*resolvable.Object)
	case query.Mutation:
		obj = s.Mutation.(*resolvable.Object)
	case query.Subscription:
		obj = s.Subscription.(*resolvable.Object)
	}
	return applySelectionSet(r, s, obj, op.Selections)
}

type Selection interface {
	isSelection()
}

type SchemaField struct {
	resolvable.Field
	Alias       string
	Args        map[string]interface{}
	PackedArgs  reflect.Value
	Sels        []Selection
	Async       bool
	FixedResult reflect.Value
}

type TypeAssertion struct {
	resolvable.TypeAssertion
	Sels []Selection
}

type TypenameField struct {
	resolvable.Object
	Alias string
}

func (*SchemaField) isSelection()   {}
func (*TypeAssertion) isSelection() {}
func (*TypenameField) isSelection() {}

func applySelectionSet(r *Request, s *resolvable.Schema, e *resolvable.Object, sels []types.Selection) (flattenedSels []Selection) {
	for _, sel := range sels {
		switch sel := sel.(type) {
		case *types.Field:
			field := sel
			if skipByDirective(r, field.Directives) {
				continue
			}

			switch field.Name.Name {
			case "__typename":
				// __typename is available even though r.DisableIntrospection == true
				// because it is necessary when using union types and interfaces: https://graphql.org/learn/schema/#union-types
				flattenedSels = append(flattenedSels, &TypenameField{
					Object: *e,
					Alias:  field.Alias.Name,
				})

			case "__schema":
				if !r.DisableIntrospection {
					flattenedSels = append(flattenedSels, &SchemaField{
						Field:       s.Meta.FieldSchema,
						Alias:       field.Alias.Name,
						Sels:        applySelectionSet(r, s, s.Meta.Schema, field.SelectionSet),
						Async:       true,
						FixedResult: reflect.ValueOf(introspection.WrapSchema(r.Schema)),
					})
				}

			case "__type":
				if !r.DisableIntrospection {
					p := packer.ValuePacker{ValueType: reflect.TypeOf("")}
					v, err := p.Pack(field.Arguments.MustGet("name").Deserialize(r.Vars))
					if err != nil {
						r.AddError(errors.Errorf("%s", err))
						return nil
					}

					t, ok := r.Schema.Types[v.String()]
					if !ok {
						return nil
					}

					flattenedSels = append(flattenedSels, &SchemaField{
						Field:       s.Meta.FieldType,
						Alias:       field.Alias.Name,
						Sels:        applySelectionSet(r, s, s.Meta.Type, field.SelectionSet),
						Async:       true,
						FixedResult: reflect.ValueOf(introspection.WrapType(t)),
					})
				}

			default:
				fe := e.Fields[field.Name.Name]

				var args map[string]interface{}
				var packedArgs reflect.Value
				if fe.ArgsPacker != nil {
					args = make(map[string]interface{})
					for _, arg := range field.Arguments {
						args[arg.Name.Name] = arg.Value.Deserialize(r.Vars)
					}
					var err error
					packedArgs, err = fe.ArgsPacker.Pack(args)
					if err != nil {
						r.AddError(errors.Errorf("%s", err))
						return
					}
				}

				fieldSels := applyField(r, s, fe.ValueExec, field.SelectionSet)
				flattenedSels = append(flattenedSels, &SchemaField{
					Field:      *fe,
					Alias:      field.Alias.Name,
					Args:       args,
					PackedArgs: packedArgs,
					Sels:       fieldSels,
					Async:      fe.HasContext || fe.ArgsPacker != nil || fe.HasError || HasAsyncSel(fieldSels),
				})
			}

		case *types.InlineFragment:
			frag := sel
			if skipByDirective(r, frag.Directives) {
				continue
			}
			flattenedSels = append(flattenedSels, applyFragment(r, s, e, &frag.Fragment)...)

		case *types.FragmentSpread:
			spread := sel
			if skipByDirective(r, spread.Directives) {
				continue
			}
			flattenedSels = append(flattenedSels, applyFragment(r, s, e, &r.Doc.Fragments.Get(spread.Name.Name).Fragment)...)

		default:
			panic("invalid type")
		}
	}
	return
}

func applyFragment(r *Request, s *resolvable.Schema, e *resolvable.Object, frag *types.Fragment) []Selection {
	if frag.On.Name != e.Name {
		t := r.Schema.Resolve(frag.On.Name)
		face, ok := t.(*types.InterfaceTypeDefinition)
		if !ok && frag.On.Name != "" {
			a, ok2 := e.TypeAssertions[frag.On.Name]
			if !ok2 {
				panic(fmt.Errorf("%q does not implement %q", frag.On, e.Name)) // TODO proper error handling
			}

			return []Selection{&TypeAssertion{
				TypeAssertion: *a,
				Sels:          applySelectionSet(r, s, a.TypeExec.(*resolvable.Object), frag.Selections),
			}}
		}
		if ok && len(face.PossibleTypes) > 0 {
			sels := []Selection{}
			for _, t := range face.PossibleTypes {
				if t.Name == e.Name {
					return applySelectionSet(r, s, e, frag.Selections)
				}

				if a, ok := e.TypeAssertions[t.Name]; ok {
					sels = append(sels, &TypeAssertion{
						TypeAssertion: *a,
						Sels:          applySelectionSet(r, s, a.TypeExec.(*resolvable.Object), frag.Selections),
					})
				}
			}
			if len(sels) == 0 {
				panic(fmt.Errorf("%q does not implement %q", e.Name, frag.On)) // TODO proper error handling
			}
			return sels
		}
	}
	return applySelectionSet(r, s, e, frag.Selections)
}

func applyField(r *Request, s *resolvable.Schema, e resolvable.Resolvable, sels []types.Selection) []Selection {
	switch e := e.(type) {
	case *resolvable.Object:
		return applySelectionSet(r, s, e, sels)
	case *resolvable.List:
		return applyField(r, s, e.Elem, sels)
	case *resolvable.Scalar:
		return nil
	default:
		panic("unreachable")
	}
}

func skipByDirective(r *Request, directives types.DirectiveList) bool {
	if d := directives.Get("skip"); d != nil {
		p := packer.ValuePacker{ValueType: reflect.TypeOf(false)}
		v, err := p.Pack(d.Arguments.MustGet("if").Deserialize(r.Vars))
		if err != nil {
			r.AddError(errors.Errorf("%s", err))
		}
		if err == nil && v.Bool() {
			return true
		}
	}

	if d := directives.Get("include"); d != nil {
		p := packer.ValuePacker{ValueType: reflect.TypeOf(false)}
		v, err := p.Pack(d.Arguments.MustGet("if").Deserialize(r.Vars))
		if err != nil {
			r.AddError(errors.Errorf("%s", err))
		}
		if err == nil && !v.Bool() {
			return true
		}
	}

	return false
}

func HasAsyncSel(sels []Selection) bool {
	for _, sel := range sels {
		switch sel := sel.(type) {
		case *SchemaField:
			if sel.Async {
				return true
			}
		case *TypeAssertion:
			if HasAsyncSel(sel.Sels) {
				return true
			}
		case *TypenameField:
			// sync
		default:
			panic("unreachable")
		}
	}
	return false
}
