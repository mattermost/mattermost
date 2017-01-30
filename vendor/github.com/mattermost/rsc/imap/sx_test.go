package imap

import (
	"bufio"
	"reflect"
	"strings"
	"testing"
)

var sxTests = []struct {
	in  string
	out *sx
}{
	{"1234", &sx{kind: sxNumber, number: 1234}},
	{"hello", &sx{kind: sxAtom, data: []byte("hello")}},
	{"hello[world]", &sx{kind: sxAtom, data: []byte("hello[world]")}},
	{`"h\\ello"`, &sx{kind: sxString, data: []byte(`h\ello`)}},
	{"{6}\r\nh\\ello", &sx{kind: sxString, data: []byte(`h\ello`)}},
	{`(hello "world" (again) ())`,
		&sx{
			kind: sxList,
			sx: []*sx{
				&sx{
					kind: sxAtom,
					data: []byte("hello"),
				},
				&sx{
					kind: sxString,
					data: []byte("world"),
				},
				&sx{
					kind: sxList,
					sx: []*sx{
						&sx{
							kind: sxAtom,
							data: []byte("again"),
						},
					},
				},
				&sx{
					kind: sxList,
				},
			},
		},
	},
}

func TestSx(t *testing.T) {
	for _, tt := range sxTests {
		b := bufio.NewReader(strings.NewReader(tt.in + "\n"))
		sx, err := rdsx1(b)
		if err != nil {
			t.Errorf("parse %s: %v", tt.in, err)
			continue
		}
		if !reflect.DeepEqual(sx, tt.out) {
			t.Errorf("rdsx1(%s) = %v, want %v", tt.in, sx, tt.out)
		}
	}
}
