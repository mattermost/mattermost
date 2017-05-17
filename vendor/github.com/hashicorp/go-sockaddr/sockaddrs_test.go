package sockaddr_test

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/hashicorp/consul/lib"
	"github.com/hashicorp/go-sockaddr"
)

func init() {
	lib.SeedMathRand()
}

// NOTE: A number of these code paths are exercised in template/ and
// cmd/sockaddr/

// sockAddrStringInputs allows for easy test creation by developers.
// Parallel arrays of string inputs are converted to their SockAddr
// equivalents for use by unit tests.
type sockAddrStringInputs []struct {
	inputAddrs    []string
	sortedAddrs   []string
	sortedTypes   []sockaddr.SockAddrType
	sortFuncs     []sockaddr.CmpAddrFunc
	numIPv4Inputs int
	numIPv6Inputs int
	numUnixInputs int
}

func convertToSockAddrs(t *testing.T, inputs []string) sockaddr.SockAddrs {
	sockAddrs := make(sockaddr.SockAddrs, 0, len(inputs))
	for i, input := range inputs {
		sa, err := sockaddr.NewSockAddr(input)
		if err != nil {
			t.Fatalf("[%d] Invalid SockAddr input for %+q: %v", i, input, err)
		}
		sockAddrs = append(sockAddrs, sa)
	}

	return sockAddrs
}

// shuffleStrings randomly shuffles the list of strings
func shuffleStrings(list []string) {
	for i := range list {
		j := rand.Intn(i + 1)
		list[i], list[j] = list[j], list[i]
	}
}

func TestSockAddr_SockAddrs_AscAddress(t *testing.T) {
	testInputs := sockAddrStringInputs{
		{ // testNum: 0
			sortFuncs: []sockaddr.CmpAddrFunc{
				sockaddr.AscAddress,
			},
			numIPv4Inputs: 9,
			numIPv6Inputs: 1,
			numUnixInputs: 0,
			inputAddrs: []string{
				"10.0.0.0/8",
				"172.16.1.3/12",
				"128.95.120.2:53",
				"128.95.120.2/32",
				"192.168.0.0/16",
				"128.95.120.1/32",
				"192.168.1.10/24",
				"128.95.120.2:8600",
				"240.0.0.1/4",
				"::",
			},
			sortedAddrs: []string{
				"10.0.0.0/8",
				"128.95.120.1/32",
				"128.95.120.2:53",
				"128.95.120.2/32",
				"128.95.120.2:8600",
				"172.16.1.3/12",
				"192.168.0.0/16",
				"192.168.1.10/24",
				"240.0.0.1/4",
				"::",
			},
		},
	}

	for idx, test := range testInputs {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			shuffleStrings(test.inputAddrs)
			inputSockAddrs := convertToSockAddrs(t, test.inputAddrs)
			sas := convertToSockAddrs(t, test.sortedAddrs)
			sortedIPv4Addrs, nonIPv4Addrs := sas.FilterByType(sockaddr.TypeIPv4)
			if l := len(sortedIPv4Addrs); l != test.numIPv4Inputs {
				t.Fatal("[%d] Missing IPv4Addrs: expected %d, received %d", idx, test.numIPv4Inputs, l)
			}
			if len(nonIPv4Addrs) != test.numIPv6Inputs+test.numUnixInputs {
				t.Fatal("[%d] Non-IPv4 Address in input", idx)
			}

			// Copy inputAddrs so we can manipulate it. wtb const.
			sockAddrs := append(sockaddr.SockAddrs(nil), inputSockAddrs...)
			filteredAddrs, _ := sockAddrs.FilterByType(sockaddr.TypeIPv4)
			sockaddr.OrderedAddrBy(test.sortFuncs...).Sort(filteredAddrs)
			ipv4SockAddrs, nonIPv4s := filteredAddrs.FilterByType(sockaddr.TypeIPv4)
			if len(nonIPv4s) != 0 {
				t.Fatalf("[%d] bad", idx)
			}

			for i, ipv4SockAddr := range ipv4SockAddrs {
				ipv4Addr := sockaddr.ToIPv4Addr(ipv4SockAddr)
				sortedIPv4Addr := sockaddr.ToIPv4Addr(sortedIPv4Addrs[i])
				if ipv4Addr.Address != sortedIPv4Addr.Address {
					t.Errorf("[%d/%d] Sort equality failed: expected %s, received %s", idx, i, sortedIPv4Addrs[i], ipv4Addr)
				}
			}
		})
	}
}

