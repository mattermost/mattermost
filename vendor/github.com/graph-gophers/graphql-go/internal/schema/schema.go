package schema

import (
	"fmt"
	"text/scanner"

	"github.com/graph-gophers/graphql-go/errors"
	"github.com/graph-gophers/graphql-go/internal/common"
	"github.com/graph-gophers/graphql-go/types"
)

// New initializes an instance of Schema.
func New() *types.Schema {
	s := &types.Schema{
		EntryPointNames: make(map[string]string),
		Types:           make(map[string]types.NamedType),
		Directives:      make(map[string]*types.DirectiveDefinition),
	}
	m := newMeta()
	for n, t := range m.Types {
		s.Types[n] = t
	}
	for n, d := range m.Directives {
		s.Directives[n] = d
	}
	return s
}

func Parse(s *types.Schema, schemaString string, useStringDescriptions bool) error {
	l := common.NewLexer(schemaString, useStringDescriptions)
	err := l.CatchSyntaxError(func() { parseSchema(s, l) })
	if err != nil {
		return err
	}

	if err := mergeExtensions(s); err != nil {
		return err
	}

	for _, t := range s.Types {
		if err := resolveNamedType(s, t); err != nil {
			return err
		}
	}
	for _, d := range s.Directives {
		for _, arg := range d.Arguments {
			t, err := common.ResolveType(arg.Type, s.Resolve)
			if err != nil {
				return err
			}
			arg.Type = t
		}
	}

	// https://graphql.github.io/graphql-spec/June2018/#sec-Root-Operation-Types
	// > While any type can be the root operation type for a GraphQL operation, the type system definition language can
	// > omit the schema definition when the query, mutation, and subscription root types are named Query, Mutation,
	// > and Subscription respectively.
	if len(s.EntryPointNames) == 0 {
		if _, ok := s.Types["Query"]; ok {
			s.EntryPointNames["query"] = "Query"
		}
		if _, ok := s.Types["Mutation"]; ok {
			s.EntryPointNames["mutation"] = "Mutation"
		}
		if _, ok := s.Types["Subscription"]; ok {
			s.EntryPointNames["subscription"] = "Subscription"
		}
	}
	s.EntryPoints = make(map[string]types.NamedType)
	for key, name := range s.EntryPointNames {
		t, ok := s.Types[name]
		if !ok {
			return errors.Errorf("type %q not found", name)
		}
		s.EntryPoints[key] = t
	}

	// Interface types need validation: https://spec.graphql.org/draft/#sec-Interfaces.Interfaces-Implementing-Interfaces
	for _, typeDef := range s.Types {
		switch t := typeDef.(type) {
		case *types.InterfaceTypeDefinition:
			for i, implements := range t.Interfaces {
				typ, ok := s.Types[implements.Name]
				if !ok {
					return errors.Errorf("interface %q not found", implements)
				}
				inteface, ok := typ.(*types.InterfaceTypeDefinition)
				if !ok {
					return errors.Errorf("type %q is not an interface", inteface)
				}

				for _, f := range inteface.Fields.Names() {
					if t.Fields.Get(f) == nil {
						return errors.Errorf("interface %q expects field %q but %q does not provide it", inteface.Name, f, t.Name)
					}
				}

				t.Interfaces[i] = inteface
			}
		default:
			continue
		}
	}

	for _, obj := range s.Objects {
		obj.Interfaces = make([]*types.InterfaceTypeDefinition, len(obj.InterfaceNames))
		if err := resolveDirectives(s, obj.Directives, "OBJECT"); err != nil {
			return err
		}
		for _, field := range obj.Fields {
			if err := resolveDirectives(s, field.Directives, "FIELD_DEFINITION"); err != nil {
				return err
			}
		}
		for i, intfName := range obj.InterfaceNames {
			t, ok := s.Types[intfName]
			if !ok {
				return errors.Errorf("interface %q not found", intfName)
			}
			intf, ok := t.(*types.InterfaceTypeDefinition)
			if !ok {
				return errors.Errorf("type %q is not an interface", intfName)
			}
			for _, f := range intf.Fields.Names() {
				if obj.Fields.Get(f) == nil {
					return errors.Errorf("interface %q expects field %q but %q does not provide it", intfName, f, obj.Name)
				}
			}
			obj.Interfaces[i] = intf
			intf.PossibleTypes = append(intf.PossibleTypes, obj)
		}
	}

	for _, union := range s.Unions {
		if err := resolveDirectives(s, union.Directives, "UNION"); err != nil {
			return err
		}
		union.UnionMemberTypes = make([]*types.ObjectTypeDefinition, len(union.TypeNames))
		for i, name := range union.TypeNames {
			t, ok := s.Types[name]
			if !ok {
				return errors.Errorf("object type %q not found", name)
			}
			obj, ok := t.(*types.ObjectTypeDefinition)
			if !ok {
				return errors.Errorf("type %q is not an object", name)
			}
			union.UnionMemberTypes[i] = obj
		}
	}

	for _, enum := range s.Enums {
		if err := resolveDirectives(s, enum.Directives, "ENUM"); err != nil {
			return err
		}
		for _, value := range enum.EnumValuesDefinition {
			if err := resolveDirectives(s, value.Directives, "ENUM_VALUE"); err != nil {
				return err
			}
		}
	}

	return nil
}

