package dynamizer

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"runtime"
	"strconv"

	"github.com/cbroglie/mapstructure"
)

// A DynamoAttribute represents the union of possible DynamoDB attribute values.
// See http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
//
// Since the intention is to use this with JSON documents (or structs
// representing JSON documents), the binary and set types have been omitted.
type DynamoAttribute struct {
	S    *string                     `json:",omitempty"` // pointer so we can represent the zero-value
	N    string                      `json:",omitempty"`
	BOOL *bool                       `json:",omitempty"` // pointer so we can represent the zero-value
	NULL bool                        `json:",omitempty"`
	M    map[string]*DynamoAttribute `json:",omitempty"`
	L    []*DynamoAttribute          `json:",omitempty"`
}

// A DynamoItem represents a the top level item stored in DyanmoDB.
type DynamoItem map[string]*DynamoAttribute

// ToDynamo accepts a map or struct in basic JSON format and converts it to a
// map which can be JSON-encoded into the DynamoDB format.
//
// If in is a struct, we first JSON encode/decode it to get the data as a map.
// This can/should be optimized later.
func ToDynamo(in interface{}) (item DynamoItem, err error) {
	defer func() {
		if r := recover(); r != nil {
			if e, ok := r.(runtime.Error); ok {
				err = e
			} else if s, ok := r.(string); ok {
				err = errors.New(s)
			} else {
				err = r.(error)
			}
			item = nil
		}
	}()

	v := reflect.ValueOf(in)
	switch v.Kind() {
	case reflect.Struct:
		item = dynamizeStruct(in)
	case reflect.Map:
		if v.Type().Key().Kind() != reflect.String {
			return nil, errors.New("item must be a map[string]interface{} or struct (or a non-nil pointer to one), got " + v.Type().String())
		}
		item = dynamizeMap(in)
	case reflect.Ptr:
		if v.IsNil() {
			return nil, errors.New("item must not be nil")
		}
		return ToDynamo(v.Elem().Interface())
	default:
		return nil, errors.New("item must be a map[string]interface{} or struct (or a non-nil pointer to one), got " + v.Type().String())
	}
	return item, nil
}

// FromDynamo takes a map of DynamoDB attributes and converts it into a map or
// struct in basic JSON format.
//
// If v points to a struct, we first convert it to a basic map, then JSON
// encode/decode it to convert to a struct. This can/should be optimized later.
func FromDynamo(item DynamoItem, v interface{}) (err error) {
	defer func() {
		if r := recover(); r != nil {
			if e, ok := r.(runtime.Error); ok {
				err = e
			} else if s, ok := r.(string); ok {
				err = errors.New(s)
			} else {
				err = r.(error)
			}
			item = nil
		}
	}()

	m := make(map[string]interface{})
	for k, v := range item {
		m[k] = undynamize(v)
	}

	// Handle the case where v is already a reflect.Value object representing a
	// struct or map.
	rv, ok := v.(reflect.Value)
	var rt reflect.Type
	if ok {
		rt = rv.Type()
		if !rv.CanAddr() {
			return fmt.Errorf("v is not addressable")
		}
	} else {
		rv = reflect.ValueOf(v)
		if rv.Kind() != reflect.Ptr || rv.IsNil() {
			if rv.IsValid() {
				return fmt.Errorf("v must be a non-nil pointer to a map[string]interface{} or struct (or an addressable reflect.Value), got %s", rv.Type().String())
			} else {
				return fmt.Errorf("v must be a non-nil pointer to a map[string]interface{} or struct (or an addressable reflect.Value), got zero-value")
			}
		}
		rt = rv.Type()
		rv = rv.Elem()
	}

	switch rv.Kind() {
	case reflect.Struct:
		config := &mapstructure.DecoderConfig{
			TagName: "json",
			Result:  v,
		}
		decoder, err := mapstructure.NewDecoder(config)
		if err != nil {
			return err
		}
		return decoder.Decode(m)
	case reflect.Map:
		if rv.Type().Key().Kind() != reflect.String {
			return fmt.Errorf("v must be a non-nil pointer to a map[string]interface{} or struct (or an addressable reflect.Value), got %s", rt.String())
		}
		rv.Set(reflect.ValueOf(m))
	default:
		return fmt.Errorf("v must be a non-nil pointer to a map[string]interface{} or struct (or an addressable reflect.Value), got %s", rt.String())
	}

	return nil
}

func dynamizeStruct(in interface{}) DynamoItem {
	// TODO: We convert structs into basic maps by JSON encoding/decoding. This
	// can be made more efficient by recursing over the struct directly.
	b, err := json.Marshal(in)
	if err != nil {
		panic(err)
	}

	var m map[string]interface{}
	decoder := json.NewDecoder(bytes.NewReader(b))
	decoder.UseNumber()
	err = decoder.Decode(&m)
	if err != nil {
		panic(err)
	}

	return dynamizeMap(m)
}

func dynamizeMap(in interface{}) DynamoItem {
	item := make(DynamoItem)
	m := in.(map[string]interface{})
	for k, v := range m {
		item[k] = dynamize(v)
	}
	return item
}

func dynamize(in interface{}) *DynamoAttribute {
	a := &DynamoAttribute{}

	if in == nil {
		a.NULL = true
		return a
	}

	if m, ok := in.(map[string]interface{}); ok {
		a.M = make(map[string]*DynamoAttribute)
		for k, v := range m {
			a.M[k] = dynamize(v)
		}
		return a
	}

	if l, ok := in.([]interface{}); ok {
		a.L = make([]*DynamoAttribute, len(l))
		for index, v := range l {
			a.L[index] = dynamize(v)
		}
		return a
	}

	// Only primitive types should remain.
	v := reflect.ValueOf(in)
	switch v.Kind() {
	case reflect.Bool:
		a.BOOL = new(bool)
		*a.BOOL = v.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		a.N = strconv.FormatInt(v.Int(), 10)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		a.N = strconv.FormatUint(v.Uint(), 10)
	case reflect.Float32, reflect.Float64:
		a.N = strconv.FormatFloat(v.Float(), 'f', -1, 64)
	case reflect.String:
		if n, ok := in.(json.Number); ok {
			a.N = n.String()
		} else {
			a.S = new(string)
			*a.S = v.String()
		}
	default:
		panic(fmt.Sprintf(`the type %s is not supported`, v.Type().String()))
	}

	return a
}

func undynamize(a *DynamoAttribute) interface{} {
	if a.S != nil {
		return *a.S
	}

	if a.N != "" {
		// Number is tricky b/c we don't know which numeric type to use. Here we
		// simply try the different types from most to least restrictive.
		if n, err := strconv.ParseInt(a.N, 10, 64); err == nil {
			return int(n)
		}
		if n, err := strconv.ParseUint(a.N, 10, 64); err == nil {
			return uint(n)
		}
		n, err := strconv.ParseFloat(a.N, 64)
		if err != nil {
			panic(err)
		}
		return n
	}

	if a.BOOL != nil {
		return *a.BOOL
	}

	if a.NULL {
		return nil
	}

	if a.M != nil {
		m := make(map[string]interface{})
		for k, v := range a.M {
			m[k] = undynamize(v)
		}
		return m
	}

	if a.L != nil {
		l := make([]interface{}, len(a.L))
		for index, v := range a.L {
			l[index] = undynamize(v)
		}
		return l
	}

	panic(fmt.Sprintf("unsupported dynamo attribute %#v", a))
}
