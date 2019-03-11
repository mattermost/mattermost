// Copyright 2012 James Cooper. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

// Package gorp provides a simple way to marshal Go structs to and from
// SQL databases.  It uses the database/sql package, and should work with any
// compliant database/sql driver.
//
// Source code and project home:
// https://github.com/go-gorp/gorp
//
package gorp

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"
)

// OracleString (empty string is null)
// TODO: move to dialect/oracle?, rename to String?
type OracleString struct {
	sql.NullString
}

// Scan implements the Scanner interface.
func (os *OracleString) Scan(value interface{}) error {
	if value == nil {
		os.String, os.Valid = "", false
		return nil
	}
	os.Valid = true
	return os.NullString.Scan(value)
}

// Value implements the driver Valuer interface.
func (os OracleString) Value() (driver.Value, error) {
	if !os.Valid || os.String == "" {
		return nil, nil
	}
	return os.String, nil
}

// SqlTyper is a type that returns its database type.  Most of the
// time, the type can just use "database/sql/driver".Valuer; but when
// it returns nil for its empty value, it needs to implement SqlTyper
// to have its column type detected properly during table creation.
type SqlTyper interface {
	SqlType() driver.Valuer
}

// for fields that exists in DB table, but not exists in struct
type dummyField struct{}

// Scan implements the Scanner interface.
func (nt *dummyField) Scan(value interface{}) error {
	return nil
}

var zeroVal reflect.Value
var versFieldConst = "[gorp_ver_field]"

// The TypeConverter interface provides a way to map a value of one
// type to another type when persisting to, or loading from, a database.
//
// Example use cases: Implement type converter to convert bool types to "y"/"n" strings,
// or serialize a struct member as a JSON blob.
type TypeConverter interface {
	// ToDb converts val to another type. Called before INSERT/UPDATE operations
	ToDb(val interface{}) (interface{}, error)

	// FromDb returns a CustomScanner appropriate for this type. This will be used
	// to hold values returned from SELECT queries.
	//
	// In particular the CustomScanner returned should implement a Binder
	// function appropriate for the Go type you wish to convert the db value to
	//
	// If bool==false, then no custom scanner will be used for this field.
	FromDb(target interface{}) (CustomScanner, bool)
}

// Executor exposes the sql.DB and sql.Tx Exec function so that it can be used
// on internal functions that convert named parameters for the Exec function.
type executor interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
}

// SqlExecutor exposes gorp operations that can be run from Pre/Post
// hooks.  This hides whether the current operation that triggered the
// hook is in a transaction.
//
// See the DbMap function docs for each of the functions below for more
// information.
type SqlExecutor interface {
	Get(i interface{}, keys ...interface{}) (interface{}, error)
	Insert(list ...interface{}) error
	Update(list ...interface{}) (int64, error)
	Delete(list ...interface{}) (int64, error)
	Exec(query string, args ...interface{}) (sql.Result, error)
	ExecNoTimeout(query string, args ...interface{}) (sql.Result, error)
	Select(i interface{}, query string,
		args ...interface{}) ([]interface{}, error)
	SelectInt(query string, args ...interface{}) (int64, error)
	SelectNullInt(query string, args ...interface{}) (sql.NullInt64, error)
	SelectFloat(query string, args ...interface{}) (float64, error)
	SelectNullFloat(query string, args ...interface{}) (sql.NullFloat64, error)
	SelectStr(query string, args ...interface{}) (string, error)
	SelectNullStr(query string, args ...interface{}) (sql.NullString, error)
	SelectOne(holder interface{}, query string, args ...interface{}) error
	Query(query string, args ...interface{}) (*sql.Rows, error)
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(query string, args ...interface{}) *sql.Row
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
}

// DynamicTable allows the users of gorp to dynamically
// use different database table names during runtime
// while sharing the same golang struct for in-memory data
type DynamicTable interface {
	TableName() string
	SetTableName(string)
}

// Compile-time check that DbMap and Transaction implement the SqlExecutor
// interface.
var _, _ SqlExecutor = &DbMap{}, &Transaction{}

