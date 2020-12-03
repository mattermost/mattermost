package gojay

import (
	"fmt"
	"math"
)

// DecodeInt reads the next JSON-encoded value from the decoder's input (io.Reader) and stores it in the int pointed to by v.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *Decoder) DecodeInt(v *int) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeInt(v)
}
func (dec *Decoder) decodeInt(v *int) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		// we don't look for 0 as leading zeros are invalid per RFC
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt64()
			if err != nil {
				return err
			}
			*v = int(val)
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt64Negative()
			if err != nil {
				return err
			}
			*v = -int(val)
			return nil
		case 'n':
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return err
			}
			return nil
		default:
			dec.err = InvalidUnmarshalError(
				fmt.Sprintf(
					"Cannot unmarshall to int, wrong char '%s' found at pos %d",
					string(dec.data[dec.cursor]),
					dec.cursor,
				),
			)
			err := dec.skipData()
			if err != nil {
				return err
			}
			return nil
		}
	}
	return dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) decodeIntNull(v **int) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		// we don't look for 0 as leading zeros are invalid per RFC
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt64()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int)
			}
			**v = int(val)
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt64Negative()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int)
			}
			**v = -int(val)
			return nil
		case 'n':
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return err
			}
			return nil
		default:
			dec.err = InvalidUnmarshalError(
				fmt.Sprintf(
					"Cannot unmarshall to int, wrong char '%s' found at pos %d",
					string(dec.data[dec.cursor]),
					dec.cursor,
				),
			)
			err := dec.skipData()
			if err != nil {
				return err
			}
			return nil
		}
	}
	return dec.raiseInvalidJSONErr(dec.cursor)
}