func TestSockAddr_SockAddrs_AscPrivate(t *testing.T) {
	testInputs := []struct {
		sortFuncs   []sockaddr.CmpAddrFunc
		inputAddrs  []string
		sortedAddrs []string
	}{
		{ // testNum: 0
			sortFuncs: []sockaddr.CmpAddrFunc{
				sockaddr.AscType,
				sockaddr.AscPrivate,
				sockaddr.AscAddress,
				sockaddr.AscType,
				sockaddr.AscAddress,
				sockaddr.AscPort,
			},
			inputAddrs: []string{
				"10.0.0.0/8",
				"172.16.1.3/12",
				"192.168.0.0/16",
				"192.168.0.0/16",
				"192.168.1.10/24",
				"128.95.120.1/32",
				"128.95.120.2/32",
				"128.95.120.2:53",
				"128.95.120.2:8600",
				"240.0.0.1/4",
				"::",
			},
			sortedAddrs: []string{
				"10.0.0.0/8",
				"172.16.1.3/12",
				"192.168.0.0/16",
				"192.168.0.0/16",
				"192.168.1.10/24",
				"240.0.0.1/4",
				"128.95.120.1/32",
				"128.95.120.2/32",
				// "128.95.120.2:53",
				// "128.95.120.2:8600",
				// "::",
			},
		},
		{
			sortFuncs: []sockaddr.CmpAddrFunc{
				sockaddr.AscType,
				sockaddr.AscPrivate,
				sockaddr.AscAddress,
			},
			inputAddrs: []string{
				"1.2.3.4:53",
				"192.168.1.2",
				"/tmp/foo",
				"[cc::1]:8600",
				"[::1]:53",
			},
			sortedAddrs: []string{
				"/tmp/foo",
				"192.168.1.2",
				"1.2.3.4:53",
				"[::1]:53",
				"[cc::1]:8600",
			},
		},
		{
			sortFuncs: []sockaddr.CmpAddrFunc{
				sockaddr.AscType,
				sockaddr.AscPrivate,
				sockaddr.AscAddress,
			},
			inputAddrs: []string{
				"/tmp/foo",
				"/tmp/bar",
				"1.2.3.4",
			},
			sortedAddrs: []string{
				"/tmp/bar",
				"/tmp/foo",
				"1.2.3.4",
			},
		},
	}

	for idx, test := range testInputs {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			sortedAddrs := convertToSockAddrs(t, test.sortedAddrs)

			inputAddrs := append([]string(nil), test.inputAddrs...)
			shuffleStrings(inputAddrs)
			inputSockAddrs := convertToSockAddrs(t, inputAddrs)

			sockaddr.OrderedAddrBy(test.sortFuncs...).Sort(inputSockAddrs)

			for i, sockAddr := range sortedAddrs {
				if !sockAddr.Equal(inputSockAddrs[i]) {
					t.Logf("Input Addrs:\t%+v", inputAddrs)
					t.Logf("Sorted Addrs:\t%+v", inputSockAddrs)
					t.Logf("Expected Addrs:\t%+v", test.sortedAddrs)
					t.Fatalf("[%d/%d] Sort AscType/AscAddress failed: expected %+q, received %+q", idx, i, sockAddr, inputSockAddrs[i])
				}
			}
		})
	}
}

