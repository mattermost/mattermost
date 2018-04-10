package sockaddr_test

import (
	"fmt"
	"testing"

	"github.com/hashicorp/go-sockaddr"
)

func TestSockAddr_IPv4Addr(t *testing.T) {
	tests := []struct {
		z00_input             string
		z01_addrHexStr        string
		z02_addrBinStr        string
		z03_addrStr           string
		z04_NetIPStringOut    string
		z05_addrInt           sockaddr.IPv4Address
		z06_netInt            sockaddr.IPv4Network
		z07_ipMaskStr         string
		z08_maskbits          int
		z09_NetIPNetStringOut string
		z10_maskInt           sockaddr.IPv4Mask
		z11_networkStr        string
		z12_octets            []int
		z13_firstUsable       string
		z14_lastUsable        string
		z15_broadcast         string
		z16_portInt           sockaddr.IPPort
		z17_DialPacketArgs    []string
		z18_DialStreamArgs    []string
		z19_ListenPacketArgs  []string
		z20_ListenStreamArgs  []string
		z21_IsRFC1918         bool
		z22_IsRFC6598         bool
		z23_IsRFC6890         bool
		z99_pass              bool
	}{
		{ // 0
			z00_input:             "0.0.0.0",
			z01_addrHexStr:        "00000000",
			z02_addrBinStr:        "00000000000000000000000000000000",
			z03_addrStr:           "0.0.0.0",
			z04_NetIPStringOut:    "0.0.0.0",
			z05_addrInt:           0,
			z06_netInt:            0,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "0.0.0.0/32",
			z10_maskInt:           sockaddr.IPv4HostMask,
			z11_networkStr:        "0.0.0.0",
			z12_octets:            []int{0, 0, 0, 0},
			z13_firstUsable:       "0.0.0.0",
			z14_lastUsable:        "0.0.0.0",
			z15_broadcast:         "0.0.0.0",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", "0.0.0.0:0"},
			z20_ListenStreamArgs:  []string{"tcp4", "0.0.0.0:0"},
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 1
			z00_input:             "0.0.0.0:80",
			z01_addrHexStr:        "00000000",
			z02_addrBinStr:        "00000000000000000000000000000000",
			z03_addrStr:           "0.0.0.0:80",
			z04_NetIPStringOut:    "0.0.0.0",
			z05_addrInt:           0,
			z06_netInt:            0,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "0.0.0.0/32",
			z10_maskInt:           sockaddr.IPv4HostMask,
			z11_networkStr:        "0.0.0.0",
			z12_octets:            []int{0, 0, 0, 0},
			z13_firstUsable:       "0.0.0.0",
			z14_lastUsable:        "0.0.0.0",
			z15_broadcast:         "0.0.0.0",
			z16_portInt:           80,
			z17_DialPacketArgs:    []string{"udp4", "0.0.0.0:80"},
			z18_DialStreamArgs:    []string{"tcp4", "0.0.0.0:80"},
			z19_ListenPacketArgs:  []string{"udp4", "0.0.0.0:80"},
			z20_ListenStreamArgs:  []string{"tcp4", "0.0.0.0:80"},
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 2
			z00_input:             "0.0.0.0/0",
			z01_addrHexStr:        "00000000",
			z02_addrBinStr:        "00000000000000000000000000000000",
			z03_addrStr:           "0.0.0.0/0",
			z04_NetIPStringOut:    "0.0.0.0",
			z05_addrInt:           0,
			z06_netInt:            0,
			z07_ipMaskStr:         "00000000",
			z09_NetIPNetStringOut: "0.0.0.0/0",
			z10_maskInt:           0,
			z11_networkStr:        "0.0.0.0/0",
			z12_octets:            []int{0, 0, 0, 0},
			z13_firstUsable:       "0.0.0.1",
			z14_lastUsable:        "255.255.255.254",
			z15_broadcast:         "255.255.255.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z99_pass:              true,
		},
		{ // 3
			z00_input:             "0.0.0.1",
			z01_addrHexStr:        "00000001",
			z02_addrBinStr:        "00000000000000000000000000000001",
			z03_addrStr:           "0.0.0.1",
			z04_NetIPStringOut:    "0.0.0.1",
			z05_addrInt:           1,
			z06_netInt:            1,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "0.0.0.1/32",
			z10_maskInt:           sockaddr.IPv4HostMask,
			z11_networkStr:        "0.0.0.1",
			z12_octets:            []int{0, 0, 0, 1},
			z13_firstUsable:       "0.0.0.1",
			z14_lastUsable:        "0.0.0.1",
			z15_broadcast:         "0.0.0.1",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", "0.0.0.1:0"},
			z20_ListenStreamArgs:  []string{"tcp4", "0.0.0.1:0"},
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 4
			z00_input:             "0.0.0.1/1",
			z01_addrHexStr:        "00000001",
			z02_addrBinStr:        "00000000000000000000000000000001",
			z03_addrStr:           "0.0.0.1/1",
			z04_NetIPStringOut:    "0.0.0.1",
			z05_addrInt:           1,
			z06_netInt:            0,
			z07_ipMaskStr:         "80000000",
			z08_maskbits:          1,
			z09_NetIPNetStringOut: "0.0.0.0/1",
			z10_maskInt:           2147483648,
			z11_networkStr:        "0.0.0.0/1",
			z12_octets:            []int{0, 0, 0, 1},
			z13_firstUsable:       "0.0.0.1",
			z14_lastUsable:        "127.255.255.254",
			z15_broadcast:         "127.255.255.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z99_pass:              true,
		},
		{ // 5
			z00_input:             "1.2.3.4",
			z01_addrHexStr:        "01020304",
			z02_addrBinStr:        "00000001000000100000001100000100",
			z03_addrStr:           "1.2.3.4",
			z04_NetIPStringOut:    "1.2.3.4",
			z05_addrInt:           16909060,
			z06_netInt:            16909060,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "1.2.3.4/32",
			z10_maskInt:           sockaddr.IPv4HostMask,
			z11_networkStr:        "1.2.3.4",
			z12_octets:            []int{1, 2, 3, 4},
			z13_firstUsable:       "1.2.3.4",
			z14_lastUsable:        "1.2.3.4",
			z15_broadcast:         "1.2.3.4",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", "1.2.3.4:0"},
			z20_ListenStreamArgs:  []string{"tcp4", "1.2.3.4:0"},
			z99_pass:              true,
		},
		{ // 6
			z00_input:             "10.0.0.0/8",
			z01_addrHexStr:        "0a000000",
			z02_addrBinStr:        "00001010000000000000000000000000",
			z03_addrStr:           "10.0.0.0/8",
			z04_NetIPStringOut:    "10.0.0.0",
			z05_addrInt:           167772160,
			z06_netInt:            167772160,
			z07_ipMaskStr:         "ff000000",
			z08_maskbits:          8,
			z09_NetIPNetStringOut: "10.0.0.0/8",
			z10_maskInt:           4278190080,
			z11_networkStr:        "10.0.0.0/8",
			z12_octets:            []int{10, 0, 0, 0},
			z13_firstUsable:       "10.0.0.1",
			z14_lastUsable:        "10.255.255.254",
			z15_broadcast:         "10.255.255.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z21_IsRFC1918:         true,
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 7
			z00_input:             "128.0.0.0",
			z01_addrHexStr:        "80000000",
			z02_addrBinStr:        "10000000000000000000000000000000",
			z03_addrStr:           "128.0.0.0",
			z04_NetIPStringOut:    "128.0.0.0",
			z05_addrInt:           2147483648,
			z06_netInt:            2147483648,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "128.0.0.0/32",
			z10_maskInt:           sockaddr.IPv4HostMask,
			z11_networkStr:        "128.0.0.0",
			z12_octets:            []int{128, 0, 0, 0},
			z13_firstUsable:       "128.0.0.0",
			z14_lastUsable:        "128.0.0.0",
			z15_broadcast:         "128.0.0.0",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", "128.0.0.0:0"},
			z20_ListenStreamArgs:  []string{"tcp4", "128.0.0.0:0"},
			z99_pass:              true,
		},
		{ // 8
			z00_input:             "128.95.120.1/32",
			z01_addrHexStr:        "805f7801",
			z02_addrBinStr:        "10000000010111110111100000000001",
			z03_addrStr:           "128.95.120.1",
			z04_NetIPStringOut:    "128.95.120.1",
			z05_addrInt:           2153740289,
			z06_netInt:            2153740289,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "128.95.120.1/32",
			z10_maskInt:           sockaddr.IPv4HostMask,
			z11_networkStr:        "128.95.120.1",
			z12_octets:            []int{128, 95, 120, 1},
			z13_firstUsable:       "128.95.120.1",
			z14_lastUsable:        "128.95.120.1",
			z15_broadcast:         "128.95.120.1",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", "128.95.120.1:0"},
			z20_ListenStreamArgs:  []string{"tcp4", "128.95.120.1:0"},
			z99_pass:              true,
		},
		{ // 9
			z00_input:             "172.16.1.3/12",
			z01_addrHexStr:        "ac100103",
			z02_addrBinStr:        "10101100000100000000000100000011",
			z03_addrStr:           "172.16.1.3/12",
			z04_NetIPStringOut:    "172.16.1.3",
			z05_addrInt:           2886729987,
			z06_netInt:            2886729728,
			z07_ipMaskStr:         "fff00000",
			z08_maskbits:          12,
			z09_NetIPNetStringOut: "172.16.0.0/12",
			z10_maskInt:           4293918720,
			z11_networkStr:        "172.16.0.0/12",
			z12_octets:            []int{172, 16, 1, 3},
			z13_firstUsable:       "172.16.0.1",
			z14_lastUsable:        "172.31.255.254",
			z15_broadcast:         "172.31.255.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z21_IsRFC1918:         true,
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 10
			z00_input:             "192.168.0.0/16",
			z01_addrHexStr:        "c0a80000",
			z02_addrBinStr:        "11000000101010000000000000000000",
			z03_addrStr:           "192.168.0.0/16",
			z04_NetIPStringOut:    "192.168.0.0",
			z05_addrInt:           3232235520,
			z06_netInt:            3232235520,
			z07_ipMaskStr:         "ffff0000",
			z08_maskbits:          16,
			z09_NetIPNetStringOut: "192.168.0.0/16",
			z10_maskInt:           4294901760,
			z11_networkStr:        "192.168.0.0/16",
			z12_octets:            []int{192, 168, 0, 0},
			z13_firstUsable:       "192.168.0.1",
			z14_lastUsable:        "192.168.255.254",
			z15_broadcast:         "192.168.255.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z21_IsRFC1918:         true,
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 11
			z00_input:             "192.168.0.1",
			z01_addrHexStr:        "c0a80001",
			z02_addrBinStr:        "11000000101010000000000000000001",
			z03_addrStr:           "192.168.0.1",
			z04_NetIPStringOut:    "192.168.0.1",
			z05_addrInt:           3232235521,
			z06_netInt:            3232235521,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "192.168.0.1/32",
			z10_maskInt:           sockaddr.IPv4HostMask,
			z11_networkStr:        "192.168.0.1",
			z12_octets:            []int{192, 168, 0, 1},
			z13_firstUsable:       "192.168.0.1",
			z14_lastUsable:        "192.168.0.1",
			z15_broadcast:         "192.168.0.1",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", "192.168.0.1:0"},
			z20_ListenStreamArgs:  []string{"tcp4", "192.168.0.1:0"},
			z21_IsRFC1918:         true,
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 12
			z00_input:             "192.168.0.2/31",
			z01_addrHexStr:        "c0a80002",
			z02_addrBinStr:        "11000000101010000000000000000010",
			z03_addrStr:           "192.168.0.2/31",
			z04_NetIPStringOut:    "192.168.0.2",
			z05_addrInt:           3232235522,
			z06_netInt:            3232235522,
			z07_ipMaskStr:         "fffffffe",
			z08_maskbits:          31,
			z09_NetIPNetStringOut: "192.168.0.2/31",
			z10_maskInt:           4294967294,
			z11_networkStr:        "192.168.0.2/31",
			z12_octets:            []int{192, 168, 0, 2},
			z13_firstUsable:       "192.168.0.2",
			z14_lastUsable:        "192.168.0.3",
			z15_broadcast:         "192.168.0.3",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z21_IsRFC1918:         true,
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 13
			z00_input:             "192.168.1.10/24",
			z01_addrHexStr:        "c0a8010a",
			z02_addrBinStr:        "11000000101010000000000100001010",
			z03_addrStr:           "192.168.1.10/24",
			z04_NetIPStringOut:    "192.168.1.10",
			z05_addrInt:           3232235786,
			z06_netInt:            3232235776,
			z07_ipMaskStr:         "ffffff00",
			z08_maskbits:          24,
			z09_NetIPNetStringOut: "192.168.1.0/24",
			z10_maskInt:           4294967040,
			z11_networkStr:        "192.168.1.0/24",
			z12_octets:            []int{192, 168, 1, 10},
			z13_firstUsable:       "192.168.1.1",
			z14_lastUsable:        "192.168.1.254",
			z15_broadcast:         "192.168.1.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z21_IsRFC1918:         true,
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 14
			z00_input:             "192.168.10.10/16",
			z01_addrHexStr:        "c0a80a0a",
			z02_addrBinStr:        "11000000101010000000101000001010",
			z03_addrStr:           "192.168.10.10/16",
			z04_NetIPStringOut:    "192.168.10.10",
			z05_addrInt:           3232238090,
			z06_netInt:            3232235520,
			z07_ipMaskStr:         "ffff0000",
			z08_maskbits:          16,
			z09_NetIPNetStringOut: "192.168.0.0/16",
			z10_maskInt:           4294901760,
			z11_networkStr:        "192.168.0.0/16",
			z12_octets:            []int{192, 168, 10, 10},
			z13_firstUsable:       "192.168.0.1",
			z14_lastUsable:        "192.168.255.254",
			z15_broadcast:         "192.168.255.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z21_IsRFC1918:         true,
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 15
			z00_input:             "240.0.0.0/4",
			z01_addrHexStr:        "f0000000",
			z02_addrBinStr:        "11110000000000000000000000000000",
			z03_addrStr:           "240.0.0.0/4",
			z04_NetIPStringOut:    "240.0.0.0",
			z05_addrInt:           4026531840,
			z06_netInt:            4026531840,
			z07_ipMaskStr:         "f0000000",
			z08_maskbits:          4,
			z09_NetIPNetStringOut: "240.0.0.0/4",
			z10_maskInt:           4026531840,
			z11_networkStr:        "240.0.0.0/4",
			z12_octets:            []int{240, 0, 0, 0},
			z13_firstUsable:       "240.0.0.1",
			z14_lastUsable:        "255.255.255.254",
			z15_broadcast:         "255.255.255.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 16
			z00_input:             "240.0.0.1/4",
			z01_addrHexStr:        "f0000001",
			z02_addrBinStr:        "11110000000000000000000000000001",
			z03_addrStr:           "240.0.0.1/4",
			z04_NetIPStringOut:    "240.0.0.1",
			z05_addrInt:           4026531841,
			z06_netInt:            4026531840,
			z07_ipMaskStr:         "f0000000",
			z08_maskbits:          4,
			z09_NetIPNetStringOut: "240.0.0.0/4",
			z10_maskInt:           4026531840,
			z11_networkStr:        "240.0.0.0/4",
			z12_octets:            []int{240, 0, 0, 1},
			z13_firstUsable:       "240.0.0.1",
			z14_lastUsable:        "255.255.255.254",
			z15_broadcast:         "255.255.255.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 17
			z00_input:             "255.255.255.255",
			z01_addrHexStr:        "ffffffff",
			z02_addrBinStr:        "11111111111111111111111111111111",
			z03_addrStr:           "255.255.255.255",
			z04_NetIPStringOut:    "255.255.255.255",
			z05_addrInt:           4294967295,
			z06_netInt:            4294967295,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "255.255.255.255/32",
			z10_maskInt:           sockaddr.IPv4HostMask,
			z11_networkStr:        "255.255.255.255",
			z12_octets:            []int{255, 255, 255, 255},
			z13_firstUsable:       "255.255.255.255",
			z14_lastUsable:        "255.255.255.255",
			z15_broadcast:         "255.255.255.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", "255.255.255.255:0"},
			z20_ListenStreamArgs:  []string{"tcp4", "255.255.255.255:0"},
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 18
			z00_input: "www.hashicorp.com",
			z99_pass:  false,
		},
		{ // 19
			z00_input: "2001:DB8::/48",
			z99_pass:  false,
		},
		{ // 20
			z00_input: "2001:DB8::",
			z99_pass:  false,
		},
		{ // 21
			z00_input:             "128.95.120.1:8600",
			z01_addrHexStr:        "805f7801",
			z02_addrBinStr:        "10000000010111110111100000000001",
			z03_addrStr:           "128.95.120.1:8600",
			z04_NetIPStringOut:    "128.95.120.1",
			z05_addrInt:           2153740289,
			z06_netInt:            2153740289,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "128.95.120.1/32",
			z10_maskInt:           sockaddr.IPv4HostMask,
			z11_networkStr:        "128.95.120.1",
			z12_octets:            []int{128, 95, 120, 1},
			z13_firstUsable:       "128.95.120.1",
			z14_lastUsable:        "128.95.120.1",
			z15_broadcast:         "128.95.120.1",
			z16_portInt:           8600,
			z17_DialPacketArgs:    []string{"udp4", "128.95.120.1:8600"},
			z18_DialStreamArgs:    []string{"tcp4", "128.95.120.1:8600"},
			z19_ListenPacketArgs:  []string{"udp4", "128.95.120.1:8600"},
			z20_ListenStreamArgs:  []string{"tcp4", "128.95.120.1:8600"},
			z99_pass:              true,
		},
		{ // 22
			z00_input:             "100.64.2.3/23",
			z01_addrHexStr:        "64400203",
			z02_addrBinStr:        "01100100010000000000001000000011",
			z03_addrStr:           "100.64.2.3/23",
			z04_NetIPStringOut:    "100.64.2.3",
			z05_addrInt:           1681916419,
			z06_netInt:            1681916416,
			z07_ipMaskStr:         "fffffe00",
			z08_maskbits:          23,
			z09_NetIPNetStringOut: "100.64.2.0/23",
			z10_maskInt:           4294966784,
			z11_networkStr:        "100.64.2.0/23",
			z12_octets:            []int{100, 64, 2, 3},
			z13_firstUsable:       "100.64.2.1",
			z14_lastUsable:        "100.64.3.254",
			z15_broadcast:         "100.64.3.255",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", ""},
			z20_ListenStreamArgs:  []string{"tcp4", ""},
			z22_IsRFC6598:         true,
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
		{ // 23
			z00_input:             "192.168.3.53/00ffffff",
			z01_addrHexStr:        "c0a80335",
			z02_addrBinStr:        "11000000101010000000001100110101",
			z03_addrStr:           "192.168.3.53",
			z04_NetIPStringOut:    "192.168.3.53",
			z05_addrInt:           3232236341,
			z06_netInt:            3232236341,
			z07_ipMaskStr:         "ffffffff",
			z08_maskbits:          32,
			z09_NetIPNetStringOut: "192.168.3.53/32",
			z10_maskInt:           4294967295,
			z11_networkStr:        "192.168.3.53",
			z12_octets:            []int{192, 168, 3, 53},
			z13_firstUsable:       "192.168.3.53",
			z14_lastUsable:        "192.168.3.53",
			z15_broadcast:         "192.168.3.53",
			z17_DialPacketArgs:    []string{"udp4", ""},
			z18_DialStreamArgs:    []string{"tcp4", ""},
			z19_ListenPacketArgs:  []string{"udp4", "192.168.3.53:0"},
			z20_ListenStreamArgs:  []string{"tcp4", "192.168.3.53:0"},
			z21_IsRFC1918:         true,
			z22_IsRFC6598:         false,
			z23_IsRFC6890:         true,
			z99_pass:              true,
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			ipv4, err := sockaddr.NewIPv4Addr(test.z00_input)
			if test.z99_pass && err != nil {
				t.Fatalf("[%d] Unable to create an IPv4Addr from %+q: %v", idx, test.z00_input, err)
			} else if !test.z99_pass && err == nil {
				t.Fatalf("[%d] Expected test to fail for %+q", idx, test.z00_input)
			} else if !test.z99_pass && err != nil {
				// Expected failure, return successfully
				return
			}

			if type_ := ipv4.Type(); type_ != sockaddr.TypeIPv4 {
				t.Errorf("[%d] Expected new IPv4Addr to be Type %d, received %d (int)", idx, sockaddr.TypeIPv4, type_)
			}

			h, ok := ipv4.Host().(sockaddr.IPv4Addr)
			if !ok {
				t.Errorf("[%d] Unable to type assert +%q's Host to IPv4Addr", idx, test.z00_input)
			}

			if h.Address != ipv4.Address || h.Mask != sockaddr.IPv4HostMask || h.Port != ipv4.Port {
				t.Errorf("[%d] Expected %+q's Host() to return identical IPv4Addr except mask, received %+q", idx, test.z00_input, h.String())
			}

			if c := cap(*ipv4.NetIP()); c != sockaddr.IPv4len {
				t.Errorf("[%d] Expected new IPv4Addr's Address capacity to be %d bytes, received %d", idx, sockaddr.IPv4len, c)
			}

			if l := len(*ipv4.NetIP()); l != sockaddr.IPv4len {
				t.Errorf("[%d] Expected new IPv4Addr's Address length to be %d bytes, received %d", idx, sockaddr.IPv4len, l)
			}

			if s := ipv4.AddressHexString(); s != test.z01_addrHexStr {
				t.Errorf("[%d] Expected address %+q's hexadecimal representation to be %+q, received %+q", idx, test.z00_input, test.z01_addrHexStr, s)
			}

			if s := ipv4.AddressBinString(); s != test.z02_addrBinStr {
				t.Errorf("[%d] Expected address %+q's binary representation to be %+q, received %+q", idx, test.z00_input, test.z02_addrBinStr, s)
			}

			if s := ipv4.String(); s != test.z03_addrStr {
				t.Errorf("[%d] Expected %+q's String to be %+q, received %+q", idx, test.z00_input, test.z03_addrStr, s)
			}

			if s := ipv4.NetIP().String(); s != test.z04_NetIPStringOut {
				t.Errorf("[%d] Expected %+q's address to be %+q, received %+q", idx, test.z00_input, test.z04_NetIPStringOut, s)
			}

			if a := ipv4.Address; a != test.z05_addrInt {
				t.Errorf("[%d] Expected %+q's Address to return %d, received %d", idx, test.z00_input, test.z05_addrInt, a)
			}

			if n, ok := ipv4.Network().(sockaddr.IPv4Addr); !ok || n.Address != sockaddr.IPv4Address(test.z06_netInt) {
				t.Errorf("[%d] Expected %+q's Network to return %d, received %d", idx, test.z00_input, test.z06_netInt, n.Address)
			}

			if m := ipv4.NetIPMask().String(); m != test.z07_ipMaskStr {
				t.Errorf("[%d] Expected %+q's mask to be %+q, received %+q", idx, test.z00_input, test.z07_ipMaskStr, m)
			}

			if m := ipv4.Maskbits(); m != test.z08_maskbits {
				t.Errorf("[%d] Expected %+q's port to be %d, received %d", idx, test.z00_input, test.z08_maskbits, m)
			}

			if n := ipv4.NetIPNet().String(); n != test.z09_NetIPNetStringOut {
				t.Errorf("[%d] Expected %+q's network to be %+q, received %+q", idx, test.z00_input, test.z09_NetIPNetStringOut, n)
			}

			if m := ipv4.Mask; m != test.z10_maskInt {
				t.Errorf("[%d] Expected %+q's Mask to return %d, received %d", idx, test.z00_input, test.z10_maskInt, m)
			}

			// Network()'s mask must match the IPv4Addr's Mask
			if n, ok := ipv4.Network().(sockaddr.IPv4Addr); !ok || n.Mask != test.z10_maskInt {
				t.Errorf("[%d] Expected %+q's Network's Mask to return %d, received %d", idx, test.z00_input, test.z10_maskInt, n.Mask)
			}

			if n := ipv4.Network().String(); n != test.z11_networkStr {
				t.Errorf("[%d] Expected %+q's Network() to be %+q, received %+q", idx, test.z00_input, test.z11_networkStr, n)
			}

			if o := ipv4.Octets(); len(o) != 4 || o[0] != test.z12_octets[0] || o[1] != test.z12_octets[1] || o[2] != test.z12_octets[2] || o[3] != test.z12_octets[3] {
				t.Errorf("[%d] Expected %+q's Octets to be %+v, received %+v", idx, test.z00_input, test.z12_octets, o)
			}

			if f := ipv4.FirstUsable().String(); f != test.z13_firstUsable {
				t.Errorf("[%d] Expected %+q's FirstUsable() to be %+q, received %+q", idx, test.z00_input, test.z13_firstUsable, f)
			}

			if l := ipv4.LastUsable().String(); l != test.z14_lastUsable {
				t.Errorf("[%d] Expected %+q's LastUsable() to be %+q, received %+q", idx, test.z00_input, test.z14_lastUsable, l)
			}

			if b := ipv4.Broadcast().String(); b != test.z15_broadcast {
				t.Errorf("[%d] Expected %+q's broadcast to be %+q, received %+q", idx, test.z00_input, test.z15_broadcast, b)
			}

			if p := ipv4.IPPort(); sockaddr.IPPort(p) != test.z16_portInt || sockaddr.IPPort(p) != test.z16_portInt {
				t.Errorf("[%d] Expected %+q's port to be %d, received %d", idx, test.z00_input, test.z16_portInt, p)
			}

			if dialNet, dialArgs := ipv4.DialPacketArgs(); dialNet != test.z17_DialPacketArgs[0] || dialArgs != test.z17_DialPacketArgs[1] {
				t.Errorf("[%d] Expected %+q's DialPacketArgs() to be %+q, received %+q, %+q", idx, test.z00_input, test.z17_DialPacketArgs, dialNet, dialArgs)
			}

			if dialNet, dialArgs := ipv4.DialStreamArgs(); dialNet != test.z18_DialStreamArgs[0] || dialArgs != test.z18_DialStreamArgs[1] {
				t.Errorf("[%d] Expected %+q's DialStreamArgs() to be %+q, received %+q, %+q", idx, test.z00_input, test.z18_DialStreamArgs, dialNet, dialArgs)
			}

			if listenNet, listenArgs := ipv4.ListenPacketArgs(); listenNet != test.z19_ListenPacketArgs[0] || listenArgs != test.z19_ListenPacketArgs[1] {
				t.Errorf("[%d] Expected %+q's ListenPacketArgs() to be %+q, received %+q, %+q", idx, test.z00_input, test.z19_ListenPacketArgs, listenNet, listenArgs)
			}

			if listenNet, listenArgs := ipv4.ListenStreamArgs(); listenNet != test.z20_ListenStreamArgs[0] || listenArgs != test.z20_ListenStreamArgs[1] {
				t.Errorf("[%d] Expected %+q's ListenStreamArgs() to be %+q, received %+q, %+q", idx, test.z00_input, test.z20_ListenStreamArgs, listenNet, listenArgs)
			}

			if v := sockaddr.IsRFC(1918, ipv4); v != test.z21_IsRFC1918 {
				t.Errorf("[%d] Expected IsRFC(1918, %+q) to be %t, received %t", idx, test.z00_input, test.z21_IsRFC1918, v)
			}

			if v := sockaddr.IsRFC(6598, ipv4); v != test.z22_IsRFC6598 {
				t.Errorf("[%d] Expected IsRFC(6598, %+q) to be %t, received %t", idx, test.z00_input, test.z22_IsRFC6598, v)
			}

			if v := sockaddr.IsRFC(6890, ipv4); v != test.z23_IsRFC6890 {
				t.Errorf("[%d] Expected IsRFC(6890, %+q) to be %t, received %t", idx, test.z00_input, test.z23_IsRFC6890, v)
			}
		})
	}
}

