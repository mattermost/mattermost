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
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// DbMap is the root gorp mapping object. Create one of these for each
// database schema you wish to map.  Each DbMap contains a list of
// mapped tables.
//
// Example:
//
//     dialect := gorp.MySQLDialect{"InnoDB", "UTF8"}
//     dbmap := &gorp.DbMap{Db: db, Dialect: dialect}
//
type DbMap struct {
	// Db handle to use with this map
	Db *sql.DB

	// Dialect implementation to use with this map
	Dialect Dialect

	TypeConverter TypeConverter

	QueryTimeout time.Duration

	tables        []*TableMap
	tablesDynamic map[string]*TableMap // tables that use same go-struct and different db table names
	logger        GorpLogger
	logPrefix     string
}

func (m *DbMap) dynamicTableAdd(tableName string, tbl *TableMap) {
	if m.tablesDynamic == nil {
		m.tablesDynamic = make(map[string]*TableMap)
	}
	m.tablesDynamic[tableName] = tbl
}

func (m *DbMap) dynamicTableFind(tableName string) (*TableMap, bool) {
	if m.tablesDynamic == nil {
		return nil, false
	}
	tbl, found := m.tablesDynamic[tableName]
	return tbl, found
}

func (m *DbMap) dynamicTableMap() map[string]*TableMap {
	if m.tablesDynamic == nil {
		m.tablesDynamic = make(map[string]*TableMap)
	}
	return m.tablesDynamic
}

func (m *DbMap) CreateIndex() error {

	var err error
	dialect := reflect.TypeOf(m.Dialect)
	for _, table := range m.tables {
		for _, index := range table.indexes {
			err = m.createIndexImpl(dialect, table, index)
			if err != nil {
				break
			}
		}
	}

	for _, table := range m.dynamicTableMap() {
		for _, index := range table.indexes {
			err = m.createIndexImpl(dialect, table, index)
			if err != nil {
				break
			}
		}
	}

	return err
}

func (m *DbMap) createIndexImpl(dialect reflect.Type,
	table *TableMap,
	index *IndexMap) error {
	s := bytes.Buffer{}
	s.WriteString("create")
	if index.Unique {
		s.WriteString(" unique")
	}
	s.WriteString(" index")
	s.WriteString(fmt.Sprintf(" %s on %s", index.IndexName, table.TableName))
	if dname := dialect.Name(); dname == "PostgresDialect" && index.IndexType != "" {
		s.WriteString(fmt.Sprintf(" %s %s", m.Dialect.CreateIndexSuffix(), index.IndexType))
	}
	s.WriteString(" (")
	for x, col := range index.columns {
		if x > 0 {
			s.WriteString(", ")
		}
		s.WriteString(m.Dialect.QuoteField(col))
	}
	s.WriteString(")")

	if dname := dialect.Name(); dname == "MySQLDialect" && index.IndexType != "" {
		s.WriteString(fmt.Sprintf(" %s %s", m.Dialect.CreateIndexSuffix(), index.IndexType))
	}
	s.WriteString(";")
	_, err := m.ExecNoTimeout(s.String())
	return err
}

func (t *TableMap) DropIndex(name string) error {

	var err error
	dialect := reflect.TypeOf(t.dbmap.Dialect)
	for _, idx := range t.indexes {
		if idx.IndexName == name {
			s := bytes.Buffer{}
			s.WriteString(fmt.Sprintf("DROP INDEX %s", idx.IndexName))

			if dname := dialect.Name(); dname == "MySQLDialect" {
				s.WriteString(fmt.Sprintf(" %s %s", t.dbmap.Dialect.DropIndexSuffix(), t.TableName))
			}
			s.WriteString(";")
			_, e := t.dbmap.ExecNoTimeout(s.String())
			if e != nil {
				err = e
			}
			break
		}
	}
	t.ResetSql()
	return err
}

// AddTable registers the given interface type with gorp. The table name
// will be given the name of the TypeOf(i).  You must call this function,
// or AddTableWithName, for any struct type you wish to persist with
// the given DbMap.
//
// This operation is idempotent. If i's type is already mapped, the
// existing *TableMap is returned
func (m *DbMap) AddTable(i interface{}) *TableMap {
	return m.AddTableWithName(i, "")
}

