package tiff

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math/big"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Format specifies the Go type equivalent used to represent the basic
// tiff data types.
type Format int

const (
	IntVal Format = iota
	FloatVal
	RatVal
	StringVal
	UndefVal
	OtherVal
)

var ErrShortReadTagValue = errors.New("tiff: short read of tag value")

var formatNames = map[Format]string{
	IntVal:    "int",
	FloatVal:  "float",
	RatVal:    "rational",
	StringVal: "string",
	UndefVal:  "undefined",
	OtherVal:  "other",
}

// DataType represents the basic tiff tag data types.
type DataType uint16

const (
	DTByte      DataType = 1
	DTAscii     DataType = 2
	DTShort     DataType = 3
	DTLong      DataType = 4
	DTRational  DataType = 5
	DTSByte     DataType = 6
	DTUndefined DataType = 7
	DTSShort    DataType = 8
	DTSLong     DataType = 9
	DTSRational DataType = 10
	DTFloat     DataType = 11
	DTDouble    DataType = 12
)

var typeNames = map[DataType]string{
	DTByte:      "byte",
	DTAscii:     "ascii",
	DTShort:     "short",
	DTLong:      "long",
	DTRational:  "rational",
	DTSByte:     "signed byte",
	DTUndefined: "undefined",
	DTSShort:    "signed short",
	DTSLong:     "signed long",
	DTSRational: "signed rational",
	DTFloat:     "float",
	DTDouble:    "double",
}

// typeSize specifies the size in bytes of each type.
var typeSize = map[DataType]uint32{
	DTByte:      1,
	DTAscii:     1,
	DTShort:     2,
	DTLong:      4,
	DTRational:  8,
	DTSByte:     1,
	DTUndefined: 1,
	DTSShort:    2,
	DTSLong:     4,
	DTSRational: 8,
	DTFloat:     4,
	DTDouble:    8,
}

// Tag reflects the parsed content of a tiff IFD tag.
type Tag struct {
	// Id is the 2-byte tiff tag identifier.
	Id uint16
	// Type is an integer (1 through 12) indicating the tag value's data type.
	Type DataType
	// Count is the number of type Type stored in the tag's value (i.e. the
	// tag's value is an array of type Type and length Count).
	Count uint32
	// Val holds the bytes that represent the tag's value.
	Val []byte
	// ValOffset holds byte offset of the tag value w.r.t. the beginning of the
	// reader it was decoded from. Zero if the tag value fit inside the offset
	// field.
	ValOffset uint32

	order     binary.ByteOrder
	intVals   []int64
	floatVals []float64
	ratVals   [][]int64
	strVal    string
	format    Format
}

// DecodeTag parses a tiff-encoded IFD tag from r and returns a Tag object. The
// first read from r should be the first byte of the tag. ReadAt offsets should
// generally be relative to the beginning of the tiff structure (not relative
// to the beginning of the tag).
func DecodeTag(r ReadAtReader, order binary.ByteOrder) (*Tag, error) {
	t := new(Tag)
	t.order = order

	err := binary.Read(r, order, &t.Id)
	if err != nil {
		return nil, errors.New("tiff: tag id read failed: " + err.Error())
	}

	err = binary.Read(r, order, &t.Type)
	if err != nil {
		return nil, errors.New("tiff: tag type read failed: " + err.Error())
	}

	err = binary.Read(r, order, &t.Count)
	if err != nil {
		return nil, errors.New("tiff: tag component count read failed: " + err.Error())
	}

	// There seems to be a relatively common corrupt tag which has a Count of
	// MaxUint32. This is probably not a valid value, so return early.
	if t.Count == 1<<32-1 {
		return t, errors.New("invalid Count offset in tag")
	}

	valLen := typeSize[t.Type] * t.Count
	if valLen == 0 {
		return t, errors.New("zero length tag value")
	}

	if valLen > 4 {
		binary.Read(r, order, &t.ValOffset)

		// Use a bytes.Buffer so we don't allocate a huge slice if the tag
		// is corrupt.
		var buff bytes.Buffer
		sr := io.NewSectionReader(r, int64(t.ValOffset), int64(valLen))
		n, err := io.Copy(&buff, sr)
		if err != nil {
			return t, errors.New("tiff: tag value read failed: " + err.Error())
		} else if n != int64(valLen) {
			return t, ErrShortReadTagValue
		}
		t.Val = buff.Bytes()

	} else {
		val := make([]byte, valLen)
		if _, err = io.ReadFull(r, val); err != nil {
			return t, errors.New("tiff: tag offset read failed: " + err.Error())
		}
		// ignore padding.
		if _, err = io.ReadFull(r, make([]byte, 4-valLen)); err != nil {
			return t, errors.New("tiff: tag offset read failed: " + err.Error())
		}

		t.Val = val
	}

	return t, t.convertVals()
}

