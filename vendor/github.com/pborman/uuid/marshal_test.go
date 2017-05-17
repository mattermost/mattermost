// Copyright 2014 Google Inc.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package uuid

import (
	"bytes"
	"encoding/json"
	"reflect"
	"testing"
)

var testUUID = Parse("f47ac10b-58cc-0372-8567-0e02b2c3d479")
var testArray = testUUID.Array()

func TestJSON(t *testing.T) {
	type S struct {
		ID1 UUID
		ID2 UUID
	}
	s1 := S{ID1: testUUID}
	data, err := json.Marshal(&s1)
	if err != nil {
		t.Fatal(err)
	}
	var s2 S
	if err := json.Unmarshal(data, &s2); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(&s1, &s2) {
		t.Errorf("got %#v, want %#v", s2, s1)
	}
}

func TestJSONArray(t *testing.T) {
	type S struct {
		ID1 Array
		ID2 Array
	}
	s1 := S{ID1: testArray}
	data, err := json.Marshal(&s1)
	if err != nil {
		t.Fatal(err)
	}
	var s2 S
	if err := json.Unmarshal(data, &s2); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(&s1, &s2) {
		t.Errorf("got %#v, want %#v", s2, s1)
	}
}

func TestMarshal(t *testing.T) {
	data, err := testUUID.MarshalBinary()
	if err != nil {
		t.Fatalf("MarhsalBinary returned unexpected error %v", err)
	}
	if !bytes.Equal(data, testUUID) {
		t.Fatalf("MarhsalBinary returns %x, want %x", data, testUUID)
	}
	var u UUID
	u.UnmarshalBinary(data)
	if !Equal(data, u) {
		t.Fatalf("UnmarhsalBinary returns %v, want %v", u, testUUID)
	}
}

func TestMarshalArray(t *testing.T) {
	data, err := testArray.MarshalBinary()
	if err != nil {
		t.Fatalf("MarhsalBinary returned unexpected error %v", err)
	}
	if !bytes.Equal(data, testUUID) {
		t.Fatalf("MarhsalBinary returns %x, want %x", data, testUUID)
	}
	var a Array
	a.UnmarshalBinary(data)
	if a != testArray {
		t.Fatalf("UnmarhsalBinary returns %v, want %v", a, testArray)
	}
}

func TestMarshalTextArray(t *testing.T) {
	data, err := testArray.MarshalText()
	if err != nil {
		t.Fatalf("MarhsalText returned unexpected error %v", err)
	}
	var a Array
	a.UnmarshalText(data)
	if a != testArray {
		t.Fatalf("UnmarhsalText returns %v, want %v", a, testArray)
	}
}

func BenchmarkUUID_MarshalJSON(b *testing.B) {
	x := &struct {
		UUID UUID `json:"uuid"`
	}{}
	x.UUID = Parse("f47ac10b-58cc-0372-8567-0e02b2c3d479")
	if x.UUID == nil {
		b.Fatal("invalid uuid")
	}
	for i := 0; i < b.N; i++ {
		js, err := json.Marshal(x)
		if err != nil {
			b.Fatalf("marshal json: %#v (%v)", js, err)
		}
	}
}

func BenchmarkUUID_UnmarshalJSON(b *testing.B) {
	js := []byte(`{"uuid":"f47ac10b-58cc-0372-8567-0e02b2c3d479"}`)
	var x *struct {
		UUID UUID `json:"uuid"`
	}
	for i := 0; i < b.N; i++ {
		err := json.Unmarshal(js, &x)
		if err != nil {
			b.Fatalf("marshal json: %#v (%v)", js, err)
		}
	}
}