// AddTableWithName has the same behavior as AddTable, but sets
// table.TableName to name.
func (m *DbMap) AddTableWithName(i interface{}, name string) *TableMap {
	return m.AddTableWithNameAndSchema(i, "", name)
}

// AddTableWithNameAndSchema has the same behavior as AddTable, but sets
// table.TableName to name.
func (m *DbMap) AddTableWithNameAndSchema(i interface{}, schema string, name string) *TableMap {
	t := reflect.TypeOf(i)
	if name == "" {
		name = t.Name()
	}

	// check if we have a table for this type already
	// if so, update the name and return the existing pointer
	for i := range m.tables {
		table := m.tables[i]
		if table.gotype == t {
			table.TableName = name
			return table
		}
	}

	tmap := &TableMap{gotype: t, TableName: name, SchemaName: schema, dbmap: m}
	var primaryKey []*ColumnMap
	tmap.Columns, primaryKey = m.readStructColumns(t)
	m.tables = append(m.tables, tmap)
	if len(primaryKey) > 0 {
		tmap.keys = append(tmap.keys, primaryKey...)
	}

	return tmap
}

// AddTableDynamic registers the given interface type with gorp.
// The table name will be dynamically determined at runtime by
// using the GetTableName method on DynamicTable interface
func (m *DbMap) AddTableDynamic(inp DynamicTable, schema string) *TableMap {

	val := reflect.ValueOf(inp)
	elm := val.Elem()
	t := elm.Type()
	name := inp.TableName()
	if name == "" {
		panic("Missing table name in DynamicTable instance")
	}

	// Check if there is another dynamic table with the same name
	if _, found := m.dynamicTableFind(name); found {
		panic(fmt.Sprintf("A table with the same name %v already exists", name))
	}

	tmap := &TableMap{gotype: t, TableName: name, SchemaName: schema, dbmap: m}
	var primaryKey []*ColumnMap
	tmap.Columns, primaryKey = m.readStructColumns(t)
	if len(primaryKey) > 0 {
		tmap.keys = append(tmap.keys, primaryKey...)
	}

	m.dynamicTableAdd(name, tmap)

	return tmap
}

