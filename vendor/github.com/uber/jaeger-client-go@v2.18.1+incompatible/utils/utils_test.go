// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import (
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetLocalIP(t *testing.T) {
	ip, _ := HostIP()
	assert.NotNil(t, ip, "assert we have an ip")
}

func TestParseIPToUint32(t *testing.T) {
	tests := []struct {
		in  string
		out uint32
		err error
	}{
		{"1.2.3.4", 1<<24 | 2<<16 | 3<<8 | 4, nil},
		{"127.0.0.1", 127<<24 | 1, nil},
		{"localhost", 127<<24 | 1, nil},
		{"127.xxx.0.1", 0, nil},
		{"", 0, ErrEmptyIP},
		{"hostname", 0, ErrNotFourOctets},
	}

	for _, test := range tests {
		intIP, err := ParseIPToUint32(test.in)
		if test.err != nil {
			assert.Equal(t, test.err, err)
		} else {
			assert.Equal(t, test.out, intIP)
		}

	}
}

func TestParsePort(t *testing.T) {
	tests := []struct {
		in  string
		out uint16
		err bool
	}{
		{"123", 123, false},
		{"77777", 0, true}, // too large for 16bit
		{"bad-wolf", 0, true},
	}
	for _, test := range tests {
		p, err := ParsePort(test.in)
		if test.err {
			assert.Error(t, err)
		} else {
			assert.Equal(t, test.out, p)
		}
	}
}

func TestPackIPAsUint32(t *testing.T) {
	ipv6a := net.IP{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 1, 2, 3, 4}
	ipv6b := net.ParseIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
	assert.NotNil(t, ipv6a)

	tests := []struct {
		in  net.IP
		out uint32
	}{
		{net.IPv4(1, 2, 3, 4), 1<<24 | 2<<16 | 3<<8 | 4},
		{ipv6a, 1<<24 | 2<<16 | 3<<8 | 4}, // IPv6 but convertible to IPv4
		{ipv6b, 0},
	}
	for _, test := range tests {
		ip := PackIPAsUint32(test.in)
		assert.Equal(t, test.out, ip)
	}
}
