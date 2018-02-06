// +build go1.7

package redis

import (
	"errors"
	"testing"
)

func TestParseURL(t *testing.T) {
	cases := []struct {
		u    string
		addr string
		db   int
		tls  bool
		err  error
	}{
		{
			"redis://localhost:123/1",
			"localhost:123",
			1, false, nil,
		},
		{
			"redis://localhost:123",
			"localhost:123",
			0, false, nil,
		},
		{
			"redis://localhost/1",
			"localhost:6379",
			1, false, nil,
		},
		{
			"redis://12345",
			"12345:6379",
			0, false, nil,
		},
		{
			"rediss://localhost:123",
			"localhost:123",
			0, true, nil,
		},
		{
			"redis://localhost/?abc=123",
			"",
			0, false, errors.New("no options supported"),
		},
		{
			"http://google.com",
			"",
			0, false, errors.New("invalid redis URL scheme: http"),
		},
		{
			"redis://localhost/1/2/3/4",
			"",
			0, false, errors.New("invalid redis URL path: /1/2/3/4"),
		},
		{
			"12345",
			"",
			0, false, errors.New("invalid redis URL scheme: "),
		},
		{
			"redis://localhost/iamadatabase",
			"",
			0, false, errors.New(`invalid redis database number: "iamadatabase"`),
		},
	}

	for _, c := range cases {
		t.Run(c.u, func(t *testing.T) {
			o, err := ParseURL(c.u)
			if c.err == nil && err != nil {
				t.Fatalf("unexpected error: %q", err)
				return
			}
			if c.err != nil && err != nil {
				if c.err.Error() != err.Error() {
					t.Fatalf("got %q, expected %q", err, c.err)
				}
				return
			}
			if o.Addr != c.addr {
				t.Errorf("got %q, want %q", o.Addr, c.addr)
			}
			if o.DB != c.db {
				t.Errorf("got %q, expected %q", o.DB, c.db)
			}
			if c.tls && o.TLSConfig == nil {
				t.Errorf("got nil TLSConfig, expected a TLSConfig")
			}
		})
	}
}
