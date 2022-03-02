//go:build !wasm && js
// +build !wasm,js

package psd

import (
	"errors"
	"io"

	"github.com/gopherjs/gopherjs/js"
)

func decodePackBits(dest []byte, r io.Reader, width int, lines int, large bool) (read int, err error) {
	intSize := get4or8(large) >> 1
	b := make([]byte, lines*intSize)
	var l int
	if l, err = io.ReadFull(r, b); err != nil {
		return
	}
	read += l

	lens := js.Global.Get("$github.com/oov/psd$").Call("decodePackBitsLines", b, lines, large).Interface().([]uint)
	if lens == nil {
		return read, errors.New("psd: error occurred in decodePackBitsLines")
	}

	total := uint(0)
	for _, ln := range lens {
		total += ln
	}
	b = make([]byte, total)
	if l, err = io.ReadFull(r, b); err != nil {
		return
	}
	read += l
	if !js.Global.Get("$github.com/oov/psd$").Call("decodePackBits", dest, b, lens).Bool() {
		return read, errors.New("psd: error occurred in decodePackBits")
	}
	return
}
