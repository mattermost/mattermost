package proto

import (
	"bufio"
	"fmt"
	"io"
	"strconv"

	"github.com/go-redis/redis/internal"
)

const bytesAllocLimit = 1024 * 1024 // 1mb

const (
	ErrorReply  = '-'
	StatusReply = '+'
	IntReply    = ':'
	StringReply = '$'
	ArrayReply  = '*'
)

type MultiBulkParse func(*Reader, int64) (interface{}, error)

type Reader struct {
	src *bufio.Reader
	buf []byte
}

func NewReader(rd io.Reader) *Reader {
	return &Reader{
		src: bufio.NewReader(rd),
		buf: make([]byte, 4096),
	}
}

func (r *Reader) Reset(rd io.Reader) {
	r.src.Reset(rd)
}

func (r *Reader) PeekBuffered() []byte {
	if n := r.src.Buffered(); n != 0 {
		b, _ := r.src.Peek(n)
		return b
	}
	return nil
}

func (r *Reader) ReadN(n int) ([]byte, error) {
	b, err := readN(r.src, r.buf, n)
	if err != nil {
		return nil, err
	}
	r.buf = b
	return b, nil
}

func (r *Reader) ReadLine() ([]byte, error) {
	line, isPrefix, err := r.src.ReadLine()
	if err != nil {
		return nil, err
	}
	if isPrefix {
		return nil, bufio.ErrBufferFull
	}
	if len(line) == 0 {
		return nil, fmt.Errorf("redis: reply is empty")
	}
	if isNilReply(line) {
		return nil, internal.Nil
	}
	return line, nil
}

func (r *Reader) ReadReply(m MultiBulkParse) (interface{}, error) {
	line, err := r.ReadLine()
	if err != nil {
		return nil, err
	}

	switch line[0] {
	case ErrorReply:
		return nil, ParseErrorReply(line)
	case StatusReply:
		return parseStatusValue(line), nil
	case IntReply:
		return parseInt(line[1:], 10, 64)
	case StringReply:
		return r.readTmpBytesValue(line)
	case ArrayReply:
		n, err := parseArrayLen(line)
		if err != nil {
			return nil, err
		}
		return m(r, n)
	}
	return nil, fmt.Errorf("redis: can't parse %.100q", line)
}

func (r *Reader) ReadIntReply() (int64, error) {
	line, err := r.ReadLine()
	if err != nil {
		return 0, err
	}
	switch line[0] {
	case ErrorReply:
		return 0, ParseErrorReply(line)
	case IntReply:
		return parseInt(line[1:], 10, 64)
	default:
		return 0, fmt.Errorf("redis: can't parse int reply: %.100q", line)
	}
}

func (r *Reader) ReadTmpBytesReply() ([]byte, error) {
	line, err := r.ReadLine()
	if err != nil {
		return nil, err
	}
	switch line[0] {
	case ErrorReply:
		return nil, ParseErrorReply(line)
	case StringReply:
		return r.readTmpBytesValue(line)
	case StatusReply:
		return parseStatusValue(line), nil
	default:
		return nil, fmt.Errorf("redis: can't parse string reply: %.100q", line)
	}
}

func (r *Reader) ReadBytesReply() ([]byte, error) {
	b, err := r.ReadTmpBytesReply()
	if err != nil {
		return nil, err
	}
	cp := make([]byte, len(b))
	copy(cp, b)
	return cp, nil
}

