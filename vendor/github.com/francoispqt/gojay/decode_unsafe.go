package gojay

import (
	"fmt"
)

// Unsafe is the structure holding the unsafe version of the API.
// The difference between unsafe api and regular api is that the regular API
// copies the buffer passed to Unmarshal functions to a new internal buffer.
// Making it safer because internally GoJay uses unsafe.Pointer to transform slice of bytes into a string.
var Unsafe = decUnsafe{}

type decUnsafe struct{}

func (u decUnsafe) UnmarshalJSONArray(data []byte, v UnmarshalerJSONArray) error {
	dec := borrowDecoder(nil, 0)
	defer dec.Release()
	dec.data = data
	dec.length = len(data)
	_, err := dec.decodeArray(v)
	return err
}

func (u decUnsafe) UnmarshalJSONObject(data []byte, v UnmarshalerJSONObject) error {
	dec := borrowDecoder(nil, 0)
	defer dec.Release()
	dec.data = data
	dec.length = len(data)
	_, err := dec.decodeObject(v)
	return err
}

func (u decUnsafe) Unmarshal(data []byte, v interface{}) error {
	var err error
	var dec *Decoder
	switch vt := v.(type) {
	case *string:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeString(vt)
	case *int:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt(vt)
	case *int8:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt8(vt)
	case *int16:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt16(vt)
	case *int32:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt32(vt)
	case *int64:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeInt64(vt)
	case *uint8:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint8(vt)
	case *uint16:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint16(vt)
	case *uint32:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint32(vt)
	case *uint64:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeUint64(vt)
	case *float64:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeFloat64(vt)
	case *float32:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeFloat32(vt)
	case *bool:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		err = dec.decodeBool(vt)
	case UnmarshalerJSONObject:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		_, err = dec.decodeObject(vt)
	case UnmarshalerJSONArray:
		dec = borrowDecoder(nil, 0)
		dec.length = len(data)
		dec.data = data
		_, err = dec.decodeArray(vt)
	default:
		return InvalidUnmarshalError(fmt.Sprintf(invalidUnmarshalErrorMsg, vt))
	}
	defer dec.Release()
	if err != nil {
		return err
	}
	return dec.err
}
