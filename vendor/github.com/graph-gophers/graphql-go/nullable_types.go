package graphql

import (
	"fmt"
	"math"
)

// NullString is a string that can be null. Use it in input structs to
// differentiate a value explicitly set to null from an omitted value.
// When the value is defined (either null or a value) Set is true.
type NullString struct {
	Value *string
	Set   bool
}

func (NullString) ImplementsGraphQLType(name string) bool {
	return name == "String"
}

func (s *NullString) UnmarshalGraphQL(input interface{}) error {
	s.Set = true

	if input == nil {
		return nil
	}

	switch v := input.(type) {
	case string:
		s.Value = &v
		return nil
	default:
		return fmt.Errorf("wrong type for String: %T", v)
	}
}

func (s *NullString) Nullable() {}

// NullBool is a string that can be null. Use it in input structs to
// differentiate a value explicitly set to null from an omitted value.
// When the value is defined (either null or a value) Set is true.
type NullBool struct {
	Value *bool
	Set   bool
}

func (NullBool) ImplementsGraphQLType(name string) bool {
	return name == "Boolean"
}

func (s *NullBool) UnmarshalGraphQL(input interface{}) error {
	s.Set = true

	if input == nil {
		return nil
	}

	switch v := input.(type) {
	case bool:
		s.Value = &v
		return nil
	default:
		return fmt.Errorf("wrong type for Boolean: %T", v)
	}
}

func (s *NullBool) Nullable() {}

// NullInt is a string that can be null. Use it in input structs to
// differentiate a value explicitly set to null from an omitted value.
// When the value is defined (either null or a value) Set is true.
type NullInt struct {
	Value *int32
	Set   bool
}

func (NullInt) ImplementsGraphQLType(name string) bool {
	return name == "Int"
}

func (s *NullInt) UnmarshalGraphQL(input interface{}) error {
	s.Set = true

	if input == nil {
		return nil
	}

	switch v := input.(type) {
	case int32:
		s.Value = &v
		return nil
	case float64:
		coerced := int32(v)
		if v < math.MinInt32 || v > math.MaxInt32 || float64(coerced) != v {
			return fmt.Errorf("not a 32-bit integer")
		}
		s.Value = &coerced
		return nil
	default:
		return fmt.Errorf("wrong type for Int: %T", v)
	}
}

func (s *NullInt) Nullable() {}

// NullFloat is a string that can be null. Use it in input structs to
// differentiate a value explicitly set to null from an omitted value.
// When the value is defined (either null or a value) Set is true.
type NullFloat struct {
	Value *float64
	Set   bool
}

func (NullFloat) ImplementsGraphQLType(name string) bool {
	return name == "Float"
}

func (s *NullFloat) UnmarshalGraphQL(input interface{}) error {
	s.Set = true

	if input == nil {
		return nil
	}

	switch v := input.(type) {
	case float64:
		s.Value = &v
		return nil
	case int32:
		coerced := float64(v)
		s.Value = &coerced
		return nil
	case int:
		coerced := float64(v)
		s.Value = &coerced
		return nil
	default:
		return fmt.Errorf("wrong type for Float: %T", v)
	}
}

func (s *NullFloat) Nullable() {}

// NullTime is a string that can be null. Use it in input structs to
// differentiate a value explicitly set to null from an omitted value.
// When the value is defined (either null or a value) Set is true.
type NullTime struct {
	Value *Time
	Set   bool
}

func (NullTime) ImplementsGraphQLType(name string) bool {
	return name == "Time"
}

func (s *NullTime) UnmarshalGraphQL(input interface{}) error {
	s.Set = true

	if input == nil {
		return nil
	}

	s.Value = new(Time)
	return s.Value.UnmarshalGraphQL(input)
}

func (s *NullTime) Nullable() {}
