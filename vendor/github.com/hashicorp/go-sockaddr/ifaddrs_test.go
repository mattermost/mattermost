package sockaddr_test

import (
	"fmt"
	"net"
	"reflect"
	"testing"

	sockaddr "github.com/hashicorp/go-sockaddr"
)

const (
	// NOTE(seanc@): Assume "en0" is the interface with a default route attached
	// to it.  When this is not the case, change this one constant and tests
	// should pass (i.e. "net0").
	ifNameWithDefault = "en0"
)

// NOTE: A number of these code paths are exercised in template/ and
// cmd/sockaddr/.
//
// TODO(sean@): Add better coverage for filtering functions (e.g. ExcludeBy*,
// IncludeBy*).

func TestCmpIfAddrFunc(t *testing.T) {
	tests := []struct {
		name       string
		t1         sockaddr.IfAddr // must come before t2 according to the ascOp
		t2         sockaddr.IfAddr
		ascOp      sockaddr.CmpIfAddrFunc
		ascResult  int
		descOp     sockaddr.CmpIfAddrFunc
		descResult int
	}{
		{
			name:       "empty test",
			t1:         sockaddr.IfAddr{},
			t2:         sockaddr.IfAddr{},
			ascOp:      sockaddr.AscIfAddress,
			descOp:     sockaddr.DescIfAddress,
			ascResult:  0,
			descResult: 0,
		},
		{
			name: "ipv4 address less",
			t1: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("1.2.3.3"),
			},
			t2: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
			},
			ascOp:      sockaddr.AscIfAddress,
			descOp:     sockaddr.DescIfAddress,
			ascResult:  -1,
			descResult: -1,
		},
		{
			name: "ipv4 private",
			t1: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("10.1.2.3"),
			},
			t2: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("203.0.113.3"),
			},
			ascOp:      sockaddr.AscIfPrivate,
			descOp:     sockaddr.DescIfPrivate,
			ascResult:  0, // not both private, can't complete the test
			descResult: 0,
		},
		{
			name: "IfAddr name",
			t1: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("10.1.2.3"),
				Interface: net.Interface{
					Name: "abc0",
				},
			},
			t2: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("203.0.113.3"),
				Interface: net.Interface{
					Name: "xyz0",
				},
			},
			ascOp:      sockaddr.AscIfName,
			descOp:     sockaddr.DescIfName,
			ascResult:  -1,
			descResult: -1,
		},
		{
			name: "IfAddr network size",
			t1: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("10.0.0.0/8"),
			},
			t2: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.0/24"),
			},
			ascOp:      sockaddr.AscIfNetworkSize,
			descOp:     sockaddr.DescIfNetworkSize,
			ascResult:  -1,
			descResult: -1,
		},
		{
			name: "IfAddr port",
			t1: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("10.0.0.0:80"),
			},
			t2: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.0:8600"),
			},
			ascOp:      sockaddr.AscIfPort,
			descOp:     sockaddr.DescIfPort,
			ascResult:  -1,
			descResult: -1,
		},
		{
			name: "IfAddr type",
			t1: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("10.0.0.0:80"),
			},
			t2: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("[::1]:80"),
			},
			ascOp:      sockaddr.AscIfType,
			descOp:     sockaddr.DescIfType,
			ascResult:  -1,
			descResult: -1,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d must have a name", i)
		}

		// Test ascending operation
		ascExpected := test.ascResult
		ascResult := test.ascOp(&test.t1, &test.t2)
		if ascResult != ascExpected {
			t.Errorf("%s: Unexpected result %d, expected %d when comparing %v and %v using %v", test.name, ascResult, ascExpected, test.t1, test.t2, test.ascOp)
		}

		// Test descending operation
		descExpected := test.descResult
		descResult := test.descOp(&test.t2, &test.t1)
		if descResult != descExpected {
			t.Errorf("%s: Unexpected result %d, expected %d when comparing %v and %v using %v", test.name, descResult, descExpected, test.t1, test.t2, test.descOp)
		}

		if ascResult != descResult {
			t.Fatalf("bad")
		}

		// Reverse the args
		ascExpected = -1 * test.ascResult
		ascResult = test.ascOp(&test.t2, &test.t1)
		if ascResult != ascExpected {
			t.Errorf("%s: Unexpected result %d, expected %d when comparing %v and %v using %v", test.name, ascResult, ascExpected, test.t1, test.t2, test.ascOp)
		}

		descExpected = -1 * test.descResult
		descResult = test.descOp(&test.t1, &test.t2)
		if descResult != descExpected {
			t.Errorf("%s: Unexpected result %d, expected %d when comparing %v and %v using %v", test.name, descResult, descExpected, test.t1, test.t2, test.descOp)
		}

		if ascResult != descResult {
			t.Fatalf("bad")
		}

		// Test equality
		ascExpected = 0
		ascResult = test.ascOp(&test.t1, &test.t1)
		if ascResult != ascExpected {
			t.Errorf("%s: Unexpected result %d, expected %d when comparing %v and %v using %v", test.name, ascResult, ascExpected, test.t1, test.t2, test.ascOp)
		}

		descExpected = 0
		descResult = test.descOp(&test.t1, &test.t1)
		if descResult != descExpected {
			t.Errorf("%s: Unexpected result %d, expected %d when comparing %v and %v using %v", test.name, descResult, descExpected, test.t1, test.t2, test.descOp)
		}
	}
}

