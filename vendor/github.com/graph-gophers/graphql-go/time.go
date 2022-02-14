package graphql

import (
	"encoding/json"
	"fmt"
	"time"
)

// Time is a custom GraphQL type to represent an instant in time. It has to be added to a schema
// via "scalar Time" since it is not a predeclared GraphQL type like "ID".
type Time struct {
	time.Time
}

// ImplementsGraphQLType maps this custom Go type
// to the graphql scalar type in the schema.
func (Time) ImplementsGraphQLType(name string) bool {
	return name == "Time"
}

// UnmarshalGraphQL is a custom unmarshaler for Time
//
// This function will be called whenever you use the
// time scalar as an input
func (t *Time) UnmarshalGraphQL(input interface{}) error {
	switch input := input.(type) {
	case time.Time:
		t.Time = input
		return nil
	case string:
		var err error
		t.Time, err = time.Parse(time.RFC3339, input)
		return err
	case []byte:
		var err error
		t.Time, err = time.Parse(time.RFC3339, string(input))
		return err
	case int32:
		t.Time = time.Unix(int64(input), 0)
		return nil
	case int64:
		if input >= 1e10 {
			sec := input / 1e9
			nsec := input - (sec * 1e9)
			t.Time = time.Unix(sec, nsec)
		} else {
			t.Time = time.Unix(input, 0)
		}
		return nil
	case float64:
		t.Time = time.Unix(int64(input), 0)
		return nil
	default:
		return fmt.Errorf("wrong type for Time: %T", input)
	}
}

// MarshalJSON is a custom marshaler for Time
//
// This function will be called whenever you
// query for fields that use the Time type
func (t Time) MarshalJSON() ([]byte, error) {
	return json.Marshal(t.Time)
}