func (m *DbMap) readStructColumns(t reflect.Type) (cols []*ColumnMap, primaryKey []*ColumnMap) {
	primaryKey = make([]*ColumnMap, 0)
	n := t.NumField()
	for i := 0; i < n; i++ {
		f := t.Field(i)
		if f.Anonymous && f.Type.Kind() == reflect.Struct {
			// Recursively add nested fields in embedded structs.
			subcols, subpk := m.readStructColumns(f.Type)
			// Don't append nested fields that have the same field
			// name as an already-mapped field.
			for _, subcol := range subcols {
				shouldAppend := true
				for _, col := range cols {
					if !subcol.Transient && subcol.fieldName == col.fieldName {
						shouldAppend = false
						break
					}
				}
				if shouldAppend {
					cols = append(cols, subcol)
				}
			}
			if subpk != nil {
				primaryKey = append(primaryKey, subpk...)
			}
		} else {
			// Tag = Name { ','  Option }
			// Option = OptionKey [ ':' OptionValue ]
			cArguments := strings.Split(f.Tag.Get("db"), ",")
			columnName := cArguments[0]
			var maxSize int
			var defaultValue string
			var isAuto bool
			var isPK bool
			var isNotNull bool
			for _, argString := range cArguments[1:] {
				argString = strings.TrimSpace(argString)
				arg := strings.SplitN(argString, ":", 2)

				// check mandatory/unexpected option values
				switch arg[0] {
				case "size", "default":
					// options requiring value
					if len(arg) == 1 {
						panic(fmt.Sprintf("missing option value for option %v on field %v", arg[0], f.Name))
					}
				default:
					// options where value is invalid (currently all other options)
					if len(arg) == 2 {
						panic(fmt.Sprintf("unexpected option value for option %v on field %v", arg[0], f.Name))
					}
				}

				switch arg[0] {
				case "size":
					maxSize, _ = strconv.Atoi(arg[1])
				case "default":
					defaultValue = arg[1]
				case "primarykey":
					isPK = true
				case "autoincrement":
					isAuto = true
				case "notnull":
					isNotNull = true
				default:
					panic(fmt.Sprintf("Unrecognized tag option for field %v: %v", f.Name, arg))
				}
			}
			if columnName == "" {
				columnName = f.Name
			}

			gotype := f.Type
			valueType := gotype
			if valueType.Kind() == reflect.Ptr {
				valueType = valueType.Elem()
			}
			value := reflect.New(valueType).Interface()
			if m.TypeConverter != nil {
				// Make a new pointer to a value of type gotype and
				// pass it to the TypeConverter's FromDb method to see
				// if a different type should be used for the column
				// type during table creation.
				scanner, useHolder := m.TypeConverter.FromDb(value)
				if useHolder {
					value = scanner.Holder
					gotype = reflect.TypeOf(value)
				}
			}
			if typer, ok := value.(SqlTyper); ok {
				gotype = reflect.TypeOf(typer.SqlType())
			} else if valuer, ok := value.(driver.Valuer); ok {
				// Only check for driver.Valuer if SqlTyper wasn't
				// found.
				v, err := valuer.Value()
				if err == nil && v != nil {
					gotype = reflect.TypeOf(v)
				}
			}
			cm := &ColumnMap{
				ColumnName:   columnName,
				DefaultValue: defaultValue,
				Transient:    columnName == "-",
				fieldName:    f.Name,
				gotype:       gotype,
				isPK:         isPK,
				isAutoIncr:   isAuto,
				isNotNull:    isNotNull,
				MaxSize:      maxSize,
			}
			if isPK {
				primaryKey = append(primaryKey, cm)
			}
			// Check for nested fields of the same field name and
			// override them.
			shouldAppend := true
			for index, col := range cols {
				if !col.Transient && col.fieldName == cm.fieldName {
					cols[index] = cm
					shouldAppend = false
					break
				}
			}
			if shouldAppend {
				cols = append(cols, cm)
			}
		}

	}
	return
}

// CreateTables iterates through TableMaps registered to this DbMap and
// executes "create table" statements against the database for each.
//
// This is particularly useful in unit tests where you want to create
// and destroy the schema automatically.
func (m *DbMap) CreateTables() error {
	return m.createTables(false)
}

// CreateTablesIfNotExists is similar to CreateTables, but starts
// each statement with "create table if not exists" so that existing
// tables do not raise errors
func (m *DbMap) CreateTablesIfNotExists() error {
	return m.createTables(true)
}

func (m *DbMap) createTables(ifNotExists bool) error {
	var err error
	for i := range m.tables {
		table := m.tables[i]
		sql := table.SqlForCreate(ifNotExists)
		_, err = m.ExecNoTimeout(sql)
		if err != nil {
			return err
		}
	}

	for _, tbl := range m.dynamicTableMap() {
		sql := tbl.SqlForCreate(ifNotExists)
		_, err = m.ExecNoTimeout(sql)
		if err != nil {
			return err
		}
	}

	return err
}

// DropTable drops an individual table.
// Returns an error when the table does not exist.
func (m *DbMap) DropTable(table interface{}) error {
	t := reflect.TypeOf(table)

	tableName := ""
	if dyn, ok := table.(DynamicTable); ok {
		tableName = dyn.TableName()
	}

	return m.dropTable(t, tableName, false)
}

// DropTableIfExists drops an individual table when the table exists.
func (m *DbMap) DropTableIfExists(table interface{}) error {
	t := reflect.TypeOf(table)

	tableName := ""
	if dyn, ok := table.(DynamicTable); ok {
		tableName = dyn.TableName()
	}

	return m.dropTable(t, tableName, true)
}

// DropTables iterates through TableMaps registered to this DbMap and
// executes "drop table" statements against the database for each.
func (m *DbMap) DropTables() error {
	return m.dropTables(false)
}

// DropTablesIfExists is the same as DropTables, but uses the "if exists" clause to
// avoid errors for tables that do not exist.
func (m *DbMap) DropTablesIfExists() error {
	return m.dropTables(true)
}

