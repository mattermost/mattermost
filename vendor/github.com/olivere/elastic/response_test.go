// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"
)

func BenchmarkResponse(b *testing.B) {
	c := &Client{
		decoder: &DefaultDecoder{},
	}

	var resp *Response
	for n := 0; n < b.N; n++ {
		iteration := fmt.Sprint(n)
		body := fmt.Sprintf(`{"n":%d}`, n)
		res := &http.Response{
			Header: http.Header{
				"X-Iteration": []string{iteration},
			},
			Body:       ioutil.NopCloser(bytes.NewBufferString(body)),
			StatusCode: http.StatusOK,
		}
		var err error
		resp, err = c.newResponse(res)
		if err != nil {
			b.Fatal(err)
		}
		/*
			if want, have := body, string(resp.Body); want != have {
				b.Fatalf("want %q, have %q", want, have)
			}
			//*/
		/*
			if want, have := iteration, resp.Header.Get("X-Iteration"); want != have {
				b.Fatalf("want %q, have %q", want, have)
			}
			//*/
	}
	_ = resp
}
