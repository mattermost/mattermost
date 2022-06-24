package gojay

// EncodeArray encodes an implementation of MarshalerJSONArray to JSON
func (enc *Encoder) EncodeArray(v MarshalerJSONArray) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeArray(v)
	_, err := enc.Write()
	if err != nil {
		enc.err = err
		return err
	}
	return nil
}
func (enc *Encoder) encodeArray(v MarshalerJSONArray) ([]byte, error) {
	enc.grow(200)
	enc.writeByte('[')
	v.MarshalJSONArray(enc)
	enc.writeByte(']')
	return enc.buf, enc.err
}

// AddArray adds an implementation of MarshalerJSONArray to be encoded, must be used inside a slice or array encoding (does not encode a key)
// value must implement Marshaler
func (enc *Encoder) AddArray(v MarshalerJSONArray) {
	enc.Array(v)
}

// AddArrayOmitEmpty adds an array or slice to be encoded, must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerAddArrayOmitEmpty
func (enc *Encoder) AddArrayOmitEmpty(v MarshalerJSONArray) {
	enc.ArrayOmitEmpty(v)
}

// AddArrayNullEmpty adds an array or slice to be encoded, must be used inside a slice or array encoding (does not encode a key)
// value must implement Marshaler, if v is empty, `null` will be encoded`
func (enc *Encoder) AddArrayNullEmpty(v MarshalerJSONArray) {
	enc.ArrayNullEmpty(v)
}

// AddArrayKey adds an array or slice to be encoded, must be used inside an object as it will encode a key
// value must implement Marshaler
func (enc *Encoder) AddArrayKey(key string, v MarshalerJSONArray) {
	enc.ArrayKey(key, v)
}

// AddArrayKeyOmitEmpty adds an array or slice to be encoded and skips it if it is nil.
// Must be called inside an object as it will encode a key.
func (enc *Encoder) AddArrayKeyOmitEmpty(key string, v MarshalerJSONArray) {
	enc.ArrayKeyOmitEmpty(key, v)
}

// AddArrayKeyNullEmpty adds an array or slice to be encoded and skips it if it is nil.
// Must be called inside an object as it will encode a key. `null` will be encoded`
func (enc *Encoder) AddArrayKeyNullEmpty(key string, v MarshalerJSONArray) {
	enc.ArrayKeyNullEmpty(key, v)
}

// Array adds an implementation of MarshalerJSONArray to be encoded, must be used inside a slice or array encoding (does not encode a key)
// value must implement Marshaler
func (enc *Encoder) Array(v MarshalerJSONArray) {
	if v.IsNil() {
		enc.grow(3)
		r := enc.getPreviousRune()
		if r != '[' {
			enc.writeByte(',')
		}
		enc.writeByte('[')
		enc.writeByte(']')
		return
	}
	enc.grow(100)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeByte('[')
	v.MarshalJSONArray(enc)
	enc.writeByte(']')
}

// ArrayOmitEmpty adds an array or slice to be encoded, must be used inside a slice or array encoding (does not encode a key)
// value must implement Marshaler
func (enc *Encoder) ArrayOmitEmpty(v MarshalerJSONArray) {
	if v.IsNil() {
		return
	}
	enc.grow(4)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeByte('[')
	v.MarshalJSONArray(enc)
	enc.writeByte(']')
}

// ArrayNullEmpty adds an array or slice to be encoded, must be used inside a slice or array encoding (does not encode a key)
// value must implement Marshaler
func (enc *Encoder) ArrayNullEmpty(v MarshalerJSONArray) {
	enc.grow(4)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	if v.IsNil() {
		enc.writeBytes(nullBytes)
		return
	}
	enc.writeByte('[')
	v.MarshalJSONArray(enc)
	enc.writeByte(']')
}

// ArrayKey adds an array or slice to be encoded, must be used inside an object as it will encode a key
// value must implement Marshaler
func (enc *Encoder) ArrayKey(key string, v MarshalerJSONArray) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	if v.IsNil() {
		enc.grow(2 + len(key))
		r := enc.getPreviousRune()
		if r != '{' {
			enc.writeByte(',')
		}
		enc.writeByte('"')
		enc.writeStringEscape(key)
		enc.writeBytes(objKeyArr)
		enc.writeByte(']')
		return
	}
	enc.grow(5 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKeyArr)
	v.MarshalJSONArray(enc)
	enc.writeByte(']')
}

// ArrayKeyOmitEmpty adds an array or slice to be encoded and skips if it is nil.
// Must be called inside an object as it will encode a key.
func (enc *Encoder) ArrayKeyOmitEmpty(key string, v MarshalerJSONArray) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	if v.IsNil() {
		return
	}
	enc.grow(5 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKeyArr)
	v.MarshalJSONArray(enc)
	enc.writeByte(']')
}

// ArrayKeyNullEmpty adds an array or slice to be encoded and encodes `null`` if it is nil.
// Must be called inside an object as it will encode a key.
func (enc *Encoder) ArrayKeyNullEmpty(key string, v MarshalerJSONArray) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	enc.grow(5 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	if v.IsNil() {
		enc.writeBytes(nullBytes)
		return
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKeyArr)
	v.MarshalJSONArray(enc)
	enc.writeByte(']')
}

// EncodeArrayFunc is a custom func type implementing MarshaleArray.
// Use it to cast a func(*Encoder) to Marshal an object.
//
//	enc := gojay.NewEncoder(io.Writer)
//	enc.EncodeArray(gojay.EncodeArrayFunc(func(enc *gojay.Encoder) {
//		enc.AddStringKey("hello", "world")
//	}))
type EncodeArrayFunc func(*Encoder)

// MarshalJSONArray implements MarshalerJSONArray.
func (f EncodeArrayFunc) MarshalJSONArray(enc *Encoder) {
	f(enc)
}

// IsNil implements MarshalerJSONArray.
func (f EncodeArrayFunc) IsNil() bool {
	return f == nil
}
