package resize

import (
	"testing"
)

func Test_ClampUint8(t *testing.T) {
	var testData = []struct {
		in       int32
		expected uint8
	}{
		{0, 0},
		{255, 255},
		{128, 128},
		{-2, 0},
		{256, 255},
	}
	for _, test := range testData {
		actual := clampUint8(test.in)
		if actual != test.expected {
			t.Fail()
		}
	}
}

func Test_ClampUint16(t *testing.T) {
	var testData = []struct {
		in       int64
		expected uint16
	}{
		{0, 0},
		{65535, 65535},
		{128, 128},
		{-2, 0},
		{65536, 65535},
	}
	for _, test := range testData {
		actual := clampUint16(test.in)
		if actual != test.expected {
			t.Fail()
		}
	}
}
