package sockaddr_test

import (
	"fmt"
	"testing"

	"github.com/hashicorp/go-sockaddr"
)

func TestSockAddr_IPAddr_CmpAddress(t *testing.T) {
	tests := []struct {
		a   string
		b   string
		cmp int
	}{
		{ // 0: Same IPAddr (v4), same port
			a:   "208.67.222.222:0",
			b:   "208.67.222.222/32",
			cmp: 0,
		},
		{ // 1: Same IPAddr (v6), same port
			a:   "[2607:f0d0:1002:0051:0000:0000:0000:0004]:0",
			b:   "2607:f0d0:1002:0051:0000:0000:0000:0004/128",
			cmp: 0,
		},
		{ // 2: Same IPAddr (v4), different port
			a:   "208.67.222.222:4646",
			b:   "208.67.222.222/32",
			cmp: 0,
		},
		{ // 3: Same IPAddr (v6), different port
			a:   "[2607:f0d0:1002:0051:0000:0000:0000:0004]:4646",
			b:   "[2607:f0d0:1002:0051:0000:0000:0000:0004]:4647",
			cmp: 0,
		},
		{ // 4: Different IPAddr (v4), same port
			a:   "208.67.220.220:4648",
			b:   "208.67.222.222:4648",
			cmp: -1,
		},
		{ // 5: Different IPAddr (v6), same port
			a:   "[2607:f0d0:1002:0051:0000:0000:0000:0004]:4648",
			b:   "[2607:f0d0:1002:0052:0000:0000:0000:0004]:4648",
			cmp: -1,
		},
		{ // 6: Different IPAddr (v4), different port
			a:   "208.67.220.220:8600",
			b:   "208.67.222.222:4648",
			cmp: -1,
		},
		{ // 7: Different IPAddr (v6), different port
			a:   "[2607:f0d0:1002:0051:0000:0000:0000:0004]:8500",
			b:   "[2607:f0d0:1002:0052:0000:0000:0000:0004]:4648",
			cmp: -1,
		},
		{ // 8: Incompatible IPAddr (v4 vs v6), same port
			a:   "208.67.220.220:8600",
			b:   "[2607:f0d0:1002:0051:0000:0000:0000:0004]:8600",
			cmp: 0,
		},
		{ // 9: Incompatible IPAddr (v4 vs v6), different port
			a:   "208.67.220.220:8500",
			b:   "[2607:f0d0:1002:0051:0000:0000:0000:0004]:8600",
			cmp: 0,
		},
		{ // 10: Incompatible SockAddr types
			a:   "128.95.120.1:123",
			b:   "/tmp/foo.sock",
			cmp: 0,
		},
		{ // 11: Incompatible SockAddr types
			a:   "[::]:123",
			b:   "/tmp/foo.sock",
			cmp: 0,
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			saA, err := sockaddr.NewSockAddr(test.a)
			if err != nil {
				t.Fatalf("[%d] Unable to create a SockAddr from %+q: %v", idx, test.a, err)
			}
			saB, err := sockaddr.NewSockAddr(test.b)
			if err != nil {
				t.Fatalf("[%d] Unable to create an SockAddr from %+q: %v", idx, test.b, err)
			}

			ipA, ok := saA.(sockaddr.IPAddr)
			if !ok {
				t.Fatalf("[%d] Unable to convert SockAddr %+q to an IPAddr", idx, test.a)
			}

			if x := ipA.CmpAddress(saB); x != test.cmp {
				t.Errorf("[%d] IPAddr.CmpAddress() failed with %+q with %+q (expected %d, received %d)", idx, ipA, saB, test.cmp, x)
			}

			ipB, ok := saB.(sockaddr.IPAddr)
			if !ok {
				// Return success for comparing non-IPAddr types
				return
			}
			if x := ipA.CmpAddress(ipB); x != test.cmp {
				t.Errorf("[%d] IPAddr.CmpAddress() failed with %+q with %+q (expected %d, received %d)", idx, ipA, ipB, test.cmp, x)
			}
			if x := ipB.CmpAddress(ipA); x*-1 != test.cmp {
				t.Errorf("[%d] IPAddr.CmpAddress() failed with %+q with %+q (expected %d, received %d)", idx, ipB, ipA, test.cmp, x)
			}

			if x := ipB.CmpAddress(saA); x*-1 != test.cmp {
				t.Errorf("[%d] IPAddr.CmpAddress() failed with %+q with %+q (expected %d, received %d)", idx, ipB, saA, test.cmp, x)
			}
		})
	}
}