func TestSockAddr_IPv4Addr_CmpAddress(t *testing.T) {
	tests := []struct {
		a   string
		b   string
		cmp int
	}{
		{ // 0
			a:   "208.67.222.222/32",
			b:   "208.67.222.222",
			cmp: 0,
		},
		{ // 1
			a:   "208.67.222.222/32",
			b:   "208.67.222.222/32",
			cmp: 0,
		},
		{ // 2
			a:   "208.67.222.222/32",
			b:   "208.67.222.222:0",
			cmp: 0,
		},
		{ // 3
			a:   "208.67.222.220/32",
			b:   "208.67.222.222/32",
			cmp: -1,
		},
		{ // 4
			a:   "208.67.222.222/32",
			b:   "208.67.222.220/32",
			cmp: 1,
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			ipv4a, err := sockaddr.NewIPv4Addr(test.a)
			if err != nil {
				t.Fatalf("[%d] Unable to create an IPv4Addr from %+q: %v", idx, test.a, err)
			}

			ipv4b, err := sockaddr.NewIPv4Addr(test.b)
			if err != nil {
				t.Fatalf("[%d] Unable to create an IPv4Addr from %+q: %v", idx, test.b, err)
			}

			if x := ipv4a.CmpAddress(ipv4b); x != test.cmp {
				t.Errorf("[%d] IPv4Addr.CmpAddress() failed with %+q with %+q (expected %d, received %d)", idx, ipv4a, ipv4b, test.cmp, x)
			}

			if x := ipv4b.CmpAddress(ipv4a); x*-1 != test.cmp {
				t.Errorf("[%d] IPv4Addr.CmpAddress() failed with %+q with %+q (expected %d, received %d)", idx, ipv4a, ipv4b, test.cmp, x)
			}
		})
	}
}

