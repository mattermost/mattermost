package psd

import (
	"io"
	"io/ioutil"
	"math"
	"unicode/utf16"
)

func itoa(x int) string {
	var b [32]byte
	var minus bool
	if x < 0 {
		minus = true
		x = -x
	}
	i := len(b) - 1
	for x > 9 {
		b[i] = byte(x%10 + '0')
		x /= 10
		i--
	}
	b[i] = byte(x + '0')
	if minus {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

func readUint16(b []byte, offset int) uint16 {
	return uint16(b[offset])<<8 | uint16(b[offset+1])
}

func writeUint16(b []byte, v uint16, offset int) {
	b[offset] = uint8(v >> 8)
	b[offset+1] = uint8(v)
}

func readUint32(b []byte, offset int) uint32 {
	return uint32(b[offset])<<24 | uint32(b[offset+1])<<16 | uint32(b[offset+2])<<8 | uint32(b[offset+3])
}

func readUint64(b []byte, offset int) uint64 {
	return uint64(b[offset])<<56 | uint64(b[offset+1])<<48 | uint64(b[offset+2])<<40 | uint64(b[offset+3])<<32 |
		uint64(b[offset+4])<<24 | uint64(b[offset+5])<<16 | uint64(b[offset+6])<<8 | uint64(b[offset+7])
}

func get4or8(is64 bool) int {
	if is64 {
		return 8
	}
	return 4
}

func readUint(b []byte, offset int, size int) uint64 {
	switch size {
	case 8:
		return readUint64(b, offset)
	case 4:
		return uint64(readUint32(b, offset))
	case 2:
		return uint64(readUint16(b, offset))
	case 1:
		return uint64(b[offset])
	}
	panic("psd: unexpected size")
}

func readFloat32(b []byte, offset int) float32 {
	return math.Float32frombits(readUint32(b, offset))
}

func readFloat64(b []byte, offset int) float64 {
	return math.Float64frombits(readUint64(b, offset))
}

func writeUint32(b []byte, v uint32, offset int) {
	b[offset] = uint8(v >> 24)
	b[offset+1] = uint8(v >> 16)
	b[offset+2] = uint8(v >> 8)
	b[offset+3] = uint8(v)
}

func readUnicodeString(b []byte) string {
	ln := readUint32(b, 0)
	if ln == 0 {
		return ""
	}
	buf := make([]uint16, ln)
	for i := range buf {
		buf[i] = readUint16(b, 4+i<<1)
	}
	return string(utf16.Decode(buf))
}

func adjustAlign2(r io.Reader, l int) (read int, err error) {
	if l&1 != 0 {
		var b [1]byte
		return r.Read(b[:])
	}
	return 0, nil
}

func adjustAlign4(r io.Reader, l int) (read int, err error) {
	if gap := l & 3; gap > 0 {
		var b [4]byte
		return r.Read(b[:4-gap])
	}
	return 0, nil
}

func discard(r io.Reader, skip int) (read int, err error) {
	type discarder interface {
		Discard(n int) (discarded int, err error)
	}
	switch rr := r.(type) {
	case discarder:
		return rr.Discard(skip)
	case io.Seeker:
		if _, err = rr.Seek(int64(skip), 1); err != nil {
			return 0, err
		}
		return skip, nil
	default:
		rd, err := io.CopyN(ioutil.Discard, r, int64(skip))
		return int(rd), err
	}
}

func readPascalString(r io.Reader) (str string, read int, err error) {
	b := make([]byte, 1)
	if _, err := io.ReadFull(r, b); err != nil {
		return "", 0, err
	}
	if b[0] == 0 {
		return "", 1, nil
	}
	buf := make([]byte, b[0])
	if _, err := io.ReadFull(r, buf); err != nil {
		return "", 1, err
	}
	return string(buf), len(buf) + 1, nil
}

func reportReaderPosition(format string, r io.Reader) error {
	sk, ok := r.(io.Seeker)
	if !ok {
		return nil
	}

	pos, err := sk.Seek(0, 1)
	if err != nil {
		return err
	}
	Debug.Printf(format, pos)
	return nil
}
