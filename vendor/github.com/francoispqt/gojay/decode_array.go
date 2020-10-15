package gojay

import "reflect"

// DecodeArray reads the next JSON-encoded value from the decoder's input (io.Reader)
// and stores it in the value pointed to by v.
//
// v must implement UnmarshalerJSONArray.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *Decoder) DecodeArray(v UnmarshalerJSONArray) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	_, err := dec.decodeArray(v)
	return err
}
func (dec *Decoder) decodeArray(arr UnmarshalerJSONArray) (int, error) {
	// remember last array index in case of nested arrays
	lastArrayIndex := dec.arrayIndex
	dec.arrayIndex = 0
	defer func() {
		dec.arrayIndex = lastArrayIndex
	}()
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		case '[':
			dec.cursor = dec.cursor + 1
			// array is open, char is not space start readings
			for dec.nextChar() != 0 {
				// closing array
				if dec.data[dec.cursor] == ']' {
					dec.cursor = dec.cursor + 1
					return dec.cursor, nil
				}
				// calling unmarshall function for each element of the slice
				err := arr.UnmarshalJSONArray(dec)
				if err != nil {
					return 0, err
				}
				dec.arrayIndex++
			}
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		case 'n':
			// is null
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return 0, err
			}
			return dec.cursor, nil
		case '{', '"', 'f', 't', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			// can't unmarshall to struct
			// we skip array and set Error
			dec.err = dec.makeInvalidUnmarshalErr(arr)
			err := dec.skipData()
			if err != nil {
				return 0, err
			}
			return dec.cursor, nil
		default:
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}
func (dec *Decoder) decodeArrayNull(v interface{}) (int, error) {
	// remember last array index in case of nested arrays
	lastArrayIndex := dec.arrayIndex
	dec.arrayIndex = 0
	defer func() {
		dec.arrayIndex = lastArrayIndex
	}()
	vv := reflect.ValueOf(v)
	vvt := vv.Type()
	if vvt.Kind() != reflect.Ptr || vvt.Elem().Kind() != reflect.Ptr {
		dec.err = ErrUnmarshalPtrExpected
		return 0, dec.err
	}
	// not an array not an error, but do not know what to do
	// do not check syntax
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		case '[':
			dec.cursor = dec.cursor + 1
			// create our new type
			elt := vv.Elem()
			n := reflect.New(elt.Type().Elem())
			var arr UnmarshalerJSONArray
			var ok bool
			if arr, ok = n.Interface().(UnmarshalerJSONArray); !ok {
				dec.err = dec.makeInvalidUnmarshalErr((UnmarshalerJSONArray)(nil))
				return 0, dec.err
			}
			// array is open, char is not space start readings
			for dec.nextChar() != 0 {
				// closing array
				if dec.data[dec.cursor] == ']' {
					elt.Set(n)
					dec.cursor = dec.cursor + 1
					return dec.cursor, nil
				}
				// calling unmarshall function for each element of the slice
				err := arr.UnmarshalJSONArray(dec)
				if err != nil {
					return 0, err
				}
				dec.arrayIndex++
			}
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		case 'n':
			// is null
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return 0, err
			}
			return dec.cursor, nil
		case '{', '"', 'f', 't', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			// can't unmarshall to struct
			// we skip array and set Error
			dec.err = dec.makeInvalidUnmarshalErr((UnmarshalerJSONArray)(nil))
			err := dec.skipData()
			if err != nil {
				return 0, err
			}
			return dec.cursor, nil
		default:
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) skipArray() (int, error) {
	var arraysOpen = 1
	var arraysClosed = 0
	// var stringOpen byte = 0
	for j := dec.cursor; j < dec.length || dec.read(); j++ {
		switch dec.data[j] {
		case ']':
			arraysClosed++
			// everything is closed return
			if arraysOpen == arraysClosed {
				// add char to object data
				return j + 1, nil
			}
		case '[':
			arraysOpen++
		case '"':
			j++
			var isInEscapeSeq bool
			var isFirstQuote = true
			for ; j < dec.length || dec.read(); j++ {
				if dec.data[j] != '"' {
					continue
				}
				if dec.data[j-1] != '\\' || (!isInEscapeSeq && !isFirstQuote) {
					break
				} else {
					isInEscapeSeq = false
				}
				if isFirstQuote {
					isFirstQuote = false
				}
				// loop backward and count how many anti slash found
				// to see if string is effectively escaped
				ct := 0
				for i := j - 1; i > 0; i-- {
					if dec.data[i] != '\\' {
						break
					}
					ct++
				}
				// is pair number of slashes, quote is not escaped
				if ct&1 == 0 {
					break
				}
				isInEscapeSeq = true
			}
		default:
			continue
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

// DecodeArrayFunc is a func type implementing UnmarshalerJSONArray.
// Use it to cast a `func(*Decoder) error` to Unmarshal an array on the fly.

type DecodeArrayFunc func(*Decoder) error

// UnmarshalJSONArray implements UnmarshalerJSONArray.
func (f DecodeArrayFunc) UnmarshalJSONArray(dec *Decoder) error {
	return f(dec)
}

// IsNil implements UnmarshalerJSONArray.
func (f DecodeArrayFunc) IsNil() bool {
	return f == nil
}

// Add Values functions

// AddArray decodes the JSON value within an object or an array to a UnmarshalerJSONArray.
func (dec *Decoder) AddArray(v UnmarshalerJSONArray) error {
	return dec.Array(v)
}

// AddArrayNull decodes the JSON value within an object or an array to a UnmarshalerJSONArray.
func (dec *Decoder) AddArrayNull(v interface{}) error {
	return dec.ArrayNull(v)
}

// Array decodes the JSON value within an object or an array to a UnmarshalerJSONArray.
func (dec *Decoder) Array(v UnmarshalerJSONArray) error {
	newCursor, err := dec.decodeArray(v)
	if err != nil {
		return err
	}
	dec.cursor = newCursor
	dec.called |= 1
	return nil
}

// ArrayNull decodes the JSON value within an object or an array to a UnmarshalerJSONArray.
// v should be a pointer to an UnmarshalerJSONArray,
// if `null` value is encountered in JSON, it will leave the value v untouched,
// else it will create a new instance of the UnmarshalerJSONArray behind v.
func (dec *Decoder) ArrayNull(v interface{}) error {
	newCursor, err := dec.decodeArrayNull(v)
	if err != nil {
		return err
	}
	dec.cursor = newCursor
	dec.called |= 1
	return nil
}

// Index returns the index of an array being decoded.
func (dec *Decoder) Index() int {
	return dec.arrayIndex
}
