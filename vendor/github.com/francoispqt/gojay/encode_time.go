package gojay

import (
	"time"
)

// EncodeTime encodes a *time.Time to JSON with the given format
func (enc *Encoder) EncodeTime(t *time.Time, format string) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeTime(t, format)
	_, err := enc.Write()
	if err != nil {
		return err
	}
	return nil
}

// encodeInt encodes an int to JSON
func (enc *Encoder) encodeTime(t *time.Time, format string) ([]byte, error) {
	enc.writeByte('"')
	enc.buf = t.AppendFormat(enc.buf, format)
	enc.writeByte('"')
	return enc.buf, nil
}

// AddTimeKey adds an *time.Time to be encoded with the given format, must be used inside an object as it will encode a key
func (enc *Encoder) AddTimeKey(key string, t *time.Time, format string) {
	enc.TimeKey(key, t, format)
}

// TimeKey adds an *time.Time to be encoded with the given format, must be used inside an object as it will encode a key
func (enc *Encoder) TimeKey(key string, t *time.Time, format string) {
	if enc.hasKeys {
		if !enc.keyExists(key) {
			return
		}
	}
	enc.grow(10 + len(key))
	r := enc.getPreviousRune()
	if r != '{' {
		enc.writeTwoBytes(',', '"')
	} else {
		enc.writeByte('"')
	}
	enc.writeStringEscape(key)
	enc.writeBytes(objKeyStr)
	enc.buf = t.AppendFormat(enc.buf, format)
	enc.writeByte('"')
}

// AddTime adds an *time.Time to be encoded with the given format, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddTime(t *time.Time, format string) {
	enc.Time(t, format)
}

// Time adds an *time.Time to be encoded with the given format, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) Time(t *time.Time, format string) {
	enc.grow(10)
	r := enc.getPreviousRune()
	if r != '[' {
		enc.writeByte(',')
	}
	enc.writeByte('"')
	enc.buf = t.AppendFormat(enc.buf, format)
	enc.writeByte('"')
}
