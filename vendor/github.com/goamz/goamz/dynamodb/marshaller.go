package dynamodb

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"unicode"
)

func MarshalAttributes(m interface{}) ([]Attribute, error) {
	v := reflect.ValueOf(m).Elem()

	builder := &attributeBuilder{}
	builder.buffer = []Attribute{}
	for _, f := range cachedTypeFields(v.Type()) { // loop on each field
		fv := fieldByIndex(v, f.index)
		if !fv.IsValid() || isEmptyValueToOmit(fv) {
			continue
		}

		err := builder.reflectToDynamoDBAttribute(f.name, fv)
		if err != nil {
			return builder.buffer, err
		}
	}

	return builder.buffer, nil
}

func UnmarshalAttributes(attributesRef *map[string]*Attribute, m interface{}) error {
	rv := reflect.ValueOf(m)
	if rv.Kind() != reflect.Ptr || rv.IsNil() {
		return fmt.Errorf("InvalidUnmarshalError reflect.ValueOf(v): %#v, m interface{}: %#v", rv, reflect.TypeOf(m))
	}

	v := reflect.ValueOf(m).Elem()

	attributes := *attributesRef
	for _, f := range cachedTypeFields(v.Type()) { // loop on each field
		fv := fieldByIndex(v, f.index)
		correlatedAttribute := attributes[f.name]
		if correlatedAttribute == nil {
			continue
		}
		err := unmarshallAttribute(correlatedAttribute, fv)
		if err != nil {
			return err
		}
	}

	return nil
}

type attributeBuilder struct {
	buffer []Attribute
}

func (builder *attributeBuilder) Push(attribute *Attribute) {
	builder.buffer = append(builder.buffer, *attribute)
}

func unmarshallAttribute(a *Attribute, v reflect.Value) error {
	switch v.Kind() {
	case reflect.Bool:
		n, err := strconv.ParseInt(a.Value, 10, 64)
		if err != nil {
			return fmt.Errorf("UnmarshalTypeError (bool) %#v: %#v", a.Value, err)
		}
		v.SetBool(n != 0)

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		n, err := strconv.ParseInt(a.Value, 10, 64)
		if err != nil || v.OverflowInt(n) {
			return fmt.Errorf("UnmarshalTypeError (number) %#v: %#v", a.Value, err)
		}
		v.SetInt(n)

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		n, err := strconv.ParseUint(a.Value, 10, 64)
		if err != nil || v.OverflowUint(n) {
			return fmt.Errorf("UnmarshalTypeError (number) %#v: %#v", a.Value, err)
		}
		v.SetUint(n)

	case reflect.Float32, reflect.Float64:
		n, err := strconv.ParseFloat(a.Value, v.Type().Bits())
		if err != nil || v.OverflowFloat(n) {
			return fmt.Errorf("UnmarshalTypeError (number) %#v: %#v", a.Value, err)
		}
		v.SetFloat(n)

	case reflect.String:
		v.SetString(a.Value)

	case reflect.Slice:
		if v.Type().Elem().Kind() == reflect.Uint8 { // byte arrays are a special case
			b := make([]byte, base64.StdEncoding.DecodedLen(len(a.Value)))
			n, err := base64.StdEncoding.Decode(b, []byte(a.Value))
			if err != nil {
				return fmt.Errorf("UnmarshalTypeError (byte) %#v: %#v", a.Value, err)
			}
			v.Set(reflect.ValueOf(b[0:n]))
			break
		}

		if a.SetType() { // Special NS and SS types should be correctly handled
			nativeSetCreated := false
			switch v.Type().Elem().Kind() {
			case reflect.Bool:
				nativeSetCreated = true
				arry := reflect.MakeSlice(v.Type(), len(a.SetValues), len(a.SetValues))
				for i, aval := range a.SetValues {
					n, err := strconv.ParseInt(aval, 10, 64)
					if err != nil {
						return fmt.Errorf("UnmarshalSetTypeError (bool) %#v: %#v", aval, err)
					}
					arry.Index(i).SetBool(n != 0)
				}
				v.Set(arry)

			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
				nativeSetCreated = true
				arry := reflect.MakeSlice(v.Type(), len(a.SetValues), len(a.SetValues))
				for i, aval := range a.SetValues {
					n, err := strconv.ParseInt(aval, 10, 64)
					if err != nil || arry.Index(i).OverflowInt(n) {
						return fmt.Errorf("UnmarshalSetTypeError (number) %#v: %#v", aval, err)
					}
					arry.Index(i).SetInt(n)
				}
				v.Set(arry)

			case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
				nativeSetCreated = true
				arry := reflect.MakeSlice(v.Type(), len(a.SetValues), len(a.SetValues))
				for i, aval := range a.SetValues {
					n, err := strconv.ParseUint(aval, 10, 64)
					if err != nil || arry.Index(i).OverflowUint(n) {
						return fmt.Errorf("UnmarshalSetTypeError (number) %#v: %#v", aval, err)
					}
					arry.Index(i).SetUint(n)
				}
				v.Set(arry)

			case reflect.Float32, reflect.Float64:
				nativeSetCreated = true
				arry := reflect.MakeSlice(v.Type(), len(a.SetValues), len(a.SetValues))
				for i, aval := range a.SetValues {
					n, err := strconv.ParseFloat(aval, arry.Index(i).Type().Bits())
					if err != nil || arry.Index(i).OverflowFloat(n) {
						return fmt.Errorf("UnmarshalSetTypeError (number) %#v: %#v", aval, err)
					}
					arry.Index(i).SetFloat(n)
				}
				v.Set(arry)

			case reflect.String:
				nativeSetCreated = true
				arry := reflect.MakeSlice(v.Type(), len(a.SetValues), len(a.SetValues))
				for i, aval := range a.SetValues {
					arry.Index(i).SetString(aval)
				}
				v.Set(arry)
			}

			if nativeSetCreated {
				break
			}
		}

		// Slices can be marshalled as nil, but otherwise are handled
		// as arrays.
		fallthrough
	case reflect.Array, reflect.Struct, reflect.Map, reflect.Interface, reflect.Ptr:
		unmarshalled := reflect.New(v.Type())
		err := json.Unmarshal([]byte(a.Value), unmarshalled.Interface())
		if err != nil {
			return err
		}
		v.Set(unmarshalled.Elem())

	default:
		return fmt.Errorf("UnsupportedTypeError %#v", v.Type())
	}

	return nil
}