func TestFilterIfByFlags(t *testing.T) {
	tests := []struct {
		name     string
		selector string
		ifAddrs  sockaddr.IfAddrs
		flags    net.Flags
		fail     bool
	}{
		{
			name:     "broadcast",
			selector: "broadcast",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagBroadcast,
					},
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.1"),
				},
			},
		},
		{
			name:     "down",
			selector: "down",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.2"),
				},
			},
		},
		{
			name:     "forwardable IPv4",
			selector: "forwardable",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.3"),
				},
			},
		},
		{
			name:     "forwardable IPv6",
			selector: "forwardable",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv6Addr("cc::1/128"),
				},
			},
		},
		{
			name:     "global unicast",
			selector: "global unicast",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv6Addr("cc::2"),
				},
			},
		},
		{
			name:     "interface-local multicast",
			selector: "interface-local multicast",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv6Addr("ff01::2"),
				},
			},
		},
		{
			name:     "link-local multicast",
			selector: "link-local multicast",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv6Addr("ff02::3"),
				},
			},
		},
		{
			name:     "link-local unicast IPv4",
			selector: "link-local unicast",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv4Addr("169.254.1.101"),
				},
			},
		},
		{
			name:     "link-local unicast IPv6",
			selector: "link-local unicast",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv6Addr("fe80::3"),
				},
			},
		},
		{
			name:     "loopback ipv4",
			selector: "loopback",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagLoopback,
					},
					SockAddr: sockaddr.MustIPv4Addr("127.0.0.1"),
				},
			},
		},
		{
			name:     "loopback ipv6",
			selector: "loopback",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagLoopback,
					},
					SockAddr: sockaddr.MustIPv6Addr("::1"),
				},
			},
		},
		{
			name:     "multicast IPv4",
			selector: "multicast",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagMulticast,
					},
					SockAddr: sockaddr.MustIPv4Addr("224.0.0.1"),
				},
			},
		},
		{
			name:     "multicast IPv6",
			selector: "multicast",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagMulticast,
					},
					SockAddr: sockaddr.MustIPv6Addr("ff05::3"),
				},
			},
		},
		{
			name:     "point-to-point",
			selector: "point-to-point",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagPointToPoint,
					},
					SockAddr: sockaddr.MustIPv6Addr("cc::3"),
				},
			},
		},
		{
			name:     "unspecified",
			selector: "unspecified",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv6Addr("::"),
				},
			},
		},
		{
			name:     "up",
			selector: "up",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagUp,
					},
					SockAddr: sockaddr.MustIPv6Addr("cc::3"),
				},
			},
		},
		{
			name:     "invalid",
			selector: "foo",
			fail:     true,
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{},
					SockAddr:  sockaddr.MustIPv6Addr("cc::3"),
				},
			},
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d needs a name", i)
		}

		t.Run(test.name, func(t *testing.T) {
			in, out, err := sockaddr.IfByFlag(test.selector, test.ifAddrs)
			if test.fail == true && err == nil {
				t.Fatalf("%s: expected failure", test.name)
			} else if test.fail == true && err != nil {
				return
			}

			if err != nil && test.fail != true {
				t.Fatalf("%s: failed: %v", test.name, err)
			}
			if ilen := len(in); ilen != 1 {
				t.Fatalf("%s: wrong in length %d, expected 1", test.name, ilen)
			}
			if olen := len(out); olen != 0 {
				t.Fatalf("%s: wrong in length %d, expected 0", test.name, olen)
			}
		})
	}
}

func TestIfByNetwork(t *testing.T) {
	tests := []struct {
		name     string
		input    sockaddr.IfAddrs
		selector string
		matched  sockaddr.IfAddrs
		excluded sockaddr.IfAddrs
		fail     bool
	}{
		{
			name: "exact match",
			input: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
			},
			selector: "1.2.3.4",
			matched: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
			},
		},
		{
			name: "exact match plural",
			input: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.0/24"),
				},
			},
			selector: "1.2.3.0/24",
			matched: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.0/24"),
				},
			},
		},
		{
			name: "split plural",
			input: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("12.2.3.0/24"),
				},
			},
			selector: "1.2.3.0/24",
			excluded: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("12.2.3.0/24"),
				},
			},
			matched: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
			},
		},
		{
			name: "excluded plural",
			input: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("12.2.3.0/24"),
				},
			},
			selector: "10.0.0.0/8",
			excluded: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("12.2.3.0/24"),
				},
			},
		},
		{
			name: "invalid selector",
			input: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("12.2.3.0/24"),
				},
			},
			selector: "[:]",
			fail:     true,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d needs a name", i)
		}

		t.Run(test.name, func(t *testing.T) {
			matched, excluded, err := sockaddr.IfByNetwork(test.selector, test.input)
			if err != nil && !test.fail {
				t.Fatal("bad")
			} else if err == nil && test.fail {
				t.Fatal("bad")
			}

			if len(test.matched) != len(matched) {
				t.Fatal("bad")
			} else if len(test.excluded) != len(excluded) {
				t.Fatal("bad")
			}

			for i := 0; i < len(test.excluded); i++ {
				if !reflect.DeepEqual(test.excluded[i], excluded[i]) {
					t.Errorf("wrong excluded: %d %v %v", i, test.excluded[i], excluded[i])
				}
			}

			for i := 0; i < len(test.matched); i++ {
				if !reflect.DeepEqual(test.matched[i], matched[i]) {
					t.Errorf("wrong matched: %d %v %v", i, test.matched[i], matched[i])
				}
			}
		})
	}
}