// DecodeInt16 reads the next JSON-encoded value from the decoder's input (io.Reader) and stores it in the int16 pointed to by v.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *Decoder) DecodeInt16(v *int16) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeInt16(v)
}
func (dec *Decoder) decodeInt16(v *int16) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		// we don't look for 0 as leading zeros are invalid per RFC
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt16()
			if err != nil {
				return err
			}
			*v = val
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt16Negative()
			if err != nil {
				return err
			}
			*v = -val
			return nil
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
	return dec.raiseInvalidJSONErr(dec.cursor)
}
func (dec *Decoder) decodeInt16Null(v **int16) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		// we don't look for 0 as leading zeros are invalid per RFC
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt16()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int16)
			}
			**v = val
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt16Negative()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int16)
			}
			**v = -val
			return nil
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
	return dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) getInt16Negative() (int16, error) {
	// look for following numbers
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case '1', '2', '3', '4', '5', '6', '7', '8', '9':
			return dec.getInt16()
		default:
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) getInt16() (int16, error) {
	var end = dec.cursor
	var start = dec.cursor
	// look for following numbers
	for j := dec.cursor + 1; j < dec.length || dec.read(); j++ {
		switch dec.data[j] {
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			end = j
			continue
		case '.':
			// if dot is found
			// look for exponent (e,E) as exponent can change the
			// way number should be parsed to int.
			// if no exponent found, just unmarshal the number before decimal point
			j++
			startDecimal := j
			endDecimal := j - 1
			for ; j < dec.length || dec.read(); j++ {
				switch dec.data[j] {
				case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
					endDecimal = j
					continue
				case 'e', 'E':
					if startDecimal > endDecimal {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					dec.cursor = j + 1
					// can try unmarshalling to int as Exponent might change decimal number to non decimal
					// let's get the float value first
					// we get part before decimal as integer
					beforeDecimal := dec.atoi16(start, end)
					// get number after the decimal point
					// multiple the before decimal point portion by 10 using bitwise
					for i := startDecimal; i <= endDecimal; i++ {
						beforeDecimal = (beforeDecimal << 3) + (beforeDecimal << 1)
					}
					// then we add both integers
					// then we divide the number by the power found
					afterDecimal := dec.atoi16(startDecimal, endDecimal)
					expI := endDecimal - startDecimal + 2
					if expI >= len(pow10uint64) || expI < 0 {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					pow := pow10uint64[expI]
					floatVal := float64(beforeDecimal+afterDecimal) / float64(pow)
					// we have the floating value, now multiply by the exponent
					exp, err := dec.getExponent()
					if err != nil {
						return 0, err
					}
					pExp := (exp + (exp >> 31)) ^ (exp >> 31) + 1 // abs
					if pExp >= int64(len(pow10uint64)) || pExp < 0 {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					val := floatVal * float64(pow10uint64[pExp])
					return int16(val), nil
				case ' ', '\t', '\n', ',', ']', '}':
					dec.cursor = j
					return dec.atoi16(start, end), nil
				default:
					dec.cursor = j
					return 0, dec.raiseInvalidJSONErr(dec.cursor)
				}
			}
			return dec.atoi16(start, end), nil
		case 'e', 'E':
			// get init n
			dec.cursor = j + 1
			return dec.getInt16WithExp(dec.atoi16(start, end))
		case ' ', '\n', '\t', '\r', ',', '}', ']':
			dec.cursor = j
			return dec.atoi16(start, end), nil
		}
		// invalid json we expect numbers, dot (single one), comma, or spaces
		return 0, dec.raiseInvalidJSONErr(dec.cursor)
	}
	return dec.atoi16(start, end), nil
}

func (dec *Decoder) getInt16WithExp(init int16) (int16, error) {
	var exp uint16
	var sign = int16(1)
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case '+':
			continue
		case '-':
			sign = -1
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			uintv := uint16(digits[dec.data[dec.cursor]])
			exp = (exp << 3) + (exp << 1) + uintv
			dec.cursor++
			for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
				switch dec.data[dec.cursor] {
				case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
					uintv := uint16(digits[dec.data[dec.cursor]])
					exp = (exp << 3) + (exp << 1) + uintv
				case ' ', '\t', '\n', '}', ',', ']':
					exp = exp + 1
					if exp >= uint16(len(pow10uint64)) {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					if sign == -1 {
						return init * (1 / int16(pow10uint64[exp])), nil
					}
					return init * int16(pow10uint64[exp]), nil
				default:
					return 0, dec.raiseInvalidJSONErr(dec.cursor)
				}
			}
			exp = exp + 1
			if exp >= uint16(len(pow10uint64)) {
				return 0, dec.raiseInvalidJSONErr(dec.cursor)
			}
			if sign == -1 {
				return init * (1 / int16(pow10uint64[exp])), nil
			}
			return init * int16(pow10uint64[exp]), nil
		default:
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

// DecodeInt8 reads the next JSON-encoded value from the decoder's input (io.Reader) and stores it in the int8 pointed to by v.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *Decoder) DecodeInt8(v *int8) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeInt8(v)
}
func (dec *Decoder) decodeInt8(v *int8) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		// we don't look for 0 as leading zeros are invalid per RFC
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt8()
			if err != nil {
				return err
			}
			*v = val
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt8Negative()
			if err != nil {
				return err
			}
			*v = -val
			return nil
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
	return dec.raiseInvalidJSONErr(dec.cursor)
}
func (dec *Decoder) decodeInt8Null(v **int8) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		// we don't look for 0 as leading zeros are invalid per RFC
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt8()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int8)
			}
			**v = val
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt8Negative()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int8)
			}
			**v = -val
			return nil
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
	return dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) getInt8Negative() (int8, error) {
	// look for following numbers
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case '1', '2', '3', '4', '5', '6', '7', '8', '9':
			return dec.getInt8()
		default:
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) getInt8() (int8, error) {
	var end = dec.cursor
	var start = dec.cursor
	// look for following numbers
	for j := dec.cursor + 1; j < dec.length || dec.read(); j++ {
		switch dec.data[j] {
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			end = j
			continue
		case '.':
			// if dot is found
			// look for exponent (e,E) as exponent can change the
			// way number should be parsed to int.
			// if no exponent found, just unmarshal the number before decimal point
			j++
			startDecimal := j
			endDecimal := j - 1
			for ; j < dec.length || dec.read(); j++ {
				switch dec.data[j] {
				case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
					endDecimal = j
					continue
				case 'e', 'E':
					if startDecimal > endDecimal {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					dec.cursor = j + 1
					// can try unmarshalling to int as Exponent might change decimal number to non decimal
					// let's get the float value first
					// we get part before decimal as integer
					beforeDecimal := dec.atoi8(start, end)
					// get number after the decimal point
					// multiple the before decimal point portion by 10 using bitwise
					for i := startDecimal; i <= endDecimal; i++ {
						beforeDecimal = (beforeDecimal << 3) + (beforeDecimal << 1)
					}
					// then we add both integers
					// then we divide the number by the power found
					afterDecimal := dec.atoi8(startDecimal, endDecimal)
					expI := endDecimal - startDecimal + 2
					if expI >= len(pow10uint64) || expI < 0 {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					pow := pow10uint64[expI]
					floatVal := float64(beforeDecimal+afterDecimal) / float64(pow)
					// we have the floating value, now multiply by the exponent
					exp, err := dec.getExponent()
					if err != nil {
						return 0, err
					}
					pExp := (exp + (exp >> 31)) ^ (exp >> 31) + 1 // abs
					if pExp >= int64(len(pow10uint64)) || pExp < 0 {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					val := floatVal * float64(pow10uint64[pExp])
					return int8(val), nil
				case ' ', '\t', '\n', ',', ']', '}':
					dec.cursor = j
					return dec.atoi8(start, end), nil
				default:
					dec.cursor = j
					return 0, dec.raiseInvalidJSONErr(dec.cursor)
				}
			}
			return dec.atoi8(start, end), nil
		case 'e', 'E':
			// get init n
			dec.cursor = j + 1
			return dec.getInt8WithExp(dec.atoi8(start, end))
		case ' ', '\n', '\t', '\r', ',', '}', ']':
			dec.cursor = j
			return dec.atoi8(start, end), nil
		}
		// invalid json we expect numbers, dot (single one), comma, or spaces
		return 0, dec.raiseInvalidJSONErr(dec.cursor)
	}
	return dec.atoi8(start, end), nil
}

func (dec *Decoder) getInt8WithExp(init int8) (int8, error) {
	var exp uint8
	var sign = int8(1)
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case '+':
			continue
		case '-':
			sign = -1
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			uintv := uint8(digits[dec.data[dec.cursor]])
			exp = (exp << 3) + (exp << 1) + uintv
			dec.cursor++
			for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
				switch dec.data[dec.cursor] {
				case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
					uintv := uint8(digits[dec.data[dec.cursor]])
					exp = (exp << 3) + (exp << 1) + uintv
				case ' ', '\t', '\n', '}', ',', ']':
					if exp+1 >= uint8(len(pow10uint64)) {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					if sign == -1 {
						return init * (1 / int8(pow10uint64[exp+1])), nil
					}
					return init * int8(pow10uint64[exp+1]), nil
				default:
					return 0, dec.raiseInvalidJSONErr(dec.cursor)
				}
			}
			if exp+1 >= uint8(len(pow10uint64)) {
				return 0, dec.raiseInvalidJSONErr(dec.cursor)
			}
			if sign == -1 {
				return init * (1 / int8(pow10uint64[exp+1])), nil
			}
			return init * int8(pow10uint64[exp+1]), nil
		default:
			dec.err = dec.raiseInvalidJSONErr(dec.cursor)
			return 0, dec.err
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

// DecodeInt32 reads the next JSON-encoded value from the decoder's input (io.Reader) and stores it in the int32 pointed to by v.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *Decoder) DecodeInt32(v *int32) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeInt32(v)
}
func (dec *Decoder) decodeInt32(v *int32) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt32()
			if err != nil {
				return err
			}
			*v = val
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt32Negative()
			if err != nil {
				return err
			}
			*v = -val
			return nil
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
	return dec.raiseInvalidJSONErr(dec.cursor)
}
func (dec *Decoder) decodeInt32Null(v **int32) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt32()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int32)
			}
			**v = val
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt32Negative()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int32)
			}
			**v = -val
			return nil
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
	return dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) getInt32Negative() (int32, error) {
	// look for following numbers
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case '1', '2', '3', '4', '5', '6', '7', '8', '9':
			return dec.getInt32()
		default:
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) getInt32() (int32, error) {
	var end = dec.cursor
	var start = dec.cursor
	// look for following numbers
	for j := dec.cursor + 1; j < dec.length || dec.read(); j++ {
		switch dec.data[j] {
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			end = j
			continue
		case '.':
			// if dot is found
			// look for exponent (e,E) as exponent can change the
			// way number should be parsed to int.
			// if no exponent found, just unmarshal the number before decimal point
			j++
			startDecimal := j
			endDecimal := j - 1
			for ; j < dec.length || dec.read(); j++ {
				switch dec.data[j] {
				case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
					endDecimal = j
					continue
				case 'e', 'E':
					// if eg 1.E
					if startDecimal > endDecimal {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					dec.cursor = j + 1
					// can try unmarshalling to int as Exponent might change decimal number to non decimal
					// let's get the float value first
					// we get part before decimal as integer
					beforeDecimal := dec.atoi64(start, end)
					// get number after the decimal point
					// multiple the before decimal point portion by 10 using bitwise
					for i := startDecimal; i <= endDecimal; i++ {
						beforeDecimal = (beforeDecimal << 3) + (beforeDecimal << 1)
					}
					// then we add both integers
					// then we divide the number by the power found
					afterDecimal := dec.atoi64(startDecimal, endDecimal)
					expI := endDecimal - startDecimal + 2
					if expI >= len(pow10uint64) || expI < 0 {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					pow := pow10uint64[expI]
					floatVal := float64(beforeDecimal+afterDecimal) / float64(pow)
					// we have the floating value, now multiply by the exponent
					exp, err := dec.getExponent()
					if err != nil {
						return 0, err
					}
					pExp := (exp + (exp >> 31)) ^ (exp >> 31) + 1 // abs
					if pExp >= int64(len(pow10uint64)) || pExp < 0 {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					val := floatVal * float64(pow10uint64[pExp])
					return int32(val), nil
				case ' ', '\t', '\n', ',', ']', '}':
					dec.cursor = j
					return dec.atoi32(start, end), nil
				default:
					dec.cursor = j
					return 0, dec.raiseInvalidJSONErr(dec.cursor)
				}
			}
			return dec.atoi32(start, end), nil
		case 'e', 'E':
			// get init n
			dec.cursor = j + 1
			return dec.getInt32WithExp(dec.atoi32(start, end))
		case ' ', '\n', '\t', '\r', ',', '}', ']':
			dec.cursor = j
			return dec.atoi32(start, end), nil
		}
		// invalid json we expect numbers, dot (single one), comma, or spaces
		return 0, dec.raiseInvalidJSONErr(dec.cursor)
	}
	return dec.atoi32(start, end), nil
}

func (dec *Decoder) getInt32WithExp(init int32) (int32, error) {
	var exp uint32
	var sign = int32(1)
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case '+':
			continue
		case '-':
			sign = -1
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			uintv := uint32(digits[dec.data[dec.cursor]])
			exp = (exp << 3) + (exp << 1) + uintv
			dec.cursor++
			for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
				switch dec.data[dec.cursor] {
				case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
					uintv := uint32(digits[dec.data[dec.cursor]])
					exp = (exp << 3) + (exp << 1) + uintv
				case ' ', '\t', '\n', '}', ',', ']':
					if exp+1 >= uint32(len(pow10uint64)) {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					if sign == -1 {
						return init * (1 / int32(pow10uint64[exp+1])), nil
					}
					return init * int32(pow10uint64[exp+1]), nil
				default:
					return 0, dec.raiseInvalidJSONErr(dec.cursor)
				}
			}
			if exp+1 >= uint32(len(pow10uint64)) {
				return 0, dec.raiseInvalidJSONErr(dec.cursor)
			}
			if sign == -1 {
				return init * (1 / int32(pow10uint64[exp+1])), nil
			}
			return init * int32(pow10uint64[exp+1]), nil
		default:
			dec.err = dec.raiseInvalidJSONErr(dec.cursor)
			return 0, dec.err
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

// DecodeInt64 reads the next JSON-encoded value from the decoder's input (io.Reader) and stores it in the int64 pointed to by v.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *Decoder) DecodeInt64(v *int64) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeInt64(v)
}

func (dec *Decoder) decodeInt64(v *int64) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt64()
			if err != nil {
				return err
			}
			*v = val
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt64Negative()
			if err != nil {
				return err
			}
			*v = -val
			return nil
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
	return dec.raiseInvalidJSONErr(dec.cursor)
}
func (dec *Decoder) decodeInt64Null(v **int64) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch c := dec.data[dec.cursor]; c {
		case ' ', '\n', '\t', '\r', ',':
			continue
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			val, err := dec.getInt64()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int64)
			}
			**v = val
			return nil
		case '-':
			dec.cursor = dec.cursor + 1
			val, err := dec.getInt64Negative()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(int64)
			}
			**v = -val
			return nil
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
	return dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) getInt64Negative() (int64, error) {
	// look for following numbers
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case '1', '2', '3', '4', '5', '6', '7', '8', '9':
			return dec.getInt64()
		default:
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) getInt64() (int64, error) {
	var end = dec.cursor
	var start = dec.cursor
	// look for following numbers
	for j := dec.cursor + 1; j < dec.length || dec.read(); j++ {
		switch dec.data[j] {
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			end = j
			continue
		case ' ', '\t', '\n', ',', '}', ']':
			dec.cursor = j
			return dec.atoi64(start, end), nil
		case '.':
			// if dot is found
			// look for exponent (e,E) as exponent can change the
			// way number should be parsed to int.
			// if no exponent found, just unmarshal the number before decimal point
			j++
			startDecimal := j
			endDecimal := j - 1
			for ; j < dec.length || dec.read(); j++ {
				switch dec.data[j] {
				case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
					endDecimal = j
					continue
				case 'e', 'E':
					// if eg 1.E
					if startDecimal > endDecimal {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					dec.cursor = j + 1
					// can try unmarshalling to int as Exponent might change decimal number to non decimal
					// let's get the float value first
					// we get part before decimal as integer
					beforeDecimal := dec.atoi64(start, end)
					// get number after the decimal point
					// multiple the before decimal point portion by 10 using bitwise
					for i := startDecimal; i <= endDecimal; i++ {
						beforeDecimal = (beforeDecimal << 3) + (beforeDecimal << 1)
					}
					// then we add both integers
					// then we divide the number by the power found
					afterDecimal := dec.atoi64(startDecimal, endDecimal)
					expI := endDecimal - startDecimal + 2
					if expI >= len(pow10uint64) || expI < 0 {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					pow := pow10uint64[expI]
					floatVal := float64(beforeDecimal+afterDecimal) / float64(pow)
					// we have the floating value, now multiply by the exponent
					exp, err := dec.getExponent()
					if err != nil {
						return 0, err
					}
					pExp := (exp + (exp >> 31)) ^ (exp >> 31) + 1 // abs
					if pExp >= int64(len(pow10uint64)) || pExp < 0 {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					val := floatVal * float64(pow10uint64[pExp])
					return int64(val), nil
				case ' ', '\t', '\n', ',', ']', '}':
					dec.cursor = j
					return dec.atoi64(start, end), nil
				default:
					dec.cursor = j
					return 0, dec.raiseInvalidJSONErr(dec.cursor)
				}
			}
			return dec.atoi64(start, end), nil
		case 'e', 'E':
			// get init n
			dec.cursor = j + 1
			return dec.getInt64WithExp(dec.atoi64(start, end))
		}
		// invalid json we expect numbers, dot (single one), comma, or spaces
		return 0, dec.raiseInvalidJSONErr(dec.cursor)
	}
	return dec.atoi64(start, end), nil
}

func (dec *Decoder) getInt64WithExp(init int64) (int64, error) {
	var exp uint64
	var sign = int64(1)
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case '+':
			continue
		case '-':
			sign = -1
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
			uintv := uint64(digits[dec.data[dec.cursor]])
			exp = (exp << 3) + (exp << 1) + uintv
			dec.cursor++
			for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
				switch dec.data[dec.cursor] {
				case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
					uintv := uint64(digits[dec.data[dec.cursor]])
					exp = (exp << 3) + (exp << 1) + uintv
				case ' ', '\t', '\n', '}', ',', ']':
					if exp+1 >= uint64(len(pow10uint64)) {
						return 0, dec.raiseInvalidJSONErr(dec.cursor)
					}
					if sign == -1 {
						return init * (1 / int64(pow10uint64[exp+1])), nil
					}
					return init * int64(pow10uint64[exp+1]), nil
				default:
					return 0, dec.raiseInvalidJSONErr(dec.cursor)
				}
			}
			if exp+1 >= uint64(len(pow10uint64)) {
				return 0, dec.raiseInvalidJSONErr(dec.cursor)
			}
			if sign == -1 {
				return init * (1 / int64(pow10uint64[exp+1])), nil
			}
			return init * int64(pow10uint64[exp+1]), nil
		default:
			return 0, dec.raiseInvalidJSONErr(dec.cursor)
		}
	}
	return 0, dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) atoi64(start, end int) int64 {
	var ll = end + 1 - start
	var val = int64(digits[dec.data[start]])
	end = end + 1
	if ll < maxInt64Length {
		for i := start + 1; i < end; i++ {
			intv := int64(digits[dec.data[i]])
			val = (val << 3) + (val << 1) + intv
		}
		return val
	} else if ll == maxInt64Length {
		for i := start + 1; i < end; i++ {
			intv := int64(digits[dec.data[i]])
			if val > maxInt64toMultiply {
				dec.err = dec.makeInvalidUnmarshalErr(val)
				return 0
			}
			val = (val << 3) + (val << 1)
			if math.MaxInt64-val < intv {
				dec.err = dec.makeInvalidUnmarshalErr(val)
				return 0
			}
			val += intv
		}
	} else {
		dec.err = dec.makeInvalidUnmarshalErr(val)
		return 0
	}
	return val
}