func ParseSchema(schemaString string, useStringDescriptions bool) (*types.Schema, error) {
	s := New()
	err := Parse(s, schemaString, useStringDescriptions)
	return s, err
}

func mergeExtensions(s *types.Schema) error {
	for _, ext := range s.Extensions {
		typ := s.Types[ext.Type.TypeName()]
		if typ == nil {
			return fmt.Errorf("trying to extend unknown type %q", ext.Type.TypeName())
		}

		if typ.Kind() != ext.Type.Kind() {
			return fmt.Errorf("trying to extend type %q with type %q", typ.Kind(), ext.Type.Kind())
		}

		switch og := typ.(type) {
		case *types.ObjectTypeDefinition:
			e := ext.Type.(*types.ObjectTypeDefinition)

			for _, field := range e.Fields {
				if og.Fields.Get(field.Name) != nil {
					return fmt.Errorf("extended field %q already exists", field.Name)
				}
			}
			og.Fields = append(og.Fields, e.Fields...)

			for _, en := range e.InterfaceNames {
				for _, on := range og.InterfaceNames {
					if on == en {
						return fmt.Errorf("interface %q implemented in the extension is already implemented in %q", on, og.Name)
					}
				}
			}
			og.InterfaceNames = append(og.InterfaceNames, e.InterfaceNames...)

		case *types.InputObject:
			e := ext.Type.(*types.InputObject)

			for _, field := range e.Values {
				if og.Values.Get(field.Name.Name) != nil {
					return fmt.Errorf("extended field %q already exists", field.Name)
				}
			}
			og.Values = append(og.Values, e.Values...)

		case *types.InterfaceTypeDefinition:
			e := ext.Type.(*types.InterfaceTypeDefinition)

			for _, field := range e.Fields {
				if og.Fields.Get(field.Name) != nil {
					return fmt.Errorf("extended field %s already exists", field.Name)
				}
			}
			og.Fields = append(og.Fields, e.Fields...)

		case *types.Union:
			e := ext.Type.(*types.Union)

			for _, en := range e.TypeNames {
				for _, on := range og.TypeNames {
					if on == en {
						return fmt.Errorf("union type %q already declared in %q", on, og.Name)
					}
				}
			}
			og.TypeNames = append(og.TypeNames, e.TypeNames...)

		case *types.EnumTypeDefinition:
			e := ext.Type.(*types.EnumTypeDefinition)

			for _, en := range e.EnumValuesDefinition {
				for _, on := range og.EnumValuesDefinition {
					if on.EnumValue == en.EnumValue {
						return fmt.Errorf("enum value %q already declared in %q", on.EnumValue, og.Name)
					}
				}
			}
			og.EnumValuesDefinition = append(og.EnumValuesDefinition, e.EnumValuesDefinition...)
		default:
			return fmt.Errorf(`unexpected %q, expecting "schema", "type", "enum", "interface", "union" or "input"`, og.TypeName())
		}
	}

	return nil
}

func resolveNamedType(s *types.Schema, t types.NamedType) error {
	switch t := t.(type) {
	case *types.ObjectTypeDefinition:
		for _, f := range t.Fields {
			if err := resolveField(s, f); err != nil {
				return err
			}
		}
	case *types.InterfaceTypeDefinition:
		for _, f := range t.Fields {
			if err := resolveField(s, f); err != nil {
				return err
			}
		}
	case *types.InputObject:
		if err := resolveInputObject(s, t.Values); err != nil {
			return err
		}
	}
	return nil
}

func resolveField(s *types.Schema, f *types.FieldDefinition) error {
	t, err := common.ResolveType(f.Type, s.Resolve)
	if err != nil {
		return err
	}
	f.Type = t
	if err := resolveDirectives(s, f.Directives, "FIELD_DEFINITION"); err != nil {
		return err
	}
	return resolveInputObject(s, f.Arguments)
}