// reflectValueQuoted writes the value in v to the output.
// If quoted is true, the serialization is wrapped in a JSON string.
func (e *attributeBuilder) reflectToDynamoDBAttribute(name string, v reflect.Value) error {
	if !v.IsValid() {
		return nil
	} // don't build

	switch v.Kind() {
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr, reflect.Float32, reflect.Float64:
		rv, err := numericReflectedValueString(v)
		if err != nil {
			return err
		}
		e.Push(NewNumericAttribute(name, rv))

	case reflect.String:
		e.Push(NewStringAttribute(name, v.String()))

	case reflect.Slice:
		if v.IsNil() {
			break
		}
		if v.Type().Elem().Kind() == reflect.Uint8 {
			// Byte slices are treated as errors
			s := v.Bytes()
			dst := make([]byte, base64.StdEncoding.EncodedLen(len(s)))
			base64.StdEncoding.Encode(dst, s)
			e.Push(NewStringAttribute(name, string(dst)))
			break
		}

		// Special NS and SS types should be correctly handled
		nativeSetCreated := false
		switch v.Type().Elem().Kind() {
		case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr, reflect.Float32, reflect.Float64:
			nativeSetCreated = true
			arrystrings := make([]string, v.Len())
			for i, _ := range arrystrings {
				var err error
				arrystrings[i], err = numericReflectedValueString(v.Index(i))
				if err != nil {
					return err
				}
			}
			e.Push(NewNumericSetAttribute(name, arrystrings))
		case reflect.String: // simple copy will suffice
			nativeSetCreated = true
			arrystrings := make([]string, v.Len())
			for i, _ := range arrystrings {
				arrystrings[i] = v.Index(i).String()
			}
			e.Push(NewStringSetAttribute(name, arrystrings))
		}

		if nativeSetCreated {
			break
		}

		// Slices can be marshalled as nil, but otherwise are handled
		// as arrays.
		fallthrough
	case reflect.Array, reflect.Struct, reflect.Map, reflect.Interface, reflect.Ptr:
		jsonVersion, err := json.Marshal(v.Interface())
		if err != nil {
			return err
		}
		escapedJson := `"` + string(jsonVersion) + `"` // strconv.Quote not required because the entire string is escaped from json Marshall
		e.Push(NewStringAttribute(name, escapedJson[1:len(escapedJson)-1]))

	default:
		return fmt.Errorf("UnsupportedTypeError %#v", v.Type())
	}
	return nil
}

