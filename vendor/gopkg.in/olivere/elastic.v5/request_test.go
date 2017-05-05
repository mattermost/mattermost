// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "testing"

var testReq *Request // used as a temporary variable to avoid compiler optimizations in tests/benchmarks

func BenchmarkRequestSetBodyString(b *testing.B) {
	req, err := NewRequest("GET", "/")
	if err != nil {
		b.Fatal(err)
	}
	for i := 0; i < b.N; i++ {
		body := `{"query":{"match_all":{}}}`
		err = req.SetBody(body, false)
		if err != nil {
			b.Fatal(err)
		}
	}
	testReq = req
}

func BenchmarkRequestSetBodyStringGzip(b *testing.B) {
	req, err := NewRequest("GET", "/")
	if err != nil {
		b.Fatal(err)
	}
	for i := 0; i < b.N; i++ {
		body := `{"query":{"match_all":{}}}`
		err = req.SetBody(body, true)
		if err != nil {
			b.Fatal(err)
		}
	}
	testReq = req
}

func BenchmarkRequestSetBodyBytes(b *testing.B) {
	req, err := NewRequest("GET", "/")
	if err != nil {
		b.Fatal(err)
	}
	for i := 0; i < b.N; i++ {
		body := []byte(`{"query":{"match_all":{}}}`)
		err = req.SetBody(body, false)
		if err != nil {
			b.Fatal(err)
		}
	}
	testReq = req
}

func BenchmarkRequestSetBodyBytesGzip(b *testing.B) {
	req, err := NewRequest("GET", "/")
	if err != nil {
		b.Fatal(err)
	}
	for i := 0; i < b.N; i++ {
		body := []byte(`{"query":{"match_all":{}}}`)
		err = req.SetBody(body, true)
		if err != nil {
			b.Fatal(err)
		}
	}
	testReq = req
}

func BenchmarkRequestSetBodyMap(b *testing.B) {
	req, err := NewRequest("GET", "/")
	if err != nil {
		b.Fatal(err)
	}
	for i := 0; i < b.N; i++ {
		body := map[string]interface{}{
			"query": map[string]interface{}{
				"match_all": map[string]interface{}{},
			},
		}
		err = req.SetBody(body, false)
		if err != nil {
			b.Fatal(err)
		}
	}
	testReq = req
}

func BenchmarkRequestSetBodyMapGzip(b *testing.B) {
	req, err := NewRequest("GET", "/")
	if err != nil {
		b.Fatal(err)
	}
	for i := 0; i < b.N; i++ {
		body := map[string]interface{}{
			"query": map[string]interface{}{
				"match_all": map[string]interface{}{},
			},
		}
		err = req.SetBody(body, true)
		if err != nil {
			b.Fatal(err)
		}
	}
	testReq = req
}