func TestFilterIfByType(t *testing.T) {
	tests := []struct {
		name         string
		ifAddrs      sockaddr.IfAddrs
		ifAddrType   sockaddr.SockAddrType
		matchedLen   int
		remainingLen int
	}{
		{
			name: "include all",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("2.3.4.5"),
				},
			},
			ifAddrType:   sockaddr.TypeIPv4,
			matchedLen:   2,
			remainingLen: 0,
		},
		{
			name: "include some",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv6Addr("::1"),
				},
			},
			ifAddrType:   sockaddr.TypeIPv4,
			matchedLen:   1,
			remainingLen: 1,
		},
		{
			name: "exclude all",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.5"),
				},
			},
			ifAddrType:   sockaddr.TypeIPv6,
			matchedLen:   0,
			remainingLen: 2,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d needs a name", i)
		}

		in, out := sockaddr.FilterIfByType(test.ifAddrs, test.ifAddrType)
		if len(in) != test.matchedLen {
			t.Fatalf("%s: wrong length %d, expected %d", test.name, len(in), test.matchedLen)
		}

		if len(out) != test.remainingLen {
			t.Fatalf("%s: wrong length %d, expected %d", test.name, len(out), test.remainingLen)
		}
	}
}

// TestGetIfAddrs runs through the motions of calling sockaddr.GetIfAddrs(), but
// doesn't do much in the way of testing beyond verifying that `lo0` has a
// loopback address present.
func TestGetIfAddrs(t *testing.T) {
	ifAddrs, err := sockaddr.GetAllInterfaces()
	if err != nil {
		t.Fatalf("Unable to proceed: %v", err)
	}
	if len(ifAddrs) == 0 {
		t.Skip()
	}

	var loInt *sockaddr.IfAddr
	for _, ifAddr := range ifAddrs {
		val := sockaddr.IfAddrAttr(ifAddr, "name")
		if val == "" {
			t.Fatalf("name failed")
		} else if val == "lo0" || val == "lo" || val == "Loopback Pseudo-Interface 1" {
			loInt = &ifAddr
			break
		}
	}
	if loInt == nil {
		t.Fatalf("No loopback interfaces found, loInt nil")
	}

	if val := sockaddr.IfAddrAttr(*loInt, "flags"); !(val == "up|loopback|multicast" || val == "up|loopback") {
		t.Fatalf("expected different flags from loopback: %q", val)
	}

	if loInt == nil {
		t.Fatalf("Expected to find an lo0 interface, didn't find any")
	}

	haveIPv4, foundIPv4lo := false, false
	haveIPv6, foundIPv6lo := false, false
	switch loInt.SockAddr.(type) {
	case sockaddr.IPv4Addr:
		haveIPv4 = true

		// Make the semi-brittle assumption that if we have
		// IPv4, we also have an address at 127.0.0.1 available
		// to us.
		if loInt.SockAddr.String() == "127.0.0.1/8" {
			foundIPv4lo = true
		}
	case sockaddr.IPv6Addr:
		haveIPv6 = true
		if loInt.SockAddr.String() == "::1" {
			foundIPv6lo = true
		}
	default:
		t.Fatalf("Unsupported type %v for address %v", loInt.Type(), loInt)
	}

	// While not wise, it's entirely possible a host doesn't have IPv4
	// enabled.
	if haveIPv4 && !foundIPv4lo {
		t.Fatalf("Had an IPv4 w/o an expected IPv4 loopback addresses")
	}

	// While prudent to run without, a sane environment may still contain an
	// IPv6 loopback address.
	if haveIPv6 && !foundIPv6lo {
		t.Fatalf("Had an IPv6 w/o an expected IPv6 loopback addresses")
	}
}

// TestGetDefaultIfName tests to make sure a default interface name is always
// returned from getDefaultIfName().
func TestGetDefaultInterface(t *testing.T) {
	reportOnDefault := func(args ...interface{}) {
		if havePublicIP() || havePrivateIP() {
			t.Fatalf(args[0].(string), args[1:]...)
		} else {
			t.Skipf(args[0].(string), args[1:]...)
		}
	}

	ifAddrs, err := sockaddr.GetDefaultInterfaces()
	if err != nil {
		switch {
		case len(ifAddrs) == 0:
			reportOnDefault("bad: %v", err)
		case ifAddrs[0].Flags&net.FlagUp == 0:
			reportOnDefault("bad: %v", err)
		default:
			reportOnDefault("bad: %v", err)
		}
	}
}

