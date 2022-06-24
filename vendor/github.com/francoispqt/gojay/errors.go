package gojay

import (
	"errors"
	"fmt"
)

const invalidJSONCharErrorMsg = "Invalid JSON, wrong char '%c' found at position %d"

// InvalidJSONError is a type representing an error returned when
// Decoding encounters invalid JSON.
type InvalidJSONError string

func (err InvalidJSONError) Error() string {
	return string(err)
}

func (dec *Decoder) raiseInvalidJSONErr(pos int) error {
	var c byte
	if len(dec.data) > pos {
		c = dec.data[pos]
	}
	dec.err = InvalidJSONError(
		fmt.Sprintf(
			invalidJSONCharErrorMsg,
			c,
			pos,
		),
	)
	return dec.err
}

const invalidUnmarshalErrorMsg = "Cannot unmarshal JSON to type '%T'"

// InvalidUnmarshalError is a type representing an error returned when
// Decoding cannot unmarshal JSON to the receiver type for various reasons.
type InvalidUnmarshalError string

func (err InvalidUnmarshalError) Error() string {
	return string(err)
}

func (dec *Decoder) makeInvalidUnmarshalErr(v interface{}) error {
	return InvalidUnmarshalError(
		fmt.Sprintf(
			invalidUnmarshalErrorMsg,
			v,
		),
	)
}

const invalidMarshalErrorMsg = "Invalid type %T provided to Marshal"

// InvalidMarshalError is a type representing an error returned when
// Encoding did not find the proper way to encode
type InvalidMarshalError string

func (err InvalidMarshalError) Error() string {
	return string(err)
}

// NoReaderError is a type representing an error returned when
// decoding requires a reader and none was given
type NoReaderError string

func (err NoReaderError) Error() string {
	return string(err)
}

// InvalidUsagePooledDecoderError is a type representing an error returned
// when decoding is called on a still pooled Decoder
type InvalidUsagePooledDecoderError string

func (err InvalidUsagePooledDecoderError) Error() string {
	return string(err)
}

// InvalidUsagePooledEncoderError is a type representing an error returned
// when decoding is called on a still pooled Encoder
type InvalidUsagePooledEncoderError string

func (err InvalidUsagePooledEncoderError) Error() string {
	return string(err)
}

// ErrUnmarshalPtrExpected is the error returned when unmarshal expects a pointer value,
// When using `dec.ObjectNull` or `dec.ArrayNull` for example.
var ErrUnmarshalPtrExpected = errors.New("Cannot unmarshal to given value, a pointer is expected")
