package imap

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"log"
	"strings"
	"time"
)

type sxKind int

const (
	sxNone sxKind = iota
	sxAtom
	sxString
	sxNumber
	sxList
)

type sx struct {
	kind   sxKind
	data   []byte
	number int64
	sx     []*sx
}

func rdsx(b *bufio.Reader) (*sx, error) {
	x := &sx{kind: sxList}
	for {
		xx, err := rdsx1(b)
		if err != nil {
			return nil, err
		}
		if xx == nil {
			break
		}
		x.sx = append(x.sx, xx)
	}
	return x, nil
}

func rdsx1(b *bufio.Reader) (*sx, error) {
	c, err := b.ReadByte()
	if c == ' ' {
		c, err = b.ReadByte()
	}
	if c == '\r' {
		c, err = b.ReadByte()
	}
	if err != nil {
		return nil, err
	}
	if c == '\n' {
		return nil, nil
	}
	if c == ')' { // end of list
		b.UnreadByte()
		return nil, nil
	}
	if c == '(' { // parenthesized list
		x, err := rdsx(b)
		if err != nil {
			return nil, err
		}
		c, err = b.ReadByte()
		if err != nil {
			return nil, err
		}
		if c != ')' {
			// oops! not good
			b.UnreadByte()
		}
		return x, nil
	}
	if c == '{' { // length-prefixed string
		n := 0
		for {
			c, _ = b.ReadByte()
			if c < '0' || c > '9' {
				break
			}
			n = n*10 + int(c) - '0'
		}
		if c != '}' {
			// oops! not good
			b.UnreadByte()
		}
		c, err = b.ReadByte()
		if c != '\r' {
			// oops! not good
		}
		c, err = b.ReadByte()
		if c != '\n' {
			// oops! not good
		}
		data := make([]byte, n)
		if _, err := io.ReadFull(b, data); err != nil {
			return nil, err
		}
		return &sx{kind: sxString, data: data}, nil
	}
	if c == '"' { // quoted string
		var data []byte
		for {
			c, err = b.ReadByte()
			if err != nil {
				return nil, err
			}
			if c == '"' {
				break
			}
			if c == '\\' {
				c, _ = b.ReadByte()
			}
			data = append(data, c)
		}
		return &sx{kind: sxString, data: data}, nil
	}
	if '0' <= c && c <= '9' { // number
		n := int64(c) - '0'
		for {
			c, err := b.ReadByte()
			if err != nil {
				return nil, err
			}
			if c < '0' || c > '9' {
				break
			}
			n = n*10 + int64(c) - '0'
		}
		b.UnreadByte()
		return &sx{kind: sxNumber, number: n}, nil
	}

	// atom
	nbr := 0
	var data []byte
	data = append(data, c)
	for {
		c, err = b.ReadByte()
		if err != nil {
			return nil, err
		}
		if c <= ' ' || c == '(' || c == ')' || c == '{' || c == '}' {
			break
		}
		if c == '[' {
			// allow embedded brackets as in BODY[]
			if data[0] == '[' {
				break
			}
			nbr++
		}
		if c == ']' {
			if nbr <= 0 {
				break
			}
			nbr--
		}
		data = append(data, c)
	}
	if c != ' ' {
		b.UnreadByte()
	}
	return &sx{kind: sxAtom, data: data}, nil
}

func (x *sx) ok() bool {
	return len(x.sx) >= 2 && x.sx[1].kind == sxAtom && strings.EqualFold(string(x.sx[1].data), "ok")
}

func (x *sx) String() string {
	var b bytes.Buffer
	x.fmt(&b, true)
	return b.String()
}

func (x *sx) fmt(b *bytes.Buffer, paren bool) {
	if x == nil {
		return
	}
	switch x.kind {
	case sxAtom, sxString:
		fmt.Fprintf(b, "%q", x.data)
	case sxNumber:
		fmt.Fprintf(b, "%d", x.number)
	case sxList:
		if paren {
			b.WriteByte('(')
		}
		for i, xx := range x.sx {
			if i > 0 {
				b.WriteByte(' ')
			}
			xx.fmt(b, paren)
		}
		if paren {
			b.WriteByte(')')
		}
	default:
		b.WriteByte('?')
	}
}

var bytesNIL = []byte("NIL")

var fmtKind = []sxKind{
	'L': sxList,
	'S': sxString,
	'N': sxNumber,
	'A': sxAtom,
}

func (x *sx) match(format string) bool {
	done := false
	c := format[0]
	for i := 0; i < len(x.sx); i++ {
		if !done {
			if i >= len(format) {
				log.Printf("sxmatch: too short")
				return false
			}
			if format[i] == '*' {
				done = true
			} else {
				c = format[i]
			}
		}
		xx := x.sx[i]
		if xx.kind == sxAtom && xx.isNil() {
			if c == 'L' {
				xx.kind = sxList
				xx.data = nil
			} else if c == 'S' {
				xx.kind = sxString
				xx.data = nil
			}
		}
		if xx.kind == sxAtom && c == 'S' {
			xx.kind = sxString
		}
		if xx.kind != fmtKind[c] {
			log.Printf("sxmatch: %s not %c", xx, c)
			return false
		}
	}
	if len(format) > len(x.sx) {
		log.Printf("sxmatch: too long")
		return false
	}
	return true
}

func (x *sx) isAtom(name string) bool {
	if x == nil || x.kind != sxAtom {
		return false
	}
	data := x.data
	n := len(name)
	if n > 0 && name[n-1] == '[' {
		i := bytes.IndexByte(data, '[')
		if i < 0 {
			return false
		}
		data = data[:i]
		name = name[:n-1]
	}
	for i := 0; i < len(name); i++ {
		if i >= len(data) || lwr(rune(data[i])) != lwr(rune(name[i])) {
			return false
		}
	}
	return len(name) == len(data)
}

func (x *sx) isString() bool {
	if x.isNil() {
		return true
	}
	if x.kind == sxAtom {
		x.kind = sxString
	}
	return x.kind == sxString
}

func (x *sx) isNumber() bool {
	return x.kind == sxNumber
}

func (x *sx) isNil() bool {
	return x == nil ||
		x.kind == sxList && len(x.sx) == 0 ||
		x.kind == sxAtom && bytes.Equal(x.data, bytesNIL)
}

func (x *sx) isList() bool {
	return x.isNil() || x.kind == sxList
}

func (x *sx) parseFlags() Flags {
	if x.kind != sxList {
		log.Printf("malformed flags: %s", x)
		return 0
	}

	f := Flags(0)
SX:
	for _, xx := range x.sx {
		if xx.kind != sxAtom {
			continue
		}
		for i, name := range flagNames {
			if xx.isAtom(name) {
				f |= 1 << uint(i)
				continue SX
			}
		}
		if Debug {
			log.Printf("unknown flag: %v", xx)
		}
	}
	return f
}

func (x *sx) parseDate() time.Time {
	if x.kind != sxString {
		log.Printf("malformed date: %s", x)
		return time.Time{}
	}

	t, err := time.Parse("02-Jan-2006 15:04:05 -0700", string(x.data))
	if err != nil {
		log.Printf("malformed date: %s (%s)", x, err)
	}
	return t
}

func (x *sx) nstring() string {
	return string(x.nbytes())
}

func (x *sx) nbytes() []byte {
	if x.isNil() {
		return nil
	}
	return x.data
}
