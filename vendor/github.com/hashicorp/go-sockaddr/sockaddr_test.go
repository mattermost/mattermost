package sockaddr_test

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/hashicorp/go-sockaddr"
)

// TODO(sean@): Either extend this test to include IPv6Addr and UnixSock, or
// remove and find a good home to test this functionality elsewhere.

func TestSockAddr_New(t *testing.T) {
	type SockAddrFixture struct {
		input              string
		ResultType         string
		NetworkAddress     string
		BroadcastAddress   string
		IPUint32           sockaddr.IPv4Address
		Maskbits           int
		BinString          string
		HexString          string
		FirstUsableAddress string
		LastUsableAddress  string
	}
	type SockAddrFixtures []SockAddrFixtures

	goodResults := []SockAddrFixture{
		{
			input:              "0.0.0.0",
			ResultType:         "ipv4",
			NetworkAddress:     "0.0.0.0",
			BroadcastAddress:   "0.0.0.0",
			Maskbits:           32,
			IPUint32:           0,
			BinString:          "00000000000000000000000000000000",
			HexString:          "00000000",
			FirstUsableAddress: "0.0.0.0",
			LastUsableAddress:  "0.0.0.0",
		},
		{
			input:              "0.0.0.0/0",
			ResultType:         "ipv4",
			NetworkAddress:     "0.0.0.0",
			BroadcastAddress:   "255.255.255.255",
			Maskbits:           0,
			IPUint32:           0,
			BinString:          "00000000000000000000000000000000",
			HexString:          "00000000",
			FirstUsableAddress: "0.0.0.1",
			LastUsableAddress:  "255.255.255.254",
		},
		{
			input:              "0.0.0.1",
			ResultType:         "ipv4",
			NetworkAddress:     "0.0.0.1",
			BroadcastAddress:   "0.0.0.1",
			Maskbits:           32,
			IPUint32:           1,
			BinString:          "00000000000000000000000000000001",
			HexString:          "00000001",
			FirstUsableAddress: "0.0.0.1",
			LastUsableAddress:  "0.0.0.1",
		},
		{
			input:              "0.0.0.1/1",
			ResultType:         "ipv4",
			NetworkAddress:     "0.0.0.0",
			BroadcastAddress:   "127.255.255.255",
			Maskbits:           1,
			IPUint32:           1,
			BinString:          "00000000000000000000000000000001",
			HexString:          "00000001",
			FirstUsableAddress: "0.0.0.1",
			LastUsableAddress:  "127.255.255.254",
		},
		{
			input:              "128.0.0.0",
			ResultType:         "ipv4",
			NetworkAddress:     "128.0.0.0",
			BroadcastAddress:   "128.0.0.0",
			Maskbits:           32,
			IPUint32:           2147483648,
			BinString:          "10000000000000000000000000000000",
			HexString:          "80000000",
			FirstUsableAddress: "128.0.0.0",
			LastUsableAddress:  "128.0.0.0",
		},
		{
			input:              "255.255.255.255",
			ResultType:         "ipv4",
			NetworkAddress:     "255.255.255.255",
			BroadcastAddress:   "255.255.255.255",
			Maskbits:           32,
			IPUint32:           4294967295,
			BinString:          "11111111111111111111111111111111",
			HexString:          "ffffffff",
			FirstUsableAddress: "255.255.255.255",
			LastUsableAddress:  "255.255.255.255",
		},
		{
			input:              "1.2.3.4",
			ResultType:         "ipv4",
			NetworkAddress:     "1.2.3.4",
			BroadcastAddress:   "1.2.3.4",
			Maskbits:           32,
			IPUint32:           16909060,
			BinString:          "00000001000000100000001100000100",
			HexString:          "01020304",
			FirstUsableAddress: "1.2.3.4",
			LastUsableAddress:  "1.2.3.4",
		},
		{
			input:              "192.168.10.10/16",
			ResultType:         "ipv4",
			NetworkAddress:     "192.168.0.0",
			BroadcastAddress:   "192.168.255.255",
			Maskbits:           16,
			IPUint32:           3232238090,
			BinString:          "11000000101010000000101000001010",
			HexString:          "c0a80a0a",
			FirstUsableAddress: "192.168.0.1",
			LastUsableAddress:  "192.168.255.254",
		},
		{
			input:              "192.168.1.10/24",
			ResultType:         "ipv4",
			NetworkAddress:     "192.168.1.0",
			BroadcastAddress:   "192.168.1.255",
			Maskbits:           24,
			IPUint32:           3232235786,
			BinString:          "11000000101010000000000100001010",
			HexString:          "c0a8010a",
			FirstUsableAddress: "192.168.1.1",
			LastUsableAddress:  "192.168.1.254",
		},
		{
			input:              "192.168.0.1",
			ResultType:         "ipv4",
			NetworkAddress:     "192.168.0.1",
			BroadcastAddress:   "192.168.0.1",
			Maskbits:           32,
			IPUint32:           3232235521,
			BinString:          "11000000101010000000000000000001",
			HexString:          "c0a80001",
			FirstUsableAddress: "192.168.0.1",
			LastUsableAddress:  "192.168.0.1",
		},
		{
			input:              "192.168.0.2/31",
			ResultType:         "ipv4",
			NetworkAddress:     "192.168.0.2",
			BroadcastAddress:   "192.168.0.3",
			Maskbits:           31,
			IPUint32:           3232235522,
			BinString:          "11000000101010000000000000000010",
			HexString:          "c0a80002",
			FirstUsableAddress: "192.168.0.2",
			LastUsableAddress:  "192.168.0.3",
		},
		{
			input:              "240.0.0.0/4",
			ResultType:         "ipv4",
			NetworkAddress:     "240.0.0.0",
			BroadcastAddress:   "255.255.255.255",
			Maskbits:           4,
			IPUint32:           4026531840,
			BinString:          "11110000000000000000000000000000",
			HexString:          "f0000000",
			FirstUsableAddress: "240.0.0.1",
			LastUsableAddress:  "255.255.255.254",
		},
	}

	for idx, r := range goodResults {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			var (
				addr sockaddr.IPAddr
				str  string
			)

			sa, err := sockaddr.NewSockAddr(r.input)
			if err != nil {
				t.Fatalf("Failed parse %s", r.input)
			}

			switch r.ResultType {
			case "ipv4":
				ipv4b, err := sockaddr.NewIPv4Addr(r.input)
				if err != nil {
					t.Fatalf("[%d] Unable to construct a new IPv4 from %s: %s", idx, r.input, err)
				}
				if !ipv4b.Equal(sa) {
					t.Fatalf("[%d] Equality comparison failed on fresh IPv4", idx)
				}

				type_ := sa.Type()
				if type_ != sockaddr.TypeIPv4 {
					t.Fatalf("[%d] Type mismatch for %s: %d", idx, r.input, type_)
				}

				ipv4 := sockaddr.ToIPv4Addr(sa)
				if ipv4 == nil {
					t.Fatalf("[%d] Failed ToIPv4Addr() %s", idx, r.input)
				}

				addr = ipv4.Broadcast()
				if addr == nil || addr.NetIP().To4().String() != r.BroadcastAddress {
					t.Fatalf("Failed IPv4Addr.BroadcastAddress() %s: expected %+q, received %+q", r.input, r.BroadcastAddress, addr.NetIP().To4().String())
				}

				maskbits := ipv4.Maskbits()
				if maskbits != r.Maskbits {
					t.Fatalf("Failed Maskbits %s: %d != %d", r.input, maskbits, r.Maskbits)
				}

				if ipv4.Address != r.IPUint32 {
					t.Fatalf("Failed ToUint32() %s: %d != %d", r.input, ipv4.Address, r.IPUint32)
				}

				str = ipv4.AddressBinString()
				if str != r.BinString {
					t.Fatalf("Failed BinString %s: %s != %s", r.input, str, r.BinString)
				}

				str = ipv4.AddressHexString()
				if str != r.HexString {
					t.Fatalf("Failed HexString %s: %s != %s", r.input, str, r.HexString)
				}

				addr = ipv4.Network()
				if addr == nil || addr.NetIP().To4().String() != r.NetworkAddress {
					t.Fatalf("Failed NetworkAddress %s: %s != %s", r.input, addr.NetIP().To4().String(), r.NetworkAddress)
				}

				addr = ipv4.FirstUsable()
				if addr == nil || addr.NetIP().To4().String() != r.FirstUsableAddress {
					t.Fatalf("Failed FirstUsableAddress %s: %s != %s", r.input, addr.NetIP().To4().String(), r.FirstUsableAddress)
				}

				addr = ipv4.LastUsable()
				if addr == nil || addr.NetIP().To4().String() != r.LastUsableAddress {
					t.Fatalf("Failed LastUsableAddress %s: %s != %s", r.input, addr.NetIP().To4().String(), r.LastUsableAddress)
				}
			default:
				t.Fatalf("Unknown result type: %s", r.ResultType)
			}
		})
	}

	badResults := []string{
		"256.0.0.0",
		"0.0.0.0.0",
	}

	for idx, badIP := range badResults {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			sa, err := sockaddr.NewSockAddr(badIP)
			if err == nil {
				t.Fatalf("Failed should have failed to parse %s: %v", badIP, sa)
			}
			if sa != nil {
				t.Fatalf("SockAddr should be nil")
			}
		})
	}

}

