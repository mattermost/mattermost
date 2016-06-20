// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// jfmt reads JSON from standard input, formats it, and writes it to standard output.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
)

func main() {
	log.SetFlags(0)

	if len(os.Args) > 1 {
		fmt.Fprintf(os.Stderr, "usage: json < input > output\n")
		os.Exit(2)
	}
	
	// TODO: Can do on the fly.
	
	data, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		log.Fatal(err)
	}
	
	var buf bytes.Buffer
	json.Indent(&buf, data, "", "    ")
	buf.WriteByte('\n')

	os.Stdout.Write(buf.Bytes())
}
