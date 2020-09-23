package gojay

import (
	"fmt"
	"io"
)

// UnmarshalJSONArray parses the JSON-encoded data and stores the result in the value pointed to by v.
//
// v must implement UnmarshalerJSONArray.
//
// If a JSON value is not appropriate for a given target type, or if a JSON number
// overflows the target type, UnmarshalJSONArray skips that field and completes the unmarshaling as best it can.
func UnmarshalJSONArray(data []byte, v UnmarshalerJSONArray) error {
	dec := borrowDecoder(nil, 0)
	defer dec.Release()
	dec.data = make([]byte, len(data))
	copy(dec.data, data)
	dec.length = len(data)
	_, err := dec.decodeArray(v)
	if err != nil {
		return err
	}
	if dec.err != nil {
		return dec.err
	}
	return nil
}

// UnmarshalJSONObject parses the JSON-encoded data and stores the result in the value pointed to by v.
//
// v must implement UnmarshalerJSONObject.
//
// If a JSON value is not appropriate for a given target type, or if a JSON number
// overflows the target type, UnmarshalJSONObject skips that field and completes the unmarshaling as best it can.
func UnmarshalJSONObject(data []byte, v UnmarshalerJSONObject) error {
	dec := borrowDecoder(nil, 0)
	defer dec.Release()
	dec.data = make([]byte, len(data))
	copy(dec.data, data)
	dec.length = len(data)
	_, err := dec.decodeObject(v)
	if err != nil {
		return err
	}
	if dec.err != nil {
		return dec.err
	}
	return nil
}

// Unmarshal parses the JSON-encoded data and stores the result in the value pointed to by v.
// If v is nil, not an implementation of UnmarshalerJSONObject or UnmarshalerJSONArray or not one of the following types:
// 	*string, **string, *int, **int, *int8, **int8, *int16, **int16, *int32, **int32, *int64, **int64, *uint8, **uint8, *uint16, **uint16,
// 	*uint32, **uint32, *uint64, **uint64, *float64, **float64, *float32, **float32, *bool, **bool
// Unmarshal returns an InvalidUnmarshalError.
//
//
// If a JSON value is not appropriate for a given target type, or if a JSON number
// overflows the target type, Unmarshal skips that field and completes the unmarshaling as best it can.
// If no more serious errors are encountered, Unmarshal returns an UnmarshalTypeError describing the earliest such error.
// In any case, it's not guaranteed that all the remaining fields following the problematic one will be unmarshaled into the target object.
func Unmarshal(data []byte, v interface{}) error {
	var err error
	var dec *Decoder
	switch vt := v.(type) {
	case *string:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeString(vt)
	case **string:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeStringNull(vt)
	case *int:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt(vt)
	case **int:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeIntNull(vt)
	case *int8:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt8(vt)
	case **int8:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt8Null(vt)
	case *int16:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt16(vt)
	case **int16:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt16Null(vt)
	case *int32:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt32(vt)
	case **int32:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt32Null(vt)
	case *int64:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt64(vt)
	case **int64:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt64Null(vt)
	case *uint8:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint8(vt)
	case **uint8:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint8Null(vt)
	case *uint16:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint16(vt)
	case **uint16:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint16Null(vt)
	case *uint32:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint32(vt)
	case **uint32:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint32Null(vt)
	case *uint64:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint64(vt)
	case **uint64:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint64Null(vt)
	case *float64:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeFloat64(vt)
	case **float64:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeFloat64Null(vt)
	case *float32:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeFloat32(vt)
	case **float32:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeFloat32Null(vt)
	case *bool:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeBool(vt)
	case **bool:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeBoolNull(vt)
	case UnmarshalerJSONObject:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = make([]byte, len(data))
		copy(dec.data, data)
		_, err = dec.decodeObject(vt)
	case UnmarshalerJSONArray:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = make([]byte, len(data))
		copy(dec.data, data)
		_, err = dec.decodeArray(vt)
	case *interface{}:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = make([]byte, len(data))
		copy(dec.data, data)
		err = dec.decodeInterface(vt)
	default:
		return InvalidUnmarshalError(fmt.Sprintf(invalidUnmarshalErrorMsg, vt))
	}
	defer dec.Release()
	if err != nil {
		return err
	}
	return dec.err
}

