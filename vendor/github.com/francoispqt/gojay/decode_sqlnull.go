package gojay

import "database/sql"

// DecodeSQLNullString decodes a sql.NullString
func (dec *Decoder) DecodeSQLNullString(v *sql.NullString) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeSQLNullString(v)
}

func (dec *Decoder) decodeSQLNullString(v *sql.NullString) error {
	var str string
	if err := dec.decodeString(&str); err != nil {
		return err
	}
	v.String = str
	v.Valid = true
	return nil
}

// DecodeSQLNullInt64 decodes a sql.NullInt64
func (dec *Decoder) DecodeSQLNullInt64(v *sql.NullInt64) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeSQLNullInt64(v)
}

func (dec *Decoder) decodeSQLNullInt64(v *sql.NullInt64) error {
	var i int64
	if err := dec.decodeInt64(&i); err != nil {
		return err
	}
	v.Int64 = i
	v.Valid = true
	return nil
}

// DecodeSQLNullFloat64 decodes a sql.NullString with the given format
func (dec *Decoder) DecodeSQLNullFloat64(v *sql.NullFloat64) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeSQLNullFloat64(v)
}

func (dec *Decoder) decodeSQLNullFloat64(v *sql.NullFloat64) error {
	var i float64
	if err := dec.decodeFloat64(&i); err != nil {
		return err
	}
	v.Float64 = i
	v.Valid = true
	return nil
}

// DecodeSQLNullBool decodes a sql.NullString with the given format
func (dec *Decoder) DecodeSQLNullBool(v *sql.NullBool) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	return dec.decodeSQLNullBool(v)
}

func (dec *Decoder) decodeSQLNullBool(v *sql.NullBool) error {
	var b bool
	if err := dec.decodeBool(&b); err != nil {
		return err
	}
	v.Bool = b
	v.Valid = true
	return nil
}

// Add Values functions

// AddSQLNullString decodes the JSON value within an object or an array to qn *sql.NullString
func (dec *Decoder) AddSQLNullString(v *sql.NullString) error {
	return dec.SQLNullString(v)
}

// SQLNullString decodes the JSON value within an object or an array to an *sql.NullString
func (dec *Decoder) SQLNullString(v *sql.NullString) error {
	var b *string
	if err := dec.StringNull(&b); err != nil {
		return err
	}
	if b == nil {
		v.Valid = false
	} else {
		v.String = *b
		v.Valid = true
	}
	return nil
}

// AddSQLNullInt64 decodes the JSON value within an object or an array to qn *sql.NullInt64
func (dec *Decoder) AddSQLNullInt64(v *sql.NullInt64) error {
	return dec.SQLNullInt64(v)
}

// SQLNullInt64 decodes the JSON value within an object or an array to an *sql.NullInt64
func (dec *Decoder) SQLNullInt64(v *sql.NullInt64) error {
	var b *int64
	if err := dec.Int64Null(&b); err != nil {
		return err
	}
	if b == nil {
		v.Valid = false
	} else {
		v.Int64 = *b
		v.Valid = true
	}
	return nil
}

// AddSQLNullFloat64 decodes the JSON value within an object or an array to qn *sql.NullFloat64
func (dec *Decoder) AddSQLNullFloat64(v *sql.NullFloat64) error {
	return dec.SQLNullFloat64(v)
}

// SQLNullFloat64 decodes the JSON value within an object or an array to an *sql.NullFloat64
func (dec *Decoder) SQLNullFloat64(v *sql.NullFloat64) error {
	var b *float64
	if err := dec.Float64Null(&b); err != nil {
		return err
	}
	if b == nil {
		v.Valid = false
	} else {
		v.Float64 = *b
		v.Valid = true
	}
	return nil
}

// AddSQLNullBool decodes the JSON value within an object or an array to an *sql.NullBool
func (dec *Decoder) AddSQLNullBool(v *sql.NullBool) error {
	return dec.SQLNullBool(v)
}

// SQLNullBool decodes the JSON value within an object or an array to an *sql.NullBool
func (dec *Decoder) SQLNullBool(v *sql.NullBool) error {
	var b *bool
	if err := dec.BoolNull(&b); err != nil {
		return err
	}
	if b == nil {
		v.Valid = false
	} else {
		v.Bool = *b
		v.Valid = true
	}
	return nil
}
