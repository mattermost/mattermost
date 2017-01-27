// Copyright (c) 2012 The gocql Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package uuid

import (
	"bytes"
	"testing"
)

func TestNil(t *testing.T) {
	var uuid UUID
	want, got := "00000000-0000-0000-0000-000000000000", uuid.String()
	if want != got {
		t.Fatalf("TestNil: expected %q got %q", want, got)
	}
}

var tests = []struct {
	input   string
	variant int
	version int
}{
	{"b4f00409-cef8-4822-802c-deb20704c365", VariantIETF, 4},
	{"f81d4fae-7dec-11d0-a765-00a0c91e6bf6", VariantIETF, 1},
	{"00000000-7dec-11d0-a765-00a0c91e6bf6", VariantIETF, 1},
	{"3051a8d7-aea7-1801-e0bf-bc539dd60cf3", VariantFuture, 1},
	{"3051a8d7-aea7-2801-e0bf-bc539dd60cf3", VariantFuture, 2},
	{"3051a8d7-aea7-3801-e0bf-bc539dd60cf3", VariantFuture, 3},
	{"3051a8d7-aea7-4801-e0bf-bc539dd60cf3", VariantFuture, 4},
	{"3051a8d7-aea7-3801-e0bf-bc539dd60cf3", VariantFuture, 5},
	{"d0e817e1-e4b1-1801-3fe6-b4b60ccecf9d", VariantNCSCompat, 0},
	{"d0e817e1-e4b1-1801-bfe6-b4b60ccecf9d", VariantIETF, 1},
	{"d0e817e1-e4b1-1801-dfe6-b4b60ccecf9d", VariantMicrosoft, 0},
	{"d0e817e1-e4b1-1801-ffe6-b4b60ccecf9d", VariantFuture, 0},
}

func TestPredefined(t *testing.T) {
	for i := range tests {
		uuid, err := Parse(tests[i].input)
		if err != nil {
			t.Errorf("Parse #%d: %v", i, err)
			continue
		}

		if str := uuid.String(); str != tests[i].input {
			t.Errorf("String #%d: expected %q got %q", i, tests[i].input, str)
			continue
		}

		if variant := uuid.Variant(); variant != tests[i].variant {
			t.Errorf("Variant #%d: expected %d got %d", i, tests[i].variant, variant)
		}

		if tests[i].variant == VariantIETF {
			if version := uuid.Version(); version != tests[i].version {
				t.Errorf("Version #%d: expected %d got %d", i, tests[i].version, version)
			}
		}
	}
}

func TestNewRandom(t *testing.T) {
	for i := 0; i < 20; i++ {
		uuid := NewRandom()

		if variant := uuid.Variant(); variant != VariantIETF {
			t.Errorf("wrong variant. expected %d got %d", VariantIETF, variant)
		}
		if version := uuid.Version(); version != 4 {
			t.Errorf("wrong version. expected %d got %d", 4, version)
		}
	}
}

func TestNewTime(t *testing.T) {
	var node []byte
	timestamp := uint64(0)
	for i := 0; i < 20; i++ {
		uuid := NewTime()

		if variant := uuid.Variant(); variant != VariantIETF {
			t.Errorf("wrong variant. expected %d got %d", VariantIETF, variant)
		}
		if version := uuid.Version(); version != 1 {
			t.Errorf("wrong version. expected %d got %d", 1, version)
		}

		if n := uuid.Node(); !bytes.Equal(n, node) && i > 0 {
			t.Errorf("wrong node. expected %x, got %x", node, n)
		} else if i == 0 {
			node = n
		}

		ts := uuid.Timestamp()
		if ts < timestamp {
			t.Errorf("timestamps must grow")
		}
		timestamp = ts
	}
}