func argsString(args ...interface{}) string {
	var margs string
	for i, a := range args {
		var v interface{} = a
		if x, ok := v.(driver.Valuer); ok {
			y, err := x.Value()
			if err == nil {
				v = y
			}
		}
		switch v.(type) {
		case string:
			v = fmt.Sprintf("%q", v)
		default:
			v = fmt.Sprintf("%v", v)
		}
		margs += fmt.Sprintf("%d:%s", i+1, v)
		if i+1 < len(args) {
			margs += " "
		}
	}
	return margs
}

// Calls the Exec function on the executor, but attempts to expand any eligible named
// query arguments first.
func exec(e SqlExecutor, query string, doTimeout bool, args ...interface{}) (sql.Result, error) {
	var dbMap *DbMap
	var executor executor
	switch m := e.(type) {
	case *DbMap:
		executor = m.Db
		dbMap = m
	case *Transaction:
		executor = m.tx
		dbMap = m.dbmap
	}

	if len(args) == 1 {
		query, args = maybeExpandNamedQuery(dbMap, query, args)
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbMap.QueryTimeout)
	defer cancel()
	return executor.ExecContext(ctx, query, args...)
}

// maybeExpandNamedQuery checks the given arg to see if it's eligible to be used
// as input to a named query.  If so, it rewrites the query to use
// dialect-dependent bindvars and instantiates the corresponding slice of
// parameters by extracting data from the map / struct.
// If not, returns the input values unchanged.
func maybeExpandNamedQuery(m *DbMap, query string, args []interface{}) (string, []interface{}) {
	var (
		arg    = args[0]
		argval = reflect.ValueOf(arg)
	)
	if argval.Kind() == reflect.Ptr {
		argval = argval.Elem()
	}

	if argval.Kind() == reflect.Map && argval.Type().Key().Kind() == reflect.String {
		return expandNamedQuery(m, query, func(key string) reflect.Value {
			return argval.MapIndex(reflect.ValueOf(key))
		})
	}
	if argval.Kind() != reflect.Struct {
		return query, args
	}
	if _, ok := arg.(time.Time); ok {
		// time.Time is driver.Value
		return query, args
	}
	if _, ok := arg.(driver.Valuer); ok {
		// driver.Valuer will be converted to driver.Value.
		return query, args
	}

	return expandNamedQuery(m, query, argval.FieldByName)
}

var keyRegexp = regexp.MustCompile(`:[[:word:]]+`)

// expandNamedQuery accepts a query with placeholders of the form ":key", and a
// single arg of Kind Struct or Map[string].  It returns the query with the
// dialect's placeholders, and a slice of args ready for positional insertion
// into the query.
func expandNamedQuery(m *DbMap, query string, keyGetter func(key string) reflect.Value) (string, []interface{}) {
	var (
		n    int
		args []interface{}
	)
	return keyRegexp.ReplaceAllStringFunc(query, func(key string) string {
		val := keyGetter(key[1:])
		if !val.IsValid() {
			return key
		}
		args = append(args, val.Interface())
		newVar := m.Dialect.BindVar(n)
		n++
		return newVar
	}), args
}

func columnToFieldIndex(m *DbMap, t reflect.Type, name string, cols []string) ([][]int, error) {
	colToFieldIndex := make([][]int, len(cols))

	// check if type t is a mapped table - if so we'll
	// check the table for column aliasing below
	tableMapped := false
	table := tableOrNil(m, t, name)
	if table != nil {
		tableMapped = true
	}

	// Loop over column names and find field in i to bind to
	// based on column name. all returned columns must match
	// a field in the i struct
	missingColNames := []string{}
	for x := range cols {
		colName := strings.ToLower(cols[x])
		field, found := t.FieldByNameFunc(func(fieldName string) bool {
			field, _ := t.FieldByName(fieldName)
			cArguments := strings.Split(field.Tag.Get("db"), ",")
			fieldName = cArguments[0]

			if tableMapped {
				colMap := colMapOrNil(table, fieldName)
				if colMap != nil {
					fieldName = colMap.ColumnName
				}
			}
			if fieldName == "" || fieldName == "-" {
				fieldName = field.Name
			}
			return colName == strings.ToLower(fieldName)
		})
		if found {
			colToFieldIndex[x] = field.Index
		}
		if colToFieldIndex[x] == nil {
			missingColNames = append(missingColNames, colName)
		}
	}
	if len(missingColNames) > 0 {
		return colToFieldIndex, &NoFieldInTypeError{
			TypeName:        t.Name(),
			MissingColNames: missingColNames,
		}
	}
	return colToFieldIndex, nil
}

