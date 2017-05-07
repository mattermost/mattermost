package toml

import (
	"bytes"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"
	"reflect"
)

// encodes a string to a TOML-compliant string value
func encodeTomlString(value string) string {
	result := ""
	for _, rr := range value {
		switch rr {
		case '\b':
			result += "\\b"
		case '\t':
			result += "\\t"
		case '\n':
			result += "\\n"
		case '\f':
			result += "\\f"
		case '\r':
			result += "\\r"
		case '"':
			result += "\\\""
		case '\\':
			result += "\\\\"
		default:
			intRr := uint16(rr)
			if intRr < 0x001F {
				result += fmt.Sprintf("\\u%0.4X", intRr)
			} else {
				result += string(rr)
			}
		}
	}
	return result
}

func tomlValueStringRepresentation(v interface{}) (string, error) {
	switch value := v.(type) {
	case uint64:
		return strconv.FormatUint(value, 10), nil
	case int64:
		return strconv.FormatInt(value, 10), nil
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 32), nil
	case string:
		return "\"" + encodeTomlString(value) + "\"", nil
	case []byte:
		b, _ := v.([]byte)
		return tomlValueStringRepresentation(string(b))
	case bool:
		if value {
			return "true", nil
		}
		return "false", nil
	case time.Time:
		return value.Format(time.RFC3339), nil
	case nil:
		return "", nil
	}

	rv := reflect.ValueOf(v)

	if rv.Kind() == reflect.Slice {
		values := []string{}
		for i := 0; i < rv.Len(); i++ {
			item := rv.Index(i).Interface()
			itemRepr, err := tomlValueStringRepresentation(item)
			if err != nil {
				return "", err
			}
			values = append(values, itemRepr)
		}
		return "[" + strings.Join(values, ",") + "]", nil
	}
	return "", fmt.Errorf("unsupported value type %T: %v", v, v)
}

func (t *TomlTree) writeTo(w io.Writer, indent, keyspace string, bytesCount int64) (int64, error) {
	simpleValuesKeys := make([]string, 0)
	complexValuesKeys := make([]string, 0)

	for k := range t.values {
		v := t.values[k]
		switch v.(type) {
		case *TomlTree, []*TomlTree:
			complexValuesKeys = append(complexValuesKeys, k)
		default:
			simpleValuesKeys = append(simpleValuesKeys, k)
		}
	}

	sort.Strings(simpleValuesKeys)
	sort.Strings(complexValuesKeys)

	for _, k := range simpleValuesKeys {
		v, ok := t.values[k].(*tomlValue)
		if !ok {
			return bytesCount, fmt.Errorf("invalid value type at %s: %T", k, t.values[k])
		}

		repr, err := tomlValueStringRepresentation(v.value)
		if err != nil {
			return bytesCount, err
		}

		kvRepr := fmt.Sprintf("%s%s = %s\n", indent, k, repr)
		writtenBytesCount, err := w.Write([]byte(kvRepr))
		bytesCount += int64(writtenBytesCount)
		if err != nil {
			return bytesCount, err
		}
	}

	for _, k := range complexValuesKeys {
		v := t.values[k]

		combinedKey := k
		if keyspace != "" {
			combinedKey = keyspace + "." + combinedKey
		}

		switch node := v.(type) {
		// node has to be of those two types given how keys are sorted above
		case *TomlTree:
			tableName := fmt.Sprintf("\n%s[%s]\n", indent, combinedKey)
			writtenBytesCount, err := w.Write([]byte(tableName))
			bytesCount += int64(writtenBytesCount)
			if err != nil {
				return bytesCount, err
			}
			bytesCount, err = node.writeTo(w, indent+"  ", combinedKey, bytesCount)
			if err != nil {
				return bytesCount, err
			}
		case []*TomlTree:
			for _, subTree := range node {
				if len(subTree.values) > 0 {
					tableArrayName := fmt.Sprintf("\n%s[[%s]]\n", indent, combinedKey)
					writtenBytesCount, err := w.Write([]byte(tableArrayName))
					bytesCount += int64(writtenBytesCount)
					if err != nil {
						return bytesCount, err
					}

					bytesCount, err = subTree.writeTo(w, indent+"  ", combinedKey, bytesCount)
					if err != nil {
						return bytesCount, err
					}
				}
			}
		}
	}

	return bytesCount, nil
}

// WriteTo encode the TomlTree as Toml and writes it to the writer w.
// Returns the number of bytes written in case of success, or an error if anything happened.
func (t *TomlTree) WriteTo(w io.Writer) (int64, error) {
	return t.writeTo(w, "", "", 0)
}

// ToTomlString generates a human-readable representation of the current tree.
// Output spans multiple lines, and is suitable for ingest by a TOML parser.
// If the conversion cannot be performed, ToString returns a non-nil error.
func (t *TomlTree) ToTomlString() (string, error) {
	var buf bytes.Buffer
	_, err := t.WriteTo(&buf)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

// String generates a human-readable representation of the current tree.
// Alias of ToString. Present to implement the fmt.Stringer interface.
func (t *TomlTree) String() string {
	result, _ := t.ToTomlString()
	return result
}

// ToMap recursively generates a representation of the tree using Go built-in structures.
// The following types are used:
// * uint64
// * int64
// * bool
// * string
// * time.Time
// * map[string]interface{} (where interface{} is any of this list)
// * []interface{} (where interface{} is any of this list)
func (t *TomlTree) ToMap() map[string]interface{} {
	result := map[string]interface{}{}

	for k, v := range t.values {
		switch node := v.(type) {
		case []*TomlTree:
			var array []interface{}
			for _, item := range node {
				array = append(array, item.ToMap())
			}
			result[k] = array
		case *TomlTree:
			result[k] = node.ToMap()
		case *tomlValue:
			result[k] = node.value
		}
	}
	return result
}
