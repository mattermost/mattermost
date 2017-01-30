// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package riff_test

import (
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"strings"

	"golang.org/x/image/riff"
)

func ExampleReader() {
	formType, r, err := riff.NewReader(strings.NewReader(data))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("RIFF(%s)\n", formType)
	if err := dump(r, ".\t"); err != nil {
		log.Fatal(err)
	}
	// Output:
	// RIFF(ROOT)
	// .	ZERO ""
	// .	ONE  "a"
	// .	LIST(META)
	// .	.	LIST(GOOD)
	// .	.	.	ONE  "a"
	// .	.	.	FIVE "klmno"
	// .	.	ZERO ""
	// .	.	LIST(BAD )
	// .	.	.	THRE "def"
	// .	TWO  "bc"
	// .	LIST(UGLY)
	// .	.	FOUR "ghij"
	// .	.	SIX  "pqrstu"
}

func dump(r *riff.Reader, indent string) error {
	for {
		chunkID, chunkLen, chunkData, err := r.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		if chunkID == riff.LIST {
			listType, list, err := riff.NewListReader(chunkLen, chunkData)
			if err != nil {
				return err
			}
			fmt.Printf("%sLIST(%s)\n", indent, listType)
			if err := dump(list, indent+".\t"); err != nil {
				return err
			}
			continue
		}
		b, err := ioutil.ReadAll(chunkData)
		if err != nil {
			return err
		}
		fmt.Printf("%s%s %q\n", indent, chunkID, b)
	}
}

func encodeU32(u uint32) string {
	return string([]byte{
		byte(u >> 0),
		byte(u >> 8),
		byte(u >> 16),
		byte(u >> 24),
	})
}

func encode(chunkID, contents string) string {
	n := len(contents)
	if n&1 == 1 {
		contents += "\x00"
	}
	return chunkID + encodeU32(uint32(n)) + contents
}

func encodeMulti(typ0, typ1 string, chunks ...string) string {
	n := 4
	for _, c := range chunks {
		n += len(c)
	}
	s := typ0 + encodeU32(uint32(n)) + typ1
	for _, c := range chunks {
		s += c
	}
	return s
}

var (
	d0   = encode("ZERO", "")
	d1   = encode("ONE ", "a")
	d2   = encode("TWO ", "bc")
	d3   = encode("THRE", "def")
	d4   = encode("FOUR", "ghij")
	d5   = encode("FIVE", "klmno")
	d6   = encode("SIX ", "pqrstu")
	l0   = encodeMulti("LIST", "GOOD", d1, d5)
	l1   = encodeMulti("LIST", "BAD ", d3)
	l2   = encodeMulti("LIST", "UGLY", d4, d6)
	l01  = encodeMulti("LIST", "META", l0, d0, l1)
	data = encodeMulti("RIFF", "ROOT", d0, d1, l01, d2, l2)
)