func TestSockAddr_IPv4Addr_ContainsAddress(t *testing.T) {
	tests := []struct {
		input string
		pass  []string
		fail  []string
	}{
		{ // 0
			input: "208.67.222.222/32",
			pass: []string{
				"208.67.222.222",
				"208.67.222.222/32",
				"208.67.222.223/31",
				"208.67.222.222/31",
				"0.0.0.0/0",
			},
			fail: []string{
				"0.0.0.0/1",
				"208.67.222.220/31",
				"208.67.220.224/31",
				"208.67.220.220/32",
			},
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			ipv4, err := sockaddr.NewIPv4Addr(test.input)
			if err != nil {
				t.Fatalf("[%d] Unable to create an IPv4Addr from %+q: %v", idx, test.input, err)
			}

			for passIdx, passInput := range test.pass {
				passAddr, err := sockaddr.NewIPv4Addr(passInput)
				if err != nil {
					t.Fatalf("[%d/%d] Unable to create an IPv4Addr from %+q: %v", idx, passIdx, passInput, err)
				}

				if !passAddr.ContainsAddress(ipv4.Address) {
					t.Errorf("[%d/%d] Expected %+q to contain %+q", idx, passIdx, test.input, passInput)
				}
			}

			for failIdx, failInput := range test.fail {
				failAddr, err := sockaddr.NewIPv4Addr(failInput)
				if err != nil {
					t.Fatalf("[%d/%d] Unable to create an IPv4Addr from %+q: %v", idx, failIdx, failInput, err)
				}

				if failAddr.ContainsAddress(ipv4.Address) {
					t.Errorf("[%d/%d] Expected %+q to contain %+q", idx, failIdx, test.input, failInput)
				}
			}
		})
	}
}

