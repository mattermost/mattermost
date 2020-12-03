package gojay

import (
	"encoding/json"
	"fmt"
	"io"
)

var nullBytes = []byte("null")

// MarshalJSONArray returns the JSON encoding of v, an implementation of MarshalerJSONArray.
//
//
// Example:
// 	type TestSlice []*TestStruct
//
// 	func (t TestSlice) MarshalJSONArray(enc *Encoder) {
//		for _, e := range t {
//			enc.AddObject(e)
//		}
//	}
//
//	func main() {
//		test := &TestSlice{
//			&TestStruct{123456},
//			&TestStruct{7890},
// 		}
// 		b, _ := Marshal(test)
//		fmt.Println(b) // [{"id":123456},{"id":7890}]
//	}
func MarshalJSONArray(v MarshalerJSONArray) ([]byte, error) {
	enc := BorrowEncoder(nil)
	enc.grow(512)
	enc.writeByte('[')
	v.(MarshalerJSONArray).MarshalJSONArray(enc)
	enc.writeByte(']')

	defer func() {
		enc.buf = make([]byte, 0, 512)
		enc.Release()
	}()

	return enc.buf, nil
}

// MarshalJSONObject returns the JSON encoding of v, an implementation of MarshalerJSONObject.
//
// Example:
//	type Object struct {
//		id int
//	}
//	func (s *Object) MarshalJSONObject(enc *gojay.Encoder) {
//		enc.IntKey("id", s.id)
//	}
//	func (s *Object) IsNil() bool {
//		return s == nil
//	}
//
// 	func main() {
//		test := &Object{
//			id: 123456,
//		}
//		b, _ := gojay.Marshal(test)
// 		fmt.Println(b) // {"id":123456}
//	}
func MarshalJSONObject(v MarshalerJSONObject) ([]byte, error) {
	enc := BorrowEncoder(nil)
	enc.grow(512)

	defer func() {
		enc.buf = make([]byte, 0, 512)
		enc.Release()
	}()

	return enc.encodeObject(v)
}

// Marshal returns the JSON encoding of v.
//
// If v is nil, not an implementation MarshalerJSONObject or MarshalerJSONArray or not one of the following types:
//	string, int, int8, int16, int32, int64, uint8, uint16, uint32, uint64, float64, float32, bool
// Marshal returns an InvalidMarshalError.
func Marshal(v interface{}) ([]byte, error) {
	return marshal(v, false)
}

// MarshalAny returns the JSON encoding of v.
//
// If v is nil, not an implementation MarshalerJSONObject or MarshalerJSONArray or not one of the following types:
//	string, int, int8, int16, int32, int64, uint8, uint16, uint32, uint64, float64, float32, bool
// MarshalAny falls back to "json/encoding" package to marshal the value.
func MarshalAny(v interface{}) ([]byte, error) {
	return marshal(v, true)
}

func marshal(v interface{}, any bool) ([]byte, error) {
	var (
		enc = BorrowEncoder(nil)

		buf []byte
		err error
	)

	defer func() {
		enc.buf = make([]byte, 0, 512)
		enc.Release()
	}()

	buf, err = func() ([]byte, error) {
		switch vt := v.(type) {
		case MarshalerJSONObject:
			return enc.encodeObject(vt)
		case MarshalerJSONArray:
			return enc.encodeArray(vt)
		case string:
			return enc.encodeString(vt)
		case bool:
			return enc.encodeBool(vt)
		case int:
			return enc.encodeInt(vt)
		case int64:
			return enc.encodeInt64(vt)
		case int32:
			return enc.encodeInt(int(vt))
		case int16:
			return enc.encodeInt(int(vt))
		case int8:
			return enc.encodeInt(int(vt))
		case uint64:
			return enc.encodeInt(int(vt))
		case uint32:
			return enc.encodeInt(int(vt))
		case uint16:
			return enc.encodeInt(int(vt))
		case uint8:
			return enc.encodeInt(int(vt))
		case float64:
			return enc.encodeFloat(vt)
		case float32:
			return enc.encodeFloat32(vt)
		case *EmbeddedJSON:
			return enc.encodeEmbeddedJSON(vt)
		default:
			if any {
				return json.Marshal(vt)
			}

			return nil, InvalidMarshalError(fmt.Sprintf(invalidMarshalErrorMsg, vt))
		}
	}()
	return buf, err
}

// MarshalerJSONObject is the interface to implement for struct to be encoded
type MarshalerJSONObject interface {
	MarshalJSONObject(enc *Encoder)
	IsNil() bool
}

// MarshalerJSONArray is the interface to implement
// for a slice or an array to be encoded
type MarshalerJSONArray interface {
	MarshalJSONArray(enc *Encoder)
	IsNil() bool
}

// An Encoder writes JSON values to an output stream.
type Encoder struct {
	buf      []byte
	isPooled byte
	w        io.Writer
	err      error
	hasKeys  bool
	keys     []string
}

// AppendBytes allows a modular usage by appending bytes manually to the current state of the buffer.
func (enc *Encoder) AppendBytes(b []byte) {
	enc.writeBytes(b)
}

// AppendByte allows a modular usage by appending a single byte manually to the current state of the buffer.
func (enc *Encoder) AppendByte(b byte) {
	enc.writeByte(b)
}

// Buf returns the Encoder's buffer.
func (enc *Encoder) Buf() []byte {
	return enc.buf
}

// Write writes to the io.Writer and resets the buffer.
func (enc *Encoder) Write() (int, error) {
	i, err := enc.w.Write(enc.buf)
	enc.buf = enc.buf[:0]
	return i, err
}

func (enc *Encoder) getPreviousRune() byte {
	last := len(enc.buf) - 1
	return enc.buf[last]
}
