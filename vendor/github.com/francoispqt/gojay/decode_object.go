package gojay

import (
	"reflect"
	"unsafe"
)

// DecodeObject reads the next JSON-encoded value from the decoder's input (io.Reader) and stores it in the value pointed to by v.
//
// v must implement UnmarshalerJSONObject.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *Decoder) DecodeObject(j UnmarshalerJSONObject) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	_, err := dec.decodeObject(j)
	return err
}
func (dec *Decoder) decodeObject(j UnmarshalerJSONObject) (int, error) {
	keys := j.NKeys()
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
		case '{':
			dec.cursor = dec.cursor + 1
			// if keys is zero we will parse all keys
			// we run two loops for micro optimization
			if keys == 0 {
				for dec.cursor < dec.length || dec.read() {
					k, done, err := dec.nextKey()
					if err != nil {
						return 0, err
					} else if done {
						return dec.cursor, nil
					}
					err = j.UnmarshalJSONObject(dec, k)
					if err != nil {
						dec.err = err
						return 0, err
					} else if dec.called&1 == 0 {
						err := dec.skipData()
						if err != nil {
							return 0, err
						}
					} else {
						dec.keysDone++
					}
					dec.called &= 0
				}
			} else {
				for (dec.cursor < dec.length || dec.read()) && dec.keysDone < keys {
					k, done, err := dec.nextKey()
					if err != nil {
						return 0, err
					} else if done {
						return dec.cursor, nil
					}
					err = j.UnmarshalJSONObject(dec, k)
					if err != nil {
						dec.err = err
						return 0, err
					} else if dec.called&1 == 0 {
						err := dec.skipData()
						if err != nil {
							return 0, err
						}
					} else {
						dec.keysDone++
					}
					dec.called &= 0
				}
			}
			// will get to that point when keysDone is not lower than keys anymore
			// in that case, we make sure cursor goes to the end of object, but we skip
			// unmarshalling
			if dec.child&1 != 0 {
				end, err := dec.skipObject()
				dec.cursor = end
				return dec.cursor, err
			}
			return dec.cursor, nil
		case 'n':
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return 0, err
			}
			return dec.cursor, nil
		default:
			// can't unmarshal to struct
			dec.err = dec.makeInvalidUnmarshalErr(j)
			err := dec.skipData()
			if err != nil {
				return 0, err
			}
			return dec.cursor, nil
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) decodeObjectNull(v interface{}) (int, error) {
	// make sure the value is a pointer
	vv := reflect.ValueOf(v)
	vvt := vv.Type()
	if vvt.Kind() != reflect.Ptr || vvt.Elem().Kind() != reflect.Ptr {
		dec.err = ErrUnmarshalPtrExpected
		return 0, dec.err
	}
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
		case '{':
			elt := vv.Elem()
			n := reflect.New(elt.Type().Elem())
			elt.Set(n)
			var j UnmarshalerJSONObject
			var ok bool
			if j, ok = n.Interface().(UnmarshalerJSONObject); !ok {
				dec.err = dec.makeInvalidUnmarshalErr((UnmarshalerJSONObject)(nil))
				return 0, dec.err
			}
			keys := j.NKeys()
			dec.cursor = dec.cursor + 1
			// if keys is zero we will parse all keys
			// we run two loops for micro optimization
			if keys == 0 {
				for dec.cursor < dec.length || dec.read() {
					k, done, err := dec.nextKey()
					if err != nil {
						return 0, err
					} else if done {
						return dec.cursor, nil
					}
					err = j.UnmarshalJSONObject(dec, k)
					if err != nil {
						dec.err = err
						return 0, err
					} else if dec.called&1 == 0 {
						err := dec.skipData()
						if err != nil {
							return 0, err
						}
					} else {
						dec.keysDone++
					}
					dec.called &= 0
				}
			} else {
				for (dec.cursor < dec.length || dec.read()) && dec.keysDone < keys {
					k, done, err := dec.nextKey()
					if err != nil {
						return 0, err
					} else if done {
						return dec.cursor, nil
					}
					err = j.UnmarshalJSONObject(dec, k)
					if err != nil {
						dec.err = err
						return 0, err
					} else if dec.called&1 == 0 {
						err := dec.skipData()
						if err != nil {
							return 0, err
						}
					} else {
						dec.keysDone++
					}
					dec.called &= 0
				}
			}
			// will get to that point when keysDone is not lower than keys anymore
			// in that case, we make sure cursor goes to the end of object, but we skip
			// unmarshalling
			if dec.child&1 != 0 {
				end, err := dec.skipObject()
				dec.cursor = end
				return dec.cursor, err
			}
			return dec.cursor, nil
		case 'n':
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return 0, err
			}
			return dec.cursor, nil
		default:
			// can't unmarshal to struct
			dec.err = dec.makeInvalidUnmarshalErr((UnmarshalerJSONObject)(nil))
			err := dec.skipData()
			if err != nil {
				return 0, err
			}
			return dec.cursor, nil
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) skipObject() (int, error) {
	var objectsOpen = 1
	var objectsClosed = 0
	for j := dec.cursor; j < dec.length || dec.read(); j++ {
		switch dec.data[j] {
		case '}':
			objectsClosed++
			// everything is closed return
			if objectsOpen == objectsClosed {
				// add char to object data
				return j + 1, nil
			}
		case '{':
			objectsOpen++
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

func (dec *Decoder) nextKey() (string, bool, error) {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		case '"':
			dec.cursor = dec.cursor + 1
			start, end, err := dec.getString()
			if err != nil {
				return "", false, err
			}
			var found byte
			for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
				if dec.data[dec.cursor] == ':' {
					found |= 1
					break
				}
			}
			if found&1 != 0 {
				dec.cursor++
				d := dec.data[start : end-1]
				return *(*string)(unsafe.Pointer(&d)), false, nil
			}
			return "", false, dec.raiseInvalidJSONErr(dec.cursor)
		case '}':
			dec.cursor = dec.cursor + 1
			return "", true, nil
		default:
			// can't unmarshall to struct
			return "", false, dec.raiseInvalidJSONErr(dec.cursor)
		}
	}
	return "", false, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) skipData() error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		// is null
		case 'n':
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return err
			}
			return nil
		case 't':
			dec.cursor++
			err := dec.assertTrue()
			if err != nil {
				return err
			}
			return nil
		// is false
		case 'f':
			dec.cursor++
			err := dec.assertFalse()
			if err != nil {
				return err
			}
			return nil
		// is an object
		case '{':
			dec.cursor = dec.cursor + 1
			end, err := dec.skipObject()
			dec.cursor = end
			return err
		// is string
		case '"':
			dec.cursor = dec.cursor + 1
			err := dec.skipString()
			return err
		// is array
		case '[':
			dec.cursor = dec.cursor + 1
			end, err := dec.skipArray()
			dec.cursor = end
			return err
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-':
			end, err := dec.skipNumber()
			dec.cursor = end
			return err
		}
		return dec.raiseInvalidJSONErr(dec.cursor)
	}
	return dec.raiseInvalidJSONErr(dec.cursor)
}