func TestSockAddr_IPv4Addr_CmpPort(t *testing.T) {
	tests := []struct {
		a   string
		b   string
		cmp int
	}{
		{ // 0: Same port, same IP
			a:   "208.67.222.222:0",
			b:   "208.67.222.222/32",
			cmp: 0,
		},
		{ // 1: Same port, different IP
			a:   "208.67.222.220:0",
			b:   "208.67.222.222/32",
			cmp: 0,
		},
		{ // 2: Same IP, different port
			a:   "208.67.222.222:80",
			b:   "208.67.222.222:443",
			cmp: -1,
		},
		{ // 3: Same IP, different port
			a:   "208.67.222.222:443",
			b:   "208.67.222.222:80",
			cmp: 1,
		},
		{ // 4: Different IP, different port
			a:   "208.67.222.222:53",
			b:   "208.67.220.220:8600",
			cmp: -1,
		},
		{ // 5: Different IP, different port
			a:   "208.67.222.222:8600",
			b:   "208.67.220.220:53",
			cmp: 1,
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			ipv4a, err := sockaddr.NewIPv4Addr(test.a)
			if err != nil {
				t.Fatalf("[%d] Unable to create an IPv4Addr from %+q: %v", idx, test.a, err)
			}

			ipv4b, err := sockaddr.NewIPv4Addr(test.b)
			if err != nil {
				t.Fatalf("[%d] Unable to create an IPv4Addr from %+q: %v", idx, test.b, err)
			}

			if x := ipv4a.CmpPort(ipv4b); x != test.cmp {
				t.Errorf("[%d] IPv4Addr.CmpPort() failed with %+q with %+q (expected %d, received %d)", idx, ipv4a, ipv4b, test.cmp, x)
			}

			if x := ipv4b.CmpPort(ipv4a); x*-1 != test.cmp {
				t.Errorf("[%d] IPv4Addr.CmpPort() failed with %+q with %+q (expected %d, received %d)", idx, ipv4a, ipv4b, test.cmp, x)
			}
		})
	}
}

