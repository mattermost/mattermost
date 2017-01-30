// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package slave

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
)

func Main() {
	if len(os.Args) != 2 || os.Args[1] != "LISTEN_STDIN" {
		fmt.Fprintf(os.Stderr, "devweb slave must be invoked by devweb\n")
		os.Exit(2)
	}
	l, err := net.FileListener(os.Stdin)
	if err != nil {
		log.Fatal(err)
	}
	os.Stdin.Close()
	log.Fatal(http.Serve(l, nil))
}