func TestIfAddrAttrs(t *testing.T) {
	const expectedNumAttrs = 2
	attrs := sockaddr.IfAddrAttrs()
	if len(attrs) != expectedNumAttrs {
		t.Fatalf("wrong number of attrs")
	}

	tests := []struct {
		name     string
		ifAddr   sockaddr.IfAddr
		attr     string
		expected string
	}{
		{
			name: "name",
			ifAddr: sockaddr.IfAddr{
				Interface: net.Interface{
					Name: "abc0",
				},
			},
			attr:     "name",
			expected: "abc0",
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d must have a name", i)
		}

		result, err := sockaddr.IfAttrs(test.attr, sockaddr.IfAddrs{test.ifAddr})
		if err != nil {
			t.Errorf("failed to get attr %q from %v", test.name, test.ifAddr)
		}

		if result != test.expected {
			t.Errorf("unexpected result")
		}
	}

	// Test an empty array
	result, err := sockaddr.IfAttrs("name", sockaddr.IfAddrs{})
	if err != nil {
		t.Error(`failed to get attr "name" from an empty array`)
	}

	if result != "" {
		t.Errorf("unexpected result")
	}
}

func TestGetAllInterfaces(t *testing.T) {
	ifAddrs, err := sockaddr.GetAllInterfaces()
	if err != nil {
		t.Fatalf("unable to gather interfaces: %v", err)
	}

	initialLen := len(ifAddrs)
	if initialLen == 0 {
		t.Fatalf("no interfaces available")
	}

	ifAddrs, err = sockaddr.SortIfBy("name,type,port,size,address", ifAddrs)
	if err != nil {
		t.Fatalf("unable to initially sort address")
	}

	ascSorted, err := sockaddr.SortIfBy("name,type,port,size,address", ifAddrs)
	if err != nil {
		t.Fatalf("unable to asc sort address")
	}

	descSorted, err := sockaddr.SortIfBy("name,type,port,size,-address", ascSorted)
	if err != nil {
		t.Fatalf("unable to desc sort address")
	}

	if initialLen != len(ascSorted) && len(ascSorted) != len(descSorted) {
		t.Fatalf("wrong len")
	}

	for i := initialLen - 1; i >= 0; i-- {
		if !reflect.DeepEqual(descSorted[i], ifAddrs[i]) {
			t.Errorf("wrong sort order: %d %v %v", i, descSorted[i], ifAddrs[i])
		}
	}
}

func TestGetDefaultInterfaces(t *testing.T) {
	reportOnDefault := func(args ...interface{}) {
		if havePublicIP() || havePrivateIP() {
			t.Fatalf(args[0].(string), args[1:]...)
		} else {
			t.Skipf(args[0].(string), args[1:]...)
		}
	}

	ifAddrs, err := sockaddr.GetDefaultInterfaces()
	if err != nil {
		reportOnDefault("unable to gather default interfaces: %v", err)
	}

	if len(ifAddrs) == 0 {
		reportOnDefault("no default interfaces available", nil)
	}
}

func TestGetPrivateInterfaces(t *testing.T) {
	reportOnPrivate := func(args ...interface{}) {
		if havePrivateIP() {
			t.Fatalf(args[0].(string), args[1:]...)
		} else {
			t.Skipf(args[0].(string), args[1:]...)
		}
	}

	ifAddrs, err := sockaddr.GetPrivateInterfaces()
	if err != nil {
		reportOnPrivate("failed: %v", err)
	}

	if len(ifAddrs) == 0 {
		reportOnPrivate("no public IPs found")
	}

	if len(ifAddrs[0].String()) == 0 {
		reportOnPrivate("no string representation of private IP found")
	}
}

func TestGetPublicInterfaces(t *testing.T) {
	reportOnPublic := func(args ...interface{}) {
		if havePublicIP() {
			t.Fatalf(args[0].(string), args[1:]...)
		} else {
			t.Skipf(args[0].(string), args[1:]...)
		}
	}

	ifAddrs, err := sockaddr.GetPublicInterfaces()
	if err != nil {
		reportOnPublic("failed: %v", err)
	}

	if len(ifAddrs) == 0 {
		reportOnPublic("no public IPs found")
	}
}

