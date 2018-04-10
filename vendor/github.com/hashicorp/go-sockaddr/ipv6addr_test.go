package sockaddr_test

import (
	"fmt"
	"math/big"
	"strings"
	"testing"

	"github.com/hashicorp/go-sockaddr"
)

// ipv6HostMask is an unexported big.Int representing a /128 IPv6 address
var ipv6HostMask sockaddr.IPv6Mask

func init() {
	biMask := big.NewInt(0)
	biMask = biMask.SetBytes([]byte{
		0xff, 0xff,
		0xff, 0xff,
		0xff, 0xff,
		0xff, 0xff,
		0xff, 0xff,
		0xff, 0xff,
		0xff, 0xff,
		0xff, 0xff,
	},
	)
	ipv6HostMask = sockaddr.IPv6Mask(biMask)
}

func newIPv6BigInt(t *testing.T, ipv6Str string) *big.Int {
	addr := big.NewInt(0)
	addrStr := strings.Join(strings.Split(ipv6Str, ":"), "")
	_, ok := addr.SetString(addrStr, 16)
	if !ok {
		t.Fatalf("Unable to create an IPv6Addr from string %+q", ipv6Str)
	}

	return addr
}

func newIPv6Address(t *testing.T, ipv6Str string) sockaddr.IPv6Address {
	return sockaddr.IPv6Address(newIPv6BigInt(t, ipv6Str))
}

func newIPv6Mask(t *testing.T, ipv6Str string) sockaddr.IPv6Mask {
	return sockaddr.IPv6Mask(newIPv6BigInt(t, ipv6Str))
}

func newIPv6Network(t *testing.T, ipv6Str string) sockaddr.IPv6Network {
	return sockaddr.IPv6Network(newIPv6BigInt(t, ipv6Str))
}