func resolveDirectives(s *types.Schema, directives types.DirectiveList, loc string) error {
	for _, d := range directives {
		dirName := d.Name.Name
		dd, ok := s.Directives[dirName]
		if !ok {
			return errors.Errorf("directive %q not found", dirName)
		}
		validLoc := false
		for _, l := range dd.Locations {
			if l == loc {
				validLoc = true
				break
			}
		}
		if !validLoc {
			return errors.Errorf("invalid location %q for directive %q (must be one of %v)", loc, dirName, dd.Locations)
		}
		for _, arg := range d.Arguments {
			if dd.Arguments.Get(arg.Name.Name) == nil {
				return errors.Errorf("invalid argument %q for directive %q", arg.Name.Name, dirName)
			}
		}
		for _, arg := range dd.Arguments {
			if _, ok := d.Arguments.Get(arg.Name.Name); !ok {
				d.Arguments = append(d.Arguments, &types.Argument{Name: arg.Name, Value: arg.Default})
			}
		}
	}
	return nil
}

func resolveInputObject(s *types.Schema, values types.ArgumentsDefinition) error {
	for _, v := range values {
		t, err := common.ResolveType(v.Type, s.Resolve)
		if err != nil {
			return err
		}
		v.Type = t
	}
	return nil
}

func parseSchema(s *types.Schema, l *common.Lexer) {
	l.ConsumeWhitespace()

	for l.Peek() != scanner.EOF {
		desc := l.DescComment()
		switch x := l.ConsumeIdent(); x {

		case "schema":
			l.ConsumeToken('{')
			for l.Peek() != '}' {

				name := l.ConsumeIdent()
				l.ConsumeToken(':')
				typ := l.ConsumeIdent()
				s.EntryPointNames[name] = typ
			}
			l.ConsumeToken('}')

		case "type":
			obj := parseObjectDef(l)
			obj.Desc = desc
			s.Types[obj.Name] = obj
			s.Objects = append(s.Objects, obj)

		case "interface":
			iface := parseInterfaceDef(l)
			iface.Desc = desc
			s.Types[iface.Name] = iface

		case "union":
			union := parseUnionDef(l)
			union.Desc = desc
			s.Types[union.Name] = union
			s.Unions = append(s.Unions, union)

		case "enum":
			enum := parseEnumDef(l)
			enum.Desc = desc
			s.Types[enum.Name] = enum
			s.Enums = append(s.Enums, enum)

		case "input":
			input := parseInputDef(l)
			input.Desc = desc
			s.Types[input.Name] = input

		case "scalar":
			loc := l.Location()
			name := l.ConsumeIdent()
			directives := common.ParseDirectives(l)
			s.Types[name] = &types.ScalarTypeDefinition{Name: name, Desc: desc, Directives: directives, Loc: loc}

		case "directive":
			directive := parseDirectiveDef(l)
			directive.Desc = desc
			s.Directives[directive.Name] = directive

		case "extend":
			parseExtension(s, l)

		default:
			// TODO: Add support for type extensions.
			l.SyntaxError(fmt.Sprintf(`unexpected %q, expecting "schema", "type", "enum", "interface", "union", "input", "scalar" or "directive"`, x))
		}
	}
}

func parseObjectDef(l *common.Lexer) *types.ObjectTypeDefinition {
	object := &types.ObjectTypeDefinition{Loc: l.Location(), Name: l.ConsumeIdent()}

	for {
		if l.Peek() == '{' {
			break
		}

		if l.Peek() == '@' {
			object.Directives = common.ParseDirectives(l)
			continue
		}

		if l.Peek() == scanner.Ident {
			l.ConsumeKeyword("implements")

			for l.Peek() != '{' && l.Peek() != '@' {
				if l.Peek() == '&' {
					l.ConsumeToken('&')
				}

				object.InterfaceNames = append(object.InterfaceNames, l.ConsumeIdent())
			}
			continue
		}

	}
	l.ConsumeToken('{')
	object.Fields = parseFieldsDef(l)
	l.ConsumeToken('}')

	return object

}

func parseInterfaceDef(l *common.Lexer) *types.InterfaceTypeDefinition {
	i := &types.InterfaceTypeDefinition{Loc: l.Location(), Name: l.ConsumeIdent()}

	if l.Peek() == scanner.Ident {
		l.ConsumeKeyword("implements")
		i.Interfaces = append(i.Interfaces, &types.InterfaceTypeDefinition{Name: l.ConsumeIdent()})

		for l.Peek() == '&' {
			l.ConsumeToken('&')
			i.Interfaces = append(i.Interfaces, &types.InterfaceTypeDefinition{Name: l.ConsumeIdent()})
		}
	}

	i.Directives = common.ParseDirectives(l)

	l.ConsumeToken('{')
	i.Fields = parseFieldsDef(l)
	l.ConsumeToken('}')

	return i
}