func fieldByName(val reflect.Value, fieldName string) *reflect.Value {
	// try to find field by exact match
	f := val.FieldByName(fieldName)

	if f != zeroVal {
		return &f
	}

	// try to find by case insensitive match - only the Postgres driver
	// seems to require this - in the case where columns are aliased in the sql
	fieldNameL := strings.ToLower(fieldName)
	fieldCount := val.NumField()
	t := val.Type()
	for i := 0; i < fieldCount; i++ {
		sf := t.Field(i)
		if strings.ToLower(sf.Name) == fieldNameL {
			f := val.Field(i)
			return &f
		}
	}

	return nil
}

// toSliceType returns the element type of the given object, if the object is a
// "*[]*Element" or "*[]Element". If not, returns nil.
// err is returned if the user was trying to pass a pointer-to-slice but failed.
func toSliceType(i interface{}) (reflect.Type, error) {
	t := reflect.TypeOf(i)
	if t.Kind() != reflect.Ptr {
		// If it's a slice, return a more helpful error message
		if t.Kind() == reflect.Slice {
			return nil, fmt.Errorf("gorp: cannot SELECT into a non-pointer slice: %v", t)
		}
		return nil, nil
	}
	if t = t.Elem(); t.Kind() != reflect.Slice {
		return nil, nil
	}
	return t.Elem(), nil
}

func toType(i interface{}) (reflect.Type, error) {
	t := reflect.TypeOf(i)

	// If a Pointer to a type, follow
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}

	if t.Kind() != reflect.Struct {
		return nil, fmt.Errorf("gorp: cannot SELECT into this type: %v", reflect.TypeOf(i))
	}
	return t, nil
}

type foundTable struct {
	table   *TableMap
	dynName *string
}

func tableFor(m *DbMap, t reflect.Type, i interface{}) (*foundTable, error) {
	if dyn, isDynamic := i.(DynamicTable); isDynamic {
		tableName := dyn.TableName()
		table, err := m.DynamicTableFor(tableName, true)
		if err != nil {
			return nil, err
		}
		return &foundTable{
			table:   table,
			dynName: &tableName,
		}, nil
	}
	table, err := m.TableFor(t, true)
	if err != nil {
		return nil, err
	}
	return &foundTable{table: table}, nil
}

func get(m *DbMap, exec SqlExecutor, i interface{},
	keys ...interface{}) (interface{}, error) {

	t, err := toType(i)
	if err != nil {
		return nil, err
	}

	foundTable, err := tableFor(m, t, i)
	if err != nil {
		return nil, err
	}
	table := foundTable.table

	plan := table.bindGet()

	v := reflect.New(t)
	if foundTable.dynName != nil {
		retDyn := v.Interface().(DynamicTable)
		retDyn.SetTableName(*foundTable.dynName)
	}

	dest := make([]interface{}, len(plan.argFields))

	conv := m.TypeConverter
	custScan := make([]CustomScanner, 0)

	for x, fieldName := range plan.argFields {
		f := v.Elem().FieldByName(fieldName)
		target := f.Addr().Interface()
		if conv != nil {
			scanner, ok := conv.FromDb(target)
			if ok {
				target = scanner.Holder
				custScan = append(custScan, scanner)
			}
		}
		dest[x] = target
	}

	ctx, cancel := context.WithTimeout(context.Background(), m.QueryTimeout)
	defer cancel()
	row := exec.QueryRowContext(ctx, plan.query, keys...)

	err = row.Scan(dest...)
	if err != nil {
		if err == sql.ErrNoRows {
			err = nil
		}
		return nil, err
	}

	for _, c := range custScan {
		err = c.Bind()
		if err != nil {
			return nil, err
		}
	}

	if v, ok := v.Interface().(HasPostGet); ok {
		err := v.PostGet(exec)
		if err != nil {
			return nil, err
		}
	}

	return v.Interface(), nil
}