func TestSockAddr_IPv6Addr(t *testing.T) {
	tests := []struct {
		z00_input             string
		z01_addrHexStr        string
		z02_addrBinStr        string
		z03_addrStr           string
		z04_NetIPStringOut    string
		z05_addrInt           sockaddr.IPv6Address
		z06_netInt            sockaddr.IPv6Network
		z07_ipMaskStr         string
		z08_maskbits          int
		z09_NetIPNetStringOut string
		z10_maskInt           sockaddr.IPv6Mask
		z11_networkStr        string
		z12_octets            []int
		z13_firstUsable       string
		z14_lastUsable        string
		z16_portInt           sockaddr.IPPort
		z17_DialPacketArgs    []string
		z18_DialStreamArgs    []string
		z19_ListenPacketArgs  []string
		z20_ListenStreamArgs  []string
		z99_pass              bool
	}{
		{ // 0 -- IPv4 fail
			z00_input: "1.2.3.4",
			z99_pass:  false,
		},
		{ // 1 - IPv4 with port
			z00_input: "5.6.7.8:80",
			z99_pass:  false,
		},
		{ // 2 - Hostname
			z00_input: "www.hashicorp.com",
			z99_pass:  false,
		},
		{ // 3 - IPv6 with port, but no square brackets
			z00_input: "2607:f0d0:1002:0051:0000:0000:0000:0004:8600",
			z99_pass:  false,
		},
		{ // 4 - IPv6 with port
			z00_input:             "[2607:f0d0:1002:0051:0000:0000:0000:0004]:8600",
			z01_addrHexStr:        "2607f0d0100200510000000000000004",
			z02_addrBinStr:        "00100110000001111111000011010000000100000000001000000000010100010000000000000000000000000000000000000000000000000000000000000100",
			z03_addrStr:           "[2607:f0d0:1002:51::4]:8600",
			z04_NetIPStringOut:    "2607:f0d0:1002:51::4",
			z05_addrInt:           newIPv6Address(t, "2607:f0d0:1002:0051:0000:0000:0000:0004"),
			z06_netInt:            newIPv6Network(t, "2607:f0d0:1002:0051:0000:0000:0000:0004"),
			z07_ipMaskStr:         "ffffffffffffffffffffffffffffffff",
			z08_maskbits:          128,
			z09_NetIPNetStringOut: "2607:f0d0:1002:51::4/128",
			z10_maskInt:           newIPv6Mask(t, "ffffffffffffffffffffffffffffffff"),
			z11_networkStr:        "2607:f0d0:1002:51::4",
			z12_octets:            []int{0x26, 0x7, 0xf0, 0xd0, 0x10, 0x2, 0x0, 0x51, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x4},
			z13_firstUsable:       "2607:f0d0:1002:51::4",
			z14_lastUsable:        "2607:f0d0:1002:51::4",
			z16_portInt:           8600,
			z17_DialPacketArgs:    []string{"udp6", "[2607:f0d0:1002:51::4]:8600"},
			z18_DialStreamArgs:    []string{"tcp6", "[2607:f0d0:1002:51::4]:8600"},
			z19_ListenPacketArgs:  []string{"udp6", "[2607:f0d0:1002:51::4]:8600"},
			z20_ListenStreamArgs:  []string{"tcp6", "[2607:f0d0:1002:51::4]:8600"},
			z99_pass:              true,
		},
		{ // 5 - IPv6
			z00_input:             "2607:f0d0:1002:0051:0000:0000:0000:0004",
			z01_addrHexStr:        "2607f0d0100200510000000000000004",
			z02_addrBinStr:        "00100110000001111111000011010000000100000000001000000000010100010000000000000000000000000000000000000000000000000000000000000100",
			z03_addrStr:           "2607:f0d0:1002:51::4",
			z04_NetIPStringOut:    "2607:f0d0:1002:51::4",
			z05_addrInt:           newIPv6Address(t, "2607:f0d0:1002:0051:0000:0000:0000:0004"),
			z06_netInt:            newIPv6Network(t, "2607:f0d0:1002:0051:0000:0000:0000:0004"),
			z07_ipMaskStr:         "ffffffffffffffffffffffffffffffff",
			z08_maskbits:          128,
			z09_NetIPNetStringOut: "2607:f0d0:1002:51::4/128",
			z10_maskInt:           newIPv6Mask(t, "ffffffffffffffffffffffffffffffff"),
			z11_networkStr:        "2607:f0d0:1002:51::4",
			z12_octets:            []int{0x26, 0x7, 0xf0, 0xd0, 0x10, 0x2, 0x0, 0x51, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x4},
			z13_firstUsable:       "2607:f0d0:1002:51::4",
			z14_lastUsable:        "2607:f0d0:1002:51::4",
			z17_DialPacketArgs:    []string{"udp6", ""},
			z18_DialStreamArgs:    []string{"tcp6", ""},
			z19_ListenPacketArgs:  []string{"udp6", "[2607:f0d0:1002:51::4]:0"},
			z20_ListenStreamArgs:  []string{"tcp6", "[2607:f0d0:1002:51::4]:0"},
			z99_pass:              true,
		},
		{ // 6 IPv6 with square brackets, optional
			z00_input:             "[2607:f0d0:1002:0051:0000:0000:0000:0004]",
			z01_addrHexStr:        "2607f0d0100200510000000000000004",
			z02_addrBinStr:        "00100110000001111111000011010000000100000000001000000000010100010000000000000000000000000000000000000000000000000000000000000100",
			z03_addrStr:           "2607:f0d0:1002:51::4",
			z04_NetIPStringOut:    "2607:f0d0:1002:51::4",
			z05_addrInt:           newIPv6Address(t, "2607:f0d0:1002:0051:0000:0000:0000:0004"),
			z06_netInt:            newIPv6Network(t, "2607:f0d0:1002:0051:0000:0000:0000:0004"),
			z07_ipMaskStr:         "ffffffffffffffffffffffffffffffff",
			z08_maskbits:          128,
			z09_NetIPNetStringOut: "2607:f0d0:1002:51::4/128",
			z10_maskInt:           newIPv6Mask(t, "ffffffffffffffffffffffffffffffff"),
			z11_networkStr:        "2607:f0d0:1002:51::4",
			z12_octets:            []int{0x26, 0x7, 0xf0, 0xd0, 0x10, 0x2, 0x0, 0x51, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x4},
			z13_firstUsable:       "2607:f0d0:1002:51::4",
			z14_lastUsable:        "2607:f0d0:1002:51::4",
			z17_DialPacketArgs:    []string{"udp6", ""},
			z18_DialStreamArgs:    []string{"tcp6", ""},
			z19_ListenPacketArgs:  []string{"udp6", "[2607:f0d0:1002:51::4]:0"},
			z20_ListenStreamArgs:  []string{"tcp6", "[2607:f0d0:1002:51::4]:0"},
			z99_pass:              true,
		},
		{ // 7 - unspecified address
			z00_input:             "0:0:0:0:0:0:0:0",
			z01_addrHexStr:        "00000000000000000000000000000000",
			z02_addrBinStr:        "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
			z03_addrStr:           "::",
			z04_NetIPStringOut:    "::",
			z05_addrInt:           newIPv6Address(t, "0"),
			z06_netInt:            newIPv6Network(t, "0"),
			z07_ipMaskStr:         "ffffffffffffffffffffffffffffffff",
			z08_maskbits:          128,
			z09_NetIPNetStringOut: "::/128",
			z10_maskInt:           newIPv6Mask(t, "ffffffffffffffffffffffffffffffff"),
			z11_networkStr:        "::",
			z12_octets:            []int{0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0},
			z13_firstUsable:       "::",
			z14_lastUsable:        "::",
			z17_DialPacketArgs:    []string{"udp6", ""},
			z18_DialStreamArgs:    []string{"tcp6", ""},
			z19_ListenPacketArgs:  []string{"udp6", "[::]:0"},
			z20_ListenStreamArgs:  []string{"tcp6", "[::]:0"},
			z99_pass:              true,
		},
		{ // 8 - loopback address
			z00_input:             "0:0:0:0:0:0:0:1",
			z01_addrHexStr:        "00000000000000000000000000000001",
			z02_addrBinStr:        "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
			z03_addrStr:           "::1",
			z04_NetIPStringOut:    "::1",
			z05_addrInt:           newIPv6Address(t, "0000:0000:0000:0000:0000:0000:0000:0001"),
			z06_netInt:            newIPv6Network(t, "0000:0000:0000:0000:0000:0000:0000:0001"),
			z07_ipMaskStr:         "ffffffffffffffffffffffffffffffff",
			z08_maskbits:          128,
			z09_NetIPNetStringOut: "::1/128",
			z10_maskInt:           newIPv6Mask(t, "ffffffffffffffffffffffffffffffff"),
			z11_networkStr:        "::1",
			z12_octets:            []int{0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x01},
			z13_firstUsable:       "::1",
			z14_lastUsable:        "::1",
			z17_DialPacketArgs:    []string{"udp6", ""},
			z18_DialStreamArgs:    []string{"tcp6", ""},
			z19_ListenPacketArgs:  []string{"udp6", "[::1]:0"},
			z20_ListenStreamArgs:  []string{"tcp6", "[::1]:0"},
			z99_pass:              true,
		},
		{ // 9 - IPv6 with CIDR (RFC 3849)
			z00_input:             "2001:DB8::/32",
			z01_addrHexStr:        "20010db8000000000000000000000000",
			z02_addrBinStr:        "00100000000000010000110110111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
			z03_addrStr:           "2001:db8::/32",
			z04_NetIPStringOut:    "2001:db8::",
			z05_addrInt:           newIPv6Address(t, "20010db8000000000000000000000000"),
			z06_netInt:            newIPv6Network(t, "20010db8000000000000000000000000"),
			z07_ipMaskStr:         "ffffffff000000000000000000000000",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "2001:db8::/32",
			z10_maskInt:           newIPv6Mask(t, "ffffffff000000000000000000000000"),
			z11_networkStr:        "2001:db8::/32",
			z12_octets:            []int{0x20, 0x01, 0x0d, 0xb8, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0},
			z13_firstUsable:       "2001:db8::",
			z14_lastUsable:        "2001:db8:ffff:ffff:ffff:ffff:ffff:ffff",
			z17_DialPacketArgs:    []string{"udp6", ""},
			z18_DialStreamArgs:    []string{"tcp6", ""},
			z19_ListenPacketArgs:  []string{"udp6", ""},
			z20_ListenStreamArgs:  []string{"tcp6", ""},
			z99_pass:              true,
		},
		{ // 10 - IPv6 ::1
			z00_input:             "::1",
			z01_addrHexStr:        "00000000000000000000000000000001",
			z02_addrBinStr:        "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
			z03_addrStr:           "::1",
			z04_NetIPStringOut:    "::1",
			z05_addrInt:           newIPv6Address(t, "00000000000000000000000000000001"),
			z06_netInt:            newIPv6Network(t, "00000000000000000000000000000001"),
			z07_ipMaskStr:         "ffffffffffffffffffffffffffffffff",
			z08_maskbits:          128,
			z09_NetIPNetStringOut: "::1/128",
			z10_maskInt:           newIPv6Mask(t, "ffffffffffffffffffffffffffffffff"),
			z11_networkStr:        "::1",
			z12_octets:            []int{0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x1},
			z13_firstUsable:       "::1",
			z14_lastUsable:        "::1",
			z17_DialPacketArgs:    []string{"udp6", ""},
			z18_DialStreamArgs:    []string{"tcp6", ""},
			z19_ListenPacketArgs:  []string{"udp6", "[::1]:0"},
			z20_ListenStreamArgs:  []string{"tcp6", "[::1]:0"},
			z99_pass:              true,
		},
		{ // 11 - IPv6 100::
			z00_input:             "100::",
			z01_addrHexStr:        "01000000000000000000000000000000",
			z02_addrBinStr:        "00000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
			z03_addrStr:           "100::",
			z04_NetIPStringOut:    "100::",
			z05_addrInt:           newIPv6Address(t, "01000000000000000000000000000000"),
			z06_netInt:            newIPv6Network(t, "01000000000000000000000000000000"),
			z07_ipMaskStr:         "ffffffffffffffffffffffffffffffff",
			z08_maskbits:          128,
			z09_NetIPNetStringOut: "100::/128",
			z10_maskInt:           newIPv6Mask(t, "ffffffffffffffffffffffffffffffff"),
			z11_networkStr:        "100::",
			z12_octets:            []int{0x1, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0},
			z13_firstUsable:       "100::",
			z14_lastUsable:        "100::",
			z17_DialPacketArgs:    []string{"udp6", ""},
			z18_DialStreamArgs:    []string{"tcp6", ""},
			z19_ListenPacketArgs:  []string{"udp6", "[100::]:0"},
			z20_ListenStreamArgs:  []string{"tcp6", "[100::]:0"},
			z99_pass:              true,
		},
		{ // 12 - IPv6 100::2
			z00_input:             "100::2",
			z01_addrHexStr:        "01000000000000000000000000000002",
			z02_addrBinStr:        "00000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010",
			z03_addrStr:           "100::2",
			z04_NetIPStringOut:    "100::2",
			z05_addrInt:           newIPv6Address(t, "01000000000000000000000000000002"),
			z06_netInt:            newIPv6Network(t, "01000000000000000000000000000002"),
			z07_ipMaskStr:         "ffffffffffffffffffffffffffffffff",
			z08_maskbits:          128,
			z09_NetIPNetStringOut: "100::2/128",
			z10_maskInt:           newIPv6Mask(t, "ffffffffffffffffffffffffffffffff"),
			z11_networkStr:        "100::2",
			z12_octets:            []int{0x01, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x02},
			z13_firstUsable:       "100::2",
			z14_lastUsable:        "100::2",
			z17_DialPacketArgs:    []string{"udp6", ""},
			z18_DialStreamArgs:    []string{"tcp6", ""},
			z19_ListenPacketArgs:  []string{"udp6", "[100::2]:0"},
			z20_ListenStreamArgs:  []string{"tcp6", "[100::2]:0"},
			z99_pass:              true,
		},
		{ // 13 - IPv6 `[100::2]:80`
			z00_input:             "[100::2]:80",
			z01_addrHexStr:        "01000000000000000000000000000002",
			z02_addrBinStr:        "00000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010",
			z03_addrStr:           "[100::2]:80",
			z04_NetIPStringOut:    "100::2",
			z05_addrInt:           newIPv6Address(t, "01000000000000000000000000000002"),
			z06_netInt:            newIPv6Network(t, "01000000000000000000000000000002"),
			z07_ipMaskStr:         "ffffffffffffffffffffffffffffffff",
			z08_maskbits:          128,
			z09_NetIPNetStringOut: "100::2/128",
			z10_maskInt:           newIPv6Mask(t, "ffffffffffffffffffffffffffffffff"),
			z11_networkStr:        "100::2",
			z12_octets:            []int{0x01, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x02},
			z13_firstUsable:       "100::2",
			z14_lastUsable:        "100::2",
			z16_portInt:           80,
			z17_DialPacketArgs:    []string{"udp6", "[100::2]:80"},
			z18_DialStreamArgs:    []string{"tcp6", "[100::2]:80"},
			z19_ListenPacketArgs:  []string{"udp6", "[100::2]:80"},
			z20_ListenStreamArgs:  []string{"tcp6", "[100::2]:80"},
			z99_pass:              true,
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			ipv6, err := sockaddr.NewIPv6Addr(test.z00_input)
			if test.z99_pass && err != nil {
				t.Fatalf("[%d] Unable to create an IPv6Addr from %+q: %v", idx, test.z00_input, err)
			} else if !test.z99_pass && err == nil {
				t.Fatalf("[%d] Expected test to fail for %+q", idx, test.z00_input)
			} else if !test.z99_pass && err != nil {
				// Expected failure, return success
				return
			}

			if type_ := ipv6.Type(); type_ != sockaddr.TypeIPv6 {
				t.Errorf("[%d] Expected new IPv6Addr to be Type %d, received %d (int)", idx, sockaddr.TypeIPv6, type_)
			}

			h, ok := ipv6.Host().(sockaddr.IPv6Addr)
			if !ok {
				t.Errorf("[%d] Unable to type assert +%q's Host to IPv6Addr", idx, test.z00_input)
			}

			hAddressBigInt := big.Int(*h.Address)
			hMaskBigInt := big.Int(*h.Mask)
			if hAddressBigInt.Cmp(ipv6.Address) != 0 || hMaskBigInt.Cmp(ipv6HostMask) != 0 || h.Port != ipv6.Port {
				t.Errorf("[%d] Expected %+q's Host() to return identical IPv6Addr except mask, received %+q", idx, test.z00_input, h.String())
			}

			if c := cap(*ipv6.NetIP()); c != sockaddr.IPv6len {
				t.Errorf("[%d] Expected new IPv6Addr's Address capacity to be %d bytes, received %d", idx, sockaddr.IPv6len, c)
			}

			if l := len(*ipv6.NetIP()); l != sockaddr.IPv6len {
				t.Errorf("[%d] Expected new IPv6Addr's Address length to be %d bytes, received %d", idx, sockaddr.IPv6len, l)
			}

			if s := ipv6.AddressHexString(); s != test.z01_addrHexStr {
				t.Errorf("[%d] Expected address %+q's hexadecimal representation to be %+q, received %+q", idx, test.z00_input, test.z01_addrHexStr, s)
			}

			if s := ipv6.AddressBinString(); s != test.z02_addrBinStr {
				t.Errorf("[%d] Expected address %+q's binary representation to be %+q, received %+q", idx, test.z00_input, test.z02_addrBinStr, s)
			}

			if s := ipv6.String(); s != test.z03_addrStr {
				t.Errorf("[%d] Expected %+q's String to be %+q, received %+q", idx, test.z00_input, test.z03_addrStr, s)
			}

			if s := ipv6.NetIP().String(); s != test.z04_NetIPStringOut {
				t.Errorf("[%d] Expected %+q's address to be %+q, received %+q", idx, test.z00_input, test.z04_NetIPStringOut, s)
			}

			if hAddressBigInt.Cmp(test.z05_addrInt) != 0 {
				t.Errorf("[%d] Expected %+q's Address to return %+v, received %+v", idx, test.z00_input, test.z05_addrInt, hAddressBigInt)
			}

			n, ok := ipv6.Network().(sockaddr.IPv6Addr)
			if !ok {
				t.Errorf("[%d] Unable to type assert +%q's Network to IPv6Addr", idx, test.z00_input)
			}

			nAddressBigInt := big.Int(*n.Address)
			if nAddressBigInt.Cmp(test.z06_netInt) != 0 {
				t.Errorf("[%d] Expected %+q's Network to return %+v, received %+v", idx, test.z00_input, test.z06_netInt, n.Address)
			}

			if m := ipv6.NetIPMask().String(); m != test.z07_ipMaskStr {
				t.Errorf("[%d] Expected %+q's mask to be %+q, received %+q", idx, test.z00_input, test.z07_ipMaskStr, m)
			}

			if m := ipv6.Maskbits(); m != test.z08_maskbits {
				t.Errorf("[%dr] Expected %+q's port to be %+v, received %+v", idx, test.z00_input, test.z08_maskbits, m)
			}

			if n := ipv6.NetIPNet().String(); n != test.z09_NetIPNetStringOut {
				t.Errorf("[%d] Expected %+q's network to be %+q, received %+q", idx, test.z00_input, test.z09_NetIPNetStringOut, n)
			}

			ipv6MaskBigInt := big.Int(*ipv6.Mask)
			if ipv6MaskBigInt.Cmp(test.z10_maskInt) != 0 {
				t.Errorf("[%d] Expected %+q's Mask to return %+v, received %+v", idx, test.z00_input, test.z10_maskInt, ipv6MaskBigInt)
			}

			nMaskBigInt := big.Int(*n.Mask)
			if nMaskBigInt.Cmp(test.z10_maskInt) != 0 {
				t.Errorf("[%d] Expected %+q's Network's Mask to return %+v, received %+v", idx, test.z00_input, test.z10_maskInt, nMaskBigInt)
			}

			// Network()'s mask must match the IPv6Addr's Mask
			if n := ipv6.Network().String(); n != test.z11_networkStr {
				t.Errorf("[%d] Expected %+q's Network() to be %+q, received %+q", idx, test.z00_input, test.z11_networkStr, n)
			}

			if o := ipv6.Octets(); len(o) != 16 || cap(o) != 16 ||
				o[0] != test.z12_octets[0] || o[1] != test.z12_octets[1] ||
				o[2] != test.z12_octets[2] || o[3] != test.z12_octets[3] ||
				o[4] != test.z12_octets[4] || o[5] != test.z12_octets[5] ||
				o[6] != test.z12_octets[6] || o[7] != test.z12_octets[7] ||
				o[8] != test.z12_octets[8] || o[9] != test.z12_octets[9] ||
				o[10] != test.z12_octets[10] || o[11] != test.z12_octets[11] ||
				o[12] != test.z12_octets[12] || o[13] != test.z12_octets[13] ||
				o[14] != test.z12_octets[14] || o[15] != test.z12_octets[15] {
				t.Errorf("[%d] Expected %+q's Octets to be %x, received %x", idx, test.z00_input, test.z12_octets, o)
			}

			if f := ipv6.FirstUsable().String(); f != test.z13_firstUsable {
				t.Errorf("[%d] Expected %+q's FirstUsable() to be %+q, received %+q", idx, test.z00_input, test.z13_firstUsable, f)
			}

			if l := ipv6.LastUsable().String(); l != test.z14_lastUsable {
				t.Errorf("[%d] Expected %+q's LastUsable() to be %+q, received %+q", idx, test.z00_input, test.z14_lastUsable, l)
			}

			if p := ipv6.IPPort(); sockaddr.IPPort(p) != test.z16_portInt || sockaddr.IPPort(p) != test.z16_portInt {
				t.Errorf("[%d] Expected %+q's port to be %+v, received %+v", idx, test.z00_input, test.z16_portInt, p)
			}

			if dialNet, dialArgs := ipv6.DialPacketArgs(); dialNet != test.z17_DialPacketArgs[0] || dialArgs != test.z17_DialPacketArgs[1] {
				t.Errorf("[%d] Expected %+q's DialPacketArgs() to be %+q, received %+q, %+q", idx, test.z00_input, test.z17_DialPacketArgs, dialNet, dialArgs)
			}

			if dialNet, dialArgs := ipv6.DialStreamArgs(); dialNet != test.z18_DialStreamArgs[0] || dialArgs != test.z18_DialStreamArgs[1] {
				t.Errorf("[%d] Expected %+q's DialStreamArgs() to be %+q, received %+q, %+q", idx, test.z00_input, test.z18_DialStreamArgs, dialNet, dialArgs)
			}

			if listenNet, listenArgs := ipv6.ListenPacketArgs(); listenNet != test.z19_ListenPacketArgs[0] || listenArgs != test.z19_ListenPacketArgs[1] {
				t.Errorf("[%d] Expected %+q's ListenPacketArgs() to be %+q, received %+q, %+q", idx, test.z00_input, test.z19_ListenPacketArgs, listenNet, listenArgs)
			}

			if listenNet, listenArgs := ipv6.ListenStreamArgs(); listenNet != test.z20_ListenStreamArgs[0] || listenArgs != test.z20_ListenStreamArgs[1] {
				t.Errorf("[%d] Expected %+q's ListenStreamArgs() to be %+q, received %+q, %+q", idx, test.z00_input, test.z20_ListenStreamArgs, listenNet, listenArgs)
			}
		})
	}
}