func (t *Tag) convertVals() error {
	r := bytes.NewReader(t.Val)

	switch t.Type {
	case DTAscii:
		if len(t.Val) <= 0 {
			break
		}
		nullPos := bytes.IndexByte(t.Val, 0)
		if nullPos == -1 {
			t.strVal = string(t.Val)
		} else {
			// ignore all trailing NULL bytes, in case of a broken t.Count
			t.strVal = string(t.Val[:nullPos])
		}
	case DTByte:
		var v uint8
		t.intVals = make([]int64, int(t.Count))
		for i := range t.intVals {
			err := binary.Read(r, t.order, &v)
			if err != nil {
				return err
			}
			t.intVals[i] = int64(v)
		}
	case DTShort:
		var v uint16
		t.intVals = make([]int64, int(t.Count))
		for i := range t.intVals {
			err := binary.Read(r, t.order, &v)
			if err != nil {
				return err
			}
			t.intVals[i] = int64(v)
		}
	case DTLong:
		var v uint32
		t.intVals = make([]int64, int(t.Count))
		for i := range t.intVals {
			err := binary.Read(r, t.order, &v)
			if err != nil {
				return err
			}
			t.intVals[i] = int64(v)
		}
	case DTSByte:
		var v int8
		t.intVals = make([]int64, int(t.Count))
		for i := range t.intVals {
			err := binary.Read(r, t.order, &v)
			if err != nil {
				return err
			}
			t.intVals[i] = int64(v)
		}
	case DTSShort:
		var v int16
		t.intVals = make([]int64, int(t.Count))
		for i := range t.intVals {
			err := binary.Read(r, t.order, &v)
			if err != nil {
				return err
			}
			t.intVals[i] = int64(v)
		}
	case DTSLong:
		var v int32
		t.intVals = make([]int64, int(t.Count))
		for i := range t.intVals {
			err := binary.Read(r, t.order, &v)
			if err != nil {
				return err
			}
			t.intVals[i] = int64(v)
		}
	case DTRational:
		t.ratVals = make([][]int64, int(t.Count))
		for i := range t.ratVals {
			var n, d uint32
			err := binary.Read(r, t.order, &n)
			if err != nil {
				return err
			}
			err = binary.Read(r, t.order, &d)
			if err != nil {
				return err
			}
			t.ratVals[i] = []int64{int64(n), int64(d)}
		}
	case DTSRational:
		t.ratVals = make([][]int64, int(t.Count))
		for i := range t.ratVals {
			var n, d int32
			err := binary.Read(r, t.order, &n)
			if err != nil {
				return err
			}
			err = binary.Read(r, t.order, &d)
			if err != nil {
				return err
			}
			t.ratVals[i] = []int64{int64(n), int64(d)}
		}
	case DTFloat: // float32
		t.floatVals = make([]float64, int(t.Count))
		for i := range t.floatVals {
			var v float32
			err := binary.Read(r, t.order, &v)
			if err != nil {
				return err
			}
			t.floatVals[i] = float64(v)
		}
	case DTDouble:
		t.floatVals = make([]float64, int(t.Count))
		for i := range t.floatVals {
			var u float64
			err := binary.Read(r, t.order, &u)
			if err != nil {
				return err
			}
			t.floatVals[i] = u
		}
	}

	switch t.Type {
	case DTByte, DTShort, DTLong, DTSByte, DTSShort, DTSLong:
		t.format = IntVal
	case DTRational, DTSRational:
		t.format = RatVal
	case DTFloat, DTDouble:
		t.format = FloatVal
	case DTAscii:
		t.format = StringVal
	case DTUndefined:
		t.format = UndefVal
	default:
		t.format = OtherVal
	}

	return nil
}