func TestSockAddr_IPv4Addr_Equal(t *testing.T) {
	tests := []struct {
		name  string
		input string
		pass  []string
		fail  []string
	}{
		{
			name:  "passing",
			input: "208.67.222.222/32",
			pass:  []string{"208.67.222.222", "208.67.222.222/32", "208.67.222.222:0"},
			fail:  []string{"208.67.222.222/31", "208.67.220.220", "208.67.220.220/32", "208.67.222.222:5432"},
		},
		{
			name:  "failing",
			input: "4.2.2.1",
			pass:  []string{"4.2.2.1", "4.2.2.1/32"},
			fail:  []string{"4.2.2.1/0", "4.2.2.2", "4.2.2.2/32", "::1"},
		},
	}

	for idx, test := range tests {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			ipv4, err := sockaddr.NewIPv4Addr(test.input)
			if err != nil {
				t.Fatalf("[%d] Unable to create an IPv4Addr from %+q: %v", idx, test.input, err)
			}

			for goodIdx, passInput := range test.pass {
				good, err := sockaddr.NewIPv4Addr(passInput)
				if err != nil {
					t.Fatalf("[%d] Unable to create an IPv4Addr from %+q: %v", idx, passInput, err)
				}

				if !ipv4.Equal(good) {
					t.Errorf("[%d/%d] Expected %+q to be equal to %+q: %+q/%+q", idx, goodIdx, test.input, passInput, ipv4.String(), good.String())
				}
			}

			for failIdx, failInput := range test.fail {
				fail, err := sockaddr.NewIPAddr(failInput)
				if err != nil {
					t.Fatalf("[%d] Unable to create an IPv4Addr from %+q: %v", idx, failInput, err)
				}

				if ipv4.Equal(fail) {
					t.Errorf("[%d/%d] Expected %+q to be not equal to %+q", idx, failIdx, test.input, failInput)
				}
			}
		})
	}
}

