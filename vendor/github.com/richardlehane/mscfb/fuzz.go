// +build gofuzz

// fuzzing with https://github.com/dvyukov/go-fuzz
package mscfb

import (
	"bytes"
	"io"
)

func Fuzz(data []byte) int {
	doc, err := New(bytes.NewReader(data))
	if err != nil {
		if doc != nil {
			panic("doc != nil on error " + err.Error())
		}
		return 0
	}
	buf := &bytes.Buffer{}
	for entry, err := doc.Next(); ; entry, err = doc.Next() {
		if err != nil {
			if err == io.EOF {
				return 1
			}
			if entry != nil {
				panic("entry != nil on error " + err.Error())
			}
		}
		buf.Reset()
		buf.ReadFrom(entry)
	}
	return 1
}
