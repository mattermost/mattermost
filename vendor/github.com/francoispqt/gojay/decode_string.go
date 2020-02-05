package gojay

import (
	"unsafe"
)

// DecodeString reads the next JSON-encoded value from the decoder's input (io.Reader) and stores it in the string pointed to by v.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *Decoder) DecodeString(v *string) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeString(v)
}
func (dec *Decoder) decodeString(v *string) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			// is string
			continue
		case '"':
			dec.cursor++
			start, end, err := dec.getString()
			if err != nil {
				return err
			}
			// we do minus one to remove the last quote
			d := dec.data[start : end-1]
			*v = *(*string)(unsafe.Pointer(&d))
			dec.cursor = end
			return nil
		// is nil
		case 'n':
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return err
			}
			return nil
		default:
			dec.err = dec.makeInvalidUnmarshalErr(v)
			err := dec.skipData()
			if err != nil {
				return err
			}
			return nil
		}
	}
	return nil
}

func (dec *Decoder) decodeStringNull(v **string) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			// is string
			continue
		case '"':
			dec.cursor++
			start, end, err := dec.getString()

			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(string)
			}
			// we do minus one to remove the last quote
			d := dec.data[start : end-1]
			**v = *(*string)(unsafe.Pointer(&d))
			dec.cursor = end
			return nil
		// is nil
		case 'n':
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return err
			}
			return nil
		default:
			dec.err = dec.makeInvalidUnmarshalErr(v)
			err := dec.skipData()
			if err != nil {
				return err
			}
			return nil
		}
	}
	return nil
}

func (dec *Decoder) parseEscapedString() error {
	if dec.cursor >= dec.length && !dec.read() {
		return dec.raiseInvalidJSONErr(dec.cursor)
	}
	switch dec.data[dec.cursor] {
	case '"':
		dec.data[dec.cursor] = '"'
	case '\\':
		dec.data[dec.cursor] = '\\'
	case '/':
		dec.data[dec.cursor] = '/'
	case 'b':
		dec.data[dec.cursor] = '\b'
	case 'f':
		dec.data[dec.cursor] = '\f'
	case 'n':
		dec.data[dec.cursor] = '\n'
	case 'r':
		dec.data[dec.cursor] = '\r'
	case 't':
		dec.data[dec.cursor] = '\t'
	case 'u':
		start := dec.cursor
		dec.cursor++
		str, err := dec.parseUnicode()
		if err != nil {
			return err
		}
		diff := dec.cursor - start
		dec.data = append(append(dec.data[:start-1], str...), dec.data[dec.cursor:]...)
		dec.length = len(dec.data)
		dec.cursor += len(str) - diff - 1

		return nil
	default:
		return dec.raiseInvalidJSONErr(dec.cursor)
	}

	dec.data = append(dec.data[:dec.cursor-1], dec.data[dec.cursor:]...)
	dec.length--

	// Since we've lost a character, our dec.cursor offset is now
	// 1 past the escaped character which is precisely where we
	// want it.

	return nil
}

func (dec *Decoder) getString() (int, int, error) {
	// extract key
	var keyStart = dec.cursor
	// var str *Builder
	for dec.cursor < dec.length || dec.read() {
		switch dec.data[dec.cursor] {
		// string found
		case '"':
			dec.cursor = dec.cursor + 1
			return keyStart, dec.cursor, nil
		// slash found
		case '\\':
			dec.cursor = dec.cursor + 1
			err := dec.parseEscapedString()
			if err != nil {
				return 0, 0, err
			}
		default:
			dec.cursor = dec.cursor + 1
			continue
		}
	}
	return 0, 0, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) skipEscapedString() error {
	start := dec.cursor
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		if dec.data[dec.cursor] != '\\' {
			d := dec.data[dec.cursor]
			dec.cursor = dec.cursor + 1
			nSlash := dec.cursor - start
			switch d {
			case '"':
				// nSlash must be odd
				if nSlash&1 != 1 {
					return dec.raiseInvalidJSONErr(dec.cursor)
				}
				return nil
			case 'u': // is unicode, we skip the following characters and place the cursor one one byte backward to avoid it breaking when returning to skipString
				if err := dec.skipString(); err != nil {
					return err
				}
				dec.cursor--
				return nil
			case 'n', 'r', 't', '/', 'f', 'b':
				return nil
			default:
				// nSlash must be even
				if nSlash&1 == 1 {
					return dec.raiseInvalidJSONErr(dec.cursor)
				}
				return nil
			}
		}
	}
	return dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) skipString() error {
	for dec.cursor < dec.length || dec.read() {
		switch dec.data[dec.cursor] {
		// found the closing quote
		// let's return
		case '"':
			dec.cursor = dec.cursor + 1
			return nil
		// solidus found start parsing an escaped string
		case '\\':
			dec.cursor = dec.cursor + 1
			err := dec.skipEscapedString()
			if err != nil {
				return err
			}
		default:
			dec.cursor = dec.cursor + 1
			continue
		}
	}
	return dec.raiseInvalidJSONErr(len(dec.data) - 1)
}

// Add Values functions

// AddString decodes the JSON value within an object or an array to a *string.
// If next key is not a JSON string nor null, InvalidUnmarshalError will be returned.
func (dec *Decoder) AddString(v *string) error {
	return dec.String(v)
}

// AddStringNull decodes the JSON value within an object or an array to a *string.
// If next key is not a JSON string nor null, InvalidUnmarshalError will be returned.
// If a `null` is encountered, gojay does not change the value of the pointer.
func (dec *Decoder) AddStringNull(v **string) error {
	return dec.StringNull(v)
}

// String decodes the JSON value within an object or an array to a *string.
// If next key is not a JSON string nor null, InvalidUnmarshalError will be returned.
func (dec *Decoder) String(v *string) error {
	err := dec.decodeString(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// StringNull decodes the JSON value within an object or an array to a **string.
// If next key is not a JSON string nor null, InvalidUnmarshalError will be returned.
// If a `null` is encountered, gojay does not change the value of the pointer.
func (dec *Decoder) StringNull(v **string) error {
	err := dec.decodeStringNull(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}