func (dec *Decoder) atoi32(start, end int) int32 {
	var ll = end + 1 - start
	var val = int32(digits[dec.data[start]])
	end = end + 1

	// overflowing
	if ll < maxInt32Length {
		for i := start + 1; i < end; i++ {
			intv := int32(digits[dec.data[i]])
			val = (val << 3) + (val << 1) + intv
		}
	} else if ll == maxInt32Length {
		for i := start + 1; i < end; i++ {
			intv := int32(digits[dec.data[i]])
			if val > maxInt32toMultiply {
				dec.err = dec.makeInvalidUnmarshalErr(val)
				return 0
			}
			val = (val << 3) + (val << 1)
			if math.MaxInt32-val < intv {
				dec.err = dec.makeInvalidUnmarshalErr(val)
				return 0
			}
			val += intv
		}
	} else {
		dec.err = dec.makeInvalidUnmarshalErr(val)
		return 0
	}
	return val
}

func (dec *Decoder) atoi16(start, end int) int16 {
	var ll = end + 1 - start
	var val = int16(digits[dec.data[start]])
	end = end + 1
	// overflowing
	if ll < maxInt16Length {
		for i := start + 1; i < end; i++ {
			intv := int16(digits[dec.data[i]])
			val = (val << 3) + (val << 1) + intv
		}
	} else if ll == maxInt16Length {
		for i := start + 1; i < end; i++ {
			intv := int16(digits[dec.data[i]])
			if val > maxInt16toMultiply {
				dec.err = dec.makeInvalidUnmarshalErr(val)
				return 0
			}
			val = (val << 3) + (val << 1)
			if math.MaxInt16-val < intv {
				dec.err = dec.makeInvalidUnmarshalErr(val)
				return 0
			}
			val += intv
		}
	} else {
		dec.err = dec.makeInvalidUnmarshalErr(val)
		return 0
	}
	return val
}