// UnmarshalerJSONObject is the interface to implement to decode a JSON Object.
type UnmarshalerJSONObject interface {
	UnmarshalJSONObject(*Decoder, string) error
	NKeys() int
}

// UnmarshalerJSONArray is the interface to implement to decode a JSON Array.
type UnmarshalerJSONArray interface {
	UnmarshalJSONArray(*Decoder) error
}

// A Decoder reads and decodes JSON values from an input stream.
type Decoder struct {
	r          io.Reader
	data       []byte
	err        error
	isPooled   byte
	called     byte
	child      byte
	cursor     int
	length     int
	keysDone   int
	arrayIndex int
}

// Decode reads the next JSON-encoded value from the decoder's input (io.Reader) and stores it in the value pointed to by v.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
// The differences between Decode and Unmarshal are:
// 	- Decode reads from an io.Reader in the Decoder, whereas Unmarshal reads from a []byte
// 	- Decode leaves to the user the option of borrowing and releasing a Decoder, whereas Unmarshal internally always borrows a Decoder and releases it when the unmarshaling is completed
func (dec *Decoder) Decode(v interface{}) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	var err error
	switch vt := v.(type) {
	case *string:
		err = dec.decodeString(vt)
	case **string:
		err = dec.decodeStringNull(vt)
	case *int:
		err = dec.decodeInt(vt)
	case **int:
		err = dec.decodeIntNull(vt)
	case *int8:
		err = dec.decodeInt8(vt)
	case **int8:
		err = dec.decodeInt8Null(vt)
	case *int16:
		err = dec.decodeInt16(vt)
	case **int16:
		err = dec.decodeInt16Null(vt)
	case *int32:
		err = dec.decodeInt32(vt)
	case **int32:
		err = dec.decodeInt32Null(vt)
	case *int64:
		err = dec.decodeInt64(vt)
	case **int64:
		err = dec.decodeInt64Null(vt)
	case *uint8:
		err = dec.decodeUint8(vt)
	case **uint8:
		err = dec.decodeUint8Null(vt)
	case *uint16:
		err = dec.decodeUint16(vt)
	case **uint16:
		err = dec.decodeUint16Null(vt)
	case *uint32:
		err = dec.decodeUint32(vt)
	case **uint32:
		err = dec.decodeUint32Null(vt)
	case *uint64:
		err = dec.decodeUint64(vt)
	case **uint64:
		err = dec.decodeUint64Null(vt)
	case *float64:
		err = dec.decodeFloat64(vt)
	case **float64:
		err = dec.decodeFloat64Null(vt)
	case *float32:
		err = dec.decodeFloat32(vt)
	case **float32:
		err = dec.decodeFloat32Null(vt)
	case *bool:
		err = dec.decodeBool(vt)
	case **bool:
		err = dec.decodeBoolNull(vt)
	case UnmarshalerJSONObject:
		_, err = dec.decodeObject(vt)
	case UnmarshalerJSONArray:
		_, err = dec.decodeArray(vt)
	case *EmbeddedJSON:
		err = dec.decodeEmbeddedJSON(vt)
	case *interface{}:
		err = dec.decodeInterface(vt)
	default:
		return InvalidUnmarshalError(fmt.Sprintf(invalidUnmarshalErrorMsg, vt))
	}
	if err != nil {
		return err
	}
	return dec.err
}

// Non exported

func isDigit(b byte) bool {
	switch b {
	case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
		return true
	default:
		return false
	}
}

func (dec *Decoder) read() bool {
	if dec.r != nil {
		// if we reach the end, double the buffer to ensure there's always more space
		if len(dec.data) == dec.length {
			nLen := dec.length * 2
			if nLen == 0 {
				nLen = 512
			}
			Buf := make([]byte, nLen, nLen)
			copy(Buf, dec.data)
			dec.data = Buf
		}
		var n int
		var err error
		for n == 0 {
			n, err = dec.r.Read(dec.data[dec.length:])
			if err != nil {
				if err != io.EOF {
					dec.err = err
					return false
				}
				if n == 0 {
					return false
				}
				dec.length = dec.length + n
				return true
			}
		}
		dec.length = dec.length + n
		return true
	}
	return false
}

func (dec *Decoder) nextChar() byte {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		}
		d := dec.data[dec.cursor]
		return d
	}
	return 0
}
