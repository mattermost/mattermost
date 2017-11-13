package sockaddr_test

import (
	"fmt"
	"net"
	"os"
	"strings"
	"testing"

	sockaddr "github.com/hashicorp/go-sockaddr"
)

func boolEnvVar(envvar string, emptyDefault bool) bool {
	v := os.Getenv(envvar)
	switch strings.ToLower(v) {
	case "":
		return emptyDefault
	case "0", "f", "n":
		return false
	case "1", "t", "y":
		return true
	default:
		fmt.Fprintf(os.Stderr, "Unsupported %s flag %q", envvar, v)
		return true
	}
}

// havePrivateIP is a helper function that returns true when we believe we
// should have a private IP address.  This changes the failure mode of various
// tests that expect a private IP address.
//
// When you have a private IP assigned to the host, set the environment variable
// SOCKADDR_HAVE_PRIVATE_IP=1
func havePrivateIP() bool {
	return boolEnvVar("SOCKADDR_HAVE_PRIVATE_IP", true)
}

// havePublicIP is a helper function that returns true when we believe we should
// have a public IP address.  This changes the failure mode of various tests
// that expect a public IP address.
//
// When you have a public IP assigned to the host, set the environment variable
// SOCKADDR_HAVE_PUBLIC_IP=1
func havePublicIP() bool {
	return boolEnvVar("SOCKADDR_HAVE_PUBLIC_IP", false)
}

func TestGetPrivateIP(t *testing.T) {
	reportOnPrivate := func(args ...interface{}) {
		if havePrivateIP() {
			t.Fatalf(args[0].(string), args[1:]...)
		} else {
			t.Skipf(args[0].(string), args[1:]...)
		}
	}
	ip, err := sockaddr.GetPrivateIP()
	if err != nil {
		reportOnPrivate("unable to get a private IP: %v", err)
	}

	if ip == "" {
		reportOnPrivate("it's hard to test this reliably")
	}
}

func TestGetPrivateIPs(t *testing.T) {
	reportOnPrivate := func(args ...interface{}) {
		if havePrivateIP() {
			t.Fatalf(args[0].(string), args[1:]...)
		} else {
			t.Skipf(args[0].(string), args[1:]...)
		}
	}
	ips, err := sockaddr.GetPrivateIPs()
	if err != nil {
		reportOnPrivate("unable to get a private IPs: %v", err)
	}

	if ips == "" {
		reportOnPrivate("it's hard to test this reliably")
	}
}

func TestGetPublicIP(t *testing.T) {
	reportOnPublic := func(args ...interface{}) {
		if havePublicIP() {
			t.Fatalf(args[0].(string), args[1:]...)
		} else {
			t.Skipf(args[0].(string), args[1:]...)
		}
	}
	ip, err := sockaddr.GetPublicIP()
	if err != nil {
		reportOnPublic("unable to get a public IP: %v", err)
	}

	if ip == "" {
		reportOnPublic("it's hard to test this reliably")
	}
}

func TestGetPublicIPs(t *testing.T) {
	reportOnPublic := func(args ...interface{}) {
		if havePublicIP() {
			t.Fatalf(args[0].(string), args[1:]...)
		} else {
			t.Skipf(args[0].(string), args[1:]...)
		}
	}
	ips, err := sockaddr.GetPublicIPs()
	if err != nil {
		reportOnPublic("unable to get a public IPs: %v", err)
	}

	if ips == "" {
		reportOnPublic("it's hard to test this reliably")
	}
}

func TestGetInterfaceIP(t *testing.T) {
	ip, err := sockaddr.GetInterfaceIP(`^.*[\d]$`)
	if err != nil {
		t.Fatalf("regexp failed: %v", err)
	}

	if ip == "" {
		t.Skip("it's hard to test this reliably")
	}
}

func TestIfAddrAttr(t *testing.T) {
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

		result, err := sockaddr.IfAttr(test.attr, test.ifAddr)
		if err != nil {
			t.Errorf("failed to get attr %q from %v", test.name, test.ifAddr)
		}

		if result != test.expected {
			t.Errorf("unexpected result")
		}
	}
}

