package gojay

var objKeyStr = []byte(`":"`)
var objKeyObj = []byte(`":{`)
var objKeyArr = []byte(`":[`)
var objKey = []byte(`":`)

// EncodeObject encodes an object to JSON
func (enc *Encoder) EncodeObject(v MarshalerJSONObject) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, err := enc.encodeObject(v)
	if err != nil {
		enc.err = err
		return err
	}
	_, err = enc.Write()
	if err != nil {
		enc.err = err
		return err
	}
	return nil
}

// EncodeObjectKeys encodes an object to JSON
func (enc *Encoder) EncodeObjectKeys(v MarshalerJSONObject, keys []string) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	enc.hasKeys = true
	enc.keys = keys
	_, err := enc.encodeObject(v)
	if err != nil {
		enc.err = err
		return err
	}
	_, err = enc.Write()
	if err != nil {
		enc.err = err
		return err
	}
	return nil
}

func (enc *Encoder) encodeObject(v MarshalerJSONObject) ([]byte, error) {
	enc.grow(512)
	enc.writeByte('{')
	if !v.IsNil() {
		v.MarshalJSONObject(enc)
	}
	if enc.hasKeys {
		enc.hasKeys = false
		enc.keys = nil
	}
	enc.writeByte('}')
	return enc.buf, enc.err
}

// AddObject adds an object to be encoded, must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) AddObject(v MarshalerJSONObject) {
	enc.Object(v)
}

// AddObjectOmitEmpty adds an object to be encoded or skips it if IsNil returns true.
// Must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) AddObjectOmitEmpty(v MarshalerJSONObject) {
	enc.ObjectOmitEmpty(v)
}

// AddObjectNullEmpty adds an object to be encoded or skips it if IsNil returns true.
// Must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) AddObjectNullEmpty(v MarshalerJSONObject) {
	enc.ObjectNullEmpty(v)
}

// AddObjectKey adds a struct to be encoded, must be used inside an object as it will encode a key
// value must implement MarshalerJSONObject
func (enc *Encoder) AddObjectKey(key string, v MarshalerJSONObject) {
	enc.ObjectKey(key, v)
}

// AddObjectKeyOmitEmpty adds an object to be encoded or skips it if IsNil returns true.
// Must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) AddObjectKeyOmitEmpty(key string, v MarshalerJSONObject) {
	enc.ObjectKeyOmitEmpty(key, v)
}

// AddObjectKeyNullEmpty adds an object to be encoded or skips it if IsNil returns true.
// Must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) AddObjectKeyNullEmpty(key string, v MarshalerJSONObject) {
	enc.ObjectKeyNullEmpty(key, v)
}

// Object adds an object to be encoded, must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) Object(v MarshalerJSONObject) {
	if v.IsNil() {
		enc.grow(2)
		r := enc.getPreviousRune()
		if r != '{' && r != '[' {
			enc.writeByte(',')
		}
		enc.writeByte('{')
		enc.writeByte('}')
		return
	}
	enc.grow(4)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeByte('{')

	var origHasKeys = enc.hasKeys
	var origKeys = enc.keys
	enc.hasKeys = false
	enc.keys = nil

	v.MarshalJSONObject(enc)

	enc.hasKeys = origHasKeys
	enc.keys = origKeys

	enc.writeByte('}')
}

// ObjectWithKeys adds an object to be encoded, must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject. It will only encode the keys in keys.
func (enc *Encoder) ObjectWithKeys(v MarshalerJSONObject, keys []string) {
	if v.IsNil() {
		enc.grow(2)
		r := enc.getPreviousRune()
		if r != '{' && r != '[' {
			enc.writeByte(',')
		}
		enc.writeByte('{')
		enc.writeByte('}')
		return
	}
	enc.grow(4)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeByte('{')

	var origKeys = enc.keys
	var origHasKeys = enc.hasKeys
	enc.hasKeys = true
	enc.keys = keys

	v.MarshalJSONObject(enc)

	enc.hasKeys = origHasKeys
	enc.keys = origKeys

	enc.writeByte('}')
}

// ObjectOmitEmpty adds an object to be encoded or skips it if IsNil returns true.
// Must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) ObjectOmitEmpty(v MarshalerJSONObject) {
	if v.IsNil() {
		return
	}
	enc.grow(2)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeByte('{')

	var origHasKeys = enc.hasKeys
	var origKeys = enc.keys
	enc.hasKeys = false
	enc.keys = nil

	v.MarshalJSONObject(enc)

	enc.hasKeys = origHasKeys
	enc.keys = origKeys

	enc.writeByte('}')
}

