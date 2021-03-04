package pgproto3

import (
	"bytes"
	"encoding/binary"
	"strconv"
)

type ErrorResponse struct {
	Severity         string
	Code             string
	Message          string
	Detail           string
	Hint             string
	Position         int32
	InternalPosition int32
	InternalQuery    string
	Where            string
	SchemaName       string
	TableName        string
	ColumnName       string
	DataTypeName     string
	ConstraintName   string
	File             string
	Line             int32
	Routine          string

	UnknownFields map[byte]string
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*ErrorResponse) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *ErrorResponse) Decode(src []byte) error {
	*dst = ErrorResponse{}

	buf := bytes.NewBuffer(src)

	for {
		k, err := buf.ReadByte()
		if err != nil {
			return err
		}
		if k == 0 {
			break
		}

		vb, err := buf.ReadBytes(0)
		if err != nil {
			return err
		}
		v := string(vb[:len(vb)-1])

		switch k {
		case 'S':
			dst.Severity = v
		case 'C':
			dst.Code = v
		case 'M':
			dst.Message = v
		case 'D':
			dst.Detail = v
		case 'H':
			dst.Hint = v
		case 'P':
			s := v
			n, _ := strconv.ParseInt(s, 10, 32)
			dst.Position = int32(n)
		case 'p':
			s := v
			n, _ := strconv.ParseInt(s, 10, 32)
			dst.InternalPosition = int32(n)
		case 'q':
			dst.InternalQuery = v
		case 'W':
			dst.Where = v
		case 's':
			dst.SchemaName = v
		case 't':
			dst.TableName = v
		case 'c':
			dst.ColumnName = v
		case 'd':
			dst.DataTypeName = v
		case 'n':
			dst.ConstraintName = v
		case 'F':
			dst.File = v
		case 'L':
			s := v
			n, _ := strconv.ParseInt(s, 10, 32)
			dst.Line = int32(n)
		case 'R':
			dst.Routine = v

		default:
			if dst.UnknownFields == nil {
				dst.UnknownFields = make(map[byte]string)
			}
			dst.UnknownFields[k] = v
		}
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *ErrorResponse) Encode(dst []byte) []byte {
	return append(dst, src.marshalBinary('E')...)
}

func (src *ErrorResponse) marshalBinary(typeByte byte) []byte {
	var bigEndian BigEndianBuf
	buf := &bytes.Buffer{}

	buf.WriteByte(typeByte)
	buf.Write(bigEndian.Uint32(0))

	if src.Severity != "" {
		buf.WriteByte('S')
		buf.WriteString(src.Severity)
		buf.WriteByte(0)
	}
	if src.Code != "" {
		buf.WriteByte('C')
		buf.WriteString(src.Code)
		buf.WriteByte(0)
	}
	if src.Message != "" {
		buf.WriteByte('M')
		buf.WriteString(src.Message)
		buf.WriteByte(0)
	}
	if src.Detail != "" {
		buf.WriteByte('D')
		buf.WriteString(src.Detail)
		buf.WriteByte(0)
	}
	if src.Hint != "" {
		buf.WriteByte('H')
		buf.WriteString(src.Hint)
		buf.WriteByte(0)
	}
	if src.Position != 0 {
		buf.WriteByte('P')
		buf.WriteString(strconv.Itoa(int(src.Position)))
		buf.WriteByte(0)
	}
	if src.InternalPosition != 0 {
		buf.WriteByte('p')
		buf.WriteString(strconv.Itoa(int(src.InternalPosition)))
		buf.WriteByte(0)
	}
	if src.InternalQuery != "" {
		buf.WriteByte('q')
		buf.WriteString(src.InternalQuery)
		buf.WriteByte(0)
	}
	if src.Where != "" {
		buf.WriteByte('W')
		buf.WriteString(src.Where)
		buf.WriteByte(0)
	}
	if src.SchemaName != "" {
		buf.WriteByte('s')
		buf.WriteString(src.SchemaName)
		buf.WriteByte(0)
	}
	if src.TableName != "" {
		buf.WriteByte('t')
		buf.WriteString(src.TableName)
		buf.WriteByte(0)
	}
	if src.ColumnName != "" {
		buf.WriteByte('c')
		buf.WriteString(src.ColumnName)
		buf.WriteByte(0)
	}
	if src.DataTypeName != "" {
		buf.WriteByte('d')
		buf.WriteString(src.DataTypeName)
		buf.WriteByte(0)
	}
	if src.ConstraintName != "" {
		buf.WriteByte('n')
		buf.WriteString(src.ConstraintName)
		buf.WriteByte(0)
	}
	if src.File != "" {
		buf.WriteByte('F')
		buf.WriteString(src.File)
		buf.WriteByte(0)
	}
	if src.Line != 0 {
		buf.WriteByte('L')
		buf.WriteString(strconv.Itoa(int(src.Line)))
		buf.WriteByte(0)
	}
	if src.Routine != "" {
		buf.WriteByte('R')
		buf.WriteString(src.Routine)
		buf.WriteByte(0)
	}

	for k, v := range src.UnknownFields {
		buf.WriteByte(k)
		buf.WriteByte(0)
		buf.WriteString(v)
		buf.WriteByte(0)
	}
	buf.WriteByte(0)

	binary.BigEndian.PutUint32(buf.Bytes()[1:5], uint32(buf.Len()-1))

	return buf.Bytes()
}
