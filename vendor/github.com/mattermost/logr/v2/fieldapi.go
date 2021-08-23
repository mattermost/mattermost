package logr

import (
	"fmt"
	"time"
)

// Any picks the best supported field type based on type of val.
// For best performance when passing a struct (or struct pointer),
// implement `logr.LogWriter` on the struct, otherwise reflection
// will be used to generate a string representation.
func Any(key string, val interface{}) Field {
	return fieldForAny(key, val)
}

// Int64 constructs a field containing a key and Int64 value.
func Int64(key string, val int64) Field {
	return Field{Key: key, Type: Int64Type, Integer: val}
}

// Int32 constructs a field containing a key and Int32 value.
func Int32(key string, val int32) Field {
	return Field{Key: key, Type: Int32Type, Integer: int64(val)}
}

// Int constructs a field containing a key and Int value.
func Int(key string, val int) Field {
	return Field{Key: key, Type: IntType, Integer: int64(val)}
}

// Uint64 constructs a field containing a key and Uint64 value.
func Uint64(key string, val uint64) Field {
	return Field{Key: key, Type: Uint64Type, Integer: int64(val)}
}

// Uint32 constructs a field containing a key and Uint32 value.
func Uint32(key string, val uint32) Field {
	return Field{Key: key, Type: Uint32Type, Integer: int64(val)}
}

// Uint constructs a field containing a key and Uint value.
func Uint(key string, val uint) Field {
	return Field{Key: key, Type: UintType, Integer: int64(val)}
}

// Float64 constructs a field containing a key and Float64 value.
func Float64(key string, val float64) Field {
	return Field{Key: key, Type: Float64Type, Float: val}
}

// Float32 constructs a field containing a key and Float32 value.
func Float32(key string, val float32) Field {
	return Field{Key: key, Type: Float32Type, Float: float64(val)}
}

// String constructs a field containing a key and String value.
func String(key string, val string) Field {
	return Field{Key: key, Type: StringType, String: val}
}

// Stringer constructs a field containing a key and a `fmt.Stringer` value.
// The `String` method will be called in lazy fashion.
func Stringer(key string, val fmt.Stringer) Field {
	return Field{Key: key, Type: StringerType, Interface: val}
}

// Err constructs a field containing a default key ("error") and error value.
func Err(err error) Field {
	return NamedErr("error", err)
}

// NamedErr constructs a field containing a key and error value.
func NamedErr(key string, err error) Field {
	return Field{Key: key, Type: ErrorType, Interface: err}
}

// Bool constructs a field containing a key and bool value.
func Bool(key string, val bool) Field {
	var b int64
	if val {
		b = 1
	}
	return Field{Key: key, Type: BoolType, Integer: b}
}

// Time constructs a field containing a key and time.Time value.
func Time(key string, val time.Time) Field {
	return Field{Key: key, Type: TimeType, Interface: val}
}

// Duration constructs a field containing a key and time.Duration value.
func Duration(key string, val time.Duration) Field {
	return Field{Key: key, Type: DurationType, Integer: int64(val)}
}

// Millis constructs a field containing a key and timestamp value.
// The timestamp is expected to be milliseconds since Jan 1, 1970 UTC.
func Millis(key string, val int64) Field {
	return Field{Key: key, Type: TimestampMillisType, Integer: val}
}

// Array constructs a field containing a key and array value.
func Array(key string, val interface{}) Field {
	return Field{Key: key, Type: ArrayType, Interface: val}
}

// Map constructs a field containing a key and map value.
func Map(key string, val interface{}) Field {
	return Field{Key: key, Type: MapType, Interface: val}
}