func (dec *Decoder) atoi8(start, end int) int8 {
	var ll = end + 1 - start
	var val = int8(digits[dec.data[start]])
	end = end + 1
	// overflowing
	if ll < maxInt8Length {
		for i := start + 1; i < end; i++ {
			intv := int8(digits[dec.data[i]])
			val = (val << 3) + (val << 1) + intv
		}
	} else if ll == maxInt8Length {
		for i := start + 1; i < end; i++ {
			intv := int8(digits[dec.data[i]])
			if val > maxInt8toMultiply {
				dec.err = dec.makeInvalidUnmarshalErr(val)
				return 0
			}
			val = (val << 3) + (val << 1)
			if math.MaxInt8-val < intv {
				dec.err = dec.makeInvalidUnmarshalErr(val)
				return 0
			}
			val += intv
		}
	} else {
		dec.err = dec.makeInvalidUnmarshalErr(val)
		return 0
	}
	return val
}

// Add Values functions

// AddInt decodes the JSON value within an object or an array to an *int.
// If next key value overflows int, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) AddInt(v *int) error {
	return dec.Int(v)
}

// AddIntNull decodes the JSON value within an object or an array to an *int.
// If next key value overflows int, an InvalidUnmarshalError error will be returned.
// If a `null` is encountered, gojay does not change the value of the pointer.
func (dec *Decoder) AddIntNull(v **int) error {
	return dec.IntNull(v)
}

