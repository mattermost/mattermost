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
	"strings"
	"sync"
)

// CustomScanner binds a database column value to a Go type
type CustomScanner struct {
	// After a row is scanned, Holder will contain the value from the database column.
	// Initialize the CustomScanner with the concrete Go type you wish the database
	// driver to scan the raw column into.
	Holder interface{}
	// Target typically holds a pointer to the target struct field to bind the Holder
	// value to.
	Target interface{}
	// Binder is a custom function that converts the holder value to the target type
	// and sets target accordingly.  This function should return error if a problem
	// occurs converting the holder to the target.
	Binder func(holder interface{}, target interface{}) error
}

// Used to filter columns when selectively updating
type ColumnFilter func(*ColumnMap) bool

func acceptAllFilter(col *ColumnMap) bool {
	return true
}

// Bind is called automatically by gorp after Scan()
func (me CustomScanner) Bind() error {
	return me.Binder(me.Holder, me.Target)
}

type bindPlan struct {
	query             string
	argFields         []string
	keyFields         []string
	versField         string
	autoIncrIdx       int
	autoIncrFieldName string
	once              sync.Once
}

func (plan *bindPlan) createBindInstance(elem reflect.Value, conv TypeConverter) (bindInstance, error) {
	bi := bindInstance{query: plan.query, autoIncrIdx: plan.autoIncrIdx, autoIncrFieldName: plan.autoIncrFieldName, versField: plan.versField}
	if plan.versField != "" {
		bi.existingVersion = elem.FieldByName(plan.versField).Int()
	}

	var err error

	for i := 0; i < len(plan.argFields); i++ {
		k := plan.argFields[i]
		if k == versFieldConst {
			newVer := bi.existingVersion + 1
			bi.args = append(bi.args, newVer)
			if bi.existingVersion == 0 {
				elem.FieldByName(plan.versField).SetInt(int64(newVer))
			}
		} else {
			val := elem.FieldByName(k).Interface()
			if conv != nil {
				val, err = conv.ToDb(val)
				if err != nil {
					return bindInstance{}, err
				}
			}
			bi.args = append(bi.args, val)
		}
	}

	for i := 0; i < len(plan.keyFields); i++ {
		k := plan.keyFields[i]
		val := elem.FieldByName(k).Interface()
		if conv != nil {
			val, err = conv.ToDb(val)
			if err != nil {
				return bindInstance{}, err
			}
		}
		bi.keys = append(bi.keys, val)
	}

	return bi, nil
}

type bindInstance struct {
	query             string
	args              []interface{}
	keys              []interface{}
	existingVersion   int64
	versField         string
	autoIncrIdx       int
	autoIncrFieldName string
}

func (t *TableMap) bindInsert(elem reflect.Value) (bindInstance, error) {
	plan := &t.insertPlan
	plan.once.Do(func() {
		plan.autoIncrIdx = -1

		s := strings.Builder{}
		s2 := strings.Builder{}
		s.WriteString(fmt.Sprintf("insert into %s (", t.dbmap.Dialect.QuotedTableForQuery(t.SchemaName, t.TableName)))

		x := 0
		first := true
		for y := range t.Columns {
			col := t.Columns[y]
			if !(col.isAutoIncr && t.dbmap.Dialect.AutoIncrBindValue() == "") {
				if !col.Transient {
					if !first {
						s.WriteString(",")
						s2.WriteString(",")
					}
					s.WriteString(t.dbmap.Dialect.QuoteField(col.ColumnName))

					if col.isAutoIncr {
						s2.WriteString(t.dbmap.Dialect.AutoIncrBindValue())
						plan.autoIncrIdx = y
						plan.autoIncrFieldName = col.fieldName
					} else {
						if col.DefaultValue == "" {
							s2.WriteString(t.dbmap.Dialect.BindVar(x))
							if col == t.version {
								plan.versField = col.fieldName
								plan.argFields = append(plan.argFields, versFieldConst)
							} else {
								plan.argFields = append(plan.argFields, col.fieldName)
							}
							x++
						} else {
							s2.WriteString(col.DefaultValue)
						}
					}
					first = false
				}
			} else {
				plan.autoIncrIdx = y
				plan.autoIncrFieldName = col.fieldName
			}
		}
		s.WriteString(") values (")
		s.WriteString(s2.String())
		s.WriteString(")")
		if plan.autoIncrIdx > -1 {
			s.WriteString(t.dbmap.Dialect.AutoIncrInsertSuffix(t.Columns[plan.autoIncrIdx]))
		}
		s.WriteString(t.dbmap.Dialect.QuerySuffix())

		plan.query = s.String()
	})

	return plan.createBindInstance(elem, t.dbmap.TypeConverter)
}