func TestSockAddr_IPAddr_CmpPort(t *testing.T) {
	tests := []struct {
		a   string
		b   string
		cmp int
	}{
		{ // 0: Same IPv4Addr, same port
			a:   "208.67.222.222:0",
			b:   "208.67.222.222/32",
			cmp: 0,
		},
		{ // 1: Different IPv4Addr, same port
			a:   "208.67.220.220:0",
			b:   "208.67.222.222/32",
			cmp: 0,
		},
		{ // 2: Same IPv4Addr, different port
			a:   "208.67.222.222:80",
			b:   "208.67.222.222:443",
			cmp: -1,
		},
		{ // 3: Different IPv4Addr, different port
			a:   "208.67.220.220:8600",
			b:   "208.67.222.222:53",
			cmp: 1,
		},
		{ // 4: Same IPv6Addr, same port
			a:   "[::]:0",
			b:   "::/128",
			cmp: 0,
		},
		{ // 5: Different IPv6Addr, same port
			a:   "[::]:0",
			b:   "[2607:f0d0:1002:0051:0000:0000:0000:0004]:0",
			cmp: 0,
		},
		{ // 6: Same IPv6Addr, different port
			a:   "[::]:8400",
			b:   "[::]:8600",
			cmp: -1,
		},
		{ // 7: Different IPv6Addr, different port
			a:   "[::]:8600",
			b:   "[2607:f0d0:1002:0051:0000:0000:0000:0004]:53",
			cmp: 1,
		},
		{ // 8: Mixed IPAddr types, same port
			a:   "[::]:53",
			b:   "208.67.220.220:53",
			cmp: 0,
		},
		{ // 9: Mixed IPAddr types, different port
			a:   "[::]:53",
			b:   "128.95.120.1:123",
			cmp: -1,
		},
		{ // 10: Incompatible SockAddr types
			a:   "128.95.120.1:123",
			b:   "/tmp/foo.sock",
			cmp: 0,
		},
		{ // 11: Incompatible SockAddr types
			a:   "[::]:123",
			b:   "/tmp/foo.sock",
			cmp: 0,
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			saA, err := sockaddr.NewSockAddr(test.a)
			if err != nil {
				t.Fatalf("[%d] Unable to create a SockAddr from %+q: %v", idx, test.a, err)
			}
			saB, err := sockaddr.NewSockAddr(test.b)
			if err != nil {
				t.Fatalf("[%d] Unable to create an SockAddr from %+q: %v", idx, test.b, err)
			}

			ipA, ok := saA.(sockaddr.IPAddr)
			if !ok {
				t.Fatalf("[%d] Unable to convert SockAddr %+q to an IPAddr", idx, test.a)
			}

			if x := ipA.CmpPort(saB); x != test.cmp {
				t.Errorf("[%d] IPAddr.CmpPort() failed with %+q with %+q (expected %d, received %d)", idx, ipA, saB, test.cmp, x)
			}

			ipB, ok := saB.(sockaddr.IPAddr)
			if !ok {
				// Return success for comparing non-IPAddr types
				return
			}
			if x := ipA.CmpPort(ipB); x != test.cmp {
				t.Errorf("[%d] IPAddr.CmpPort() failed with %+q with %+q (expected %d, received %d)", idx, ipA, ipB, test.cmp, x)
			}
			if x := ipB.CmpPort(ipA); x*-1 != test.cmp {
				t.Errorf("[%d] IPAddr.CmpPort() failed with %+q with %+q (expected %d, received %d)", idx, ipB, ipA, test.cmp, x)
			}

			if x := ipB.CmpPort(saA); x*-1 != test.cmp {
				t.Errorf("[%d] IPAddr.CmpPort() failed with %+q with %+q (expected %d, received %d)", idx, ipB, saA, test.cmp, x)
			}
		})
	}
}
