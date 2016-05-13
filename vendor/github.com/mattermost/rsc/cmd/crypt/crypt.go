// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Crypt is a simple password-based encryption program,
// demonstrating how to use github.com/mattermost/rsc/crypt.
//
// Encrypt input to output using password:
//	crypt password <input >output
//
// Decrypt input to output using password:
//	crypt -d password <input >output
//
// Yes, the password is a command-line argument. This is a demo of the
// github.com/mattermost/rsc/crypt package. It's not intended for real use.
//
package main

import (
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"os"
	"strings"

	"github.com/mattermost/rsc/crypt"
)

func main() {
	args := os.Args[1:]
	encrypt := true
	if len(args) >= 1 && args[0] == "-d" {
		encrypt = false
		args = args[1:]
	}
	if len(args) != 1 || strings.HasPrefix(args[0], "-") {
		fmt.Fprintf(os.Stderr, "usage: crypt [-d] password < input > output\n")
		os.Exit(2)
	}
	password := args[0]

	data, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "reading stdin: %v\n", err)
		os.Exit(1)
	}
	if encrypt {
		pkt, err := crypt.Encrypt(password, data)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%v\n", err)
			os.Exit(1)
		}
		str := base64.StdEncoding.EncodeToString(pkt)
		for len(str) > 60 {
			fmt.Printf("%s\n", str[:60])
			str = str[60:]
		}
		fmt.Printf("%s\n", str)
	} else {
		pkt, err := base64.StdEncoding.DecodeString(strings.Map(noSpace, string(data)))
		if err != nil {
			fmt.Fprintf(os.Stderr, "decoding input: %v\n", err)
			os.Exit(1)
		}
		dec, err := crypt.Decrypt(password, pkt)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%v\n", err)
			os.Exit(1)
		}
		os.Stdout.Write(dec)
	}
}

func noSpace(r rune) rune {
	if r == ' ' || r == '\t' || r == '\n' {
		return -1
	}
	return r
}
