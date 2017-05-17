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

		result, err := sockaddr.IfAttr(test.attr, sockaddr.IfAddrs{test.ifAddr})
		if err != nil {
			t.Errorf("failed to get attr %q from %v", test.name, test.ifAddr)
		}

		if result != test.expected {
			t.Errorf("unexpected result")
		}
	}

	// Test an empty array
	result, err := sockaddr.IfAttr("name", sockaddr.IfAddrs{})
	if err != nil {
		t.Error(`failed to get attr "name" from an empty array`)
	}

	if result != "" {
		t.Errorf("unexpected result")
	}
}