func TestIPv4CmpRFC(t *testing.T) {
	tests := []struct {
		name string
		ipv4 sockaddr.IPv4Addr
		rfc  uint
		sa   sockaddr.SockAddr
		ret  int
	}{
		{
			name: "ipv4 rfc cmp recv match not arg",
			ipv4: sockaddr.MustIPv4Addr("192.168.1.10"),
			rfc:  1918,
			sa:   sockaddr.MustIPv6Addr("::1"),
			ret:  -1,
		},
		{
			name: "ipv4 rfc cmp recv match",
			ipv4: sockaddr.MustIPv4Addr("192.168.1.2"),
			rfc:  1918,
			sa:   sockaddr.MustIPv4Addr("203.1.2.3"),
			ret:  -1,
		},
		{
			name: "ipv4 rfc cmp defer",
			ipv4: sockaddr.MustIPv4Addr("192.168.1.3"),
			rfc:  1918,
			sa:   sockaddr.MustIPv4Addr("192.168.1.4"),
			ret:  0,
		},
		{
			name: "ipv4 rfc cmp recv not match",
			ipv4: sockaddr.MustIPv4Addr("1.2.3.4"),
			rfc:  1918,
			sa:   sockaddr.MustIPv4Addr("203.1.2.3"),
			ret:  0,
		},
		{
			name: "ipv4 rfc cmp recv not match arg",
			ipv4: sockaddr.MustIPv4Addr("1.2.3.4"),
			rfc:  1918,
			sa:   sockaddr.MustIPv6Addr("::1"),
			ret:  0,
		},
		{
			name: "ipv4 rfc cmp arg match",
			ipv4: sockaddr.MustIPv4Addr("1.2.3.4"),
			rfc:  1918,
			sa:   sockaddr.MustIPv4Addr("192.168.1.5"),
			ret:  1,
		},
	}
	for i, test := range tests {
		if test.name == "" {
			t.Fatalf("test %d must have a name", i)
		}

		t.Run(test.name, func(t *testing.T) {
			ipv4 := test.ipv4
			if ret := ipv4.CmpRFC(test.rfc, test.sa); ret != test.ret {
				t.Errorf("%s: unexpected ret: wanted %d got %d", test.name, test.ret, ret)
			}
		})
	}
}

func TestIPv4Attrs(t *testing.T) {
	const expectedNumAttrs = 3
	attrs := sockaddr.IPv4Attrs()
	if len(attrs) != expectedNumAttrs {
		t.Fatalf("wrong number of IPv4Attrs: %d vs %d", len(attrs), expectedNumAttrs)
	}
}
