package gojay

// TODO @afiune for now we are using the standard json unmarshaling but in
// the future it would be great to implement one here inside this repo
import "encoding/json"

// DecodeInterface reads the next JSON-encoded value from the decoder's input (io.Reader) and stores it in the value pointed to by i.
//
// i must be an interface poiter
func (dec *Decoder) DecodeInterface(i *interface{}) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	err := dec.decodeInterface(i)
	return err
}

func (dec *Decoder) decodeInterface(i *interface{}) error {
	start, end, err := dec.getObject()
	if err != nil {
		dec.cursor = start
		return err
	}

	// if start & end are equal the object is a null, don't unmarshal
	if start == end {
		return nil
	}

	object := dec.data[start:end]
	if err = json.Unmarshal(object, i); err != nil {
		return err
	}

	dec.cursor = end
	return nil
}

// @afiune Maybe return the type as well?
func (dec *Decoder) getObject() (start int, end int, err error) {
	// start cursor
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		// is null
		case 'n':
			dec.cursor++
			err = dec.assertNull()
			if err != nil {
				return
			}
			// Set start & end to the same cursor to indicate the object
			// is a null and should not be unmarshal
			start = dec.cursor
			end = dec.cursor
			return
		case 't':
			start = dec.cursor
			dec.cursor++
			err = dec.assertTrue()
			if err != nil {
				return
			}
			end = dec.cursor
			dec.cursor++
			return
		// is false
		case 'f':
			start = dec.cursor
			dec.cursor++
			err = dec.assertFalse()
			if err != nil {
				return
			}
			end = dec.cursor
			dec.cursor++
			return
		// is an object
		case '{':
			start = dec.cursor
			dec.cursor++
			end, err = dec.skipObject()
			dec.cursor = end
			return
		// is string
		case '"':
			start = dec.cursor
			dec.cursor++
			start, end, err = dec.getString()
			start--
			dec.cursor = end
			return
		// is array
		case '[':
			start = dec.cursor
			dec.cursor++
			end, err = dec.skipArray()
			dec.cursor = end
			return
		case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-':
			start = dec.cursor
			end, err = dec.skipNumber()
			dec.cursor = end
			return
		default:
			err = dec.raiseInvalidJSONErr(dec.cursor)
			return
		}
	}
	err = dec.raiseInvalidJSONErr(dec.cursor)
	return
}

// Add Values functions

// AddInterface decodes the JSON value within an object or an array to a interface{}.
func (dec *Decoder) AddInterface(v *interface{}) error {
	return dec.Interface(v)
}

// Interface decodes the JSON value within an object or an array to an interface{}.
func (dec *Decoder) Interface(value *interface{}) error {
	err := dec.decodeInterface(value)
	if err != nil {
		return err
	}
	dec.called |= 1
	return nil
}
