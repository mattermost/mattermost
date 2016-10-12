// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.8

package http2

import "crypto/tls"

func cloneTLSConfig(c *tls.Config) *tls.Config { return c.Clone() }