func TestIncludeExcludeIfs(t *testing.T) {
	tests := []struct {
		name         string
		ifAddrs      sockaddr.IfAddrs
		fail         bool
		excludeNum   int
		excludeName  string
		excludeParam string
		includeName  string
		includeParam string
		includeNum   int
	}{
		{
			name: "address",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("2.3.4.5"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("3.4.5.6"),
				},
			},
			excludeName:  "address",
			excludeNum:   2,
			excludeParam: `^1\..*\.4$`,
			includeName:  "address",
			includeNum:   1,
			includeParam: `^1\.2\.3\.`,
		},
		{
			name:         "address invalid",
			fail:         true,
			excludeName:  "address",
			excludeNum:   0,
			excludeParam: `*`,
			includeName:  "address",
			includeNum:   0,
			includeParam: `[`,
		},
		{
			name: "flag",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagUp | net.FlagLoopback,
					},
				},
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagLoopback,
					},
				},
				sockaddr.IfAddr{
					Interface: net.Interface{
						Flags: net.FlagMulticast,
					},
				},
			},
			excludeName:  "flags",
			excludeNum:   2,
			excludeParam: `up|loopback`,
			includeName:  "flags",
			includeNum:   2,
			includeParam: `loopback`,
		},
		{
			name:         "flag invalid",
			fail:         true,
			excludeName:  "foo",
			excludeNum:   0,
			excludeParam: `*`,
			includeName:  "bar",
			includeNum:   0,
			includeParam: `[`,
		},
		{
			name: "name",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					Interface: net.Interface{
						Name: "abc0",
					},
				},
				sockaddr.IfAddr{
					Interface: net.Interface{
						Name: "xyz0",
					},
				},
				sockaddr.IfAddr{
					Interface: net.Interface{
						Name: "docker666",
					},
				},
			},
			excludeName:  "name",
			excludeNum:   2,
			excludeParam: `^docker[\d]+$`,
			includeName:  "name",
			includeNum:   2,
			includeParam: `^([a-z]+)0$`,
		},
		{
			name:         "name invalid",
			fail:         true,
			excludeName:  "name",
			excludeNum:   0,
			excludeParam: `*`,
			includeName:  "name",
			includeNum:   0,
			includeParam: `[`,
		},
		{
			name: "network",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("10.2.3.4/24"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("10.255.255.4/24"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("::1"),
				},
			},
			excludeName:  "network",
			excludeNum:   1,
			excludeParam: `10.0.0.0/8`,
			includeName:  "network",
			includeNum:   1,
			includeParam: `::/127`,
		},
		{
			name: "port",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:8600"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("2.3.4.5:4646"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("3.4.5.6:4647"),
				},
			},
			excludeName:  "port",
			excludeNum:   2,
			excludeParam: `0$`,
			includeName:  "port",
			includeNum:   2,
			includeParam: `^46[\d]{2}$`,
		},
		{
			name:         "port invalid",
			fail:         true,
			excludeName:  "port",
			excludeNum:   0,
			excludeParam: `*`,
			includeName:  "port",
			includeNum:   0,
			includeParam: `[`,
		},
		{
			name: "rfc",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("10.2.3.4/24"),
				},
				sockaddr.IfAddr{
					// Excluded (/127 vs /128)
					SockAddr: sockaddr.MustIPv6Addr("::1/127"),
				},
				sockaddr.IfAddr{
					// Excluded (/127 vs /128)
					SockAddr: sockaddr.MustIPv6Addr("::/127"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("203.0.113.0/24"),
				},
			},
			excludeName:  "rfc",
			excludeNum:   2,
			excludeParam: `6890`,
			includeName:  "rfc",
			includeNum:   1,
			includeParam: `3330`,
		},
		{
			name:         "rfc invalid",
			fail:         true,
			excludeName:  "rfc",
			excludeNum:   0,
			excludeParam: `rfcOneTwoThree`,
			includeName:  "rfc",
			includeNum:   0,
			includeParam: `99999999999999`,
		},
		{
			name: "rfc IPv4 exclude",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("192.169.1.1"),
				},
			},
			excludeName:  "rfc",
			excludeNum:   1,
			excludeParam: `1918`,
			includeName:  "rfc",
			includeNum:   0,
			includeParam: `1918`,
		},
		{
			name: "rfc IPv4 include",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("192.168.1.1"),
				},
			},
			excludeName:  "rfc",
			excludeNum:   0,
			excludeParam: `1918`,
			includeName:  "rfc",
			includeNum:   1,
			includeParam: `1918`,
		},
		{
			name: "rfc IPv4 excluded RFCs",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("192.168.1.1"),
				},
			},
			excludeName:  "rfc",
			excludeNum:   1,
			excludeParam: `4291`,
			includeName:  "rfc",
			includeNum:   0,
			includeParam: `4291`,
		},
		{
			name: "rfc IPv6 exclude",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv6Addr("cc::1/127"),
				},
			},
			excludeName:  "rfc",
			excludeNum:   1,
			excludeParam: `4291`,
			includeName:  "rfc",
			includeNum:   0,
			includeParam: `4291`,
		},
		{
			name: "rfc IPv6 include",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv6Addr("::1/127"),
				},
			},
			excludeName:  "rfc",
			excludeNum:   0,
			excludeParam: `4291`,
			includeName:  "rfc",
			includeNum:   1,
			includeParam: `4291`,
		},
		{
			name: "rfc zero match",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("1.2.3.4"),
				},
			},
			excludeName:  "rfc",
			excludeNum:   1,
			excludeParam: `1918`,
			includeName:  "rfc",
			includeNum:   0,
			includeParam: `1918`,
		},
		{
			name:         "rfc empty list",
			ifAddrs:      sockaddr.IfAddrs{},
			excludeName:  "rfc",
			excludeNum:   0,
			excludeParam: `4291`,
			includeName:  "rfc",
			includeNum:   0,
			includeParam: `1918`,
		},
		{
			name: "size",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("10.2.3.4/24"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("203.0.113.0/24"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv6Addr("::1/24"),
				},
			},
			excludeName:  "size",
			excludeParam: `24`,
			excludeNum:   0,
			includeName:  "size",
			includeParam: `24`,
			includeNum:   3,
		},
		{
			name: "size invalid",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("10.2.3.4/24"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv6Addr("::1/128"),
				},
			},
			fail:         true,
			excludeName:  "size",
			excludeParam: `33`,
			excludeNum:   0,
			includeName:  "size",
			includeParam: `-1`,
			includeNum:   0,
		},
		{
			name: "type",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("10.2.3.4/24"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("203.0.113.0/24"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv6Addr("::1/127"),
				},
			},
			excludeName:  "type",
			excludeParam: `ipv6`,
			excludeNum:   2,
			includeName:  "type",
			includeParam: `ipv4`,
			includeNum:   2,
		},
		{
			name: "type",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPv4Addr("10.2.3.4/24"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("::1"),
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustUnixSock("/tmp/foo"),
				},
			},
			excludeName:  "type",
			excludeParam: `ip`,
			excludeNum:   1,
			includeName:  "type",
			includeParam: `unix`,
			includeNum:   1,
		},
		{
			name:         "type invalid arg",
			fail:         true,
			excludeName:  "type",
			excludeParam: `*`,
			excludeNum:   0,
			includeName:  "type",
			includeParam: `[`,
			includeNum:   0,
		},
		{
			name:         "type invalid",
			fail:         true,
			excludeName:  "foo",
			excludeParam: `bar`,
			excludeNum:   0,
			includeName:  "baz",
			includeParam: `bur`,
			includeNum:   0,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d must have a name", i)
		}
		t.Run(fmt.Sprintf("%s-%s", test.name, "include"), func(t *testing.T) {
			t.Logf("test.ifAddrs: %v", test.ifAddrs)
			inIfAddrs, err := sockaddr.IncludeIfs(test.includeName, test.includeParam, test.ifAddrs)
			t.Logf("inIfAddrs: %v", inIfAddrs)

			switch {
			case !test.fail && err != nil:
				t.Errorf("%s: failed unexpectedly: %v", test.name, err)
			case test.fail && err == nil:
				t.Errorf("%s: failed to throw an error", test.name)
			case test.fail && err != nil:
				// expected test failure
				return
			}

			if len(inIfAddrs) != test.includeNum {
				t.Errorf("%s: failed include length check. Expected %d, got %d. Input: %q", test.name, test.includeNum, len(inIfAddrs), test.includeParam)
			}
		})

		t.Run(fmt.Sprintf("%s-%s", test.name, "exclude"), func(t *testing.T) {
			t.Logf("test.ifAddrs: %v", test.ifAddrs)
			outIfAddrs, err := sockaddr.ExcludeIfs(test.excludeName, test.excludeParam, test.ifAddrs)
			t.Logf("outIfAddrs: %v", outIfAddrs)

			switch {
			case !test.fail && err != nil:
				t.Errorf("%s: failed unexpectedly: %v", test.name, err)
			case test.fail && err == nil:
				t.Errorf("%s: failed to throw an error", test.name)
			case test.fail && err != nil:
				// expected test failure
				return
			}

			if len(outIfAddrs) != test.excludeNum {
				t.Errorf("%s: failed exclude length check. Expected %d, got %d. Input: %q", test.name, test.excludeNum, len(outIfAddrs), test.excludeParam)
			}
		})
	}
}

