package gojay

import "strconv"

// EncodeInt encodes an int to JSON
func (enc *Encoder) EncodeInt(n int) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeInt(n)
	_, err := enc.Write()
	if err != nil {
		return err
	}
	return nil
}

// encodeInt encodes an int to JSON
func (enc *Encoder) encodeInt(n int) ([]byte, error) {
	enc.buf = strconv.AppendInt(enc.buf, int64(n), 10)
	return enc.buf, nil
}

// EncodeInt64 encodes an int64 to JSON
func (enc *Encoder) EncodeInt64(n int64) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeInt64(n)
	_, err := enc.Write()
	if err != nil {
		return err
	}
	return nil
}

// encodeInt64 encodes an int to JSON
func (enc *Encoder) encodeInt64(n int64) ([]byte, error) {
	enc.buf = strconv.AppendInt(enc.buf, n, 10)
	return enc.buf, nil
}

// AddInt adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddInt(v int) {
	enc.Int(v)
}

// AddIntOmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddIntOmitEmpty(v int) {
	enc.IntOmitEmpty(v)
}

// AddIntNullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddIntNullEmpty(v int) {
	enc.IntNullEmpty(v)
}

// Int adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Int(v int) {
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.buf = strconv.AppendInt(enc.buf, int64(v), 10)
}

// IntOmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) IntOmitEmpty(v int) {
	if v == 0 {
		return
	}
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.buf = strconv.AppendInt(enc.buf, int64(v), 10)
}

// IntNullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) IntNullEmpty(v int) {
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	if v == 0 {
		enc.writeBytes(nullBytes)
		return
	}
	enc.buf = strconv.AppendInt(enc.buf, int64(v), 10)
}

// AddIntKey adds an int to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddIntKey(key string, v int) {
	enc.IntKey(key, v)
}

// AddIntKeyOmitEmpty adds an int to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddIntKeyOmitEmpty(key string, v int) {
	enc.IntKeyOmitEmpty(key, v)
}

// AddIntKeyNullEmpty adds an int to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddIntKeyNullEmpty(key string, v int) {
	enc.IntKeyNullEmpty(key, v)
}

// IntKey adds an int to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) IntKey(key string, v int) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	enc.grow(10 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.buf = strconv.AppendInt(enc.buf, int64(v), 10)
}

// IntKeyOmitEmpty adds an int to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) IntKeyOmitEmpty(key string, v int) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	if v == 0 {
		return
	}
	enc.grow(10 + len(key))
	r := enc.getPreviousRune()
	if r != '{' && r != '[' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.buf = strconv.AppendInt(enc.buf, int64(v), 10)
}

// IntKeyNullEmpty adds an int to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) IntKeyNullEmpty(key string, v int) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	enc.grow(10 + len(key))
	r := enc.getPreviousRune()
	if r != '{' && r != '[' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	if v == 0 {
		enc.writeBytes(nullBytes)
		return
	}
	enc.buf = strconv.AppendInt(enc.buf, int64(v), 10)
}

// AddInt64 adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddInt64(v int64) {
	enc.Int64(v)
}

// AddInt64OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddInt64OmitEmpty(v int64) {
	enc.Int64OmitEmpty(v)
}

// AddInt64NullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddInt64NullEmpty(v int64) {
	enc.Int64NullEmpty(v)
}

// Int64 adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Int64(v int64) {
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.buf = strconv.AppendInt(enc.buf, v, 10)
}

// Int64OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Int64OmitEmpty(v int64) {
	if v == 0 {
		return
	}
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.buf = strconv.AppendInt(enc.buf, v, 10)
}

// Int64NullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Int64NullEmpty(v int64) {
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	if v == 0 {
		enc.writeBytes(nullBytes)
		return
	}
	enc.buf = strconv.AppendInt(enc.buf, v, 10)
}

// AddInt64Key adds an int64 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddInt64Key(key string, v int64) {
	enc.Int64Key(key, v)
}

// AddInt64KeyOmitEmpty adds an int64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddInt64KeyOmitEmpty(key string, v int64) {
	enc.Int64KeyOmitEmpty(key, v)
}

// AddInt64KeyNullEmpty adds an int64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddInt64KeyNullEmpty(key string, v int64) {
	enc.Int64KeyNullEmpty(key, v)
}

// Int64Key adds an int64 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) Int64Key(key string, v int64) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	enc.grow(10 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.buf = strconv.AppendInt(enc.buf, v, 10)
}

// Int64KeyOmitEmpty adds an int64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) Int64KeyOmitEmpty(key string, v int64) {
	if v == 0 {
		return
	}
	enc.grow(10 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.buf = strconv.AppendInt(enc.buf, v, 10)
}