func TestSockAddr_IPv6Addr_CmpAddress(t *testing.T) {
	tests := []struct {
		a   string
		b   string
		cmp int
	}{
		{ // 0
			a:   "2001:4860:0:2001::68/128",
			b:   "2001:4860:0:2001::68",
			cmp: 0,
		},
		{ // 1
			a:   "2607:f0d0:1002:0051:0000:0000:0000:0004/128",
			b:   "2607:f0d0:1002:0051:0000:0000:0000:0004",
			cmp: 0,
		},
		{ // 2
			a:   "2607:f0d0:1002:0051:0000:0000:0000:0004/128",
			b:   "2607:f0d0:1002:0051:0000:0000:0000:0004/64",
			cmp: 0,
		},
		{ // 3
			a:   "2607:f0d0:1002:0051:0000:0000:0000:0004",
			b:   "2607:f0d0:1002:0051:0000:0000:0000:0005",
			cmp: -1,
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			ipv6a, err := sockaddr.NewIPv6Addr(test.a)
			if err != nil {
				t.Fatalf("[%d] Unable to create an IPv6Addr from %+q: %v", idx, test.a, err)
			}

			ipv6b, err := sockaddr.NewIPv6Addr(test.b)
			if err != nil {
				t.Fatalf("[%d] Unable to create an IPv6Addr from %+q: %v", idx, test.b, err)
			}

			if x := ipv6a.CmpAddress(ipv6b); x != test.cmp {
				t.Errorf("[%d] IPv6Addr.CmpAddress() failed with %+q with %+q (expected %d, received %d)", idx, ipv6a, ipv6b, test.cmp, x)
			}

			if x := ipv6b.CmpAddress(ipv6a); x*-1 != test.cmp {
				t.Errorf("[%d] IPv6Addr.CmpAddress() failed with %+q with %+q (expected %d, received %d)", idx, ipv6a, ipv6b, test.cmp, x)
			}
		})
	}
}