// Goes through all the registered tables, dropping them one by one.
// If an error is encountered, then it is returned and the rest of
// the tables are not dropped.
func (m *DbMap) dropTables(addIfExists bool) (err error) {
	for _, table := range m.tables {
		err = m.dropTableImpl(table, addIfExists)
		if err != nil {
			return err
		}
	}

	for _, table := range m.dynamicTableMap() {
		err = m.dropTableImpl(table, addIfExists)
		if err != nil {
			return err
		}
	}

	return err
}

// Implementation of dropping a single table.
func (m *DbMap) dropTable(t reflect.Type, name string, addIfExists bool) error {
	table := tableOrNil(m, t, name)
	if table == nil {
		return fmt.Errorf("table %s was not registered", table.TableName)
	}

	return m.dropTableImpl(table, addIfExists)
}

func (m *DbMap) dropTableImpl(table *TableMap, ifExists bool) (err error) {
	tableDrop := "drop table"
	if ifExists {
		tableDrop = m.Dialect.IfTableExists(tableDrop, table.SchemaName, table.TableName)
	}
	_, err = m.ExecNoTimeout(fmt.Sprintf("%s %s;", tableDrop, m.Dialect.QuotedTableForQuery(table.SchemaName, table.TableName)))
	return err
}

// TruncateTables iterates through TableMaps registered to this DbMap and
// executes "truncate table" statements against the database for each, or in the case of
// sqlite, a "delete from" with no "where" clause, which uses the truncate optimization
// (http://www.sqlite.org/lang_delete.html)
func (m *DbMap) TruncateTables() error {
	var err error
	for i := range m.tables {
		table := m.tables[i]
		_, e := m.ExecNoTimeout(fmt.Sprintf("%s %s;", m.Dialect.TruncateClause(), m.Dialect.QuotedTableForQuery(table.SchemaName, table.TableName)))
		if e != nil {
			err = e
		}
	}

	for _, table := range m.dynamicTableMap() {
		_, e := m.ExecNoTimeout(fmt.Sprintf("%s %s;", m.Dialect.TruncateClause(), m.Dialect.QuotedTableForQuery(table.SchemaName, table.TableName)))
		if e != nil {
			err = e
		}
	}

	return err
}

// Insert runs a SQL INSERT statement for each element in list.  List
// items must be pointers.
//
// Any interface whose TableMap has an auto-increment primary key will
// have its last insert id bound to the PK field on the struct.
//
// The hook functions PreInsert() and/or PostInsert() will be executed
// before/after the INSERT statement if the interface defines them.
//
// Panics if any interface in the list has not been registered with AddTable
func (m *DbMap) Insert(list ...interface{}) error {
	return insert(m, m, list...)
}

// Update runs a SQL UPDATE statement for each element in list.  List
// items must be pointers.
//
// The hook functions PreUpdate() and/or PostUpdate() will be executed
// before/after the UPDATE statement if the interface defines them.
//
// Returns the number of rows updated.
//
// Returns an error if SetKeys has not been called on the TableMap
// Panics if any interface in the list has not been registered with AddTable
func (m *DbMap) Update(list ...interface{}) (int64, error) {
	return update(m, m, nil, list...)
}

// UpdateColumns runs a SQL UPDATE statement for each element in list.  List
// items must be pointers.
//
// Only the columns accepted by filter are included in the UPDATE.
//
// The hook functions PreUpdate() and/or PostUpdate() will be executed
// before/after the UPDATE statement if the interface defines them.
//
// Returns the number of rows updated.
//
// Returns an error if SetKeys has not been called on the TableMap
// Panics if any interface in the list has not been registered with AddTable
func (m *DbMap) UpdateColumns(filter ColumnFilter, list ...interface{}) (int64, error) {
	return update(m, m, filter, list...)
}

// Delete runs a SQL DELETE statement for each element in list.  List
// items must be pointers.
//
// The hook functions PreDelete() and/or PostDelete() will be executed
// before/after the DELETE statement if the interface defines them.
//
// Returns the number of rows deleted.
//
// Returns an error if SetKeys has not been called on the TableMap
// Panics if any interface in the list has not been registered with AddTable
func (m *DbMap) Delete(list ...interface{}) (int64, error) {
	return delete(m, m, list...)
}