func (r *Reader) ReadStringReply() (string, error) {
	b, err := r.ReadTmpBytesReply()
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (r *Reader) ReadFloatReply() (float64, error) {
	b, err := r.ReadTmpBytesReply()
	if err != nil {
		return 0, err
	}
	return parseFloat(b, 64)
}

func (r *Reader) ReadArrayReply(m MultiBulkParse) (interface{}, error) {
	line, err := r.ReadLine()
	if err != nil {
		return nil, err
	}
	switch line[0] {
	case ErrorReply:
		return nil, ParseErrorReply(line)
	case ArrayReply:
		n, err := parseArrayLen(line)
		if err != nil {
			return nil, err
		}
		return m(r, n)
	default:
		return nil, fmt.Errorf("redis: can't parse array reply: %.100q", line)
	}
}

func (r *Reader) ReadArrayLen() (int64, error) {
	line, err := r.ReadLine()
	if err != nil {
		return 0, err
	}
	switch line[0] {
	case ErrorReply:
		return 0, ParseErrorReply(line)
	case ArrayReply:
		return parseArrayLen(line)
	default:
		return 0, fmt.Errorf("redis: can't parse array reply: %.100q", line)
	}
}

func (r *Reader) ReadScanReply() ([]string, uint64, error) {
	n, err := r.ReadArrayLen()
	if err != nil {
		return nil, 0, err
	}
	if n != 2 {
		return nil, 0, fmt.Errorf("redis: got %d elements in scan reply, expected 2", n)
	}

	cursor, err := r.ReadUint()
	if err != nil {
		return nil, 0, err
	}

	n, err = r.ReadArrayLen()
	if err != nil {
		return nil, 0, err
	}

	keys := make([]string, n)
	for i := int64(0); i < n; i++ {
		key, err := r.ReadStringReply()
		if err != nil {
			return nil, 0, err
		}
		keys[i] = key
	}

	return keys, cursor, err
}

func (r *Reader) readTmpBytesValue(line []byte) ([]byte, error) {
	if isNilReply(line) {
		return nil, internal.Nil
	}

	replyLen, err := strconv.Atoi(string(line[1:]))
	if err != nil {
		return nil, err
	}

	b, err := r.ReadN(replyLen + 2)
	if err != nil {
		return nil, err
	}
	return b[:replyLen], nil
}

func (r *Reader) ReadInt() (int64, error) {
	b, err := r.ReadTmpBytesReply()
	if err != nil {
		return 0, err
	}
	return parseInt(b, 10, 64)
}

func (r *Reader) ReadUint() (uint64, error) {
	b, err := r.ReadTmpBytesReply()
	if err != nil {
		return 0, err
	}
	return parseUint(b, 10, 64)
}

// --------------------------------------------------------------------

func readN(r io.Reader, b []byte, n int) ([]byte, error) {
	if n == 0 && b == nil {
		return make([]byte, 0), nil
	}

	if cap(b) >= n {
		b = b[:n]
		_, err := io.ReadFull(r, b)
		return b, err
	}
	b = b[:cap(b)]

	pos := 0
	for pos < n {
		diff := n - len(b)
		if diff > bytesAllocLimit {
			diff = bytesAllocLimit
		}
		b = append(b, make([]byte, diff)...)

		nn, err := io.ReadFull(r, b[pos:])
		if err != nil {
			return nil, err
		}
		pos += nn
	}

	return b, nil
}

func formatInt(n int64) string {
	return strconv.FormatInt(n, 10)
}

func formatUint(u uint64) string {
	return strconv.FormatUint(u, 10)
}

func formatFloat(f float64) string {
	return strconv.FormatFloat(f, 'f', -1, 64)
}

func isNilReply(b []byte) bool {
	return len(b) == 3 &&
		(b[0] == StringReply || b[0] == ArrayReply) &&
		b[1] == '-' && b[2] == '1'
}

func ParseErrorReply(line []byte) error {
	return internal.RedisError(string(line[1:]))
}

func parseStatusValue(line []byte) []byte {
	return line[1:]
}

func parseArrayLen(line []byte) (int64, error) {
	if isNilReply(line) {
		return 0, internal.Nil
	}
	return parseInt(line[1:], 10, 64)
}

func atoi(b []byte) (int, error) {
	return strconv.Atoi(internal.BytesToString(b))
}

func parseInt(b []byte, base int, bitSize int) (int64, error) {
	return strconv.ParseInt(internal.BytesToString(b), base, bitSize)
}

func parseUint(b []byte, base int, bitSize int) (uint64, error) {
	return strconv.ParseUint(internal.BytesToString(b), base, bitSize)
}

func parseFloat(b []byte, bitSize int) (float64, error) {
	return strconv.ParseFloat(internal.BytesToString(b), bitSize)
}