// Int64KeyNullEmpty adds an int64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) Int64KeyNullEmpty(key string, v int64) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	enc.grow(10 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	if v == 0 {
		enc.writeBytes(nullBytes)
		return
	}
	enc.buf = strconv.AppendInt(enc.buf, v, 10)
}

// AddInt32 adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddInt32(v int32) {
	enc.Int64(int64(v))
}

// AddInt32OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddInt32OmitEmpty(v int32) {
	enc.Int64OmitEmpty(int64(v))
}

// AddInt32NullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddInt32NullEmpty(v int32) {
	enc.Int64NullEmpty(int64(v))
}

// Int32 adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Int32(v int32) {
	enc.Int64(int64(v))
}

// Int32OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Int32OmitEmpty(v int32) {
	enc.Int64OmitEmpty(int64(v))
}

// Int32NullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Int32NullEmpty(v int32) {
	enc.Int64NullEmpty(int64(v))
}

// AddInt32Key adds an int32 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddInt32Key(key string, v int32) {
	enc.Int64Key(key, int64(v))
}

// AddInt32KeyOmitEmpty adds an int32 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddInt32KeyOmitEmpty(key string, v int32) {
	enc.Int64KeyOmitEmpty(key, int64(v))
}

// Int32Key adds an int32 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) Int32Key(key string, v int32) {
	enc.Int64Key(key, int64(v))
}

// Int32KeyOmitEmpty adds an int32 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) Int32KeyOmitEmpty(key string, v int32) {
	enc.Int64KeyOmitEmpty(key, int64(v))
}

// Int32KeyNullEmpty adds an int32 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) Int32KeyNullEmpty(key string, v int32) {
	enc.Int64KeyNullEmpty(key, int64(v))
}

// AddInt16 adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddInt16(v int16) {
	enc.Int64(int64(v))
}

// AddInt16OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddInt16OmitEmpty(v int16) {
	enc.Int64OmitEmpty(int64(v))
}

// Int16 adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Int16(v int16) {
	enc.Int64(int64(v))
}

// Int16OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Int16OmitEmpty(v int16) {
	enc.Int64OmitEmpty(int64(v))
}

// Int16NullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Int16NullEmpty(v int16) {
	enc.Int64NullEmpty(int64(v))
}

// AddInt16Key adds an int16 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddInt16Key(key string, v int16) {
	enc.Int64Key(key, int64(v))
}

// AddInt16KeyOmitEmpty adds an int16 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddInt16KeyOmitEmpty(key string, v int16) {
	enc.Int64KeyOmitEmpty(key, int64(v))
}

// AddInt16KeyNullEmpty adds an int16 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddInt16KeyNullEmpty(key string, v int16) {
	enc.Int64KeyNullEmpty(key, int64(v))
}

// Int16Key adds an int16 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) Int16Key(key string, v int16) {
	enc.Int64Key(key, int64(v))
}

// Int16KeyOmitEmpty adds an int16 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) Int16KeyOmitEmpty(key string, v int16) {
	enc.Int64KeyOmitEmpty(key, int64(v))
}

// Int16KeyNullEmpty adds an int16 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) Int16KeyNullEmpty(key string, v int16) {
	enc.Int64KeyNullEmpty(key, int64(v))
}

// AddInt8 adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddInt8(v int8) {
	enc.Int64(int64(v))
}

// AddInt8OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddInt8OmitEmpty(v int8) {
	enc.Int64OmitEmpty(int64(v))
}

// AddInt8NullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddInt8NullEmpty(v int8) {
	enc.Int64NullEmpty(int64(v))
}

// Int8 adds an int to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Int8(v int8) {
	enc.Int64(int64(v))
}

// Int8OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Int8OmitEmpty(v int8) {
	enc.Int64OmitEmpty(int64(v))
}

// Int8NullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Int8NullEmpty(v int8) {
	enc.Int64NullEmpty(int64(v))
}

// AddInt8Key adds an int8 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddInt8Key(key string, v int8) {
	enc.Int64Key(key, int64(v))
}

// AddInt8KeyOmitEmpty adds an int8 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddInt8KeyOmitEmpty(key string, v int8) {
	enc.Int64KeyOmitEmpty(key, int64(v))
}

// AddInt8KeyNullEmpty adds an int8 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddInt8KeyNullEmpty(key string, v int8) {
	enc.Int64KeyNullEmpty(key, int64(v))
}

// Int8Key adds an int8 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) Int8Key(key string, v int8) {
	enc.Int64Key(key, int64(v))
}

// Int8KeyOmitEmpty adds an int8 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) Int8KeyOmitEmpty(key string, v int8) {
	enc.Int64KeyOmitEmpty(key, int64(v))
}

// Int8KeyNullEmpty adds an int8 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) Int8KeyNullEmpty(key string, v int8) {
	enc.Int64KeyNullEmpty(key, int64(v))
}
