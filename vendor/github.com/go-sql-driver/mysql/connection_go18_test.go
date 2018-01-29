// Go MySQL Driver - A MySQL-Driver for Go's database/sql package
//
// Copyright 2017 The Go-MySQL-Driver Authors. All rights reserved.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at http://mozilla.org/MPL/2.0/.

// +build go1.8

package mysql

import (
	"database/sql/driver"
	"testing"
)

func TestCheckNamedValue(t *testing.T) {
	value := driver.NamedValue{Value: ^uint64(0)}
	x := &mysqlConn{}
	err := x.CheckNamedValue(&value)

	if err != nil {
		t.Fatal("uint64 high-bit not convertible", err)
	}

	if value.Value != "18446744073709551615" {
		t.Fatalf("uint64 high-bit not converted, got %#v %T", value.Value, value.Value)
	}
}