func TestSockAddrAttrs(t *testing.T) {
	const expectedNumAttrs = 2
	saa := sockaddr.SockAddrAttrs()
	if len(saa) != expectedNumAttrs {
		t.Fatalf("wrong number of SockAddrAttrs: %d vs %d", len(saa), expectedNumAttrs)
	}

	tests := []struct {
		name string
		sa   sockaddr.SockAddr
		attr sockaddr.AttrName
		want string
	}{
		{
			name: "type",
			sa:   sockaddr.MustIPv4Addr("1.2.3.4"),
			attr: "type",
			want: "IPv4",
		},
		{
			name: "string",
			sa:   sockaddr.MustIPv4Addr("1.2.3.4"),
			attr: "string",
			want: "1.2.3.4",
		},
		{
			name: "invalid",
			sa:   sockaddr.MustIPv4Addr("1.2.3.4"),
			attr: "ENOENT",
			want: "",
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d needs a name", i)
		}

		result := sockaddr.SockAddrAttr(test.sa, test.attr)
		if result != test.want {
			t.Fatalf("%s: expected %s got %s", test.name, test.want, result)
		}
	}
}

func TestToFoo(t *testing.T) {
	tests := []struct {
		name     string
		sa       sockaddr.SockAddr
		passIP   bool
		passIPv4 bool
		passIPv6 bool
		passUnix bool
	}{
		{
			name:     "ipv4",
			sa:       sockaddr.MustIPv4Addr("1.2.3.4"),
			passIP:   true,
			passIPv4: true,
		},
		{
			name:     "ipv6",
			sa:       sockaddr.MustIPv6Addr("::1"),
			passIP:   true,
			passIPv6: true,
		},
		{
			name:     "unix",
			sa:       sockaddr.MustUnixSock("/tmp/foo"),
			passUnix: true,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d must have a name", i)
		}

		switch us := sockaddr.ToUnixSock(test.sa); {
		case us == nil && test.passUnix,
			us != nil && !test.passUnix:
			t.Fatalf("bad")
		}

		switch ip := sockaddr.ToIPAddr(test.sa); {
		case ip == nil && test.passIP,
			ip != nil && !test.passIP:
			t.Fatalf("bad")
		}

		switch ipv4 := sockaddr.ToIPv4Addr(test.sa); {
		case ipv4 == nil && test.passIPv4,
			ipv4 != nil && !test.passIPv4:
			t.Fatalf("bad")
		}

		switch ipv6 := sockaddr.ToIPv6Addr(test.sa); {
		case ipv6 == nil && test.passIPv6,
			ipv6 != nil && !test.passIPv6:
			t.Fatalf("bad")
		}
	}

}