// Get runs a SQL SELECT to fetch a single row from the table based on the
// primary key(s)
//
// i should be an empty value for the struct to load.  keys should be
// the primary key value(s) for the row to load.  If multiple keys
// exist on the table, the order should match the column order
// specified in SetKeys() when the table mapping was defined.
//
// The hook function PostGet() will be executed after the SELECT
// statement if the interface defines them.
//
// Returns a pointer to a struct that matches or nil if no row is found.
//
// Returns an error if SetKeys has not been called on the TableMap
// Panics if any interface in the list has not been registered with AddTable
func (m *DbMap) Get(i interface{}, keys ...interface{}) (interface{}, error) {
	return get(m, m, i, keys...)
}

// Select runs an arbitrary SQL query, binding the columns in the result
// to fields on the struct specified by i.  args represent the bind
// parameters for the SQL statement.
//
// Column names on the SELECT statement should be aliased to the field names
// on the struct i. Returns an error if one or more columns in the result
// do not match.  It is OK if fields on i are not part of the SQL
// statement.
//
// The hook function PostGet() will be executed after the SELECT
// statement if the interface defines them.
//
// Values are returned in one of two ways:
// 1. If i is a struct or a pointer to a struct, returns a slice of pointers to
// matching rows of type i.
// 2. If i is a pointer to a slice, the results will be appended to that slice
// and nil returned.
//
// i does NOT need to be registered with AddTable()
func (m *DbMap) Select(i interface{}, query string, args ...interface{}) ([]interface{}, error) {
	return hookedselect(m, m, i, query, args...)
}

// Exec runs an arbitrary SQL statement.  args represent the bind parameters.
// This is equivalent to running:  Exec() using database/sql
// Times out based on the DbMap.QueryTimeout field
func (m *DbMap) Exec(query string, args ...interface{}) (sql.Result, error) {
	if m.logger != nil {
		now := time.Now()
		defer m.trace(now, query, args...)
	}
	return exec(m, query, true, args...)
}

// ExecNoTimeout is the same as Exec except it will not time out
func (m *DbMap) ExecNoTimeout(query string, args ...interface{}) (sql.Result, error) {
	if m.logger != nil {
		now := time.Now()
		defer m.trace(now, query, args...)
	}
	return exec(m, query, false, args...)
}

// SelectInt is a convenience wrapper around the gorp.SelectInt function
func (m *DbMap) SelectInt(query string, args ...interface{}) (int64, error) {
	return SelectInt(m, query, args...)
}

// SelectNullInt is a convenience wrapper around the gorp.SelectNullInt function
func (m *DbMap) SelectNullInt(query string, args ...interface{}) (sql.NullInt64, error) {
	return SelectNullInt(m, query, args...)
}

// SelectFloat is a convenience wrapper around the gorp.SelectFloat function
func (m *DbMap) SelectFloat(query string, args ...interface{}) (float64, error) {
	return SelectFloat(m, query, args...)
}

// SelectNullFloat is a convenience wrapper around the gorp.SelectNullFloat function
func (m *DbMap) SelectNullFloat(query string, args ...interface{}) (sql.NullFloat64, error) {
	return SelectNullFloat(m, query, args...)
}

// SelectStr is a convenience wrapper around the gorp.SelectStr function
func (m *DbMap) SelectStr(query string, args ...interface{}) (string, error) {
	return SelectStr(m, query, args...)
}

// SelectNullStr is a convenience wrapper around the gorp.SelectNullStr function
func (m *DbMap) SelectNullStr(query string, args ...interface{}) (sql.NullString, error) {
	return SelectNullStr(m, query, args...)
}

// SelectOne is a convenience wrapper around the gorp.SelectOne function
func (m *DbMap) SelectOne(holder interface{}, query string, args ...interface{}) error {
	return SelectOne(m, m, holder, query, args...)
}

// Begin starts a gorp Transaction
func (m *DbMap) Begin() (*Transaction, error) {
	if m.logger != nil {
		now := time.Now()
		defer m.trace(now, "begin;")
	}
	tx, err := m.Db.Begin()
	if err != nil {
		return nil, err
	}
	return &Transaction{m, tx, false}, nil
}