// AddInt8 decodes the JSON value within an object or an array to an *int.
// If next key value overflows int8, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) AddInt8(v *int8) error {
	return dec.Int8(v)
}

// AddInt8Null decodes the JSON value within an object or an array to an *int.
// If next key value overflows int8, an InvalidUnmarshalError error will be returned.
// If a `null` is encountered, gojay does not change the value of the pointer.
func (dec *Decoder) AddInt8Null(v **int8) error {
	return dec.Int8Null(v)
}

// AddInt16 decodes the JSON value within an object or an array to an *int.
// If next key value overflows int16, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) AddInt16(v *int16) error {
	return dec.Int16(v)
}

// AddInt16Null decodes the JSON value within an object or an array to an *int.
// If next key value overflows int16, an InvalidUnmarshalError error will be returned.
// If a `null` is encountered, gojay does not change the value of the pointer.
func (dec *Decoder) AddInt16Null(v **int16) error {
	return dec.Int16Null(v)
}

// AddInt32 decodes the JSON value within an object or an array to an *int.
// If next key value overflows int32, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) AddInt32(v *int32) error {
	return dec.Int32(v)
}

// AddInt32Null decodes the JSON value within an object or an array to an *int.
// If next key value overflows int32, an InvalidUnmarshalError error will be returned.
// If a `null` is encountered, gojay does not change the value of the pointer.
func (dec *Decoder) AddInt32Null(v **int32) error {
	return dec.Int32Null(v)
}