// Format returns a value indicating which method can be called to retrieve the
// tag's value properly typed (e.g. integer, rational, etc.).
func (t *Tag) Format() Format { return t.format }

func (t *Tag) typeErr(to Format) error {
	return &wrongFmtErr{typeNames[t.Type], formatNames[to]}
}

// Rat returns the tag's i'th value as a rational number. It returns a nil and
// an error if this tag's Format is not RatVal.  It panics for zero deminators
// or if i is out of range.
func (t *Tag) Rat(i int) (*big.Rat, error) {
	n, d, err := t.Rat2(i)
	if err != nil {
		return nil, err
	}
	return big.NewRat(n, d), nil
}

// Rat2 returns the tag's i'th value as a rational number represented by a
// numerator-denominator pair. It returns an error if the tag's Format is not
// RatVal. It panics if i is out of range.
func (t *Tag) Rat2(i int) (num, den int64, err error) {
	if t.format != RatVal {
		return 0, 0, t.typeErr(RatVal)
	}
	return t.ratVals[i][0], t.ratVals[i][1], nil
}

// Int64 returns the tag's i'th value as an integer. It returns an error if the
// tag's Format is not IntVal. It panics if i is out of range.
func (t *Tag) Int64(i int) (int64, error) {
	if t.format != IntVal {
		return 0, t.typeErr(IntVal)
	}
	return t.intVals[i], nil
}

// Int returns the tag's i'th value as an integer. It returns an error if the
// tag's Format is not IntVal. It panics if i is out of range.
func (t *Tag) Int(i int) (int, error) {
	if t.format != IntVal {
		return 0, t.typeErr(IntVal)
	}
	return int(t.intVals[i]), nil
}

// Float returns the tag's i'th value as a float. It returns an error if the
// tag's Format is not IntVal.  It panics if i is out of range.
func (t *Tag) Float(i int) (float64, error) {
	if t.format != FloatVal {
		return 0, t.typeErr(FloatVal)
	}
	return t.floatVals[i], nil
}

// StringVal returns the tag's value as a string. It returns an error if the
// tag's Format is not StringVal. It panics if i is out of range.
func (t *Tag) StringVal() (string, error) {
	if t.format != StringVal {
		return "", t.typeErr(StringVal)
	}
	return t.strVal, nil
}

// String returns a nicely formatted version of the tag.
func (t *Tag) String() string {
	data, err := t.MarshalJSON()
	if err != nil {
		return "ERROR: " + err.Error()
	}

	if t.Count == 1 {
		return strings.Trim(fmt.Sprintf("%s", data), "[]")
	}
	return fmt.Sprintf("%s", data)
}

func (t *Tag) MarshalJSON() ([]byte, error) {
	switch t.format {
	case StringVal, UndefVal:
		return nullString(t.Val), nil
	case OtherVal:
		return []byte(fmt.Sprintf("unknown tag type '%v'", t.Type)), nil
	}

	rv := []string{}
	for i := 0; i < int(t.Count); i++ {
		switch t.format {
		case RatVal:
			n, d, _ := t.Rat2(i)
			rv = append(rv, fmt.Sprintf(`"%v/%v"`, n, d))
		case FloatVal:
			v, _ := t.Float(i)
			rv = append(rv, fmt.Sprintf("%v", v))
		case IntVal:
			v, _ := t.Int(i)
			rv = append(rv, fmt.Sprintf("%v", v))
		}
	}
	return []byte(fmt.Sprintf(`[%s]`, strings.Join(rv, ","))), nil
}

func nullString(in []byte) []byte {
	rv := bytes.Buffer{}
	rv.WriteByte('"')
	for _, b := range in {
		if unicode.IsPrint(rune(b)) {
			rv.WriteByte(b)
		}
	}
	rv.WriteByte('"')
	rvb := rv.Bytes()
	if utf8.Valid(rvb) {
		return rvb
	}
	return []byte(`""`)
}

type wrongFmtErr struct {
	From, To string
}

func (e *wrongFmtErr) Error() string {
	return fmt.Sprintf("cannot convert tag type '%v' into '%v'", e.From, e.To)
}
