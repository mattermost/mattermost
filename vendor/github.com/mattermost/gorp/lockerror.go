// Copyright 2012 James Cooper. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

// Package gorp provides a simple way to marshal Go structs to and from
// SQL databases.  It uses the database/sql package, and should work with any
// compliant database/sql driver.
//
// Source code and project home:
// https://github.com/go-gorp/gorp

package gorp

import (
	"fmt"
	"reflect"
)

// OptimisticLockError is returned by Update() or Delete() if the
// struct being modified has a Version field and the value is not equal to
// the current value in the database
type OptimisticLockError struct {
	// Table name where the lock error occurred
	TableName string

	// Primary key values of the row being updated/deleted
	Keys []interface{}

	// true if a row was found with those keys, indicating the
	// LocalVersion is stale.  false if no value was found with those
	// keys, suggesting the row has been deleted since loaded, or
	// was never inserted to begin with
	RowExists bool

	// Version value on the struct passed to Update/Delete. This value is
	// out of sync with the database.
	LocalVersion int64
}

// Error returns a description of the cause of the lock error
func (e OptimisticLockError) Error() string {
	if e.RowExists {
		return fmt.Sprintf("gorp: OptimisticLockError table=%s keys=%v out of date version=%d", e.TableName, e.Keys, e.LocalVersion)
	}

	return fmt.Sprintf("gorp: OptimisticLockError no row found for table=%s keys=%v", e.TableName, e.Keys)
}

func lockError(m *DbMap, exec SqlExecutor, tableName string,
	existingVer int64, elem reflect.Value,
	keys ...interface{}) (int64, error) {

	existing, err := get(m, exec, elem.Interface(), keys...)
	if err != nil {
		return -1, err
	}

	ole := OptimisticLockError{tableName, keys, true, existingVer}
	if existing == nil {
		ole.RowExists = false
	}
	return -1, ole
}
