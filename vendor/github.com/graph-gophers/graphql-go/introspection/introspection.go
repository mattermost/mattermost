package introspection

import (
	"sort"

	"github.com/graph-gophers/graphql-go/types"
)

type Schema struct {
	schema *types.Schema
}

// WrapSchema is only used internally.
func WrapSchema(schema *types.Schema) *Schema {
	return &Schema{schema}
}

func (r *Schema) Types() []*Type {
	var names []string
	for name := range r.schema.Types {
		names = append(names, name)
	}
	sort.Strings(names)

	l := make([]*Type, len(names))
	for i, name := range names {
		l[i] = &Type{r.schema.Types[name]}
	}
	return l
}

func (r *Schema) Directives() []*Directive {
	var names []string
	for name := range r.schema.Directives {
		names = append(names, name)
	}
	sort.Strings(names)

	l := make([]*Directive, len(names))
	for i, name := range names {
		l[i] = &Directive{r.schema.Directives[name]}
	}
	return l
}

func (r *Schema) QueryType() *Type {
	t, ok := r.schema.EntryPoints["query"]
	if !ok {
		return nil
	}
	return &Type{t}
}

func (r *Schema) MutationType() *Type {
	t, ok := r.schema.EntryPoints["mutation"]
	if !ok {
		return nil
	}
	return &Type{t}
}

func (r *Schema) SubscriptionType() *Type {
	t, ok := r.schema.EntryPoints["subscription"]
	if !ok {
		return nil
	}
	return &Type{t}
}

type Type struct {
	typ types.Type
}

// WrapType is only used internally.
func WrapType(typ types.Type) *Type {
	return &Type{typ}
}

func (r *Type) Kind() string {
	return r.typ.Kind()
}

func (r *Type) Name() *string {
	if named, ok := r.typ.(types.NamedType); ok {
		name := named.TypeName()
		return &name
	}
	return nil
}

func (r *Type) Description() *string {
	if named, ok := r.typ.(types.NamedType); ok {
		desc := named.Description()
		if desc == "" {
			return nil
		}
		return &desc
	}
	return nil
}

func (r *Type) Fields(args *struct{ IncludeDeprecated bool }) *[]*Field {
	var fields types.FieldsDefinition
	switch t := r.typ.(type) {
	case *types.ObjectTypeDefinition:
		fields = t.Fields
	case *types.InterfaceTypeDefinition:
		fields = t.Fields
	default:
		return nil
	}

	var l []*Field
	for _, f := range fields {
		if d := f.Directives.Get("deprecated"); d == nil || args.IncludeDeprecated {
			l = append(l, &Field{field: f})
		}
	}
	return &l
}

func (r *Type) Interfaces() *[]*Type {
	t, ok := r.typ.(*types.ObjectTypeDefinition)
	if !ok {
		return nil
	}

	l := make([]*Type, len(t.Interfaces))
	for i, intf := range t.Interfaces {
		l[i] = &Type{intf}
	}
	return &l
}

func (r *Type) PossibleTypes() *[]*Type {
	var possibleTypes []*types.ObjectTypeDefinition
	switch t := r.typ.(type) {
	case *types.InterfaceTypeDefinition:
		possibleTypes = t.PossibleTypes
	case *types.Union:
		possibleTypes = t.UnionMemberTypes
	default:
		return nil
	}

	l := make([]*Type, len(possibleTypes))
	for i, intf := range possibleTypes {
		l[i] = &Type{intf}
	}
	return &l
}

func (r *Type) EnumValues(args *struct{ IncludeDeprecated bool }) *[]*EnumValue {
	t, ok := r.typ.(*types.EnumTypeDefinition)
	if !ok {
		return nil
	}

	var l []*EnumValue
	for _, v := range t.EnumValuesDefinition {
		if d := v.Directives.Get("deprecated"); d == nil || args.IncludeDeprecated {
			l = append(l, &EnumValue{v})
		}
	}
	return &l
}

func (r *Type) InputFields() *[]*InputValue {
	t, ok := r.typ.(*types.InputObject)
	if !ok {
		return nil
	}

	l := make([]*InputValue, len(t.Values))
	for i, v := range t.Values {
		l[i] = &InputValue{v}
	}
	return &l
}

func (r *Type) OfType() *Type {
	switch t := r.typ.(type) {
	case *types.List:
		return &Type{t.OfType}
	case *types.NonNull:
		return &Type{t.OfType}
	default:
		return nil
	}
}

type Field struct {
	field *types.FieldDefinition
}

func (r *Field) Name() string {
	return r.field.Name
}

func (r *Field) Description() *string {
	if r.field.Desc == "" {
		return nil
	}
	return &r.field.Desc
}

func (r *Field) Args() []*InputValue {
	l := make([]*InputValue, len(r.field.Arguments))
	for i, v := range r.field.Arguments {
		l[i] = &InputValue{v}
	}
	return l
}

func (r *Field) Type() *Type {
	return &Type{r.field.Type}
}

func (r *Field) IsDeprecated() bool {
	return r.field.Directives.Get("deprecated") != nil
}

func (r *Field) DeprecationReason() *string {
	d := r.field.Directives.Get("deprecated")
	if d == nil {
		return nil
	}
	reason := d.Arguments.MustGet("reason").Deserialize(nil).(string)
	return &reason
}

type InputValue struct {
	value *types.InputValueDefinition
}

func (r *InputValue) Name() string {
	return r.value.Name.Name
}

func (r *InputValue) Description() *string {
	if r.value.Desc == "" {
		return nil
	}
	return &r.value.Desc
}

func (r *InputValue) Type() *Type {
	return &Type{r.value.Type}
}

func (r *InputValue) DefaultValue() *string {
	if r.value.Default == nil {
		return nil
	}
	s := r.value.Default.String()
	return &s
}

type EnumValue struct {
	value *types.EnumValueDefinition
}

func (r *EnumValue) Name() string {
	return r.value.EnumValue
}

func (r *EnumValue) Description() *string {
	if r.value.Desc == "" {
		return nil
	}
	return &r.value.Desc
}

func (r *EnumValue) IsDeprecated() bool {
	return r.value.Directives.Get("deprecated") != nil
}

func (r *EnumValue) DeprecationReason() *string {
	d := r.value.Directives.Get("deprecated")
	if d == nil {
		return nil
	}
	reason := d.Arguments.MustGet("reason").Deserialize(nil).(string)
	return &reason
}

type Directive struct {
	directive *types.DirectiveDefinition
}

func (r *Directive) Name() string {
	return r.directive.Name
}

func (r *Directive) Description() *string {
	if r.directive.Desc == "" {
		return nil
	}
	return &r.directive.Desc
}

func (r *Directive) Locations() []string {
	return r.directive.Locations
}

func (r *Directive) Args() []*InputValue {
	l := make([]*InputValue, len(r.directive.Arguments))
	for i, v := range r.directive.Arguments {
		l[i] = &InputValue{v}
	}
	return l
}

type Service struct {
	schema *types.Schema
}

// WrapService is only used internally.
func WrapService(schema *types.Schema) *Service {
	return &Service{schema}
}

func (r *Service) SDL() string {
	return r.schema.SchemaString
}