func (t *TableMap) bindUpdate(elem reflect.Value, colFilter ColumnFilter) (bindInstance, error) {
	if colFilter == nil {
		colFilter = acceptAllFilter
	}

	plan := &t.updatePlan
	plan.once.Do(func() {
		s := strings.Builder{}
		s.WriteString(fmt.Sprintf("update %s set ", t.dbmap.Dialect.QuotedTableForQuery(t.SchemaName, t.TableName)))
		x := 0

		for y := range t.Columns {
			col := t.Columns[y]
			if !col.isAutoIncr && !col.Transient && colFilter(col) {
				if x > 0 {
					s.WriteString(", ")
				}
				s.WriteString(t.dbmap.Dialect.QuoteField(col.ColumnName))
				s.WriteString("=")
				s.WriteString(t.dbmap.Dialect.BindVar(x))

				if col == t.version {
					plan.versField = col.fieldName
					plan.argFields = append(plan.argFields, versFieldConst)
				} else {
					plan.argFields = append(plan.argFields, col.fieldName)
				}
				x++
			}
		}

		s.WriteString(" where ")
		for y := range t.keys {
			col := t.keys[y]
			if y > 0 {
				s.WriteString(" and ")
			}
			s.WriteString(t.dbmap.Dialect.QuoteField(col.ColumnName))
			s.WriteString("=")
			s.WriteString(t.dbmap.Dialect.BindVar(x))

			plan.argFields = append(plan.argFields, col.fieldName)
			plan.keyFields = append(plan.keyFields, col.fieldName)
			x++
		}
		if plan.versField != "" {
			s.WriteString(" and ")
			s.WriteString(t.dbmap.Dialect.QuoteField(t.version.ColumnName))
			s.WriteString("=")
			s.WriteString(t.dbmap.Dialect.BindVar(x))
			plan.argFields = append(plan.argFields, plan.versField)
		}
		s.WriteString(t.dbmap.Dialect.QuerySuffix())

		plan.query = s.String()
	})

	return plan.createBindInstance(elem, t.dbmap.TypeConverter)
}

func (t *TableMap) bindDelete(elem reflect.Value) (bindInstance, error) {
	plan := &t.deletePlan
	plan.once.Do(func() {
		s := strings.Builder{}
		s.WriteString(fmt.Sprintf("delete from %s", t.dbmap.Dialect.QuotedTableForQuery(t.SchemaName, t.TableName)))

		for y := range t.Columns {
			col := t.Columns[y]
			if !col.Transient {
				if col == t.version {
					plan.versField = col.fieldName
				}
			}
		}

		s.WriteString(" where ")
		for x := range t.keys {
			k := t.keys[x]
			if x > 0 {
				s.WriteString(" and ")
			}
			s.WriteString(t.dbmap.Dialect.QuoteField(k.ColumnName))
			s.WriteString("=")
			s.WriteString(t.dbmap.Dialect.BindVar(x))

			plan.keyFields = append(plan.keyFields, k.fieldName)
			plan.argFields = append(plan.argFields, k.fieldName)
		}
		if plan.versField != "" {
			s.WriteString(" and ")
			s.WriteString(t.dbmap.Dialect.QuoteField(t.version.ColumnName))
			s.WriteString("=")
			s.WriteString(t.dbmap.Dialect.BindVar(len(plan.argFields)))

			plan.argFields = append(plan.argFields, plan.versField)
		}
		s.WriteString(t.dbmap.Dialect.QuerySuffix())

		plan.query = s.String()
	})

	return plan.createBindInstance(elem, t.dbmap.TypeConverter)
}

func (t *TableMap) bindGet() *bindPlan {
	plan := &t.getPlan
	plan.once.Do(func() {
		s := strings.Builder{}
		s.WriteString("select ")

		x := 0
		for _, col := range t.Columns {
			if !col.Transient {
				if x > 0 {
					s.WriteString(",")
				}
				s.WriteString(t.dbmap.Dialect.QuoteField(col.ColumnName))
				plan.argFields = append(plan.argFields, col.fieldName)
				x++
			}
		}
		s.WriteString(" from ")
		s.WriteString(t.dbmap.Dialect.QuotedTableForQuery(t.SchemaName, t.TableName))
		s.WriteString(" where ")
		for x := range t.keys {
			col := t.keys[x]
			if x > 0 {
				s.WriteString(" and ")
			}
			s.WriteString(t.dbmap.Dialect.QuoteField(col.ColumnName))
			s.WriteString("=")
			s.WriteString(t.dbmap.Dialect.BindVar(x))

			plan.keyFields = append(plan.keyFields, col.fieldName)
		}
		s.WriteString(t.dbmap.Dialect.QuerySuffix())

		plan.query = s.String()
	})

	return plan
}