func TestSockAddr_SockAddrs_AscPort(t *testing.T) {
	testInputs := []struct {
		name        string
		sortFuncs   []sockaddr.CmpAddrFunc
		inputAddrs  []string
		sortedAddrs []string
	}{
		{
			name: "simple port test",
			sortFuncs: []sockaddr.CmpAddrFunc{
				sockaddr.AscPort,
				sockaddr.AscType,
			},
			inputAddrs: []string{
				"1.2.3.4:53",
				"/tmp/foo",
				"[::1]:53",
			},
			sortedAddrs: []string{
				"/tmp/foo",
				"1.2.3.4:53",
				"[::1]:53",
			},
		},
		{
			name: "simple port test",
			sortFuncs: []sockaddr.CmpAddrFunc{
				sockaddr.AscPort,
				sockaddr.AscType,
			},
			inputAddrs: []string{
				"1.2.3.4:53",
				"/tmp/foo",
			},
			sortedAddrs: []string{
				"/tmp/foo",
				"1.2.3.4:53",
			},
		},
	}

	for idx, test := range testInputs {
		t.Run(test.name, func(t *testing.T) {
			sortedAddrs := convertToSockAddrs(t, test.sortedAddrs)

			inputAddrs := append([]string(nil), test.inputAddrs...)
			shuffleStrings(inputAddrs)
			inputSockAddrs := convertToSockAddrs(t, inputAddrs)

			sockaddr.OrderedAddrBy(test.sortFuncs...).Sort(inputSockAddrs)

			for i, sockAddr := range sortedAddrs {
				if !sockAddr.Equal(inputSockAddrs[i]) {
					t.Logf("Input Addrs:\t%+v", inputAddrs)
					t.Logf("Sorted Addrs:\t%+v", inputSockAddrs)
					t.Logf("Expected Addrs:\t%+v", test.sortedAddrs)
					t.Fatalf("[%d/%d] Sort AscType/AscAddress failed: expected %+q, received %+q", idx, i, sockAddr, inputSockAddrs[i])
				}
			}
		})
	}
}

func TestSockAddr_SockAddrs_AscType(t *testing.T) {
	testInputs := sockAddrStringInputs{
		{ // testNum: 0
			sortFuncs: []sockaddr.CmpAddrFunc{
				sockaddr.AscType,
			},
			inputAddrs: []string{
				"10.0.0.0/8",
				"172.16.1.3/12",
				"128.95.120.2:53",
				"::",
				"128.95.120.2/32",
				"192.168.0.0/16",
				"128.95.120.1/32",
				"192.168.1.10/24",
				"128.95.120.2:8600",
				"240.0.0.1/4",
			},
			sortedTypes: []sockaddr.SockAddrType{
				sockaddr.TypeIPv4,
				sockaddr.TypeIPv4,
				sockaddr.TypeIPv4,
				sockaddr.TypeIPv4,
				sockaddr.TypeIPv4,
				sockaddr.TypeIPv4,
				sockaddr.TypeIPv4,
				sockaddr.TypeIPv4,
				sockaddr.TypeIPv4,
				sockaddr.TypeIPv6,
			},
		},
	}

	for idx, test := range testInputs {
		t.Run(fmt.Sprintf("%d", idx), func(t *testing.T) {
			shuffleStrings(test.inputAddrs)

			inputSockAddrs := convertToSockAddrs(t, test.inputAddrs)
			sortedAddrs := convertToSockAddrs(t, test.sortedAddrs)

			sockaddr.OrderedAddrBy(test.sortFuncs...).Sort(inputSockAddrs)

			for i, sockAddr := range sortedAddrs {
				if sockAddr.Type() != sortedAddrs[i].Type() {
					t.Errorf("[%d/%d] Sort AscType failed: expected %+q, received %+q", idx, i, sortedAddrs[i], sockAddr)
				}
			}
		})
	}
}