func TestNewIPAddr(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		output string
		pass   bool
	}{
		{
			name:   "ipv4",
			input:  "1.2.3.4",
			output: "1.2.3.4",
			pass:   true,
		},
		{
			name:   "ipv6",
			input:  "::1",
			output: "::1",
			pass:   true,
		},
		{
			name:   "invalid",
			input:  "255.255.255.256",
			output: "",
			pass:   false,
		},
	}

	for _, test := range tests {
		ip, err := sockaddr.NewIPAddr(test.input)
		switch {
		case err == nil && test.pass,
			err != nil && !test.pass:

		default:
			t.Errorf("expected %s's success to be %t", test.input, test.pass)
		}

		if !test.pass {
			continue
		}

		if ip.String() != test.output {
			t.Errorf("Expected %q to match %q", ip.String(), test.output)
		}

	}
}

func TestIPAttrs(t *testing.T) {
	const expectedIPAttrs = 11
	ipAttrs := sockaddr.IPAttrs()
	if len(ipAttrs) != expectedIPAttrs {
		t.Fatalf("wrong number of args")
	}
}

func TestUniqueIfAddrsBy(t *testing.T) {
	tests := []struct {
		name     string
		ifAddrs  sockaddr.IfAddrs
		fail     bool
		selector string
		expected []string
	}{
		{
			name: "address",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("203.0.113.0/24"),
					Interface: net.Interface{
						Name: "abc0",
					},
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("203.0.113.0/24"),
					Interface: net.Interface{
						Name: "abc0",
					},
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("10.2.3.4"),
					Interface: net.Interface{
						Name: "foo1",
					},
				},
			},
			selector: "address",
			expected: []string{"203.0.113.0/24 {0 0 abc0  0}", "10.2.3.4 {0 0 foo1  0}"},
		},
		{
			name: "name",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("::1"),
					Interface: net.Interface{
						Name: "lo0",
					},
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("fe80::1"),
					Interface: net.Interface{
						Name: "lo0",
					},
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("127.0.0.1"),
					Interface: net.Interface{
						Name: "foo1",
					},
				},
			},
			selector: "name",
			expected: []string{"::1 {0 0 lo0  0}", "127.0.0.1 {0 0 foo1  0}"},
		},
		{
			name: "invalid",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{},
			},
			fail:     true,
			selector: "goozfraba",
			expected: []string{},
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d must have a name", i)
		}
		t.Run(test.name, func(t *testing.T) {

			uniqueAddrs, err := sockaddr.UniqueIfAddrsBy(test.selector, test.ifAddrs)
			switch {
			case !test.fail && err != nil:
				t.Fatalf("%s: failed unexpectedly: %v", test.name, err)
			case test.fail && err == nil:
				t.Fatalf("%s: failed to throw an error", test.name)
			case test.fail && err != nil:
				// expected test failure
				return
			}

			if len(uniqueAddrs) != len(test.expected) {
				t.Fatalf("%s: failed uniquify by attribute %s", test.name, test.selector)
			}

			for i := 0; i < len(uniqueAddrs); i++ {
				got := uniqueAddrs[i].String()
				if got != test.expected[i] {
					t.Fatalf("%s: expected %q got %q", test.name, test.expected[i], got)
				}
			}

		})
	}
}