func numericReflectedValueString(v reflect.Value) (string, error) {
	switch v.Kind() {
	case reflect.Bool:
		x := v.Bool()
		if x {
			return "1", nil
		} else {
			return "0", nil
		}

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(v.Int(), 10), nil

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return strconv.FormatUint(v.Uint(), 10), nil

	case reflect.Float32, reflect.Float64:
		f := v.Float()
		if math.IsInf(f, 0) || math.IsNaN(f) {
			return "", fmt.Errorf("UnsupportedValueError %#v (formatted float: %s)", v, strconv.FormatFloat(f, 'g', -1, v.Type().Bits()))
		}
		return strconv.FormatFloat(f, 'g', -1, v.Type().Bits()), nil
	}
	return "", fmt.Errorf("UnsupportedNumericValueError %#v", v.Type())
}

// In DynamoDB we should omit empty value in some type
// See http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html
func isEmptyValueToOmit(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String, reflect.Interface, reflect.Ptr:
		// should omit if empty value
		return isEmptyValue(v)
	}
	// otherwise should not omit
	return false
}

// ---------------- Below are copied handy functions from http://golang.org/src/pkg/encoding/json/encode.go --------------------------------
func isEmptyValue(v reflect.Value) bool {
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
	}
	return false
}

func fieldByIndex(v reflect.Value, index []int) reflect.Value {
	for _, i := range index {
		if v.Kind() == reflect.Ptr {
			if v.IsNil() {
				return reflect.Value{}
			}
			v = v.Elem()
		}
		v = v.Field(i)
	}
	return v
}

// A field represents a single field found in a struct.
type field struct {
	name      string
	tag       bool
	index     []int
	typ       reflect.Type
	omitEmpty bool
	quoted    bool
}

// byName sorts field by name, breaking ties with depth,
// then breaking ties with "name came from json tag", then
// breaking ties with index sequence.
type byName []field

func (x byName) Len() int { return len(x) }

func (x byName) Swap(i, j int) { x[i], x[j] = x[j], x[i] }

func (x byName) Less(i, j int) bool {
	if x[i].name != x[j].name {
		return x[i].name < x[j].name
	}
	if len(x[i].index) != len(x[j].index) {
		return len(x[i].index) < len(x[j].index)
	}
	if x[i].tag != x[j].tag {
		return x[i].tag
	}
	return byIndex(x).Less(i, j)
}

// byIndex sorts field by index sequence.
type byIndex []field

func (x byIndex) Len() int { return len(x) }

func (x byIndex) Swap(i, j int) { x[i], x[j] = x[j], x[i] }

func (x byIndex) Less(i, j int) bool {
	for k, xik := range x[i].index {
		if k >= len(x[j].index) {
			return false
		}
		if xik != x[j].index[k] {
			return xik < x[j].index[k]
		}
	}
	return len(x[i].index) < len(x[j].index)
}

func isValidTag(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		switch {
		case strings.ContainsRune("!#$%&()*+-./:<=>?@[]^_{|}~ ", c):
			// Backslash and quote chars are reserved, but
			// otherwise any punctuation chars are allowed
			// in a tag name.
		default:
			if !unicode.IsLetter(c) && !unicode.IsDigit(c) {
				return false
			}
		}
	}
	return true
}

// tagOptions is the string following a comma in a struct field's "json"
// tag, or the empty string. It does not include the leading comma.
type tagOptions string

// Contains returns whether checks that a comma-separated list of options
// contains a particular substr flag. substr must be surrounded by a
// string boundary or commas.
func (o tagOptions) Contains(optionName string) bool {
	if len(o) == 0 {
		return false
	}
	s := string(o)
	for s != "" {
		var next string
		i := strings.Index(s, ",")
		if i >= 0 {
			s, next = s[:i], s[i+1:]
		}
		if s == optionName {
			return true
		}
		s = next
	}
	return false
}

// parseTag splits a struct field's json tag into its name and
// comma-separated options.
func parseTag(tag string) (string, tagOptions) {
	if idx := strings.Index(tag, ","); idx != -1 {
		return tag[:idx], tagOptions(tag[idx+1:])
	}
	return tag, tagOptions("")
}

