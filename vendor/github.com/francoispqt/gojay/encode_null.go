package gojay

// AddNull adds a `null` to be encoded. Must be used while encoding an array.`
func (enc *Encoder) AddNull() {
	enc.Null()
}

// Null adds a `null` to be encoded. Must be used while encoding an array.`
func (enc *Encoder) Null() {
	enc.grow(5)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeBytes(nullBytes)
}

// AddNullKey adds a `null` to be encoded. Must be used while encoding an array.`
func (enc *Encoder) AddNullKey(key string) {
	enc.NullKey(key)
}

// NullKey adds a `null` to be encoded. Must be used while encoding an array.`
func (enc *Encoder) NullKey(key string) {
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
	enc.writeBytes(nullBytes)
}