func TestJoinIfAddrsBy(t *testing.T) {
	tests := []struct {
		name     string
		ifAddrs  sockaddr.IfAddrs
		fail     bool
		selector string
		joinStr  string
		expected string
	}{
		{
			name: "address",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("203.0.113.0/24"),
					Interface: net.Interface{
						Name: "abc0",
					},
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("203.0.113.1"),
					Interface: net.Interface{
						Name: "abc0",
					},
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("10.2.3.4"),
					Interface: net.Interface{
						Name: "foo1",
					},
				},
			},
			selector: "address",
			joinStr:  " ",
			expected: "203.0.113.0 203.0.113.1 10.2.3.4",
		},
		{
			name: "name",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("::1"),
					Interface: net.Interface{
						Name: "lo0",
					},
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("fe80::1"),
					Interface: net.Interface{
						Name: "foo0",
					},
				},
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("127.0.0.1"),
					Interface: net.Interface{
						Name: "bar2",
					},
				},
			},
			selector: "name",
			joinStr:  "-/-",
			expected: "lo0-/-foo0-/-bar2",
		},
		{
			name: "invalid",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr: sockaddr.MustIPAddr("127.0.0.1"),
					Interface: net.Interface{
						Name: "bar2",
					},
				},
			},
			fail:     true,
			selector: "goozfraba",
			expected: "",
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d must have a name", i)
		}
		t.Run(test.name, func(t *testing.T) {

			result, err := sockaddr.JoinIfAddrs(test.selector, test.joinStr, test.ifAddrs)
			switch {
			case !test.fail && err != nil:
				t.Fatalf("%s: failed unexpectedly: %v", test.name, err)
			case test.fail && err == nil:
				t.Fatalf("%s: failed to throw an error", test.name)
			case test.fail && err != nil:
				// expected test failure
				return
			}

			if result != test.expected {
				t.Fatalf("%s: expected %q got %q", test.name, test.expected, result)
			}

		})
	}
}

func TestLimitOffset(t *testing.T) {
	tests := []struct {
		name     string
		ifAddrs  sockaddr.IfAddrs
		limit    uint
		offset   int
		fail     bool
		expected sockaddr.IfAddrs
	}{
		{
			name: "basic limit offset",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.0/24")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.2")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.3")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.4")},
			},
			limit:  2,
			offset: 1,
			expected: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.2")},
			},
		},
		{
			name: "negative offset with limit",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.0/24")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.2")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.3")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.4")},
			},
			limit:  2,
			offset: -3,
			expected: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.2")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.3")},
			},
		},
		{
			name: "large limit",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.0/24")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.2")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.3")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.4")},
			},
			limit:  100,
			offset: 3,
			expected: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.3")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.4")},
			},
		},
		{
			name: "bigger offset than size",
			ifAddrs: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.0/24")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPAddr("203.0.113.1")},
			},
			fail:   true,
			limit:  1,
			offset: 3,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d must have a name", i)
		}
		t.Run(test.name, func(t *testing.T) {

			offsetResults, err := sockaddr.OffsetIfAddrs(test.offset, test.ifAddrs)
			switch {
			case !test.fail && err != nil:
				t.Fatalf("%s: failed unexpectedly: %v", test.name, err)
			case test.fail && err == nil:
				t.Fatalf("%s: failed to throw an error", test.name)
			case test.fail && err != nil:
				// expected test failure
				return
			}

			limitResults, err := sockaddr.LimitIfAddrs(test.limit, offsetResults)
			switch {
			case !test.fail && err != nil:
				t.Fatalf("%s: failed unexpectedly: %v", test.name, err)
			case test.fail && err == nil:
				t.Fatalf("%s: failed to throw an error", test.name)
			case test.fail && err != nil:
				// expected test failure
				return
			}

			if len(test.expected) != len(limitResults) {
				t.Fatalf("bad")
			}

			for i := 0; i < len(test.expected); i++ {
				if !reflect.DeepEqual(limitResults[i], test.expected[i]) {
					t.Errorf("objects in ordered limit")
				}
			}
		})
	}
}

