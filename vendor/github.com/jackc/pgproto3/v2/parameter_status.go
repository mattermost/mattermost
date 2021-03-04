package pgproto3

import (
	"bytes"
	"encoding/json"

	"github.com/jackc/pgio"
)

type ParameterStatus struct {
	Name  string
	Value string
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*ParameterStatus) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *ParameterStatus) Decode(src []byte) error {
	buf := bytes.NewBuffer(src)

	b, err := buf.ReadBytes(0)
	if err != nil {
		return err
	}
	name := string(b[:len(b)-1])

	b, err = buf.ReadBytes(0)
	if err != nil {
		return err
	}
	value := string(b[:len(b)-1])

	*dst = ParameterStatus{Name: name, Value: value}
	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *ParameterStatus) Encode(dst []byte) []byte {
	dst = append(dst, 'S')
	sp := len(dst)
	dst = pgio.AppendInt32(dst, -1)

	dst = append(dst, src.Name...)
	dst = append(dst, 0)
	dst = append(dst, src.Value...)
	dst = append(dst, 0)

	pgio.SetInt32(dst[sp:], int32(len(dst[sp:])))

	return dst
}

// MarshalJSON implements encoding/json.Marshaler.
func (ps ParameterStatus) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type  string
		Name  string
		Value string
	}{
		Type:  "ParameterStatus",
		Name:  ps.Name,
		Value: ps.Value,
	})
}