// TableFor returns the *TableMap corresponding to the given Go Type
// If no table is mapped to that type an error is returned.
// If checkPK is true and the mapped table has no registered PKs, an error is returned.
func (m *DbMap) TableFor(t reflect.Type, checkPK bool) (*TableMap, error) {
	table := tableOrNil(m, t, "")
	if table == nil {
		return nil, fmt.Errorf("no table found for type: %v", t.Name())
	}

	if checkPK && len(table.keys) < 1 {
		e := fmt.Sprintf("gorp: no keys defined for table: %s",
			table.TableName)
		return nil, errors.New(e)
	}

	return table, nil
}

// DynamicTableFor returns the *TableMap for the dynamic table corresponding
// to the input tablename
// If no table is mapped to that tablename an error is returned.
// If checkPK is true and the mapped table has no registered PKs, an error is returned.
func (m *DbMap) DynamicTableFor(tableName string, checkPK bool) (*TableMap, error) {
	table, found := m.dynamicTableFind(tableName)
	if !found {
		return nil, fmt.Errorf("gorp: no table found for name: %v", tableName)
	}

	if checkPK && len(table.keys) < 1 {
		e := fmt.Sprintf("gorp: no keys defined for table: %s",
			table.TableName)
		return nil, errors.New(e)
	}

	return table, nil
}

// Prepare creates a prepared statement for later queries or executions.
// Multiple queries or executions may be run concurrently from the returned statement.
// This is equivalent to running:  Prepare() using database/sql
func (m *DbMap) Prepare(query string) (*sql.Stmt, error) {
	if m.logger != nil {
		now := time.Now()
		defer m.trace(now, query, nil)
	}
	return m.Db.Prepare(query)
}

func tableOrNil(m *DbMap, t reflect.Type, name string) *TableMap {
	if name != "" {
		// Search by table name (dynamic tables)
		if table, found := m.dynamicTableFind(name); found {
			return table
		}
		return nil
	}

	for i := range m.tables {
		table := m.tables[i]
		if table.gotype == t {
			return table
		}
	}
	return nil
}

func (m *DbMap) tableForPointer(ptr interface{}, checkPK bool) (*TableMap, reflect.Value, error) {
	ptrv := reflect.ValueOf(ptr)
	if ptrv.Kind() != reflect.Ptr {
		e := fmt.Sprintf("gorp: passed non-pointer: %v (kind=%v)", ptr,
			ptrv.Kind())
		return nil, reflect.Value{}, errors.New(e)
	}
	elem := ptrv.Elem()
	ifc := elem.Interface()
	var t *TableMap
	var err error
	tableName := ""
	if dyn, isDyn := ptr.(DynamicTable); isDyn {
		tableName = dyn.TableName()
		t, err = m.DynamicTableFor(tableName, checkPK)
	} else {
		etype := reflect.TypeOf(ifc)
		t, err = m.TableFor(etype, checkPK)
	}

	if err != nil {
		return nil, reflect.Value{}, err
	}

	return t, elem, nil
}

func (m *DbMap) QueryRow(query string, args ...interface{}) *sql.Row {
	if m.logger != nil {
		now := time.Now()
		defer m.trace(now, query, args...)
	}

	return m.Db.QueryRow(query, args...)
}

func (m *DbMap) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	if m.logger != nil {
		now := time.Now()
		defer m.trace(now, query, args...)
	}

	return m.Db.QueryRowContext(ctx, query, args...)
}

func (m *DbMap) Query(query string, args ...interface{}) (*sql.Rows, error) {
	if m.logger != nil {
		now := time.Now()
		defer m.trace(now, query, args...)
	}

	return m.Db.Query(query, args...)
}

func (m *DbMap) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	if m.logger != nil {
		now := time.Now()
		defer m.trace(now, query, args...)
	}

	return m.Db.QueryContext(ctx, query, args...)
}

func (m *DbMap) trace(started time.Time, query string, args ...interface{}) {
	if m.logger != nil {
		var margs = argsString(args...)
		m.logger.Printf("%s%s [%s] (%v)", m.logPrefix, query, margs, (time.Now().Sub(started)))
	}
}
