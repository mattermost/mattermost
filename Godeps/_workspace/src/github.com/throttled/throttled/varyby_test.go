package throttled

import (
	"net/http"
	"net/url"
	"testing"
)

func TestVaryBy(t *testing.T) {
	u, err := url.Parse("http://localhost/test/path?q=s")
	if err != nil {
		panic(err)
	}
	ck := &http.Cookie{Name: "ssn", Value: "test"}
	cases := []struct {
		vb *VaryBy
		r  *http.Request
		k  string
	}{
		0: {nil, &http.Request{}, ""},
		1: {&VaryBy{RemoteAddr: true}, &http.Request{RemoteAddr: "::"}, "::\n"},
		2: {
			&VaryBy{Method: true, Path: true},
			&http.Request{Method: "POST", URL: u},
			"post\n/test/path\n",
		},
		3: {
			&VaryBy{Headers: []string{"Content-length"}},
			&http.Request{Header: http.Header{"Content-Type": []string{"text/plain"}, "Content-Length": []string{"123"}}},
			"123\n",
		},
		4: {
			&VaryBy{Separator: ",", Method: true, Headers: []string{"Content-length"}, Params: []string{"q", "user"}},
			&http.Request{Method: "GET", Header: http.Header{"Content-Type": []string{"text/plain"}, "Content-Length": []string{"123"}}, Form: url.Values{"q": []string{"s"}, "pwd": []string{"secret"}, "user": []string{"test"}}},
			"get,123,s,test,",
		},
		5: {
			&VaryBy{Cookies: []string{"ssn"}},
			&http.Request{Header: http.Header{"Cookie": []string{ck.String()}}},
			"test\n",
		},
		6: {
			&VaryBy{Cookies: []string{"ssn"}, RemoteAddr: true, Custom: func(r *http.Request) string {
				return "blah"
			}},
			&http.Request{Header: http.Header{"Cookie": []string{ck.String()}}},
			"blah",
		},
	}
	for i, c := range cases {
		got := c.vb.Key(c.r)
		if got != c.k {
			t.Errorf("%d: expected '%s' (%d), got '%s' (%d)", i, c.k, len(c.k), got, len(got))
		}
	}
}