// typeFields returns a list of fields that JSON should recognize for the given type.
// The algorithm is breadth-first search over the set of structs to include - the top struct
// and then any reachable anonymous structs.
func typeFields(t reflect.Type) []field {
	// Anonymous fields to explore at the current level and the next.
	current := []field{}
	next := []field{{typ: t}}

	// Count of queued names for current level and the next.
	count := map[reflect.Type]int{}
	nextCount := map[reflect.Type]int{}

	// Types already visited at an earlier level.
	visited := map[reflect.Type]bool{}

	// Fields found.
	var fields []field

	for len(next) > 0 {
		current, next = next, current[:0]
		count, nextCount = nextCount, map[reflect.Type]int{}

		for _, f := range current {
			if visited[f.typ] {
				continue
			}
			visited[f.typ] = true

			// Scan f.typ for fields to include.
			for i := 0; i < f.typ.NumField(); i++ {
				sf := f.typ.Field(i)
				if sf.PkgPath != "" { // unexported
					continue
				}
				tag := sf.Tag.Get("json")
				if tag == "-" {
					continue
				}
				name, opts := parseTag(tag)
				if !isValidTag(name) {
					name = ""
				}
				index := make([]int, len(f.index)+1)
				copy(index, f.index)
				index[len(f.index)] = i

				ft := sf.Type
				if ft.Name() == "" && ft.Kind() == reflect.Ptr {
					// Follow pointer.
					ft = ft.Elem()
				}

				// Record found field and index sequence.
				if name != "" || !sf.Anonymous || ft.Kind() != reflect.Struct {
					tagged := name != ""
					if name == "" {
						name = sf.Name
					}
					fields = append(fields, field{name, tagged, index, ft,
						opts.Contains("omitempty"), opts.Contains("string")})
					if count[f.typ] > 1 {
						// If there were multiple instances, add a second,
						// so that the annihilation code will see a duplicate.
						// It only cares about the distinction between 1 or 2,
						// so don't bother generating any more copies.
						fields = append(fields, fields[len(fields)-1])
					}
					continue
				}

				// Record new anonymous struct to explore in next round.
				nextCount[ft]++
				if nextCount[ft] == 1 {
					next = append(next, field{name: ft.Name(), index: index, typ: ft})
				}
			}
		}
	}

	sort.Sort(byName(fields))

	// Delete all fields that are hidden by the Go rules for embedded fields,
	// except that fields with JSON tags are promoted.

	// The fields are sorted in primary order of name, secondary order
	// of field index length. Loop over names; for each name, delete
	// hidden fields by choosing the one dominant field that survives.
	out := fields[:0]
	for advance, i := 0, 0; i < len(fields); i += advance {
		// One iteration per name.
		// Find the sequence of fields with the name of this first field.
		fi := fields[i]
		name := fi.name
		for advance = 1; i+advance < len(fields); advance++ {
			fj := fields[i+advance]
			if fj.name != name {
				break
			}
		}
		if advance == 1 { // Only one field with this name
			out = append(out, fi)
			continue
		}
		dominant, ok := dominantField(fields[i : i+advance])
		if ok {
			out = append(out, dominant)
		}
	}

	fields = out
	sort.Sort(byIndex(fields))

	return fields
}

// dominantField looks through the fields, all of which are known to
// have the same name, to find the single field that dominates the
// others using Go's embedding rules, modified by the presence of
// JSON tags. If there are multiple top-level fields, the boolean
// will be false: This condition is an error in Go and we skip all
// the fields.
func dominantField(fields []field) (field, bool) {
	// The fields are sorted in increasing index-length order. The winner
	// must therefore be one with the shortest index length. Drop all
	// longer entries, which is easy: just truncate the slice.
	length := len(fields[0].index)
	tagged := -1 // Index of first tagged field.
	for i, f := range fields {
		if len(f.index) > length {
			fields = fields[:i]
			break
		}
		if f.tag {
			if tagged >= 0 {
				// Multiple tagged fields at the same level: conflict.
				// Return no field.
				return field{}, false
			}
			tagged = i
		}
	}
	if tagged >= 0 {
		return fields[tagged], true
	}
	// All remaining fields have the same length. If there's more than one,
	// we have a conflict (two fields named "X" at the same level) and we
	// return no field.
	if len(fields) > 1 {
		return field{}, false
	}
	return fields[0], true
}

var fieldCache struct {
	sync.RWMutex
	m map[reflect.Type][]field
}

// cachedTypeFields is like typeFields but uses a cache to avoid repeated work.
func cachedTypeFields(t reflect.Type) []field {
	fieldCache.RLock()
	f := fieldCache.m[t]
	fieldCache.RUnlock()
	if f != nil {
		return f
	}

	// Compute fields without lock.
	// Might duplicate effort but won't hold other computations back.
	f = typeFields(t)
	if f == nil {
		f = []field{}
	}

	fieldCache.Lock()
	if fieldCache.m == nil {
		fieldCache.m = map[reflect.Type][]field{}
	}
	fieldCache.m[t] = f
	fieldCache.Unlock()
	return f
}