// DecodeObjectFunc is a func type implementing UnmarshalerJSONObject.
// Use it to cast a `func(*Decoder, k string) error` to Unmarshal an object on the fly.
type DecodeObjectFunc func(*Decoder, string) error

// UnmarshalJSONObject implements UnmarshalerJSONObject.
func (f DecodeObjectFunc) UnmarshalJSONObject(dec *Decoder, k string) error {
	return f(dec, k)
}

// NKeys implements UnmarshalerJSONObject.
func (f DecodeObjectFunc) NKeys() int {
	return 0
}

// Add Values functions

// AddObject decodes the JSON value within an object or an array to a UnmarshalerJSONObject.
func (dec *Decoder) AddObject(v UnmarshalerJSONObject) error {
	return dec.Object(v)
}

// AddObjectNull decodes the JSON value within an object or an array to a UnmarshalerJSONObject.
func (dec *Decoder) AddObjectNull(v interface{}) error {
	return dec.ObjectNull(v)
}

// Object decodes the JSON value within an object or an array to a UnmarshalerJSONObject.
func (dec *Decoder) Object(value UnmarshalerJSONObject) error {
	initialKeysDone := dec.keysDone
	initialChild := dec.child
	dec.keysDone = 0
	dec.called = 0
	dec.child |= 1
	newCursor, err := dec.decodeObject(value)
	if err != nil {
		return err
	}
	dec.cursor = newCursor
	dec.keysDone = initialKeysDone
	dec.child = initialChild
	dec.called |= 1
	return nil
}

// ObjectNull decodes the JSON value within an object or an array to a UnmarshalerJSONObject.
// v should be a pointer to an UnmarshalerJSONObject,
// if `null` value is encountered in JSON, it will leave the value v untouched,
// else it will create a new instance of the UnmarshalerJSONObject behind v.
func (dec *Decoder) ObjectNull(v interface{}) error {
	initialKeysDone := dec.keysDone
	initialChild := dec.child
	dec.keysDone = 0
	dec.called = 0
	dec.child |= 1
	newCursor, err := dec.decodeObjectNull(v)
	if err != nil {
		return err
	}
	dec.cursor = newCursor
	dec.keysDone = initialKeysDone
	dec.child = initialChild
	dec.called |= 1
	return nil
}
