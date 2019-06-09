// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStringArrayIntersection(t *testing.T) {
	a := []string{
		"abc",
		"def",
		"ghi",
	}
	b := []string{
		"jkl",
	}
	c := []string{
		"def",
	}

	if len(StringArrayIntersection(a, b)) != 0 {
		t.Fatal("should be 0")
	}

	if len(StringArrayIntersection(a, c)) != 1 {
		t.Fatal("should be 1")
	}
}

func TestRemoveDuplicatesFromStringArray(t *testing.T) {
	a := []string{
		"a",
		"b",
		"a",
		"a",
		"b",
		"c",
		"a",
	}

	if len(RemoveDuplicatesFromStringArray(a)) != 3 {
		t.Fatal("should be 3")
	}
}

func TestStringSliceDiff(t *testing.T) {
	a := []string{"one", "two", "three", "four", "five", "six"}
	b := []string{"two", "seven", "four", "six"}
	expected := []string{"one", "three", "five"}

	assert.Equal(t, StringSliceDiff(a, b), expected)
}

func TestGetIpAddress(t *testing.T) {
	// Test with a single IP in the X-Forwarded-For
	httpRequest1 := http.Request{
		Header: http.Header{
			"X-Forwarded-For": []string{"10.0.0.1"},
			"X-Real-Ip":       []string{"10.1.0.1"},
		},
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.0.0.1", GetIpAddress(&httpRequest1, []string{"X-Forwarded-For"}))

	// Test with multiple IPs in the X-Forwarded-For
	httpRequest2 := http.Request{
		Header: http.Header{
			"X-Forwarded-For": []string{"10.0.0.1,  10.0.0.2, 10.0.0.3"},
			"X-Real-Ip":       []string{"10.1.0.1"},
		},
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.0.0.1", GetIpAddress(&httpRequest2, []string{"X-Forwarded-For"}))

	// Test with an empty X-Forwarded-For
	httpRequest3 := http.Request{
		Header: http.Header{
			"X-Forwarded-For": []string{""},
			"X-Real-Ip":       []string{"10.1.0.1"},
		},
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.1.0.1", GetIpAddress(&httpRequest3, []string{"X-Forwarded-For", "X-Real-Ip"}))

	// Test without an X-Fowarded-For
	httpRequest4 := http.Request{
		Header: http.Header{
			"X-Real-Ip": []string{"10.1.0.1"},
		},
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.1.0.1", GetIpAddress(&httpRequest4, []string{"X-Forwarded-For", "X-Real-Ip"}))

	// Test without any headers
	httpRequest5 := http.Request{
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.2.0.1", GetIpAddress(&httpRequest5, []string{"X-Forwarded-For", "X-Real-Ip"}))

	// Test with both headers, but both untrusted
	httpRequest6 := http.Request{
		Header: http.Header{
			"X-Forwarded-For": []string{"10.3.0.1"},
			"X-Real-Ip":       []string{"10.1.0.1"},
		},
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.2.0.1", GetIpAddress(&httpRequest6, nil))

	// Test with both headers, but only X-Real-Ip trusted
	httpRequest7 := http.Request{
		Header: http.Header{
			"X-Forwarded-For": []string{"10.3.0.1"},
			"X-Real-Ip":       []string{"10.1.0.1"},
		},
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.1.0.1", GetIpAddress(&httpRequest7, []string{"X-Real-Ip"}))

	// Test with X-Forwarded-For, comma separated, untrusted
	httpRequest8 := http.Request{
		Header: http.Header{
			"X-Forwarded-For": []string{"10.3.0.1, 10.1.0.1"},
		},
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.2.0.1", GetIpAddress(&httpRequest8, nil))

	// Test with X-Forwarded-For, comma separated, untrusted
	httpRequest9 := http.Request{
		Header: http.Header{
			"X-Forwarded-For": []string{"10.3.0.1, 10.1.0.1"},
		},
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.3.0.1", GetIpAddress(&httpRequest9, []string{"X-Forwarded-For"}))

	// Test with both headers, both allowed, first one in trusted used
	httpRequest10 := http.Request{
		Header: http.Header{
			"X-Forwarded-For": []string{"10.3.0.1"},
			"X-Real-Ip":       []string{"10.1.0.1"},
		},
		RemoteAddr: "10.2.0.1:12345",
	}

	assert.Equal(t, "10.1.0.1", GetIpAddress(&httpRequest10, []string{"X-Real-Ip", "X-Forwarded-For"}))
}
