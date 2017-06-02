// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestHttpClientWithProxy(t *testing.T) {
	proxy := createProxyServer()
	defer proxy.Close()
	os.Setenv("HTTP_PROXY", proxy.URL)

	client := HttpClient()
	resp, err := client.Get("http://acme.com")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "proxy" {
		t.FailNow()
	}
}

func createProxyServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Header().Set("Content-Type", "text/plain; charset=us-ascii")
		fmt.Fprint(w, "proxy")
	}))
}
