package analytics

import (
	"reflect"
	"strings"
)

// Imitate what what the JSON package would do when serializing a struct value,
// the only difference is we we don't serialize zero-value struct fields as well.
// Note that this function doesn't recursively convert structures to maps, only
// the value passed as argument is transformed.
func structToMap(v reflect.Value, m map[string]interface{}) map[string]interface{} {
	t := v.Type()
	n := t.NumField()

	if m == nil {
		m = make(map[string]interface{}, n)
	}

	for i := 0; i != n; i++ {
		field := t.Field(i)
		value := v.Field(i)
		name, omitempty := parseJsonTag(field.Tag.Get("json"), field.Name)

		if name != "-" && !(omitempty && isZeroValue(value)) {
			m[name] = value.Interface()
		}
	}

	return m
}

// Parses a JSON tag the way the json package would do it, returing the expected
// name of the field once serialized and if empty values should be omitted.
func parseJsonTag(tag string, defName string) (name string, omitempty bool) {
	args := strings.Split(tag, ",")

	if len(args) == 0 || len(args[0]) == 0 {
		name = defName
	} else {
		name = args[0]
	}

	if len(args) > 1 && args[1] == "omitempty" {
		omitempty = true
	}

	return
}

// Checks if the value given as argument is a zero-value, it is based on the
// isEmptyValue function in https://golang.org/src/encoding/json/encode.go
// but also checks struct types recursively.
func isZeroValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String:
		return v.Len() == 0

	case reflect.Bool:
		return !v.Bool()

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return v.Uint() == 0

	case reflect.Float32, reflect.Float64:
		return v.Float() == 0

	case reflect.Interface, reflect.Ptr:
		return v.IsNil()

	case reflect.Struct:
		for i, n := 0, v.NumField(); i != n; i++ {
			if !isZeroValue(v.Field(i)) {
				return false
			}
		}
		return true

	case reflect.Invalid:
		return true
	}

	return false
}
