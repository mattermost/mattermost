package gojay

// EncodeString encodes a string to
func (enc *Encoder) EncodeString(s string) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeString(s)
	_, err := enc.Write()
	if err != nil {
		enc.err = err
		return err
	}
	return nil
}

// encodeString encodes a string to
func (enc *Encoder) encodeString(v string) ([]byte, error) {
	enc.writeByte('"')
	enc.writeStringEscape(v)
	enc.writeByte('"')
	return enc.buf, nil
}

// AppendString appends a string to the buffer
func (enc *Encoder) AppendString(v string) {
	enc.grow(len(v) + 2)
	enc.writeByte('"')
	enc.writeStringEscape(v)
	enc.writeByte('"')
}

// AddString adds a string to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddString(v string) {
	enc.String(v)
}

// AddStringOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddStringOmitEmpty(v string) {
	enc.StringOmitEmpty(v)
}

// AddStringNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddStringNullEmpty(v string) {
	enc.StringNullEmpty(v)
}

// AddStringKey adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddStringKey(key, v string) {
	enc.StringKey(key, v)
}

// AddStringKeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddStringKeyOmitEmpty(key, v string) {
	enc.StringKeyOmitEmpty(key, v)
}

// AddStringKeyNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddStringKeyNullEmpty(key, v string) {
	enc.StringKeyNullEmpty(key, v)
}

// String adds a string to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) String(v string) {
	enc.grow(len(v) + 4)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeTwoBytes(',', '"')
	} else {
		enc.writeByte('"')
	}
	enc.writeStringEscape(v)
	enc.writeByte('"')
}

// StringOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) StringOmitEmpty(v string) {
	if v == "" {
		return
	}
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeTwoBytes(',', '"')
	} else {
		enc.writeByte('"')
	}
	enc.writeStringEscape(v)
	enc.writeByte('"')
}

// StringNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) StringNullEmpty(v string) {
	r := enc.getPreviousRune()
	if v == "" {
		if r != '[' {
			enc.writeByte(',')
			enc.writeBytes(nullBytes)
		} else {
			enc.writeBytes(nullBytes)
		}
		return
	}
	if r != '[' {
		enc.writeTwoBytes(',', '"')
	} else {
		enc.writeByte('"')
	}
	enc.writeStringEscape(v)
	enc.writeByte('"')
}

// StringKey adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) StringKey(key, v string) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	enc.grow(len(key) + len(v) + 5)
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeTwoBytes(',', '"')
	} else {
		enc.writeByte('"')
	}
	enc.writeStringEscape(key)
	enc.writeBytes(objKeyStr)
	enc.writeStringEscape(v)
	enc.writeByte('"')
}

// StringKeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) StringKeyOmitEmpty(key, v string) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	if v == "" {
		return
	}
	enc.grow(len(key) + len(v) + 5)
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeTwoBytes(',', '"')
	} else {
		enc.writeByte('"')
	}
	enc.writeStringEscape(key)
	enc.writeBytes(objKeyStr)
	enc.writeStringEscape(v)
	enc.writeByte('"')
}

// StringKeyNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) StringKeyNullEmpty(key, v string) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	enc.grow(len(key) + len(v) + 5)
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeTwoBytes(',', '"')
	} else {
		enc.writeByte('"')
	}
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	if v == "" {
		enc.writeBytes(nullBytes)
		return
	}
	enc.writeByte('"')
	enc.writeStringEscape(v)
	enc.writeByte('"')
}