func TestSockAddr_IPv6Addr_ContainsAddress(t *testing.T) {
	tests := []struct {
		name  string
		input sockaddr.IPv6Addr
		cases []sockaddr.IPv6Addr
		fail  bool
	}{
		{
			name:  "basic",
			input: sockaddr.MustIPv6Addr("::1/128"),
			cases: []sockaddr.IPv6Addr{
				sockaddr.MustIPv6Addr("::1"),
				sockaddr.MustIPv6Addr("[::1/128]"),
			},
		},
		{
			name:  "fail",
			input: sockaddr.MustIPv6Addr("::1/128"),
			cases: []sockaddr.IPv6Addr{
				sockaddr.MustIPv6Addr("100::"),
			},
			fail: true,
		},
		{
			name:  "fail2",
			input: sockaddr.MustIPv6Addr("100::/128"),
			cases: []sockaddr.IPv6Addr{
				sockaddr.MustIPv6Addr("::1"),
			},
			fail: true,
		},
	}

	for idx, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d needs a name", idx)
		}

		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			ipv6 := test.input

			for _, tc := range test.cases {
				if ipv6.ContainsAddress(tc.Address) == test.fail {
					t.Errorf("%s: Expected %q.ContainsAddress(%q)==%t", test.name, ipv6, tc, test.fail)
				}
			}
		})
	}
}

