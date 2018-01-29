package tests

import (
	"math"
	"reflect"
	"testing"

	"encoding/json"

	"github.com/mailru/easyjson/opt"
)

// This struct type must NOT have a generated marshaler
type OptsVanilla struct {
	Int  opt.Int
	Uint opt.Uint

	Int8  opt.Int8
	Int16 opt.Int16
	Int32 opt.Int32
	Int64 opt.Int64

	Uint8  opt.Uint8
	Uint16 opt.Uint16
	Uint32 opt.Uint32
	Uint64 opt.Uint64

	Float32 opt.Float32
	Float64 opt.Float64

	Bool   opt.Bool
	String opt.String
}

var optsVanillaValue = OptsVanilla{
	Int:  opt.OInt(-123),
	Uint: opt.OUint(123),

	Int8:  opt.OInt8(math.MaxInt8),
	Int16: opt.OInt16(math.MaxInt16),
	Int32: opt.OInt32(math.MaxInt32),
	Int64: opt.OInt64(math.MaxInt64),

	Uint8:  opt.OUint8(math.MaxUint8),
	Uint16: opt.OUint16(math.MaxUint16),
	Uint32: opt.OUint32(math.MaxUint32),
	Uint64: opt.OUint64(math.MaxUint64),

	Float32: opt.OFloat32(math.MaxFloat32),
	Float64: opt.OFloat64(math.MaxFloat64),

	Bool:   opt.OBool(true),
	String: opt.OString("foo"),
}

func TestOptsVanilla(t *testing.T) {
	data, err := json.Marshal(optsVanillaValue)
	if err != nil {
		t.Errorf("Failed to marshal vanilla opts: %v", err)
	}

	var ov OptsVanilla
	if err := json.Unmarshal(data, &ov); err != nil {
		t.Errorf("Failed to unmarshal vanilla opts: %v", err)
	}

	if !reflect.DeepEqual(optsVanillaValue, ov) {
		t.Errorf("Vanilla opts unmarshal returned invalid value %+v, want %+v", ov, optsVanillaValue)
	}
}