func parseUnionDef(l *common.Lexer) *types.Union {
	union := &types.Union{Loc: l.Location(), Name: l.ConsumeIdent()}

	union.Directives = common.ParseDirectives(l)
	l.ConsumeToken('=')
	union.TypeNames = []string{l.ConsumeIdent()}
	for l.Peek() == '|' {
		l.ConsumeToken('|')
		union.TypeNames = append(union.TypeNames, l.ConsumeIdent())
	}

	return union
}

func parseInputDef(l *common.Lexer) *types.InputObject {
	i := &types.InputObject{}
	i.Loc = l.Location()
	i.Name = l.ConsumeIdent()
	i.Directives = common.ParseDirectives(l)
	l.ConsumeToken('{')
	for l.Peek() != '}' {
		i.Values = append(i.Values, common.ParseInputValue(l))
	}
	l.ConsumeToken('}')
	return i
}

func parseEnumDef(l *common.Lexer) *types.EnumTypeDefinition {
	enum := &types.EnumTypeDefinition{Loc: l.Location(), Name: l.ConsumeIdent()}

	enum.Directives = common.ParseDirectives(l)
	l.ConsumeToken('{')
	for l.Peek() != '}' {
		v := &types.EnumValueDefinition{
			Desc:       l.DescComment(),
			Loc:        l.Location(),
			EnumValue:  l.ConsumeIdent(),
			Directives: common.ParseDirectives(l),
		}

		enum.EnumValuesDefinition = append(enum.EnumValuesDefinition, v)
	}
	l.ConsumeToken('}')
	return enum
}
func parseDirectiveDef(l *common.Lexer) *types.DirectiveDefinition {
	l.ConsumeToken('@')
	loc := l.Location()
	d := &types.DirectiveDefinition{Name: l.ConsumeIdent(), Loc: loc}

	if l.Peek() == '(' {
		l.ConsumeToken('(')
		for l.Peek() != ')' {
			v := common.ParseInputValue(l)
			d.Arguments = append(d.Arguments, v)
		}
		l.ConsumeToken(')')
	}

	l.ConsumeKeyword("on")

	for {
		loc := l.ConsumeIdent()
		d.Locations = append(d.Locations, loc)
		if l.Peek() != '|' {
			break
		}
		l.ConsumeToken('|')
	}
	return d
}

func parseExtension(s *types.Schema, l *common.Lexer) {
	loc := l.Location()
	switch x := l.ConsumeIdent(); x {
	case "schema":
		l.ConsumeToken('{')
		for l.Peek() != '}' {
			name := l.ConsumeIdent()
			l.ConsumeToken(':')
			typ := l.ConsumeIdent()
			s.EntryPointNames[name] = typ
		}
		l.ConsumeToken('}')

	case "type":
		obj := parseObjectDef(l)
		s.Extensions = append(s.Extensions, &types.Extension{Type: obj, Loc: loc})

	case "interface":
		iface := parseInterfaceDef(l)
		s.Extensions = append(s.Extensions, &types.Extension{Type: iface, Loc: loc})

	case "union":
		union := parseUnionDef(l)
		s.Extensions = append(s.Extensions, &types.Extension{Type: union, Loc: loc})

	case "enum":
		enum := parseEnumDef(l)
		s.Extensions = append(s.Extensions, &types.Extension{Type: enum, Loc: loc})

	case "input":
		input := parseInputDef(l)
		s.Extensions = append(s.Extensions, &types.Extension{Type: input, Loc: loc})

	default:
		// TODO: Add ScalarTypeDefinition when adding directives
		l.SyntaxError(fmt.Sprintf(`unexpected %q, expecting "schema", "type", "enum", "interface", "union" or "input"`, x))
	}
}

func parseFieldsDef(l *common.Lexer) types.FieldsDefinition {
	var fields types.FieldsDefinition
	for l.Peek() != '}' {
		f := &types.FieldDefinition{}
		f.Desc = l.DescComment()
		f.Loc = l.Location()
		f.Name = l.ConsumeIdent()
		if l.Peek() == '(' {
			l.ConsumeToken('(')
			for l.Peek() != ')' {
				f.Arguments = append(f.Arguments, common.ParseInputValue(l))
			}
			l.ConsumeToken(')')
		}
		l.ConsumeToken(':')
		f.Type = common.ParseType(l)
		f.Directives = common.ParseDirectives(l)
		fields = append(fields, f)
	}
	return fields
}
