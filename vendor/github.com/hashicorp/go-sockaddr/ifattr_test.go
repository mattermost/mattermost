package sockaddr_test

import (
	"testing"

	sockaddr "github.com/hashicorp/go-sockaddr"
)

func TestIfAttr_net(t *testing.T) {
	ifAddrs, err := sockaddr.GetAllInterfaces()
	if err != nil {
		t.Fatalf("Unable to proceed: %v", err)
	}

	for _, ifAddr := range ifAddrs {
		testSockAddrAttr(t, ifAddr)
	}
}

func TestIfAttr_unix(t *testing.T) {
	newUnixSock := func(path string) sockaddr.UnixSock {
		sa, err := sockaddr.NewUnixSock(path)
		if err != nil {
			t.Fatalf("unable to create new unix socket: %v", err)
		}
		return sa
	}
	unixSockets := []sockaddr.SockAddr{
		newUnixSock("/tmp/test"),
	}

	for _, sa := range unixSockets {
		testSockAddrAttr(t, sa)
	}
}

func testSockAddrAttr(t *testing.T, sai interface{}) {
	attrNamesPerType := []struct {
		name     sockaddr.AttrName
		ipv4Pass bool
		ipv6Pass bool
		unixPass bool
	}{
		// Universal
		{"type", true, true, true},
		{"string", true, true, true},
		// IP
		{"name", true, true, false},
		{"size", true, true, false},
		{"flags", true, true, false},
		{"host", true, true, false},
		{"address", true, true, false},
		{"port", true, true, false},
		{"netmask", true, true, false},
		{"network", true, true, false},
		{"mask_bits", true, true, false},
		{"binary", true, true, false},
		{"hex", true, true, false},
		{"first_usable", true, true, false},
		{"last_usable", true, true, false},
		{"octets", true, true, false},
		// IPv4
		{"broadcast", true, false, false},
		{"uint32", true, false, false},
		// IPv6
		{"uint128", false, true, false},
		// Unix
		{"path", false, false, true},
	}

	for _, attrTest := range attrNamesPerType {
		switch v := sai.(type) {
		case sockaddr.IfAddr:
			saType := v.Type()
			_, err := v.Attr(attrTest.name)
			switch saType {
			case sockaddr.TypeIPv4:
				if err == nil && attrTest.ipv4Pass || err != nil && !attrTest.ipv4Pass {
					// pass
				}
				// fallthrough
			case sockaddr.TypeIPv6:
				if err == nil && attrTest.ipv6Pass || err != nil && !attrTest.ipv6Pass {
					// pass
				}
				// fallthrough
			case sockaddr.TypeUnix:
				if err == nil && attrTest.unixPass || err != nil && !attrTest.unixPass {
					// pass
				}
				// fallthrough
			default:
				t.Errorf("Unable to fetch attr name %q: %v", attrTest.name, err)
			}
		case sockaddr.SockAddr:
			val, err := sockaddr.Attr(v, attrTest.name)
			_ = err

			pass := len(val) > 0
			switch {
			case v.Type() == sockaddr.TypeIPv4 && attrTest.ipv4Pass == pass,
				v.Type() == sockaddr.TypeIPv6 && attrTest.ipv6Pass == pass,
				v.Type() == sockaddr.TypeUnix && attrTest.unixPass == pass:
				// pass
			default:
				t.Errorf("Unable to fetch attr name %q from %v / %v + %+q", attrTest.name, v, v.Type(), val)
			}
		default:
			t.Fatalf("unsupported type %T %v", sai, sai)
		}
	}
}
