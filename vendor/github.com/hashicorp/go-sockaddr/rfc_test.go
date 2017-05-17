package sockaddr_test

import (
	"testing"

	sockaddr "github.com/hashicorp/go-sockaddr"
)

func TestVisitAllRFCs(t *testing.T) {
	const expectedNumRFCs = 28
	numRFCs := 0
	sockaddr.VisitAllRFCs(func(rfcNum uint, sas sockaddr.SockAddrs) {
		numRFCs++
	})
	if numRFCs != expectedNumRFCs {
		t.Fatalf("wrong number of RFCs: %d", numRFCs)
	}
}

func TestIsRFC(t *testing.T) {
	tests := []struct {
		name   string
		sa     sockaddr.SockAddr
		rfcNum uint
		result bool
	}{
		{
			name:   "rfc1918 pass",
			sa:     sockaddr.MustIPv4Addr("192.168.0.0/16"),
			rfcNum: 1918,
			result: true,
		},
		{
			name:   "rfc1918 fail",
			sa:     sockaddr.MustIPv4Addr("1.2.3.4"),
			rfcNum: 1918,
			result: false,
		},
		{
			name:   "rfc1918 pass",
			sa:     sockaddr.MustIPv4Addr("192.168.1.1"),
			rfcNum: 1918,
			result: true,
		},
		{
			name:   "invalid rfc",
			sa:     sockaddr.MustIPv4Addr("192.168.0.0/16"),
			rfcNum: 999999999999,
			result: false,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d needs a name", i)
		}

		result := sockaddr.IsRFC(test.rfcNum, test.sa)
		if result != test.result {
			t.Fatalf("expected a match")
		}
	}
}
