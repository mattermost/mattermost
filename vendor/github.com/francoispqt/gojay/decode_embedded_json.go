package gojay

// EmbeddedJSON is a raw encoded JSON value.
// It can be used to delay JSON decoding or precompute a JSON encoding.
type EmbeddedJSON []byte

func (dec *Decoder) decodeEmbeddedJSON(ej *EmbeddedJSON) error {
	var err error
	if ej == nil {
		return InvalidUnmarshalError("Invalid nil pointer given")
	}
	var beginOfEmbeddedJSON int
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		// is null
		case 'n':
			beginOfEmbeddedJSON = dec.cursor
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return err
			}
		case 't':
			beginOfEmbeddedJSON = dec.cursor
			dec.cursor++
			err := dec.assertTrue()
			if err != nil {
				return err
			}
		// is false
		case 'f':
			beginOfEmbeddedJSON = dec.cursor
			dec.cursor++
			err := dec.assertFalse()
			if err != nil {
				return err
			}
		// is an object
		case '{':
			beginOfEmbeddedJSON = dec.cursor
			dec.cursor = dec.cursor + 1
			dec.cursor, err = dec.skipObject()
		// is string
		case '"':
			beginOfEmbeddedJSON = dec.cursor
			dec.cursor = dec.cursor + 1
			err = dec.skipString() // why no new dec.cursor in result?
		// is array
		case '[':
			beginOfEmbeddedJSON = dec.cursor
			dec.cursor = dec.cursor + 1
			dec.cursor, err = dec.skipArray()
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-':
			beginOfEmbeddedJSON = dec.cursor
			dec.cursor, err = dec.skipNumber()
		}
		break
	}
	if err == nil {
		if dec.cursor-1 >= beginOfEmbeddedJSON {
			*ej = append(*ej, dec.data[beginOfEmbeddedJSON:dec.cursor]...)
		}
		dec.called |= 1
	}
	return err
}

// AddEmbeddedJSON adds an EmbeddedsJSON to the value pointed by v.
// It can be used to delay JSON decoding or precompute a JSON encoding.
func (dec *Decoder) AddEmbeddedJSON(v *EmbeddedJSON) error {
	return dec.EmbeddedJSON(v)
}

// EmbeddedJSON adds an EmbeddedsJSON to the value pointed by v.
// It can be used to delay JSON decoding or precompute a JSON encoding.
func (dec *Decoder) EmbeddedJSON(v *EmbeddedJSON) error {
	err := dec.decodeEmbeddedJSON(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}
