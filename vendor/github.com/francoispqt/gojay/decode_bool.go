package gojay

// DecodeBool reads the next JSON-encoded value from the decoder's input (io.Reader)
// and stores it in the boolean pointed to by v.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *Decoder) DecodeBool(v *bool) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeBool(v)
}
func (dec *Decoder) decodeBool(v *bool) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		case 't':
			dec.cursor++
			err := dec.assertTrue()
			if err != nil {
				return err
			}
			*v = true
			return nil
		case 'f':
			dec.cursor++
			err := dec.assertFalse()
			if err != nil {
				return err
			}
			*v = false
			return nil
		case 'n':
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return err
			}
			*v = false
			return nil
		default:
			dec.err = dec.makeInvalidUnmarshalErr(v)
			err := dec.skipData()
			if err != nil {
				return err
			}
			return nil
		}
	}
	return nil
}
func (dec *Decoder) decodeBoolNull(v **bool) error {
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		case 't':
			dec.cursor++
			err := dec.assertTrue()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(bool)
			}
			**v = true
			return nil
		case 'f':
			dec.cursor++
			err := dec.assertFalse()
			if err != nil {
				return err
			}
			if *v == nil {
				*v = new(bool)
			}
			**v = false
			return nil
		case 'n':
			dec.cursor++
			err := dec.assertNull()
			if err != nil {
				return err
			}
			return nil
		default:
			dec.err = dec.makeInvalidUnmarshalErr(v)
			err := dec.skipData()
			if err != nil {
				return err
			}
			return nil
		}
	}
	return nil
}

func (dec *Decoder) assertTrue() error {
	i := 0
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch i {
		case 0:
			if dec.data[dec.cursor] != 'r' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 1:
			if dec.data[dec.cursor] != 'u' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 2:
			if dec.data[dec.cursor] != 'e' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 3:
			switch dec.data[dec.cursor] {
			case ' ', '\b', '\t', '\n', ',', ']', '}':
				// dec.cursor--
				return nil
			default:
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		}
		i++
	}
	if i == 3 {
		return nil
	}
	return dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) assertNull() error {
	i := 0
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch i {
		case 0:
			if dec.data[dec.cursor] != 'u' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 1:
			if dec.data[dec.cursor] != 'l' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 2:
			if dec.data[dec.cursor] != 'l' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 3:
			switch dec.data[dec.cursor] {
			case ' ', '\t', '\n', ',', ']', '}':
				// dec.cursor--
				return nil
			default:
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		}
		i++
	}
	if i == 3 {
		return nil
	}
	return dec.raiseInvalidJSONErr(dec.cursor)
}

func (dec *Decoder) assertFalse() error {
	i := 0
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch i {
		case 0:
			if dec.data[dec.cursor] != 'a' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 1:
			if dec.data[dec.cursor] != 'l' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 2:
			if dec.data[dec.cursor] != 's' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 3:
			if dec.data[dec.cursor] != 'e' {
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		case 4:
			switch dec.data[dec.cursor] {
			case ' ', '\t', '\n', ',', ']', '}':
				// dec.cursor--
				return nil
			default:
				return dec.raiseInvalidJSONErr(dec.cursor)
			}
		}
		i++
	}
	if i == 4 {
		return nil
	}
	return dec.raiseInvalidJSONErr(dec.cursor)
}

// Add Values functions

// AddBool decodes the JSON value within an object or an array to a *bool.
// If next key is neither null nor a JSON boolean, an InvalidUnmarshalError will be returned.
// If next key is null, bool will be false.
func (dec *Decoder) AddBool(v *bool) error {
	return dec.Bool(v)
}

// AddBoolNull decodes the JSON value within an object or an array to a *bool.
// If next key is neither null nor a JSON boolean, an InvalidUnmarshalError will be returned.
// If next key is null, bool will be false.
// If a `null` is encountered, gojay does not change the value of the pointer.
func (dec *Decoder) AddBoolNull(v **bool) error {
	return dec.BoolNull(v)
}

// Bool decodes the JSON value within an object or an array to a *bool.
// If next key is neither null nor a JSON boolean, an InvalidUnmarshalError will be returned.
// If next key is null, bool will be false.
func (dec *Decoder) Bool(v *bool) error {
	err := dec.decodeBool(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}

// BoolNull decodes the JSON value within an object or an array to a *bool.
// If next key is neither null nor a JSON boolean, an InvalidUnmarshalError will be returned.
// If next key is null, bool will be false.
func (dec *Decoder) BoolNull(v **bool) error {
	err := dec.decodeBoolNull(v)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}