func TestSockAddrMarshaler(t *testing.T) {
	addr := "192.168.10.24/24"
	sa, err := sockaddr.NewSockAddr(addr)
	if err != nil {
		t.Fatal(err)
	}
	sam := &sockaddr.SockAddrMarshaler{
		SockAddr: sa,
	}
	marshaled, err := json.Marshal(sam)
	if err != nil {
		t.Fatal(err)
	}
	sam2 := &sockaddr.SockAddrMarshaler{}
	err = json.Unmarshal(marshaled, sam2)
	if err != nil {
		t.Fatal(err)
	}
	if sam.SockAddr.String() != sam2.SockAddr.String() {
		t.Fatalf("mismatch after marshaling: %s vs %s", sam.SockAddr.String(), sam2.SockAddr.String())
	}
	if sam2.SockAddr.String() != addr {
		t.Fatalf("mismatch after marshaling: %s vs %s", addr, sam2.SockAddr.String())
	}
}

func TestSockAddrMultiMarshaler(t *testing.T) {
	addr := "192.168.10.24/24"
	type d struct {
		Addr  *sockaddr.SockAddrMarshaler
		Addrs []*sockaddr.SockAddrMarshaler
	}
	sa, err := sockaddr.NewSockAddr(addr)
	if err != nil {
		t.Fatal(err)
	}
	myD := &d{
		Addr: &sockaddr.SockAddrMarshaler{SockAddr: sa},
		Addrs: []*sockaddr.SockAddrMarshaler{
			&sockaddr.SockAddrMarshaler{SockAddr: sa},
			&sockaddr.SockAddrMarshaler{SockAddr: sa},
			&sockaddr.SockAddrMarshaler{SockAddr: sa},
		},
	}
	marshaled, err := json.Marshal(myD)
	if err != nil {
		t.Fatal(err)
	}
	var myD2 d
	err = json.Unmarshal(marshaled, &myD2)
	if err != nil {
		t.Fatal(err)
	}
	if myD.Addr.String() != myD2.Addr.String() {
		t.Fatalf("mismatch after marshaling: %s vs %s", myD.Addr.String(), myD2.Addr.String())
	}
	if len(myD.Addrs) != len(myD2.Addrs) {
		t.Fatalf("mismatch after marshaling: %d vs %d", len(myD.Addrs), len(myD2.Addrs))
	}
	for i, v := range myD.Addrs {
		if v.String() != myD2.Addrs[i].String() {
			t.Fatalf("mismatch after marshaling: %s vs %s", v.String(), myD2.Addrs[i].String())
		}
	}
}