func TestSortIfBy(t *testing.T) {
	tests := []struct {
		name    string
		sortStr string
		in      sockaddr.IfAddrs
		out     sockaddr.IfAddrs
		fail    bool
	}{
		{
			name:    "sort address",
			sortStr: "address",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.3")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.3")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4")},
			},
		},
		{
			name:    "sort +address",
			sortStr: "+address",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.3")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.3")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4")},
			},
		},
		{
			name:    "sort -address",
			sortStr: "-address",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.3")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.3")},
			},
		},
		{
			// NOTE(seanc@): This test requires macOS, or at least a computer where
			// en0 has the default route.
			name:    "sort default",
			sortStr: "default",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.4"),
					Interface: net.Interface{Name: ifNameWithDefault},
				},
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.3"),
					Interface: net.Interface{Name: "other0"},
				},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.4"),
					Interface: net.Interface{Name: ifNameWithDefault},
				},
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.3"),
					Interface: net.Interface{Name: "other0"},
				},
			},
		},
		{
			// NOTE(seanc@): This test requires macOS, or at least a computer where
			// en0 has the default route.
			name:    "sort +default",
			sortStr: "+default",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.4"),
					Interface: net.Interface{Name: "other0"},
				},
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.3"),
					Interface: net.Interface{Name: ifNameWithDefault},
				},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.3"),
					Interface: net.Interface{Name: ifNameWithDefault},
				},
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.4"),
					Interface: net.Interface{Name: "other0"},
				},
			},
		},
		{
			name:    "sort -default",
			sortStr: "-default",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.3"),
					Interface: net.Interface{Name: ifNameWithDefault},
				},
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.4"),
					Interface: net.Interface{Name: "other0"},
				},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.4"),
					Interface: net.Interface{Name: "other0"},
				},
				sockaddr.IfAddr{
					SockAddr:  sockaddr.MustIPv4Addr("1.2.3.3"),
					Interface: net.Interface{Name: ifNameWithDefault},
				},
			},
		},
		{
			name:    "sort name",
			sortStr: "name",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{Interface: net.Interface{Name: "foo"}},
				sockaddr.IfAddr{Interface: net.Interface{Name: "bar"}},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{Interface: net.Interface{Name: "bar"}},
				sockaddr.IfAddr{Interface: net.Interface{Name: "foo"}},
			},
		},
		{
			name:    "sort +name",
			sortStr: "+name",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{Interface: net.Interface{Name: "foo"}},
				sockaddr.IfAddr{Interface: net.Interface{Name: "bar"}},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{Interface: net.Interface{Name: "bar"}},
				sockaddr.IfAddr{Interface: net.Interface{Name: "foo"}},
			},
		},
		{
			name:    "sort -name",
			sortStr: "-name",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{Interface: net.Interface{Name: "bar"}},
				sockaddr.IfAddr{Interface: net.Interface{Name: "foo"}},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{Interface: net.Interface{Name: "foo"}},
				sockaddr.IfAddr{Interface: net.Interface{Name: "bar"}},
			},
		},
		{
			name:    "sort port",
			sortStr: "port",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("[::1]:53")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("[::1]:53")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
		},
		{
			name:    "sort +port",
			sortStr: "+port",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("[::1]:53")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("[::1]:53")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
		},
		{
			name:    "sort -port",
			sortStr: "-port",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("[::1]:53")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("[::1]:53")},
			},
		},
		{
			name:    "sort private",
			sortStr: "private",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
		},
		{
			name:    "sort +private",
			sortStr: "+private",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
		},
		{
			name:    "sort -private",
			sortStr: "-private",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1")},
			},
		},
		{
			name:    "sort size",
			sortStr: "size",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
		},
		{
			name:    "sort +size",
			sortStr: "+size",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
		},
		{
			name:    "sort -size",
			sortStr: "-size",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
			},
		},
		{
			name:    "sort type",
			sortStr: "type",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("::1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("::1")},
			},
		},
		{
			name:    "sort +type",
			sortStr: "+type",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("::1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("192.168.1.1/27")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("::1")},
			},
		},
		{
			name:    "sort -type",
			sortStr: "-type",
			in: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("::1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
			out: sockaddr.IfAddrs{
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv6Addr("::1")},
				sockaddr.IfAddr{SockAddr: sockaddr.MustIPv4Addr("1.2.3.4:80")},
			},
		},
		{
			name:    "sort invalid",
			sortStr: "ENOENT",
			fail:    true,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d needs a name", i)
		}

		t.Run(test.name, func(t *testing.T) {
			sorted, err := sockaddr.SortIfBy(test.sortStr, test.in)
			if err != nil && !test.fail {
				t.Fatalf("%s: sort failed: %v", test.name, err)
			}

			if len(test.in) != len(sorted) {
				t.Fatalf("wrong len")
			}

			for i := 0; i < len(sorted); i++ {
				if !reflect.DeepEqual(sorted[i], test.out[i]) {
					t.Errorf("wrong sort order: %d %v %v", i, sorted[i], test.out[i])
				}
			}
		})
	}
}
