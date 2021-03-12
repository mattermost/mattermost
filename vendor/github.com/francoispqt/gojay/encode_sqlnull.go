package gojay

import "database/sql"

// EncodeSQLNullString encodes a string to
func (enc *Encoder) EncodeSQLNullString(v *sql.NullString) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeString(v.String)
	_, err := enc.Write()
	if err != nil {
		enc.err = err
		return err
	}
	return nil
}

// AddSQLNullString adds a string to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullString(v *sql.NullString) {
	enc.String(v.String)
}

// AddSQLNullStringOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullStringOmitEmpty(v *sql.NullString) {
	if v != nil && v.Valid && v.String != "" {
		enc.StringOmitEmpty(v.String)
	}
}

// AddSQLNullStringNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullStringNullEmpty(v *sql.NullString) {
	if v != nil && v.Valid {
		enc.StringNullEmpty(v.String)
	}
}

// AddSQLNullStringKey adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullStringKey(key string, v *sql.NullString) {
	enc.StringKey(key, v.String)
}

// AddSQLNullStringKeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullStringKeyOmitEmpty(key string, v *sql.NullString) {
	if v != nil && v.Valid && v.String != "" {
		enc.StringKeyOmitEmpty(key, v.String)
	}
}

// SQLNullString adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullString(v *sql.NullString) {
	enc.String(v.String)
}

// SQLNullStringOmitEmpty adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullStringOmitEmpty(v *sql.NullString) {
	if v != nil && v.Valid && v.String != "" {
		enc.String(v.String)
	}
}

// SQLNullStringNullEmpty adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullStringNullEmpty(v *sql.NullString) {
	if v != nil && v.Valid {
		enc.StringNullEmpty(v.String)
	}
}

// SQLNullStringKey adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullStringKey(key string, v *sql.NullString) {
	enc.StringKey(key, v.String)
}

// SQLNullStringKeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullStringKeyOmitEmpty(key string, v *sql.NullString) {
	if v != nil && v.Valid && v.String != "" {
		enc.StringKeyOmitEmpty(key, v.String)
	}
}

// SQLNullStringKeyNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullStringKeyNullEmpty(key string, v *sql.NullString) {
	if v != nil && v.Valid {
		enc.StringKeyNullEmpty(key, v.String)
	}
}

// NullInt64

// EncodeSQLNullInt64 encodes a string to
func (enc *Encoder) EncodeSQLNullInt64(v *sql.NullInt64) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeInt64(v.Int64)
	_, err := enc.Write()
	if err != nil {
		enc.err = err
		return err
	}
	return nil
}

// AddSQLNullInt64 adds a string to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullInt64(v *sql.NullInt64) {
	enc.Int64(v.Int64)
}

// AddSQLNullInt64OmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullInt64OmitEmpty(v *sql.NullInt64) {
	if v != nil && v.Valid && v.Int64 != 0 {
		enc.Int64OmitEmpty(v.Int64)
	}
}

// AddSQLNullInt64NullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullInt64NullEmpty(v *sql.NullInt64) {
	if v != nil && v.Valid {
		enc.Int64NullEmpty(v.Int64)
	}
}

// AddSQLNullInt64Key adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullInt64Key(key string, v *sql.NullInt64) {
	enc.Int64Key(key, v.Int64)
}

// AddSQLNullInt64KeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullInt64KeyOmitEmpty(key string, v *sql.NullInt64) {
	if v != nil && v.Valid && v.Int64 != 0 {
		enc.Int64KeyOmitEmpty(key, v.Int64)
	}
}

// AddSQLNullInt64KeyNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullInt64KeyNullEmpty(key string, v *sql.NullInt64) {
	if v != nil && v.Valid {
		enc.Int64KeyNullEmpty(key, v.Int64)
	}
}

// SQLNullInt64 adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullInt64(v *sql.NullInt64) {
	enc.Int64(v.Int64)
}

// SQLNullInt64OmitEmpty adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullInt64OmitEmpty(v *sql.NullInt64) {
	if v != nil && v.Valid && v.Int64 != 0 {
		enc.Int64(v.Int64)
	}
}

// SQLNullInt64NullEmpty adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullInt64NullEmpty(v *sql.NullInt64) {
	if v != nil && v.Valid {
		enc.Int64NullEmpty(v.Int64)
	}
}

// SQLNullInt64Key adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullInt64Key(key string, v *sql.NullInt64) {
	enc.Int64Key(key, v.Int64)
}

// SQLNullInt64KeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullInt64KeyOmitEmpty(key string, v *sql.NullInt64) {
	if v != nil && v.Valid && v.Int64 != 0 {
		enc.Int64KeyOmitEmpty(key, v.Int64)
	}
}

// SQLNullInt64KeyNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullInt64KeyNullEmpty(key string, v *sql.NullInt64) {
	if v != nil && v.Valid {
		enc.Int64KeyNullEmpty(key, v.Int64)
	}
}

// NullFloat64

// EncodeSQLNullFloat64 encodes a string to
func (enc *Encoder) EncodeSQLNullFloat64(v *sql.NullFloat64) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeFloat(v.Float64)
	_, err := enc.Write()
	if err != nil {
		enc.err = err
		return err
	}
	return nil
}