func TestSockAddr_IPv6Addr_ContainsNetwork(t *testing.T) {
	tests := []struct {
		input string
		pass  []string
		fail  []string
	}{
		{ // 0
			input: "::1/128",
			pass: []string{
				"::1",
				"[::1/128]",
			},
			fail: []string{
				"100::",
			},
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			ipv6, err := sockaddr.NewIPv6Addr(test.input)
			if err != nil {
				t.Fatalf("[%d] Unable to create an IPv6Addr from %+q: %v", idx, test.input, err)
			}

			for passIdx, passInput := range test.pass {
				passAddr, err := sockaddr.NewIPv6Addr(passInput)
				if err != nil {
					t.Fatalf("[%d/%d] Unable to create an IPv6Addr from %+q: %v", idx, passIdx, passInput, err)
				}

				if !passAddr.ContainsNetwork(ipv6) {
					t.Errorf("[%d/%d] Expected %+q to contain %+q", idx, passIdx, test.input, passInput)
				}
			}

			for failIdx, failInput := range test.fail {
				failAddr, err := sockaddr.NewIPv6Addr(failInput)
				if err != nil {
					t.Fatalf("[%d/%d] Unable to create an IPv6Addr from %+q: %v", idx, failIdx, failInput, err)
				}

				if failAddr.ContainsNetwork(ipv6) {
					t.Errorf("[%d/%d] Expected %+q to contain %+q", idx, failIdx, test.input, failInput)
				}
			}
		})
	}
}

