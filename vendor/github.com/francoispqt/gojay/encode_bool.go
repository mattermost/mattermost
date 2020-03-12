package gojay

import "strconv"

// EncodeBool encodes a bool to JSON
func (enc *Encoder) EncodeBool(v bool) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeBool(v)
	_, err := enc.Write()
	if err != nil {
		enc.err = err
		return err
	}
	return nil
}

// encodeBool encodes a bool to JSON
func (enc *Encoder) encodeBool(v bool) ([]byte, error) {
	enc.grow(5)
	if v {
		enc.writeString("true")
	} else {
		enc.writeString("false")
	}
	return enc.buf, enc.err
}

// AddBool adds a bool to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddBool(v bool) {
	enc.Bool(v)
}

// AddBoolOmitEmpty adds a bool to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddBoolOmitEmpty(v bool) {
	enc.BoolOmitEmpty(v)
}

// AddBoolNullEmpty adds a bool to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddBoolNullEmpty(v bool) {
	enc.BoolNullEmpty(v)
}

// AddBoolKey adds a bool to be encoded, must be used inside an object as it will encode a key.
func (enc *Encoder) AddBoolKey(key string, v bool) {
	enc.BoolKey(key, v)
}

// AddBoolKeyOmitEmpty adds a bool to be encoded and skips if it is zero value.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddBoolKeyOmitEmpty(key string, v bool) {
	enc.BoolKeyOmitEmpty(key, v)
}

// AddBoolKeyNullEmpty adds a bool to be encoded and encodes `null` if it is zero value.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) AddBoolKeyNullEmpty(key string, v bool) {
	enc.BoolKeyNullEmpty(key, v)
}

// Bool adds a bool to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Bool(v bool) {
	enc.grow(5)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	if v {
		enc.writeString("true")
	} else {
		enc.writeString("false")
	}
}

// BoolOmitEmpty adds a bool to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) BoolOmitEmpty(v bool) {
	if v == false {
		return
	}
	enc.grow(5)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeString("true")
}

// BoolNullEmpty adds a bool to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) BoolNullEmpty(v bool) {
	enc.grow(5)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	if v == false {
		enc.writeBytes(nullBytes)
		return
	}
	enc.writeString("true")
}

// BoolKey adds a bool to be encoded, must be used inside an object as it will encode a key.
func (enc *Encoder) BoolKey(key string, value bool) {
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
	enc.buf = strconv.AppendBool(enc.buf, value)
}

// BoolKeyOmitEmpty adds a bool to be encoded and skips it if it is zero value.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) BoolKeyOmitEmpty(key string, v bool) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	if v == false {
		return
	}
	enc.grow(5 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.buf = strconv.AppendBool(enc.buf, v)
}

// BoolKeyNullEmpty adds a bool to be encoded and skips it if it is zero value.
// Must be used inside an object as it will encode a key.
func (enc *Encoder) BoolKeyNullEmpty(key string, v bool) {
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
	if v == false {
		enc.writeBytes(nullBytes)
		return
	}
	enc.buf = strconv.AppendBool(enc.buf, v)
}
