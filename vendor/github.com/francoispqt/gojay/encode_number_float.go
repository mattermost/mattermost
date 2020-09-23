package gojay

import "strconv"

// EncodeFloat encodes a float64 to JSON
func (enc *Encoder) EncodeFloat(n float64) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeFloat(n)
	_, err := enc.Write()
	if err != nil {
		return err
	}
	return nil
}

// encodeFloat encodes a float64 to JSON
func (enc *Encoder) encodeFloat(n float64) ([]byte, error) {
	enc.buf = strconv.AppendFloat(enc.buf, n, 'f', -1, 64)
	return enc.buf, nil
}

// EncodeFloat32 encodes a float32 to JSON
func (enc *Encoder) EncodeFloat32(n float32) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeFloat32(n)
	_, err := enc.Write()
	if err != nil {
		return err
	}
	return nil
}

func (enc *Encoder) encodeFloat32(n float32) ([]byte, error) {
	enc.buf = strconv.AppendFloat(enc.buf, float64(n), 'f', -1, 32)
	return enc.buf, nil
}

// AddFloat adds a float64 to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddFloat(v float64) {
	enc.Float64(v)
}

// AddFloatOmitEmpty adds a float64 to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddFloatOmitEmpty(v float64) {
	enc.Float64OmitEmpty(v)
}

// AddFloatNullEmpty adds a float64 to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddFloatNullEmpty(v float64) {
	enc.Float64NullEmpty(v)
}

// Float adds a float64 to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Float(v float64) {
	enc.Float64(v)
}

// FloatOmitEmpty adds a float64 to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) FloatOmitEmpty(v float64) {
	enc.Float64OmitEmpty(v)
}

// FloatNullEmpty adds a float64 to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) FloatNullEmpty(v float64) {
	enc.Float64NullEmpty(v)
}

// AddFloatKey adds a float64 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddFloatKey(key string, v float64) {
	enc.Float64Key(key, v)
}

// AddFloatKeyOmitEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddFloatKeyOmitEmpty(key string, v float64) {
	enc.Float64KeyOmitEmpty(key, v)
}

// AddFloatKeyNullEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddFloatKeyNullEmpty(key string, v float64) {
	enc.Float64KeyNullEmpty(key, v)
}

// FloatKey adds a float64 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) FloatKey(key string, v float64) {
	enc.Float64Key(key, v)
}

// FloatKeyOmitEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) FloatKeyOmitEmpty(key string, v float64) {
	enc.Float64KeyOmitEmpty(key, v)
}

// FloatKeyNullEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) FloatKeyNullEmpty(key string, v float64) {
	enc.Float64KeyNullEmpty(key, v)
}

// AddFloat64 adds a float64 to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddFloat64(v float64) {
	enc.Float(v)
}

// AddFloat64OmitEmpty adds a float64 to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddFloat64OmitEmpty(v float64) {
	enc.FloatOmitEmpty(v)
}

// Float64 adds a float64 to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Float64(v float64) {
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.buf = strconv.AppendFloat(enc.buf, v, 'f', -1, 64)
}

// Float64OmitEmpty adds a float64 to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Float64OmitEmpty(v float64) {
	if v == 0 {
		return
	}
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.buf = strconv.AppendFloat(enc.buf, v, 'f', -1, 64)
}

// Float64NullEmpty adds a float64 to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Float64NullEmpty(v float64) {
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	if v == 0 {
		enc.writeBytes(nullBytes)
		return
	}
	enc.buf = strconv.AppendFloat(enc.buf, v, 'f', -1, 64)
}

// AddFloat64Key adds a float64 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddFloat64Key(key string, v float64) {
	enc.FloatKey(key, v)
}

// AddFloat64KeyOmitEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddFloat64KeyOmitEmpty(key string, v float64) {
	enc.FloatKeyOmitEmpty(key, v)
}

// Float64Key adds a float64 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) Float64Key(key string, value float64) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.grow(10)
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.buf = strconv.AppendFloat(enc.buf, value, 'f', -1, 64)
}

// Float64KeyOmitEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) Float64KeyOmitEmpty(key string, v float64) {
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
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.buf = strconv.AppendFloat(enc.buf, v, 'f', -1, 64)
}

// Float64KeyNullEmpty adds a float64 to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Float64KeyNullEmpty(key string, v float64) {
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
	enc.buf = strconv.AppendFloat(enc.buf, v, 'f', -1, 64)
}

// AddFloat32 adds a float32 to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddFloat32(v float32) {
	enc.Float32(v)
}

// AddFloat32OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddFloat32OmitEmpty(v float32) {
	enc.Float32OmitEmpty(v)
}

// AddFloat32NullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) AddFloat32NullEmpty(v float32) {
	enc.Float32NullEmpty(v)
}

// Float32 adds a float32 to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Float32(v float32) {
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.buf = strconv.AppendFloat(enc.buf, float64(v), 'f', -1, 32)
}

// Float32OmitEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Float32OmitEmpty(v float32) {
	if v == 0 {
		return
	}
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.buf = strconv.AppendFloat(enc.buf, float64(v), 'f', -1, 32)
}

// Float32NullEmpty adds an int to be encoded and skips it if its value is 0,
// must be used inside a slice or array encoding (does not encode a key).
func (enc *Encoder) Float32NullEmpty(v float32) {
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	if v == 0 {
		enc.writeBytes(nullBytes)
		return
	}
	enc.buf = strconv.AppendFloat(enc.buf, float64(v), 'f', -1, 32)
}

// AddFloat32Key adds a float32 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddFloat32Key(key string, v float32) {
	enc.Float32Key(key, v)
}

// AddFloat32KeyOmitEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddFloat32KeyOmitEmpty(key string, v float32) {
	enc.Float32KeyOmitEmpty(key, v)
}

// AddFloat32KeyNullEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddFloat32KeyNullEmpty(key string, v float32) {
	enc.Float32KeyNullEmpty(key, v)
}

// Float32Key adds a float32 to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) Float32Key(key string, v float32) {
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
	enc.writeByte('"')
	enc.writeByte(':')
	enc.buf = strconv.AppendFloat(enc.buf, float64(v), 'f', -1, 32)
}

// Float32KeyOmitEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) Float32KeyOmitEmpty(key string, v float32) {
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
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.buf = strconv.AppendFloat(enc.buf, float64(v), 'f', -1, 32)
}

// Float32KeyNullEmpty adds a float64 to be encoded and skips it if its value is 0.
// Must be used inside an object as it will encode a key
func (enc *Encoder) Float32KeyNullEmpty(key string, v float32) {
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
	enc.buf = strconv.AppendFloat(enc.buf, float64(v), 'f', -1, 32)
}