func TestIfAddrMath(t *testing.T) {
	tests := []struct {
		name      string
		ifAddr    sockaddr.IfAddr
		operation string
		value     string
		expected  string
		wantFail  bool
	}{
		{
			name: "ipv4 address +2",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "address",
			value:     "+2",
			expected:  "127.0.0.3/8",
		},
		{
			name: "ipv4 address -2",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "address",
			value:     "-2",
			expected:  "126.255.255.255/8",
		},
		{
			name: "ipv4 address + overflow 0xff00ff03",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "address",
			value:     fmt.Sprintf("+%d", 0xff00ff03),
			expected:  "126.0.255.4/8",
		},
		{
			name: "ipv4 address - underflow 0xff00ff04",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "address",
			value:     fmt.Sprintf("-%d", 0xff00ff04),
			expected:  "127.255.0.253/8",
		},
		{
			name: "ipv6 address +2",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::1/128"),
			},
			operation: "address",
			value:     "+2",
			expected:  "::3",
		},
		{
			name: "ipv6 address -3",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::4/128"),
			},
			operation: "address",
			value:     "-3",
			expected:  "::1",
		},
		{
			name: "ipv6 address + overflow",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128"),
			},
			operation: "address",
			value:     fmt.Sprintf("+%d", 0x03),
			expected:  "::2",
		},
		{
			name: "ipv6 address + underflow",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::1/128"),
			},
			operation: "address",
			value:     fmt.Sprintf("-%d", 0x03),
			expected:  "ffff:ffff:ffff:ffff:ffff:ffff:ffff:fffe",
		},
		{
			name: "ipv4 network +2",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "network",
			value:     "+2",
			expected:  "127.0.0.2/8",
		},
		{
			name: "ipv4 network -2",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "network",
			value:     "-2",
			expected:  "127.255.255.254/8",
		},
		{
			// Value exceeds /8
			name: "ipv4 network + overflow 0xff00ff03",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "network",
			value:     fmt.Sprintf("+%d", 0xff00ff03),
			expected:  "127.0.255.3/8",
		},
		{
			// Value exceeds /8
			name: "ipv4 network - underflow+wrap 0xff00ff04",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "network",
			value:     fmt.Sprintf("-%d", 0xff00ff04),
			expected:  "127.255.0.252/8",
		},
		{
			name: "ipv6 network +6",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("fe80::1/64"),
			},
			operation: "network",
			value:     "+6",
			expected:  "fe80::6/64",
		},
		{
			name: "ipv6 network -6",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("fe80::ff/64"),
			},
			operation: "network",
			value:     "-6",
			expected:  "fe80::ffff:ffff:ffff:fffa/64",
		},
		{
			// Value exceeds /104 mask
			name: "ipv6 network + overflow 0xff00ff03",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("fe80::1/104"),
			},
			operation: "network",
			value:     fmt.Sprintf("+%d", 0xff00ff03),
			expected:  "fe80::ff03/104",
		},
		{
			// Value exceeds /104
			name: "ipv6 network - underflow+wrap 0xff00ff04",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("fe80::1/104"),
			},
			operation: "network",
			value:     fmt.Sprintf("-%d", 0xff00ff04),
			expected:  "fe80::ff:fc/104",
		},
		{
			name: "ipv4 address missing sign",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "address",
			value:     "123",
			wantFail:  true,
		},
		{
			name: "ipv4 network missing sign",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "network",
			value:     "123",
			wantFail:  true,
		},
		{
			name: "ipv6 address missing sign",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::1/128"),
			},
			operation: "address",
			value:     "123",
			wantFail:  true,
		},
		{
			name: "ipv6 network missing sign",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::1/128"),
			},
			operation: "network",
			value:     "123",
			wantFail:  true,
		},
		{
			name: "ipv4 address bad value",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "address",
			value:     "+xyz",
			wantFail:  true,
		},
		{
			name: "ipv4 network bad value",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "network",
			value:     "-xyz",
			wantFail:  true,
		},
		{
			name: "ipv6 address bad value",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::1/128"),
			},
			operation: "address",
			value:     "+xyz",
			wantFail:  true,
		},
		{
			name: "ipv6 network bad value",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::1/128"),
			},
			operation: "network",
			value:     "-xyz",
			wantFail:  true,
		},
		{
			name: "ipv4 bad operation",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "gooz",
			value:     "+xyz",
			wantFail:  true,
		},
		{
			name: "ipv6 bad operation",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::1/128"),
			},
			operation: "frabba",
			value:     "+xyz",
			wantFail:  true,
		},
		{
			name: "ipv4 mask operand equals input ipv4 subnet mask",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("10.20.30.40/8"),
			},
			operation: "mask",
			value:     "8",
			expected:  "10.0.0.0/8",
		},
		{
			name: "ipv4 mask operand larger than input ipv4 subnet mask",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("192.168.10.20/24"),
			},
			operation: "mask",
			value:     "16",
			expected:  "192.168.0.0/16",
		},
		{
			name: "ipv4 host upper bound mask operand larger than input ipv4 subnet mask",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("192.168.255.255/24"),
			},
			operation: "mask",
			value:     "16",
			expected:  "192.168.0.0/16",
		},
		{
			name: "ipv4 mask operand smaller than ipv4 subnet mask",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("10.20.30.40/8"),
			},
			operation: "mask",
			value:     "16",
			expected:  "10.20.0.0/8",
		},
		{
			name: "ipv4 host upper bound mask operand smaller than input ipv4 subnet mask",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("10.20.255.255/8"),
			},
			operation: "mask",
			value:     "16",
			expected:  "10.20.0.0/8",
		},
		{
			name: "ipv4 mask bad value upper bound",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "mask",
			value:     "33",
			wantFail:  true,
		},
		{
			name: "ipv4 mask bad value lower bound",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv4Addr("127.0.0.1/8"),
			},
			operation: "mask",
			value:     "-1",
			wantFail:  true,
		},
		{
			name: "ipv6 mask operand equals input ipv6 subnet mask",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("2001:0db8:85a3::8a2e:0370:7334/64"),
			},
			operation: "mask",
			value:     "64",
			expected:  "2001:db8:85a3::/64",
		},
		{
			name: "ipv6 mask operand larger than input ipv6 subnet mask",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("2001:0db8:85a3::8a2e:0370:7334/64"),
			},
			operation: "mask",
			value:     "32",
			expected:  "2001:db8::/32",
		},
		{
			name: "ipv6 mask operand smaller than input ipv6 subnet mask",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("2001:0db8:85a3::8a2e:0370:7334/64"),
			},
			operation: "mask",
			value:     "96",
			expected:  "2001:db8:85a3::8a2e:0:0/64",
		},
		{
			name: "ipv6 mask bad value upper bound",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::1/128"),
			},
			operation: "mask",
			value:     "129",
			wantFail:  true,
		},
		{
			name: "ipv6 mask bad value lower bound",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustIPv6Addr("::1/128"),
			},
			operation: "mask",
			value:     "-1",
			wantFail:  true,
		},
		{
			name: "unix unsupported operation",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustUnixSock("/tmp/bar"),
			},
			operation: "address",
			value:     "+123",
			wantFail:  true,
		},
		{
			name: "unix unsupported operation",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustUnixSock("/tmp/foo"),
			},
			operation: "network",
			value:     "+123",
			wantFail:  true,
		},
		{
			name: "unix unsupported operation",
			ifAddr: sockaddr.IfAddr{
				SockAddr: sockaddr.MustUnixSock("/tmp/foo"),
			},
			operation: "mask",
			value:     "8",
			wantFail:  true,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d must have a name", i)
		}

		results, err := sockaddr.IfAddrsMath(test.operation, test.value, sockaddr.IfAddrs{test.ifAddr})
		if test.wantFail {
			if err != nil {
				continue
			} else {
				t.Fatalf("%s: failed to fail math operation %q with value %q on %v", test.name, test.operation, test.value, test.ifAddr)
			}
		} else if err != nil {
			t.Fatalf("%s: failed to compute math operation %q with value %q on %v", test.name, test.operation, test.value, test.ifAddr)
		}
		if len(results) != 1 {
			t.Fatalf("%s: bad", test.name)
		}

		result := results[0]

		switch saType := result.Type(); saType {
		case sockaddr.TypeIPv4:
			ipv4 := sockaddr.ToIPv4Addr(result.SockAddr)
			if ipv4 == nil {
				t.Fatalf("bad: %T %+#v", result, result)
			}

			if got := ipv4.String(); got != test.expected {
				t.Errorf("unexpected result %q: want %q got %q", test.name, test.expected, got)
			}
		case sockaddr.TypeIPv6:
			ipv6 := sockaddr.ToIPv6Addr(result.SockAddr)
			if ipv6 == nil {
				t.Fatalf("bad: %T %+#v", result, result)
			}

			if got := ipv6.String(); got != test.expected {
				t.Errorf("unexpected result %q: want %q got %q", test.name, test.expected, got)
			}
		default:
			t.Fatalf("bad")
		}
	}
}
