// +build linux

package socket

import (
	"bytes"
	"testing"
)

type mockControl struct {
	Level int
	Type  int
	Data  []byte
}

func TestControlMessage(t *testing.T) {
	for _, tt := range []struct {
		cs []mockControl
	}{
		{
			[]mockControl{
				{Level: 1, Type: 1},
			},
		},
		{
			[]mockControl{
				{Level: 2, Type: 2, Data: []byte{0xfe}},
			},
		},
		{
			[]mockControl{
				{Level: 3, Type: 3, Data: []byte{0xfe, 0xff, 0xff, 0xfe}},
			},
		},
		{
			[]mockControl{
				{Level: 4, Type: 4, Data: []byte{0xfe, 0xff, 0xff, 0xfe, 0xfe, 0xff, 0xff, 0xfe}},
			},
		},
		{
			[]mockControl{
				{Level: 4, Type: 4, Data: []byte{0xfe, 0xff, 0xff, 0xfe, 0xfe, 0xff, 0xff, 0xfe}},
				{Level: 2, Type: 2, Data: []byte{0xfe}},
			},
		},
	} {
		var w []byte
		var tailPadLen int
		mm := NewControlMessage([]int{0})
		for i, c := range tt.cs {
			m := NewControlMessage([]int{len(c.Data)})
			l := len(m) - len(mm)
			if i == len(tt.cs)-1 && l > len(c.Data) {
				tailPadLen = l - len(c.Data)
			}
			w = append(w, m...)
		}

		var err error
		ww := make([]byte, len(w))
		copy(ww, w)
		m := ControlMessage(ww)
		for _, c := range tt.cs {
			if err = m.MarshalHeader(c.Level, c.Type, len(c.Data)); err != nil {
				t.Fatalf("(%v).MarshalHeader() = %v", tt.cs, err)
			}
			copy(m.Data(len(c.Data)), c.Data)
			m = m.Next(len(c.Data))
		}
		m = ControlMessage(w)
		for _, c := range tt.cs {
			m, err = m.Marshal(c.Level, c.Type, c.Data)
			if err != nil {
				t.Fatalf("(%v).Marshal() = %v", tt.cs, err)
			}
		}
		if !bytes.Equal(ww, w) {
			t.Fatalf("got %#v; want %#v", ww, w)
		}

		ws := [][]byte{w}
		if tailPadLen > 0 {
			// Test a message with no tail padding.
			nopad := w[:len(w)-tailPadLen]
			ws = append(ws, [][]byte{nopad}...)
		}
		for _, w := range ws {
			ms, err := ControlMessage(w).Parse()
			if err != nil {
				t.Fatalf("(%v).Parse() = %v", tt.cs, err)
			}
			for i, m := range ms {
				lvl, typ, dataLen, err := m.ParseHeader()
				if err != nil {
					t.Fatalf("(%v).ParseHeader() = %v", tt.cs, err)
				}
				if lvl != tt.cs[i].Level || typ != tt.cs[i].Type || dataLen != len(tt.cs[i].Data) {
					t.Fatalf("%v: got %d, %d, %d; want %d, %d, %d", tt.cs[i], lvl, typ, dataLen, tt.cs[i].Level, tt.cs[i].Type, len(tt.cs[i].Data))
				}
			}
		}
	}
}