func TestSockAddr_IPv6Addr_Equal(t *testing.T) {
	tests := []struct {
		name  string
		input sockaddr.IPv6Addr
		cases sockaddr.SockAddrs
		fail  bool
	}{
		{
			name:  "addr equal",
			input: sockaddr.MustIPv6Addr("2001:4860:0:2001::68/128"),
			cases: sockaddr.SockAddrs{
				sockaddr.MustIPv6Addr("2001:4860:0:2001::68"),
				sockaddr.MustIPv6Addr("2001:4860:0:2001::68/128"),
				sockaddr.MustIPv6Addr("[2001:4860:0:2001::68]:0"),
			},
		},
		{
			name:  "IPv6Addr not equal",
			input: sockaddr.MustIPv6Addr("2001:4860:0:2001::68/128"),
			cases: sockaddr.SockAddrs{
				sockaddr.MustIPv6Addr("2001:DB8::/48"),
				sockaddr.MustIPv6Addr("2001:4860:0:2001::67/128"),
				sockaddr.MustIPv6Addr("2001:4860:0:2001::67"),
				sockaddr.MustIPv6Addr("[2001:4860:0:2001::68]:80"),
				sockaddr.MustIPv4Addr("1.2.3.4"),
				sockaddr.MustUnixSock("/tmp/foo"),
			},
			fail: true,
		},
		{
			name:  "equal CIDR",
			input: sockaddr.MustIPv6Addr("2001:4860:0:2001::68/64"),
			cases: sockaddr.SockAddrs{
				sockaddr.MustIPv6Addr("2001:4860:0:2001::68/64"),
			},
		},
		{
			name:  "not equal CIDR",
			input: sockaddr.MustIPv6Addr("2001:4860:0:2001::68/64"),
			cases: sockaddr.SockAddrs{
				sockaddr.MustIPv6Addr("2001:DB8::/48"),
				sockaddr.MustIPv6Addr("2001:4860:0:2001::67/128"),
				sockaddr.MustIPv6Addr("2001:4860:0:2001::67"),
				sockaddr.MustIPv6Addr("[2001:4860:0:2001::68]:80"),
				sockaddr.MustIPv4Addr("1.2.3.4/32"),
				sockaddr.MustUnixSock("/tmp/foo"),
			},
			fail: true,
		},
	}

	for idx, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d needs a name", idx)
		}

		t.Run(test.name, func(t *testing.T) {
			ipv6 := test.input
			for _, tc := range test.cases {
				if ipv6.Equal(tc) == test.fail {
					t.Errorf("%s: Expected %s Equal(%q)=%t", test.name, ipv6, tc, test.fail)
				}
			}
		})
	}
}