// AddInt64 decodes the JSON value within an object or an array to an *int.
// If next key value overflows int64, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) AddInt64(v *int64) error {
	return dec.Int64(v)
}

// AddInt64Null decodes the JSON value within an object or an array to an *int.
// If next key value overflows int64, an InvalidUnmarshalError error will be returned.
// If a `null` is encountered, gojay does not change the value of the pointer.
func (dec *Decoder) AddInt64Null(v **int64) error {
	return dec.Int64Null(v)
}

// Int decodes the JSON value within an object or an array to an *int.
// If next key value overflows int, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) Int(v *int) error {
	err := dec.decodeInt(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// IntNull decodes the JSON value within an object or an array to an *int.
// If next key value overflows int, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) IntNull(v **int) error {
	err := dec.decodeIntNull(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// Int8 decodes the JSON value within an object or an array to an *int.
// If next key value overflows int8, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) Int8(v *int8) error {
	err := dec.decodeInt8(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// Int8Null decodes the JSON value within an object or an array to an *int.
// If next key value overflows int8, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) Int8Null(v **int8) error {
	err := dec.decodeInt8Null(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// Int16 decodes the JSON value within an object or an array to an *int.
// If next key value overflows int16, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) Int16(v *int16) error {
	err := dec.decodeInt16(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// Int16Null decodes the JSON value within an object or an array to an *int.
// If next key value overflows int16, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) Int16Null(v **int16) error {
	err := dec.decodeInt16Null(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// Int32 decodes the JSON value within an object or an array to an *int.
// If next key value overflows int32, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) Int32(v *int32) error {
	err := dec.decodeInt32(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// Int32Null decodes the JSON value within an object or an array to an *int.
// If next key value overflows int32, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) Int32Null(v **int32) error {
	err := dec.decodeInt32Null(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// Int64 decodes the JSON value within an object or an array to an *int.
// If next key value overflows int64, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) Int64(v *int64) error {
	err := dec.decodeInt64(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// Int64Null decodes the JSON value within an object or an array to an *int.
// If next key value overflows int64, an InvalidUnmarshalError error will be returned.
func (dec *Decoder) Int64Null(v **int64) error {
	err := dec.decodeInt64Null(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}