// AddSQLNullFloat64 adds a string to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullFloat64(v *sql.NullFloat64) {
	enc.Float64(v.Float64)
}

// AddSQLNullFloat64OmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullFloat64OmitEmpty(v *sql.NullFloat64) {
	if v != nil && v.Valid && v.Float64 != 0 {
		enc.Float64OmitEmpty(v.Float64)
	}
}

// AddSQLNullFloat64NullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullFloat64NullEmpty(v *sql.NullFloat64) {
	if v != nil && v.Valid {
		enc.Float64NullEmpty(v.Float64)
	}
}

// AddSQLNullFloat64Key adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullFloat64Key(key string, v *sql.NullFloat64) {
	enc.Float64Key(key, v.Float64)
}

// AddSQLNullFloat64KeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullFloat64KeyOmitEmpty(key string, v *sql.NullFloat64) {
	if v != nil && v.Valid && v.Float64 != 0 {
		enc.Float64KeyOmitEmpty(key, v.Float64)
	}
}

// AddSQLNullFloat64KeyNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullFloat64KeyNullEmpty(key string, v *sql.NullFloat64) {
	if v != nil && v.Valid {
		enc.Float64KeyNullEmpty(key, v.Float64)
	}
}

// SQLNullFloat64 adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullFloat64(v *sql.NullFloat64) {
	enc.Float64(v.Float64)
}

// SQLNullFloat64OmitEmpty adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullFloat64OmitEmpty(v *sql.NullFloat64) {
	if v != nil && v.Valid && v.Float64 != 0 {
		enc.Float64(v.Float64)
	}
}

// SQLNullFloat64NullEmpty adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullFloat64NullEmpty(v *sql.NullFloat64) {
	if v != nil && v.Valid {
		enc.Float64NullEmpty(v.Float64)
	}
}

// SQLNullFloat64Key adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullFloat64Key(key string, v *sql.NullFloat64) {
	enc.Float64Key(key, v.Float64)
}

// SQLNullFloat64KeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullFloat64KeyOmitEmpty(key string, v *sql.NullFloat64) {
	if v != nil && v.Valid && v.Float64 != 0 {
		enc.Float64KeyOmitEmpty(key, v.Float64)
	}
}

// SQLNullFloat64KeyNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullFloat64KeyNullEmpty(key string, v *sql.NullFloat64) {
	if v != nil && v.Valid {
		enc.Float64KeyNullEmpty(key, v.Float64)
	}
}

// NullBool

// EncodeSQLNullBool encodes a string to
func (enc *Encoder) EncodeSQLNullBool(v *sql.NullBool) error {
	if enc.isPooled == 1 {
		panic(InvalidUsagePooledEncoderError("Invalid usage of pooled encoder"))
	}
	_, _ = enc.encodeBool(v.Bool)
	_, err := enc.Write()
	if err != nil {
		enc.err = err
		return err
	}
	return nil
}

// AddSQLNullBool adds a string to be encoded, must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullBool(v *sql.NullBool) {
	enc.Bool(v.Bool)
}

// AddSQLNullBoolOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside a slice or array encoding (does not encode a key)
func (enc *Encoder) AddSQLNullBoolOmitEmpty(v *sql.NullBool) {
	if v != nil && v.Valid && v.Bool != false {
		enc.BoolOmitEmpty(v.Bool)
	}
}

// AddSQLNullBoolKey adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullBoolKey(key string, v *sql.NullBool) {
	enc.BoolKey(key, v.Bool)
}

// AddSQLNullBoolKeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullBoolKeyOmitEmpty(key string, v *sql.NullBool) {
	if v != nil && v.Valid && v.Bool != false {
		enc.BoolKeyOmitEmpty(key, v.Bool)
	}
}

// AddSQLNullBoolKeyNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) AddSQLNullBoolKeyNullEmpty(key string, v *sql.NullBool) {
	if v != nil && v.Valid {
		enc.BoolKeyNullEmpty(key, v.Bool)
	}
}

// SQLNullBool adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullBool(v *sql.NullBool) {
	enc.Bool(v.Bool)
}

// SQLNullBoolOmitEmpty adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullBoolOmitEmpty(v *sql.NullBool) {
	if v != nil && v.Valid && v.Bool != false {
		enc.Bool(v.Bool)
	}
}

// SQLNullBoolNullEmpty adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullBoolNullEmpty(v *sql.NullBool) {
	if v != nil && v.Valid {
		enc.BoolNullEmpty(v.Bool)
	}
}

// SQLNullBoolKey adds a string to be encoded, must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullBoolKey(key string, v *sql.NullBool) {
	enc.BoolKey(key, v.Bool)
}

// SQLNullBoolKeyOmitEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullBoolKeyOmitEmpty(key string, v *sql.NullBool) {
	if v != nil && v.Valid && v.Bool != false {
		enc.BoolKeyOmitEmpty(key, v.Bool)
	}
}

// SQLNullBoolKeyNullEmpty adds a string to be encoded or skips it if it is zero value.
// Must be used inside an object as it will encode a key
func (enc *Encoder) SQLNullBoolKeyNullEmpty(key string, v *sql.NullBool) {
	if v != nil && v.Valid {
		enc.BoolKeyNullEmpty(key, v.Bool)
	}
}