func TestIPv6Addr_CmpRFC(t *testing.T) {
	tests := []struct {
		name   string
		recv   sockaddr.SockAddr
		arg    sockaddr.SockAddr
		rfcNum uint
		want   int
	}{
		{
			name:   "simple in RFC",
			recv:   sockaddr.MustIPv6Addr("::1"),
			arg:    sockaddr.MustIPv6Addr("100::"),
			rfcNum: 6590,
		},
		{
			name:   "ipv6 cmp IPv4",
			recv:   sockaddr.MustIPv6Addr("2002:c058:6301::/120"),
			arg:    sockaddr.MustIPv4Addr("192.88.99.0/24"),
			rfcNum: 3068,
			want:   -1,
		},
		{
			name:   "ipv6 cmp IPv4",
			recv:   sockaddr.MustIPv6Addr("::1"),
			arg:    sockaddr.MustIPv4Addr("1.2.3.4"),
			rfcNum: 6590,
		},
		{
			name:   "ipv6 cmp IPv4",
			recv:   sockaddr.MustIPv6Addr("::1"),
			arg:    sockaddr.MustIPv4Addr("192.168.1.1"),
			rfcNum: 1918,
		},
	}

	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d needs a name", i)
		}

		t.Run(test.name, func(t *testing.T) {
			if cmp := test.recv.CmpRFC(test.rfcNum, test.arg); cmp != test.want {
				t.Fatalf("%s: want %d got %d", test.name, test.want, cmp)
			}
		})
	}
}

func TestIPv6Attrs(t *testing.T) {
	const expectedNumAttrs = 2
	attrs := sockaddr.IPv6Attrs()
	if len(attrs) != expectedNumAttrs {
		t.Fatalf("wrong number of IPv6Attrs: %d vs %d", len(attrs), expectedNumAttrs)
	}
}
