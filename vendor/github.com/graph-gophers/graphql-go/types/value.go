package types

import (
	"strconv"
	"strings"
	"text/scanner"

	"github.com/graph-gophers/graphql-go/errors"
)

// Value represents a literal input or literal default value in the GraphQL Specification.
//
// http://spec.graphql.org/draft/#sec-Input-Values
type Value interface {
	// Deserialize transforms a GraphQL specification format literal into a Go type.
	Deserialize(vars map[string]interface{}) interface{}

	// String serializes a Value into a GraphQL specification format literal.
	String() string
	Location() errors.Location
}

// PrimitiveValue represents one of the following GraphQL scalars: Int, Float,
// String, or Boolean
type PrimitiveValue struct {
	Type rune
	Text string
	Loc  errors.Location
}

func (val *PrimitiveValue) Deserialize(vars map[string]interface{}) interface{} {
	switch val.Type {
	case scanner.Int:
		value, err := strconv.ParseInt(val.Text, 10, 32)
		if err != nil {
			panic(err)
		}
		return int32(value)

	case scanner.Float:
		value, err := strconv.ParseFloat(val.Text, 64)
		if err != nil {
			panic(err)
		}
		return value

	case scanner.String:
		value, err := strconv.Unquote(val.Text)
		if err != nil {
			panic(err)
		}
		return value

	case scanner.Ident:
		switch val.Text {
		case "true":
			return true
		case "false":
			return false
		default:
			return val.Text
		}

	default:
		panic("invalid literal value")
	}
}

func (val *PrimitiveValue) String() string            { return val.Text }
func (val *PrimitiveValue) Location() errors.Location { return val.Loc }

// ListValue represents a literal list Value in the GraphQL specification.
//
// http://spec.graphql.org/draft/#sec-List-Value
type ListValue struct {
	Values []Value
	Loc    errors.Location
}

func (val *ListValue) Deserialize(vars map[string]interface{}) interface{} {
	entries := make([]interface{}, len(val.Values))
	for i, entry := range val.Values {
		entries[i] = entry.Deserialize(vars)
	}
	return entries
}

func (val *ListValue) String() string {
	entries := make([]string, len(val.Values))
	for i, entry := range val.Values {
		entries[i] = entry.String()
	}
	return "[" + strings.Join(entries, ", ") + "]"
}

func (val *ListValue) Location() errors.Location { return val.Loc }

// ObjectValue represents a literal object Value in the GraphQL specification.
//
// http://spec.graphql.org/draft/#sec-Object-Value
type ObjectValue struct {
	Fields []*ObjectField
	Loc    errors.Location
}

// ObjectField represents field/value pairs in a literal ObjectValue.
type ObjectField struct {
	Name  Ident
	Value Value
}

func (val *ObjectValue) Deserialize(vars map[string]interface{}) interface{} {
	fields := make(map[string]interface{}, len(val.Fields))
	for _, f := range val.Fields {
		fields[f.Name.Name] = f.Value.Deserialize(vars)
	}
	return fields
}

func (val *ObjectValue) String() string {
	entries := make([]string, 0, len(val.Fields))
	for _, f := range val.Fields {
		entries = append(entries, f.Name.Name+": "+f.Value.String())
	}
	return "{" + strings.Join(entries, ", ") + "}"
}

func (val *ObjectValue) Location() errors.Location {
	return val.Loc
}

// NullValue represents a literal `null` Value in the GraphQL specification.
//
// http://spec.graphql.org/draft/#sec-Null-Value
type NullValue struct {
	Loc errors.Location
}

func (val *NullValue) Deserialize(vars map[string]interface{}) interface{} { return nil }
func (val *NullValue) String() string                                      { return "null" }
func (val *NullValue) Location() errors.Location                           { return val.Loc }