func delete(m *DbMap, exec SqlExecutor, list ...interface{}) (int64, error) {
	count := int64(0)
	for _, ptr := range list {
		table, elem, err := m.tableForPointer(ptr, true)
		if err != nil {
			return -1, err
		}

		eval := elem.Addr().Interface()
		if v, ok := eval.(HasPreDelete); ok {
			err = v.PreDelete(exec)
			if err != nil {
				return -1, err
			}
		}

		bi, err := table.bindDelete(elem)
		if err != nil {
			return -1, err
		}

		res, err := exec.Exec(bi.query, bi.args...)
		if err != nil {
			return -1, err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return -1, err
		}

		if rows == 0 && bi.existingVersion > 0 {
			return lockError(m, exec, table.TableName,
				bi.existingVersion, elem, bi.keys...)
		}

		count += rows

		if v, ok := eval.(HasPostDelete); ok {
			err := v.PostDelete(exec)
			if err != nil {
				return -1, err
			}
		}
	}

	return count, nil
}

func update(m *DbMap, exec SqlExecutor, colFilter ColumnFilter, list ...interface{}) (int64, error) {
	count := int64(0)
	for _, ptr := range list {
		table, elem, err := m.tableForPointer(ptr, true)
		if err != nil {
			return -1, err
		}

		eval := elem.Addr().Interface()
		if v, ok := eval.(HasPreUpdate); ok {
			err = v.PreUpdate(exec)
			if err != nil {
				return -1, err
			}
		}

		bi, err := table.bindUpdate(elem, colFilter)
		if err != nil {
			return -1, err
		}

		res, err := exec.Exec(bi.query, bi.args...)
		if err != nil {
			return -1, err
		}

		rows, err := res.RowsAffected()
		if err != nil {
			return -1, err
		}

		if rows == 0 && bi.existingVersion > 0 {
			return lockError(m, exec, table.TableName,
				bi.existingVersion, elem, bi.keys...)
		}

		if bi.versField != "" {
			elem.FieldByName(bi.versField).SetInt(bi.existingVersion + 1)
		}

		count += rows

		if v, ok := eval.(HasPostUpdate); ok {
			err = v.PostUpdate(exec)
			if err != nil {
				return -1, err
			}
		}
	}
	return count, nil
}

func insert(m *DbMap, exec SqlExecutor, list ...interface{}) error {
	for _, ptr := range list {
		table, elem, err := m.tableForPointer(ptr, false)
		if err != nil {
			return err
		}

		eval := elem.Addr().Interface()
		if v, ok := eval.(HasPreInsert); ok {
			err := v.PreInsert(exec)
			if err != nil {
				return err
			}
		}

		bi, err := table.bindInsert(elem)
		if err != nil {
			return err
		}

		if bi.autoIncrIdx > -1 {
			f := elem.FieldByName(bi.autoIncrFieldName)
			switch inserter := m.Dialect.(type) {
			case IntegerAutoIncrInserter:
				id, err := inserter.InsertAutoIncr(exec, bi.query, bi.args...)
				if err != nil {
					return err
				}
				k := f.Kind()
				if (k == reflect.Int) || (k == reflect.Int16) || (k == reflect.Int32) || (k == reflect.Int64) {
					f.SetInt(id)
				} else if (k == reflect.Uint) || (k == reflect.Uint16) || (k == reflect.Uint32) || (k == reflect.Uint64) {
					f.SetUint(uint64(id))
				} else {
					return fmt.Errorf("gorp: cannot set autoincrement value on non-Int field. SQL=%s  autoIncrIdx=%d autoIncrFieldName=%s", bi.query, bi.autoIncrIdx, bi.autoIncrFieldName)
				}
			case TargetedAutoIncrInserter:
				err := inserter.InsertAutoIncrToTarget(exec, bi.query, f.Addr().Interface(), bi.args...)
				if err != nil {
					return err
				}
			case TargetQueryInserter:
				var idQuery = table.ColMap(bi.autoIncrFieldName).GeneratedIdQuery
				if idQuery == "" {
					return fmt.Errorf("gorp: cannot set %s value if its ColumnMap.GeneratedIdQuery is empty", bi.autoIncrFieldName)
				}
				err := inserter.InsertQueryToTarget(exec, bi.query, idQuery, f.Addr().Interface(), bi.args...)
				if err != nil {
					return err
				}
			default:
				return fmt.Errorf("gorp: cannot use autoincrement fields on dialects that do not implement an autoincrementing interface")
			}
		} else {
			_, err := exec.Exec(bi.query, bi.args...)
			if err != nil {
				return err
			}
		}

		if v, ok := eval.(HasPostInsert); ok {
			err := v.PostInsert(exec)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