// ObjectNullEmpty adds an object to be encoded or skips it if IsNil returns true.
// Must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) ObjectNullEmpty(v MarshalerJSONObject) {
	enc.grow(2)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	if v.IsNil() {
		enc.writeBytes(nullBytes)
		return
	}
	enc.writeByte('{')

	var origHasKeys = enc.hasKeys
	var origKeys = enc.keys
	enc.hasKeys = false
	enc.keys = nil

	v.MarshalJSONObject(enc)

	enc.hasKeys = origHasKeys
	enc.keys = origKeys

	enc.writeByte('}')
}

// ObjectKey adds a struct to be encoded, must be used inside an object as it will encode a key
// value must implement MarshalerJSONObject
func (enc *Encoder) ObjectKey(key string, v MarshalerJSONObject) {
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
		enc.writeBytes(objKeyObj)
		enc.writeByte('}')
		return
	}
	enc.grow(5 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKeyObj)

	var origHasKeys = enc.hasKeys
	var origKeys = enc.keys
	enc.hasKeys = false
	enc.keys = nil

	v.MarshalJSONObject(enc)

	enc.hasKeys = origHasKeys
	enc.keys = origKeys

	enc.writeByte('}')
}

// ObjectKeyWithKeys adds a struct to be encoded, must be used inside an object as it will encode a key.
// Value must implement MarshalerJSONObject. It will only encode the keys in keys.
func (enc *Encoder) ObjectKeyWithKeys(key string, value MarshalerJSONObject, keys []string) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	if value.IsNil() {
		enc.grow(2 + len(key))
		r := enc.getPreviousRune()
		if r != '{' {
			enc.writeByte(',')
		}
		enc.writeByte('"')
		enc.writeStringEscape(key)
		enc.writeBytes(objKeyObj)
		enc.writeByte('}')
		return
	}
	enc.grow(5 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKeyObj)
	var origKeys = enc.keys
	var origHasKeys = enc.hasKeys
	enc.hasKeys = true
	enc.keys = keys
	value.MarshalJSONObject(enc)
	enc.hasKeys = origHasKeys
	enc.keys = origKeys
	enc.writeByte('}')
}

// ObjectKeyOmitEmpty adds an object to be encoded or skips it if IsNil returns true.
// Must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) ObjectKeyOmitEmpty(key string, v MarshalerJSONObject) {
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
	enc.writeBytes(objKeyObj)

	var origHasKeys = enc.hasKeys
	var origKeys = enc.keys
	enc.hasKeys = false
	enc.keys = nil

	v.MarshalJSONObject(enc)

	enc.hasKeys = origHasKeys
	enc.keys = origKeys

	enc.writeByte('}')
}

// ObjectKeyNullEmpty adds an object to be encoded or skips it if IsNil returns true.
// Must be used inside a slice or array encoding (does not encode a key)
// value must implement MarshalerJSONObject
func (enc *Encoder) ObjectKeyNullEmpty(key string, v MarshalerJSONObject) {
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
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	if v.IsNil() {
		enc.writeBytes(nullBytes)
		return
	}
	enc.writeByte('{')

	var origHasKeys = enc.hasKeys
	var origKeys = enc.keys
	enc.hasKeys = false
	enc.keys = nil

	v.MarshalJSONObject(enc)

	enc.hasKeys = origHasKeys
	enc.keys = origKeys

	enc.writeByte('}')
}

// EncodeObjectFunc is a custom func type implementing MarshaleObject.
// Use it to cast a func(*Encoder) to Marshal an object.
//
//	enc := gojay.NewEncoder(io.Writer)
//	enc.EncodeObject(gojay.EncodeObjectFunc(func(enc *gojay.Encoder) {
//		enc.AddStringKey("hello", "world")
//	}))
type EncodeObjectFunc func(*Encoder)

// MarshalJSONObject implements MarshalerJSONObject.
func (f EncodeObjectFunc) MarshalJSONObject(enc *Encoder) {
	f(enc)
}

// IsNil implements MarshalerJSONObject.
func (f EncodeObjectFunc) IsNil() bool {
	return f == nil
}

func (enc *Encoder) keyExists(k string) bool {
	if enc.keys == nil {
		return false
	}
	for _, key := range enc.keys {
		if key == k {
			return true
		}
	}
	return false
}
