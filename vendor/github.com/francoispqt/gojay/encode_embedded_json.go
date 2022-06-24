package gojay

// EncodeEmbeddedJSON encodes an embedded JSON.
// is basically sets the internal buf as the value pointed by v and calls the io.Writer.Write()
func (enc *Encoder) EncodeEmbeddedJSON(v *EmbeddedJSON) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	enc.buf = *v
	_, err := enc.Write()
	if err != nil {
		return err
	}
	return nil
}

func (enc *Encoder) encodeEmbeddedJSON(v *EmbeddedJSON) ([]byte, error) {
	enc.writeBytes(*v)
	return enc.buf, nil
}

// AddEmbeddedJSON adds an EmbeddedJSON to be encoded.
//
// It basically blindly writes the bytes to the final buffer. Therefore,
// it expects the JSON to be of proper format.
func (enc *Encoder) AddEmbeddedJSON(v *EmbeddedJSON) {
	enc.grow(len(*v) + 4)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeBytes(*v)
}

// AddEmbeddedJSONOmitEmpty adds an EmbeddedJSON to be encoded or skips it if nil pointer or empty.
//
// It basically blindly writes the bytes to the final buffer. Therefore,
// it expects the JSON to be of proper format.
func (enc *Encoder) AddEmbeddedJSONOmitEmpty(v *EmbeddedJSON) {
	if v == nil || len(*v) == 0 {
		return
	}
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeBytes(*v)
}

// AddEmbeddedJSONKey adds an EmbeddedJSON and a key to be encoded.
//
// It basically blindly writes the bytes to the final buffer. Therefore,
// it expects the JSON to be of proper format.
func (enc *Encoder) AddEmbeddedJSONKey(key string, v *EmbeddedJSON) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	enc.grow(len(key) + len(*v) + 5)
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.writeBytes(*v)
}

// AddEmbeddedJSONKeyOmitEmpty adds an EmbeddedJSON and a key to be encoded or skips it if nil pointer or empty.
//
// It basically blindly writes the bytes to the final buffer. Therefore,
// it expects the JSON to be of proper format.
func (enc *Encoder) AddEmbeddedJSONKeyOmitEmpty(key string, v *EmbeddedJSON) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	if v == nil || len(*v) == 0 {
		return
	}
	enc.grow(len(key) + len(*v) + 5)
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.writeStringEscape(key)
	enc.writeBytes(objKey)
	enc.writeBytes(*v)
}
