// Copyright 2012 James Cooper. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

// Package gorp provides a simple way to marshal Go structs to and from
// SQL databases.  It uses the database/sql package, and should work with any
// compliant database/sql driver.
//
// Source code and project home:
// https://github.com/go-gorp/gorp

package gorp_test

import (
	"bytes"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-gorp/gorp"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	_ "github.com/ziutek/mymysql/godrv"
)

var (
	// verify interface compliance
	_ = []gorp.Dialect{
		gorp.SqliteDialect{},
		gorp.PostgresDialect{},
		gorp.MySQLDialect{},
		gorp.SqlServerDialect{},
		gorp.OracleDialect{},
	}

	debug bool
)

func init() {
	flag.BoolVar(&debug, "trace", true, "Turn on or off database tracing (DbMap.TraceOn)")
	flag.Parse()
}

type testable interface {
	GetId() int64
	Rand()
}

type Invoice struct {
	Id       int64
	Created  int64
	Updated  int64
	Memo     string
	PersonId int64
	IsPaid   bool
}

type InvoiceWithValuer struct {
	Id      int64
	Created int64
	Updated int64
	Memo    string
	Person  PersonValuerScanner `db:"personid"`
	IsPaid  bool
}

func (me *Invoice) GetId() int64 { return me.Id }
func (me *Invoice) Rand() {
	me.Memo = fmt.Sprintf("random %d", rand.Int63())
	me.Created = rand.Int63()
	me.Updated = rand.Int63()
}

type InvoiceTag struct {
	Id       int64 `db:"myid, primarykey, autoincrement"`
	Created  int64 `db:"myCreated"`
	Updated  int64 `db:"date_updated"`
	Memo     string
	PersonId int64 `db:"person_id"`
	IsPaid   bool  `db:"is_Paid"`
}

func (me *InvoiceTag) GetId() int64 { return me.Id }
func (me *InvoiceTag) Rand() {
	me.Memo = fmt.Sprintf("random %d", rand.Int63())
	me.Created = rand.Int63()
	me.Updated = rand.Int63()
}

// See: https://github.com/go-gorp/gorp/issues/175
type AliasTransientField struct {
	Id     int64  `db:"id"`
	Bar    int64  `db:"-"`
	BarStr string `db:"bar"`
}

func (me *AliasTransientField) GetId() int64 { return me.Id }
func (me *AliasTransientField) Rand() {
	me.BarStr = fmt.Sprintf("random %d", rand.Int63())
}

type OverriddenInvoice struct {
	Invoice
	Id string
}

type Person struct {
	Id      int64
	Created int64
	Updated int64
	FName   string
	LName   string
	Version int64
}

// PersonValuerScanner is used as a field in test types to ensure that we
// make use of "database/sql/driver".Valuer for choosing column types when
// creating tables and that we don't get in the way of the underlying
// database libraries when they make use of either Valuer or
// "database/sql".Scanner.
type PersonValuerScanner struct {
	Person
}

// Value implements "database/sql/driver".Valuer.  It will be automatically
// run by the "database/sql" package when inserting/updating data.
func (p PersonValuerScanner) Value() (driver.Value, error) {
	return p.Id, nil
}

// Scan implements "database/sql".Scanner.  It will be automatically run
// by the "database/sql" package when reading column data into a field
// of type PersonValuerScanner.
func (p *PersonValuerScanner) Scan(value interface{}) (err error) {
	switch src := value.(type) {
	case []byte:
		// TODO: this case is here for mysql only.  For some reason,
		// one (both?) of the mysql libraries opt to pass us a []byte
		// instead of an int64 for the bigint column.  We should add
		// table tests around valuers/scanners and try to solve these
		// types of odd discrepencies to make it easier for users of
		// gorp to migrate to other database engines.
		p.Id, err = strconv.ParseInt(string(src), 10, 64)
	case int64:
		// Most libraries pass in the type we'd expect.
		p.Id = src
	default:
		typ := reflect.TypeOf(value)
		return fmt.Errorf("Expected person value to be convertible to int64, got %v (type %s)", value, typ)
	}
	return
}

type FNameOnly struct {
	FName string
}

type InvoicePersonView struct {
	InvoiceId     int64
	PersonId      int64
	Memo          string
	FName         string
	LegacyVersion int64
}

type TableWithNull struct {
	Id      int64
	Str     sql.NullString
	Int64   sql.NullInt64
	Float64 sql.NullFloat64
	Bool    sql.NullBool
	Bytes   []byte
}

type WithIgnoredColumn struct {
	internal int64 `db:"-"`
	Id       int64
	Created  int64
}

type IdCreated struct {
	Id      int64
	Created int64
}

type IdCreatedExternal struct {
	IdCreated
	External int64
}

type WithStringPk struct {
	Id   string
	Name string
}

type CustomStringType string

type TypeConversionExample struct {
	Id         int64
	PersonJSON Person
	Name       CustomStringType
}

type PersonUInt32 struct {
	Id   uint32
	Name string
}

type PersonUInt64 struct {
	Id   uint64
	Name string
}

type PersonUInt16 struct {
	Id   uint16
	Name string
}

type WithEmbeddedStruct struct {
	Id int64
	Names
}

type WithEmbeddedStructConflictingEmbeddedMemberNames struct {
	Id int64
	Names
	NamesConflict
}

type WithEmbeddedStructSameMemberName struct {
	Id int64
	SameName
}

type WithEmbeddedStructBeforeAutoincrField struct {
	Names
	Id int64
}

type WithEmbeddedAutoincr struct {
	WithEmbeddedStruct
	MiddleName string
}

type Names struct {
	FirstName string
	LastName  string
}

type NamesConflict struct {
	FirstName string
	Surname   string
}

type SameName struct {
	SameName string
}

type UniqueColumns struct {
	FirstName string
	LastName  string
	City      string
	ZipCode   int64
}

type SingleColumnTable struct {
	SomeId string
}

type CustomDate struct {
	time.Time
}

type WithCustomDate struct {
	Id    int64
	Added CustomDate
}

type WithNullTime struct {
	Id   int64
	Time gorp.NullTime
}

type testTypeConverter struct{}

func (me testTypeConverter) ToDb(val interface{}) (interface{}, error) {

	switch t := val.(type) {
	case Person:
		b, err := json.Marshal(t)
		if err != nil {
			return "", err
		}
		return string(b), nil
	case CustomStringType:
		return string(t), nil
	case CustomDate:
		return t.Time, nil
	}

	return val, nil
}

func (me testTypeConverter) FromDb(target interface{}) (gorp.CustomScanner, bool) {
	switch target.(type) {
	case *Person:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New("FromDb: Unable to convert Person to *string")
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{new(string), target, binder}, true
	case *CustomStringType:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New("FromDb: Unable to convert CustomStringType to *string")
			}
			st, ok := target.(*CustomStringType)
			if !ok {
				return errors.New(fmt.Sprint("FromDb: Unable to convert target to *CustomStringType: ", reflect.TypeOf(target)))
			}
			*st = CustomStringType(*s)
			return nil
		}
		return gorp.CustomScanner{new(string), target, binder}, true
	case *CustomDate:
		binder := func(holder, target interface{}) error {
			t, ok := holder.(*time.Time)
			if !ok {
				return errors.New("FromDb: Unable to convert CustomDate to *time.Time")
			}
			dateTarget, ok := target.(*CustomDate)
			if !ok {
				return errors.New(fmt.Sprint("FromDb: Unable to convert target to *CustomDate: ", reflect.TypeOf(target)))
			}
			dateTarget.Time = *t
			return nil
		}
		return gorp.CustomScanner{new(time.Time), target, binder}, true
	}

	return gorp.CustomScanner{}, false
}

func (p *Person) PreInsert(s gorp.SqlExecutor) error {
	p.Created = time.Now().UnixNano()
	p.Updated = p.Created
	if p.FName == "badname" {
		return fmt.Errorf("Invalid name: %s", p.FName)
	}
	return nil
}

func (p *Person) PostInsert(s gorp.SqlExecutor) error {
	p.LName = "postinsert"
	return nil
}

func (p *Person) PreUpdate(s gorp.SqlExecutor) error {
	p.FName = "preupdate"
	return nil
}

func (p *Person) PostUpdate(s gorp.SqlExecutor) error {
	p.LName = "postupdate"
	return nil
}

func (p *Person) PreDelete(s gorp.SqlExecutor) error {
	p.FName = "predelete"
	return nil
}

func (p *Person) PostDelete(s gorp.SqlExecutor) error {
	p.LName = "postdelete"
	return nil
}

func (p *Person) PostGet(s gorp.SqlExecutor) error {
	p.LName = "postget"
	return nil
}

type PersistentUser struct {
	Key            int32
	Id             string
	PassedTraining bool
}

type TenantDynamic struct {
	Id       int64 `db:"id"`
	Name     string
	Address  string
	curTable string `db:"-"`
}

func (curObj *TenantDynamic) TableName() string {
	return curObj.curTable
}
func (curObj *TenantDynamic) SetTableName(tblName string) {
	curObj.curTable = tblName
}

var dynTableInst1 = TenantDynamic{curTable: "t_1_tenant_dynamic"}
var dynTableInst2 = TenantDynamic{curTable: "t_2_tenant_dynamic"}

func dynamicTablesTest(t *testing.T, dbmap *gorp.DbMap) {

	dynamicTablesTestTableMap(t, dbmap, &dynTableInst1)
	dynamicTablesTestTableMap(t, dbmap, &dynTableInst2)

	// TEST - dbmap.Insert using dynTableInst1
	dynTableInst1.Name = "Test Name 1"
	dynTableInst1.Address = "Test Address 1"
	err := dbmap.Insert(&dynTableInst1)
	if err != nil {
		t.Errorf("Errow while saving dynTableInst1. Details: %v", err)
	}

	// TEST - dbmap.Insert using dynTableInst2
	dynTableInst2.Name = "Test Name 2"
	dynTableInst2.Address = "Test Address 2"
	err = dbmap.Insert(&dynTableInst2)
	if err != nil {
		t.Errorf("Errow while saving dynTableInst2. Details: %v", err)
	}

	dynamicTablesTestSelect(t, dbmap, &dynTableInst1)
	dynamicTablesTestSelect(t, dbmap, &dynTableInst2)
	dynamicTablesTestSelectOne(t, dbmap, &dynTableInst1)
	dynamicTablesTestSelectOne(t, dbmap, &dynTableInst2)
	dynamicTablesTestGetUpdateGet(t, dbmap, &dynTableInst1)
	dynamicTablesTestGetUpdateGet(t, dbmap, &dynTableInst2)
	dynamicTablesTestDelete(t, dbmap, &dynTableInst1)
	dynamicTablesTestDelete(t, dbmap, &dynTableInst2)

}

func dynamicTablesTestTableMap(t *testing.T,
	dbmap *gorp.DbMap,
	inpInst *TenantDynamic) {

	tableName := inpInst.TableName()

	tblMap, err := dbmap.DynamicTableFor(tableName, true)
	if err != nil {
		t.Errorf("Error while searching for tablemap for tableName: %v, Error:%v", tableName, err)
	}
	if tblMap == nil {
		t.Errorf("Unable to find tablemap for tableName:%v", tableName)
	}
}

func dynamicTablesTestSelect(t *testing.T,
	dbmap *gorp.DbMap,
	inpInst *TenantDynamic) {

	// TEST - dbmap.Select using inpInst

	// read the data back from dynInst to see if the
	// table mapping is correct
	var dbTenantInst1 = TenantDynamic{curTable: inpInst.curTable}
	selectSQL1 := "select * from " + inpInst.curTable
	dbObjs, err := dbmap.Select(&dbTenantInst1, selectSQL1)
	if err != nil {
		t.Errorf("Errow in dbmap.Select. SQL: %v, Details: %v", selectSQL1, err)
	}
	if dbObjs == nil {
		t.Fatalf("Nil return from dbmap.Select")
	}
	rwCnt := len(dbObjs)
	if rwCnt != 1 {
		t.Errorf("Unexpected row count for tenantInst:%v", rwCnt)
	}

	dbInst := dbObjs[0].(*TenantDynamic)

	inpTableName := inpInst.TableName()
	resTableName := dbInst.TableName()
	if inpTableName != resTableName {
		t.Errorf("Mismatched table names %v != %v ",
			inpTableName, resTableName)
	}

	if inpInst.Id != dbInst.Id {
		t.Errorf("Mismatched Id values %v != %v ",
			inpInst.Id, dbInst.Id)
	}

	if inpInst.Name != dbInst.Name {
		t.Errorf("Mismatched Name values %v != %v ",
			inpInst.Name, dbInst.Name)
	}

	if inpInst.Address != dbInst.Address {
		t.Errorf("Mismatched Address values %v != %v ",
			inpInst.Address, dbInst.Address)
	}
}

func dynamicTablesTestGetUpdateGet(t *testing.T,
	dbmap *gorp.DbMap,
	inpInst *TenantDynamic) {

	// TEST - dbmap.Get, dbmap.Update, dbmap.Get sequence

	// read and update one of the instances to make sure
	// that the common gorp APIs are working well with dynamic table
	var inpIface2 = TenantDynamic{curTable: inpInst.curTable}
	dbObj, err := dbmap.Get(&inpIface2, inpInst.Id)
	if err != nil {
		t.Errorf("Errow in dbmap.Get. id: %v, Details: %v", inpInst.Id, err)
	}
	if dbObj == nil {
		t.Errorf("Nil return from dbmap.Get")
	}

	dbInst := dbObj.(*TenantDynamic)

	{
		inpTableName := inpInst.TableName()
		resTableName := dbInst.TableName()
		if inpTableName != resTableName {
			t.Errorf("Mismatched table names %v != %v ",
				inpTableName, resTableName)
		}

		if inpInst.Id != dbInst.Id {
			t.Errorf("Mismatched Id values %v != %v ",
				inpInst.Id, dbInst.Id)
		}

		if inpInst.Name != dbInst.Name {
			t.Errorf("Mismatched Name values %v != %v ",
				inpInst.Name, dbInst.Name)
		}

		if inpInst.Address != dbInst.Address {
			t.Errorf("Mismatched Address values %v != %v ",
				inpInst.Address, dbInst.Address)
		}
	}

	{
		updatedName := "Testing Updated Name2"
		dbInst.Name = updatedName
		cnt, err := dbmap.Update(dbInst)
		if err != nil {
			t.Errorf("Error from dbmap.Update: %v", err.Error())
		}
		if cnt != 1 {
			t.Errorf("Update count must be 1, got %v", cnt)
		}

		// Read the object again to make sure that the
		// data was updated in db
		dbObj2, err := dbmap.Get(&inpIface2, inpInst.Id)
		if err != nil {
			t.Errorf("Errow in dbmap.Get. id: %v, Details: %v", inpInst.Id, err)
		}
		if dbObj2 == nil {
			t.Errorf("Nil return from dbmap.Get")
		}

		dbInst2 := dbObj2.(*TenantDynamic)

		inpTableName := inpInst.TableName()
		resTableName := dbInst2.TableName()
		if inpTableName != resTableName {
			t.Errorf("Mismatched table names %v != %v ",
				inpTableName, resTableName)
		}

		if inpInst.Id != dbInst2.Id {
			t.Errorf("Mismatched Id values %v != %v ",
				inpInst.Id, dbInst2.Id)
		}

		if updatedName != dbInst2.Name {
			t.Errorf("Mismatched Name values %v != %v ",
				updatedName, dbInst2.Name)
		}

		if inpInst.Address != dbInst.Address {
			t.Errorf("Mismatched Address values %v != %v ",
				inpInst.Address, dbInst.Address)
		}

	}
}

func dynamicTablesTestSelectOne(t *testing.T,
	dbmap *gorp.DbMap,
	inpInst *TenantDynamic) {

	// TEST - dbmap.SelectOne

	// read the data back from inpInst to see if the
	// table mapping is correct
	var dbTenantInst1 = TenantDynamic{curTable: inpInst.curTable}
	selectSQL1 := "select * from " + dbTenantInst1.curTable + " where id = :idKey"
	params := map[string]interface{}{"idKey": inpInst.Id}
	err := dbmap.SelectOne(&dbTenantInst1, selectSQL1, params)
	if err != nil {
		t.Errorf("Errow in dbmap.SelectOne. SQL: %v, Details: %v", selectSQL1, err)
	}

	inpTableName := inpInst.curTable
	resTableName := dbTenantInst1.TableName()
	if inpTableName != resTableName {
		t.Errorf("Mismatched table names %v != %v ",
			inpTableName, resTableName)
	}

	if inpInst.Id != dbTenantInst1.Id {
		t.Errorf("Mismatched Id values %v != %v ",
			inpInst.Id, dbTenantInst1.Id)
	}

	if inpInst.Name != dbTenantInst1.Name {
		t.Errorf("Mismatched Name values %v != %v ",
			inpInst.Name, dbTenantInst1.Name)
	}

	if inpInst.Address != dbTenantInst1.Address {
		t.Errorf("Mismatched Address values %v != %v ",
			inpInst.Address, dbTenantInst1.Address)
	}
}

func dynamicTablesTestDelete(t *testing.T,
	dbmap *gorp.DbMap,
	inpInst *TenantDynamic) {

	// TEST - dbmap.Delete
	cnt, err := dbmap.Delete(inpInst)
	if err != nil {
		t.Errorf("Errow in dbmap.Delete. Details: %v", err)
	}
	if cnt != 1 {
		t.Errorf("Expected delete count for %v : 1, found count:%v",
			inpInst.TableName(), cnt)
	}

	// Try reading again to make sure instance is gone from db
	getInst := TenantDynamic{curTable: inpInst.TableName()}
	dbInst, err := dbmap.Get(&getInst, inpInst.Id)
	if err != nil {
		t.Errorf("Error while trying to read deleted %v object using id: %v",
			inpInst.TableName(), inpInst.Id)
	}

	if dbInst != nil {
		t.Errorf("Found deleted %v instance using id: %v",
			inpInst.TableName(), inpInst.Id)
	}

	if getInst.Name != "" {
		t.Errorf("Found data from deleted %v instance using id: %v",
			inpInst.TableName(), inpInst.Id)
	}

}

func TestCreateTablesIfNotExists(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	err := dbmap.CreateTablesIfNotExists()
	if err != nil {
		t.Error(err)
	}
}

func TestTruncateTables(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)
	err := dbmap.CreateTablesIfNotExists()
	if err != nil {
		t.Error(err)
	}

	// Insert some data
	p1 := &Person{0, 0, 0, "Bob", "Smith", 0}
	dbmap.Insert(p1)
	inv := &Invoice{0, 0, 1, "my invoice", 0, true}
	dbmap.Insert(inv)

	err = dbmap.TruncateTables()
	if err != nil {
		t.Error(err)
	}

	// Make sure all rows are deleted
	rows, _ := dbmap.Select(Person{}, "SELECT * FROM person_test")
	if len(rows) != 0 {
		t.Errorf("Expected 0 person rows, got %d", len(rows))
	}
	rows, _ = dbmap.Select(Invoice{}, "SELECT * FROM invoice_test")
	if len(rows) != 0 {
		t.Errorf("Expected 0 invoice rows, got %d", len(rows))
	}
}

func TestCustomDateType(t *testing.T) {
	dbmap := newDbMap()
	dbmap.TypeConverter = testTypeConverter{}
	dbmap.AddTable(WithCustomDate{}).SetKeys(true, "Id")
	err := dbmap.CreateTables()
	if err != nil {
		panic(err)
	}
	defer dropAndClose(dbmap)

	test1 := &WithCustomDate{Added: CustomDate{Time: time.Now().Truncate(time.Second)}}
	err = dbmap.Insert(test1)
	if err != nil {
		t.Errorf("Could not insert struct with custom date field: %s", err)
		t.FailNow()
	}
	// Unfortunately, the mysql driver doesn't handle time.Time
	// values properly during Get().  I can't find a way to work
	// around that problem - every other type that I've tried is just
	// silently converted.  time.Time is the only type that causes
	// the issue that this test checks for.  As such, if the driver is
	// mysql, we'll just skip the rest of this test.
	if _, driver := dialectAndDriver(); driver == "mysql" {
		t.Skip("TestCustomDateType can't run Get() with the mysql driver; skipping the rest of this test...")
	}
	result, err := dbmap.Get(new(WithCustomDate), test1.Id)
	if err != nil {
		t.Errorf("Could not get struct with custom date field: %s", err)
		t.FailNow()
	}
	test2 := result.(*WithCustomDate)
	if test2.Added.UTC() != test1.Added.UTC() {
		t.Errorf("Custom dates do not match: %v != %v", test2.Added.UTC(), test1.Added.UTC())
	}
}

func TestUIntPrimaryKey(t *testing.T) {
	dbmap := newDbMap()
	dbmap.AddTable(PersonUInt64{}).SetKeys(true, "Id")
	dbmap.AddTable(PersonUInt32{}).SetKeys(true, "Id")
	dbmap.AddTable(PersonUInt16{}).SetKeys(true, "Id")
	err := dbmap.CreateTablesIfNotExists()
	if err != nil {
		panic(err)
	}
	defer dropAndClose(dbmap)

	p1 := &PersonUInt64{0, "name1"}
	p2 := &PersonUInt32{0, "name2"}
	p3 := &PersonUInt16{0, "name3"}
	err = dbmap.Insert(p1, p2, p3)
	if err != nil {
		t.Error(err)
	}
	if p1.Id != 1 {
		t.Errorf("%d != 1", p1.Id)
	}
	if p2.Id != 1 {
		t.Errorf("%d != 1", p2.Id)
	}
	if p3.Id != 1 {
		t.Errorf("%d != 1", p3.Id)
	}
}

func TestSetUniqueTogether(t *testing.T) {
	dbmap := newDbMap()
	dbmap.AddTable(UniqueColumns{}).SetUniqueTogether("FirstName", "LastName").SetUniqueTogether("City", "ZipCode")
	err := dbmap.CreateTablesIfNotExists()
	if err != nil {
		panic(err)
	}
	defer dropAndClose(dbmap)

	n1 := &UniqueColumns{"Steve", "Jobs", "Cupertino", 95014}
	err = dbmap.Insert(n1)
	if err != nil {
		t.Error(err)
	}

	// Should fail because of the first constraint
	n2 := &UniqueColumns{"Steve", "Jobs", "Sunnyvale", 94085}
	err = dbmap.Insert(n2)
	if err == nil {
		t.Error(err)
	}
	// "unique" for Postgres/SQLite, "Duplicate entry" for MySQL
	errLower := strings.ToLower(err.Error())
	if !strings.Contains(errLower, "unique") && !strings.Contains(errLower, "duplicate entry") {
		t.Error(err)
	}

	// Should also fail because of the second unique-together
	n3 := &UniqueColumns{"Steve", "Wozniak", "Cupertino", 95014}
	err = dbmap.Insert(n3)
	if err == nil {
		t.Error(err)
	}
	// "unique" for Postgres/SQLite, "Duplicate entry" for MySQL
	errLower = strings.ToLower(err.Error())
	if !strings.Contains(errLower, "unique") && !strings.Contains(errLower, "duplicate entry") {
		t.Error(err)
	}

	// This one should finally succeed
	n4 := &UniqueColumns{"Steve", "Wozniak", "Sunnyvale", 94085}
	err = dbmap.Insert(n4)
	if err != nil {
		t.Error(err)
	}
}

func TestPersistentUser(t *testing.T) {
	dbmap := newDbMap()
	dbmap.Exec("drop table if exists PersistentUser")
	table := dbmap.AddTable(PersistentUser{}).SetKeys(false, "Key")
	table.ColMap("Key").Rename("mykey")
	err := dbmap.CreateTablesIfNotExists()
	if err != nil {
		panic(err)
	}
	defer dropAndClose(dbmap)
	pu := &PersistentUser{43, "33r", false}
	err = dbmap.Insert(pu)
	if err != nil {
		panic(err)
	}

	// prove we can pass a pointer into Get
	pu2, err := dbmap.Get(pu, pu.Key)
	if err != nil {
		panic(err)
	}
	if !reflect.DeepEqual(pu, pu2) {
		t.Errorf("%v!=%v", pu, pu2)
	}

	arr, err := dbmap.Select(pu, "select * from "+tableName(dbmap, PersistentUser{}))
	if err != nil {
		panic(err)
	}
	if !reflect.DeepEqual(pu, arr[0]) {
		t.Errorf("%v!=%v", pu, arr[0])
	}

	// prove we can get the results back in a slice
	var puArr []*PersistentUser
	_, err = dbmap.Select(&puArr, "select * from "+tableName(dbmap, PersistentUser{}))
	if err != nil {
		panic(err)
	}
	if len(puArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}
	if !reflect.DeepEqual(pu, puArr[0]) {
		t.Errorf("%v!=%v", pu, puArr[0])
	}

	// prove we can get the results back in a non-pointer slice
	var puValues []PersistentUser
	_, err = dbmap.Select(&puValues, "select * from "+tableName(dbmap, PersistentUser{}))
	if err != nil {
		panic(err)
	}
	if len(puValues) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}
	if !reflect.DeepEqual(*pu, puValues[0]) {
		t.Errorf("%v!=%v", *pu, puValues[0])
	}

	// prove we can get the results back in a string slice
	var idArr []*string
	_, err = dbmap.Select(&idArr, "select "+columnName(dbmap, PersistentUser{}, "Id")+" from "+tableName(dbmap, PersistentUser{}))
	if err != nil {
		panic(err)
	}
	if len(idArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}
	if !reflect.DeepEqual(pu.Id, *idArr[0]) {
		t.Errorf("%v!=%v", pu.Id, *idArr[0])
	}

	// prove we can get the results back in an int slice
	var keyArr []*int32
	_, err = dbmap.Select(&keyArr, "select mykey from "+tableName(dbmap, PersistentUser{}))
	if err != nil {
		panic(err)
	}
	if len(keyArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}
	if !reflect.DeepEqual(pu.Key, *keyArr[0]) {
		t.Errorf("%v!=%v", pu.Key, *keyArr[0])
	}

	// prove we can get the results back in a bool slice
	var passedArr []*bool
	_, err = dbmap.Select(&passedArr, "select "+columnName(dbmap, PersistentUser{}, "PassedTraining")+" from "+tableName(dbmap, PersistentUser{}))
	if err != nil {
		panic(err)
	}
	if len(passedArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}
	if !reflect.DeepEqual(pu.PassedTraining, *passedArr[0]) {
		t.Errorf("%v!=%v", pu.PassedTraining, *passedArr[0])
	}

	// prove we can get the results back in a non-pointer slice
	var stringArr []string
	_, err = dbmap.Select(&stringArr, "select "+columnName(dbmap, PersistentUser{}, "Id")+" from "+tableName(dbmap, PersistentUser{}))
	if err != nil {
		panic(err)
	}
	if len(stringArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}
	if !reflect.DeepEqual(pu.Id, stringArr[0]) {
		t.Errorf("%v!=%v", pu.Id, stringArr[0])
	}
}

func TestNamedQueryMap(t *testing.T) {
	dbmap := newDbMap()
	dbmap.Exec("drop table if exists PersistentUser")
	table := dbmap.AddTable(PersistentUser{}).SetKeys(false, "Key")
	table.ColMap("Key").Rename("mykey")
	err := dbmap.CreateTablesIfNotExists()
	if err != nil {
		panic(err)
	}
	defer dropAndClose(dbmap)
	pu := &PersistentUser{43, "33r", false}
	pu2 := &PersistentUser{500, "abc", false}
	err = dbmap.Insert(pu, pu2)
	if err != nil {
		panic(err)
	}

	// Test simple case
	var puArr []*PersistentUser
	_, err = dbmap.Select(&puArr, "select * from "+tableName(dbmap, PersistentUser{})+" where mykey = :Key", map[string]interface{}{
		"Key": 43,
	})
	if err != nil {
		t.Errorf("Failed to select: %s", err)
		t.FailNow()
	}
	if len(puArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}
	if !reflect.DeepEqual(pu, puArr[0]) {
		t.Errorf("%v!=%v", pu, puArr[0])
	}

	// Test more specific map value type is ok
	puArr = nil
	_, err = dbmap.Select(&puArr, "select * from "+tableName(dbmap, PersistentUser{})+" where mykey = :Key", map[string]int{
		"Key": 43,
	})
	if err != nil {
		t.Errorf("Failed to select: %s", err)
		t.FailNow()
	}
	if len(puArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}

	// Test multiple parameters set.
	puArr = nil
	_, err = dbmap.Select(&puArr, `
select * from `+tableName(dbmap, PersistentUser{})+`
 where mykey = :Key
   and `+columnName(dbmap, PersistentUser{}, "PassedTraining")+` = :PassedTraining
   and `+columnName(dbmap, PersistentUser{}, "Id")+` = :Id`, map[string]interface{}{
		"Key":            43,
		"PassedTraining": false,
		"Id":             "33r",
	})
	if err != nil {
		t.Errorf("Failed to select: %s", err)
		t.FailNow()
	}
	if len(puArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}

	// Test colon within a non-key string
	// Test having extra, unused properties in the map.
	puArr = nil
	_, err = dbmap.Select(&puArr, `
select * from `+tableName(dbmap, PersistentUser{})+`
 where mykey = :Key
   and `+columnName(dbmap, PersistentUser{}, "Id")+` != 'abc:def'`, map[string]interface{}{
		"Key":            43,
		"PassedTraining": false,
	})
	if err != nil {
		t.Errorf("Failed to select: %s", err)
		t.FailNow()
	}
	if len(puArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}

	// Test to delete with Exec and named params.
	result, err := dbmap.Exec("delete from "+tableName(dbmap, PersistentUser{})+" where mykey = :Key", map[string]interface{}{
		"Key": 43,
	})
	count, err := result.RowsAffected()
	if err != nil {
		t.Errorf("Failed to exec: %s", err)
		t.FailNow()
	}
	if count != 1 {
		t.Errorf("Expected 1 persistentuser to be deleted, but %d deleted", count)
	}
}

func TestNamedQueryStruct(t *testing.T) {
	dbmap := newDbMap()
	dbmap.Exec("drop table if exists PersistentUser")
	table := dbmap.AddTable(PersistentUser{}).SetKeys(false, "Key")
	table.ColMap("Key").Rename("mykey")
	err := dbmap.CreateTablesIfNotExists()
	if err != nil {
		panic(err)
	}
	defer dropAndClose(dbmap)
	pu := &PersistentUser{43, "33r", false}
	pu2 := &PersistentUser{500, "abc", false}
	err = dbmap.Insert(pu, pu2)
	if err != nil {
		panic(err)
	}

	// Test select self
	var puArr []*PersistentUser
	_, err = dbmap.Select(&puArr, `
select * from `+tableName(dbmap, PersistentUser{})+`
 where mykey = :Key
   and `+columnName(dbmap, PersistentUser{}, "PassedTraining")+` = :PassedTraining
   and `+columnName(dbmap, PersistentUser{}, "Id")+` = :Id`, pu)
	if err != nil {
		t.Errorf("Failed to select: %s", err)
		t.FailNow()
	}
	if len(puArr) != 1 {
		t.Errorf("Expected one persistentuser, found none")
	}
	if !reflect.DeepEqual(pu, puArr[0]) {
		t.Errorf("%v!=%v", pu, puArr[0])
	}

	// Test delete self.
	result, err := dbmap.Exec(`
delete from `+tableName(dbmap, PersistentUser{})+`
 where mykey = :Key
   and `+columnName(dbmap, PersistentUser{}, "PassedTraining")+` = :PassedTraining
   and `+columnName(dbmap, PersistentUser{}, "Id")+` = :Id`, pu)
	count, err := result.RowsAffected()
	if err != nil {
		t.Errorf("Failed to exec: %s", err)
		t.FailNow()
	}
	if count != 1 {
		t.Errorf("Expected 1 persistentuser to be deleted, but %d deleted", count)
	}
}

// Ensure that the slices containing SQL results are non-nil when the result set is empty.
func TestReturnsNonNilSlice(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)
	noResultsSQL := "select * from invoice_test where " + columnName(dbmap, Invoice{}, "Id") + "=99999"
	var r1 []*Invoice
	rawSelect(dbmap, &r1, noResultsSQL)
	if r1 == nil {
		t.Errorf("r1==nil")
	}

	r2 := rawSelect(dbmap, Invoice{}, noResultsSQL)
	if r2 == nil {
		t.Errorf("r2==nil")
	}
}

func TestOverrideVersionCol(t *testing.T) {
	dbmap := newDbMap()
	t1 := dbmap.AddTable(InvoicePersonView{}).SetKeys(false, "InvoiceId", "PersonId")
	err := dbmap.CreateTables()
	if err != nil {
		panic(err)
	}
	defer dropAndClose(dbmap)
	c1 := t1.SetVersionCol("LegacyVersion")
	if c1.ColumnName != "LegacyVersion" {
		t.Errorf("Wrong col returned: %v", c1)
	}

	ipv := &InvoicePersonView{1, 2, "memo", "fname", 0}
	_update(dbmap, ipv)
	if ipv.LegacyVersion != 1 {
		t.Errorf("LegacyVersion not updated: %d", ipv.LegacyVersion)
	}
}

func TestOptimisticLocking(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	p1 := &Person{0, 0, 0, "Bob", "Smith", 0}
	dbmap.Insert(p1) // Version is now 1
	if p1.Version != 1 {
		t.Errorf("Insert didn't incr Version: %d != %d", 1, p1.Version)
		return
	}
	if p1.Id == 0 {
		t.Errorf("Insert didn't return a generated PK")
		return
	}

	obj, err := dbmap.Get(Person{}, p1.Id)
	if err != nil {
		panic(err)
	}
	p2 := obj.(*Person)
	p2.LName = "Edwards"
	dbmap.Update(p2) // Version is now 2
	if p2.Version != 2 {
		t.Errorf("Update didn't incr Version: %d != %d", 2, p2.Version)
	}

	p1.LName = "Howard"
	count, err := dbmap.Update(p1)
	if _, ok := err.(gorp.OptimisticLockError); !ok {
		t.Errorf("update - Expected gorp.OptimisticLockError, got: %v", err)
	}
	if count != -1 {
		t.Errorf("update - Expected -1 count, got: %d", count)
	}

	count, err = dbmap.Delete(p1)
	if _, ok := err.(gorp.OptimisticLockError); !ok {
		t.Errorf("delete - Expected gorp.OptimisticLockError, got: %v", err)
	}
	if count != -1 {
		t.Errorf("delete - Expected -1 count, got: %d", count)
	}
}

// what happens if a legacy table has a null value?
func TestDoubleAddTable(t *testing.T) {
	dbmap := newDbMap()
	t1 := dbmap.AddTable(TableWithNull{}).SetKeys(false, "Id")
	t2 := dbmap.AddTable(TableWithNull{})
	if t1 != t2 {
		t.Errorf("%v != %v", t1, t2)
	}
}

// what happens if a legacy table has a null value?
func TestNullValues(t *testing.T) {
	dbmap := initDbMapNulls()
	defer dropAndClose(dbmap)

	// insert a row directly
	rawExec(dbmap, "insert into "+tableName(dbmap, TableWithNull{})+" values (10, null, "+
		"null, null, null, null)")

	// try to load it
	expected := &TableWithNull{Id: 10}
	obj := _get(dbmap, TableWithNull{}, 10)
	t1 := obj.(*TableWithNull)
	if !reflect.DeepEqual(expected, t1) {
		t.Errorf("%v != %v", expected, t1)
	}

	// update it
	t1.Str = sql.NullString{"hi", true}
	expected.Str = t1.Str
	t1.Int64 = sql.NullInt64{999, true}
	expected.Int64 = t1.Int64
	t1.Float64 = sql.NullFloat64{53.33, true}
	expected.Float64 = t1.Float64
	t1.Bool = sql.NullBool{true, true}
	expected.Bool = t1.Bool
	t1.Bytes = []byte{1, 30, 31, 33}
	expected.Bytes = t1.Bytes
	_update(dbmap, t1)

	obj = _get(dbmap, TableWithNull{}, 10)
	t1 = obj.(*TableWithNull)
	if t1.Str.String != "hi" {
		t.Errorf("%s != hi", t1.Str.String)
	}
	if !reflect.DeepEqual(expected, t1) {
		t.Errorf("%v != %v", expected, t1)
	}
}

func TestScannerValuer(t *testing.T) {
	dbmap := newDbMap()
	dbmap.AddTableWithName(PersonValuerScanner{}, "person_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(InvoiceWithValuer{}, "invoice_test").SetKeys(true, "Id")
	err := dbmap.CreateTables()
	if err != nil {
		panic(err)
	}
	defer dropAndClose(dbmap)

	pv := PersonValuerScanner{}
	pv.FName = "foo"
	pv.LName = "bar"
	err = dbmap.Insert(&pv)
	if err != nil {
		t.Errorf("Could not insert PersonValuerScanner using Person table: %v", err)
		t.FailNow()
	}

	inv := InvoiceWithValuer{}
	inv.Memo = "foo"
	inv.Person = pv
	err = dbmap.Insert(&inv)
	if err != nil {
		t.Errorf("Could not insert InvoiceWithValuer using Invoice table: %v", err)
		t.FailNow()
	}

	res, err := dbmap.Get(InvoiceWithValuer{}, inv.Id)
	if err != nil {
		t.Errorf("Could not get InvoiceWithValuer: %v", err)
		t.FailNow()
	}
	dbInv := res.(*InvoiceWithValuer)

	if dbInv.Person.Id != pv.Id {
		t.Errorf("InvoiceWithValuer got wrong person ID: %d (expected) != %d (actual)", pv.Id, dbInv.Person.Id)
	}
}

func TestColumnProps(t *testing.T) {
	dbmap := newDbMap()
	t1 := dbmap.AddTable(Invoice{}).SetKeys(true, "Id")
	t1.ColMap("Created").Rename("date_created")
	t1.ColMap("Updated").SetTransient(true)
	t1.ColMap("Memo").SetMaxSize(10)
	t1.ColMap("PersonId").SetUnique(true)

	err := dbmap.CreateTables()
	if err != nil {
		panic(err)
	}
	defer dropAndClose(dbmap)

	// test transient
	inv := &Invoice{0, 0, 1, "my invoice", 0, true}
	_insert(dbmap, inv)
	obj := _get(dbmap, Invoice{}, inv.Id)
	inv = obj.(*Invoice)
	if inv.Updated != 0 {
		t.Errorf("Saved transient column 'Updated'")
	}

	// test max size
	inv.Memo = "this memo is too long"
	err = dbmap.Insert(inv)
	if err == nil {
		t.Errorf("max size exceeded, but Insert did not fail.")
	}

	// test unique - same person id
	inv = &Invoice{0, 0, 1, "my invoice2", 0, false}
	err = dbmap.Insert(inv)
	if err == nil {
		t.Errorf("same PersonId inserted, but Insert did not fail.")
	}
}

func TestRawSelect(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	p1 := &Person{0, 0, 0, "bob", "smith", 0}
	_insert(dbmap, p1)

	inv1 := &Invoice{0, 0, 0, "xmas order", p1.Id, true}
	_insert(dbmap, inv1)

	expected := &InvoicePersonView{inv1.Id, p1.Id, inv1.Memo, p1.FName, 0}

	query := "select i." + columnName(dbmap, Invoice{}, "Id") + " InvoiceId, p." + columnName(dbmap, Person{}, "Id") + " PersonId, i." + columnName(dbmap, Invoice{}, "Memo") + ", p." + columnName(dbmap, Person{}, "FName") + " " +
		"from invoice_test i, person_test p " +
		"where i." + columnName(dbmap, Invoice{}, "PersonId") + " = p." + columnName(dbmap, Person{}, "Id")
	list := rawSelect(dbmap, InvoicePersonView{}, query)
	if len(list) != 1 {
		t.Errorf("len(list) != 1: %d", len(list))
	} else if !reflect.DeepEqual(expected, list[0]) {
		t.Errorf("%v != %v", expected, list[0])
	}
}

func TestHooks(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	p1 := &Person{0, 0, 0, "bob", "smith", 0}
	_insert(dbmap, p1)
	if p1.Created == 0 || p1.Updated == 0 {
		t.Errorf("p1.PreInsert() didn't run: %v", p1)
	} else if p1.LName != "postinsert" {
		t.Errorf("p1.PostInsert() didn't run: %v", p1)
	}

	obj := _get(dbmap, Person{}, p1.Id)
	p1 = obj.(*Person)
	if p1.LName != "postget" {
		t.Errorf("p1.PostGet() didn't run: %v", p1)
	}

	_update(dbmap, p1)
	if p1.FName != "preupdate" {
		t.Errorf("p1.PreUpdate() didn't run: %v", p1)
	} else if p1.LName != "postupdate" {
		t.Errorf("p1.PostUpdate() didn't run: %v", p1)
	}

	var persons []*Person
	bindVar := dbmap.Dialect.BindVar(0)
	rawSelect(dbmap, &persons, "select * from person_test where "+columnName(dbmap, Person{}, "Id")+" = "+bindVar, p1.Id)
	if persons[0].LName != "postget" {
		t.Errorf("p1.PostGet() didn't run after select: %v", p1)
	}

	_del(dbmap, p1)
	if p1.FName != "predelete" {
		t.Errorf("p1.PreDelete() didn't run: %v", p1)
	} else if p1.LName != "postdelete" {
		t.Errorf("p1.PostDelete() didn't run: %v", p1)
	}

	// Test error case
	p2 := &Person{0, 0, 0, "badname", "", 0}
	err := dbmap.Insert(p2)
	if err == nil {
		t.Errorf("p2.PreInsert() didn't return an error")
	}
}

func TestTransaction(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	inv1 := &Invoice{0, 100, 200, "t1", 0, true}
	inv2 := &Invoice{0, 100, 200, "t2", 0, false}

	trans, err := dbmap.Begin()
	if err != nil {
		panic(err)
	}
	trans.Insert(inv1, inv2)
	err = trans.Commit()
	if err != nil {
		panic(err)
	}

	obj, err := dbmap.Get(Invoice{}, inv1.Id)
	if err != nil {
		panic(err)
	}
	if !reflect.DeepEqual(inv1, obj) {
		t.Errorf("%v != %v", inv1, obj)
	}
	obj, err = dbmap.Get(Invoice{}, inv2.Id)
	if err != nil {
		panic(err)
	}
	if !reflect.DeepEqual(inv2, obj) {
		t.Errorf("%v != %v", inv2, obj)
	}
}

func TestSavepoint(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	inv1 := &Invoice{0, 100, 200, "unpaid", 0, false}

	trans, err := dbmap.Begin()
	if err != nil {
		panic(err)
	}
	trans.Insert(inv1)

	var checkMemo = func(want string) {
		memo, err := trans.SelectStr("select " + columnName(dbmap, Invoice{}, "Memo") + " from invoice_test")
		if err != nil {
			panic(err)
		}
		if memo != want {
			t.Errorf("%q != %q", want, memo)
		}
	}
	checkMemo("unpaid")

	err = trans.Savepoint("foo")
	if err != nil {
		panic(err)
	}
	checkMemo("unpaid")

	inv1.Memo = "paid"
	_, err = trans.Update(inv1)
	if err != nil {
		panic(err)
	}
	checkMemo("paid")

	err = trans.RollbackToSavepoint("foo")
	if err != nil {
		panic(err)
	}
	checkMemo("unpaid")

	err = trans.Rollback()
	if err != nil {
		panic(err)
	}
}

func TestMultiple(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	inv1 := &Invoice{0, 100, 200, "a", 0, false}
	inv2 := &Invoice{0, 100, 200, "b", 0, true}
	_insert(dbmap, inv1, inv2)

	inv1.Memo = "c"
	inv2.Memo = "d"
	_update(dbmap, inv1, inv2)

	count := _del(dbmap, inv1, inv2)
	if count != 2 {
		t.Errorf("%d != 2", count)
	}
}

func TestCrud(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	inv := &Invoice{0, 100, 200, "first order", 0, true}
	testCrudInternal(t, dbmap, inv)

	invtag := &InvoiceTag{0, 300, 400, "some order", 33, false}
	testCrudInternal(t, dbmap, invtag)

	foo := &AliasTransientField{BarStr: "some bar"}
	testCrudInternal(t, dbmap, foo)

	dynamicTablesTest(t, dbmap)
}

func testCrudInternal(t *testing.T, dbmap *gorp.DbMap, val testable) {
	table, err := dbmap.TableFor(reflect.TypeOf(val).Elem(), false)
	if err != nil {
		t.Errorf("couldn't call TableFor: val=%v err=%v", val, err)
	}

	_, err = dbmap.Exec("delete from " + table.TableName)
	if err != nil {
		t.Errorf("couldn't delete rows from: val=%v err=%v", val, err)
	}

	// INSERT row
	_insert(dbmap, val)
	if val.GetId() == 0 {
		t.Errorf("val.GetId() was not set on INSERT")
		return
	}

	// SELECT row
	val2 := _get(dbmap, val, val.GetId())
	if !reflect.DeepEqual(val, val2) {
		t.Errorf("%v != %v", val, val2)
	}

	// UPDATE row and SELECT
	val.Rand()
	count := _update(dbmap, val)
	if count != 1 {
		t.Errorf("update 1 != %d", count)
	}
	val2 = _get(dbmap, val, val.GetId())
	if !reflect.DeepEqual(val, val2) {
		t.Errorf("%v != %v", val, val2)
	}

	// Select *
	rows, err := dbmap.Select(val, "select * from "+dbmap.Dialect.QuoteField(table.TableName))
	if err != nil {
		t.Errorf("couldn't select * from %s err=%v", dbmap.Dialect.QuoteField(table.TableName), err)
	} else if len(rows) != 1 {
		t.Errorf("unexpected row count in %s: %d", dbmap.Dialect.QuoteField(table.TableName), len(rows))
	} else if !reflect.DeepEqual(val, rows[0]) {
		t.Errorf("select * result: %v != %v", val, rows[0])
	}

	// DELETE row
	deleted := _del(dbmap, val)
	if deleted != 1 {
		t.Errorf("Did not delete row with Id: %d", val.GetId())
		return
	}

	// VERIFY deleted
	val2 = _get(dbmap, val, val.GetId())
	if val2 != nil {
		t.Errorf("Found invoice with id: %d after Delete()", val.GetId())
	}
}

func TestWithIgnoredColumn(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	ic := &WithIgnoredColumn{-1, 0, 1}
	_insert(dbmap, ic)
	expected := &WithIgnoredColumn{0, 1, 1}
	ic2 := _get(dbmap, WithIgnoredColumn{}, ic.Id).(*WithIgnoredColumn)

	if !reflect.DeepEqual(expected, ic2) {
		t.Errorf("%v != %v", expected, ic2)
	}
	if _del(dbmap, ic) != 1 {
		t.Errorf("Did not delete row with Id: %d", ic.Id)
		return
	}
	if _get(dbmap, WithIgnoredColumn{}, ic.Id) != nil {
		t.Errorf("Found id: %d after Delete()", ic.Id)
	}
}

func TestColumnFilter(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	inv1 := &Invoice{0, 100, 200, "a", 0, false}
	_insert(dbmap, inv1)

	inv1.Memo = "c"
	inv1.IsPaid = true
	_updateColumns(dbmap, func(col *gorp.ColumnMap) bool {
		return col.ColumnName == "Memo"
	}, inv1)

	inv2 := &Invoice{}
	inv2 = _get(dbmap, inv2, inv1.Id).(*Invoice)
	if inv2.Memo != "c" {
		t.Errorf("Expected column to be updated (%#v)", inv2)
	}
	if inv2.IsPaid {
		t.Error("IsPaid shouldn't have been updated")
	}
}

func TestTypeConversionExample(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	p := Person{FName: "Bob", LName: "Smith"}
	tc := &TypeConversionExample{-1, p, CustomStringType("hi")}
	_insert(dbmap, tc)

	expected := &TypeConversionExample{1, p, CustomStringType("hi")}
	tc2 := _get(dbmap, TypeConversionExample{}, tc.Id).(*TypeConversionExample)
	if !reflect.DeepEqual(expected, tc2) {
		t.Errorf("tc2 %v != %v", expected, tc2)
	}

	tc2.Name = CustomStringType("hi2")
	tc2.PersonJSON = Person{FName: "Jane", LName: "Doe"}
	_update(dbmap, tc2)

	expected = &TypeConversionExample{1, tc2.PersonJSON, CustomStringType("hi2")}
	tc3 := _get(dbmap, TypeConversionExample{}, tc.Id).(*TypeConversionExample)
	if !reflect.DeepEqual(expected, tc3) {
		t.Errorf("tc3 %v != %v", expected, tc3)
	}

	if _del(dbmap, tc) != 1 {
		t.Errorf("Did not delete row with Id: %d", tc.Id)
	}

}

func TestWithEmbeddedStruct(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	es := &WithEmbeddedStruct{-1, Names{FirstName: "Alice", LastName: "Smith"}}
	_insert(dbmap, es)
	expected := &WithEmbeddedStruct{1, Names{FirstName: "Alice", LastName: "Smith"}}
	es2 := _get(dbmap, WithEmbeddedStruct{}, es.Id).(*WithEmbeddedStruct)
	if !reflect.DeepEqual(expected, es2) {
		t.Errorf("%v != %v", expected, es2)
	}

	es2.FirstName = "Bob"
	expected.FirstName = "Bob"
	_update(dbmap, es2)
	es2 = _get(dbmap, WithEmbeddedStruct{}, es.Id).(*WithEmbeddedStruct)
	if !reflect.DeepEqual(expected, es2) {
		t.Errorf("%v != %v", expected, es2)
	}

	ess := rawSelect(dbmap, WithEmbeddedStruct{}, "select * from embedded_struct_test")
	if !reflect.DeepEqual(es2, ess[0]) {
		t.Errorf("%v != %v", es2, ess[0])
	}
}

/*
func TestWithEmbeddedStructConflictingEmbeddedMemberNames(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	es := &WithEmbeddedStructConflictingEmbeddedMemberNames{-1, Names{FirstName: "Alice", LastName: "Smith"}, NamesConflict{FirstName: "Andrew", Surname: "Wiggin"}}
	_insert(dbmap, es)
	expected := &WithEmbeddedStructConflictingEmbeddedMemberNames{-1, Names{FirstName: "Alice", LastName: "Smith"}, NamesConflict{FirstName: "Andrew", Surname: "Wiggin"}}
	es2 := _get(dbmap, WithEmbeddedStructConflictingEmbeddedMemberNames{}, es.Id).(*WithEmbeddedStructConflictingEmbeddedMemberNames)
	if !reflect.DeepEqual(expected, es2) {
		t.Errorf("%v != %v", expected, es2)
	}

	es2.Names.FirstName = "Bob"
	expected.Names.FirstName = "Bob"
	_update(dbmap, es2)
	es2 = _get(dbmap, WithEmbeddedStructConflictingEmbeddedMemberNames{}, es.Id).(*WithEmbeddedStructConflictingEmbeddedMemberNames)
	if !reflect.DeepEqual(expected, es2) {
		t.Errorf("%v != %v", expected, es2)
	}

	ess := rawSelect(dbmap, WithEmbeddedStructConflictingEmbeddedMemberNames{}, "select * from embedded_struct_conflict_name_test")
	if !reflect.DeepEqual(es2, ess[0]) {
		t.Errorf("%v != %v", es2, ess[0])
	}
}

func TestWithEmbeddedStructSameMemberName(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	es := &WithEmbeddedStructSameMemberName{-1, SameName{SameName: "Alice"}}
	_insert(dbmap, es)
	expected := &WithEmbeddedStructSameMemberName{-1, SameName{SameName: "Alice"}}
	es2 := _get(dbmap, WithEmbeddedStructSameMemberName{}, es.Id).(*WithEmbeddedStructSameMemberName)
	if !reflect.DeepEqual(expected, es2) {
		t.Errorf("%v != %v", expected, es2)
	}

	es2.SameName = SameName{"Bob"}
	expected.SameName = SameName{"Bob"}
	_update(dbmap, es2)
	es2 = _get(dbmap, WithEmbeddedStructSameMemberName{}, es.Id).(*WithEmbeddedStructSameMemberName)
	if !reflect.DeepEqual(expected, es2) {
		t.Errorf("%v != %v", expected, es2)
	}

	ess := rawSelect(dbmap, WithEmbeddedStructSameMemberName{}, "select * from embedded_struct_same_member_name_test")
	if !reflect.DeepEqual(es2, ess[0]) {
		t.Errorf("%v != %v", es2, ess[0])
	}
}
//*/

func TestWithEmbeddedStructBeforeAutoincr(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	esba := &WithEmbeddedStructBeforeAutoincrField{Names: Names{FirstName: "Alice", LastName: "Smith"}}
	_insert(dbmap, esba)
	var expectedAutoincrId int64 = 1
	if esba.Id != expectedAutoincrId {
		t.Errorf("%d != %d", expectedAutoincrId, esba.Id)
	}
}

func TestWithEmbeddedAutoincr(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	esa := &WithEmbeddedAutoincr{
		WithEmbeddedStruct: WithEmbeddedStruct{Names: Names{FirstName: "Alice", LastName: "Smith"}},
		MiddleName:         "Rose",
	}
	_insert(dbmap, esa)
	var expectedAutoincrId int64 = 1
	if esa.Id != expectedAutoincrId {
		t.Errorf("%d != %d", expectedAutoincrId, esa.Id)
	}
}

func TestSelectVal(t *testing.T) {
	dbmap := initDbMapNulls()
	defer dropAndClose(dbmap)

	bindVar := dbmap.Dialect.BindVar(0)

	t1 := TableWithNull{Str: sql.NullString{"abc", true},
		Int64:   sql.NullInt64{78, true},
		Float64: sql.NullFloat64{32.2, true},
		Bool:    sql.NullBool{true, true},
		Bytes:   []byte("hi")}
	_insert(dbmap, &t1)

	// SelectInt
	i64 := selectInt(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Int64")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"='abc'")
	if i64 != 78 {
		t.Errorf("int64 %d != 78", i64)
	}
	i64 = selectInt(dbmap, "select count(*) from "+tableName(dbmap, TableWithNull{}))
	if i64 != 1 {
		t.Errorf("int64 count %d != 1", i64)
	}
	i64 = selectInt(dbmap, "select count(*) from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"="+bindVar, "asdfasdf")
	if i64 != 0 {
		t.Errorf("int64 no rows %d != 0", i64)
	}

	// SelectNullInt
	n := selectNullInt(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Int64")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"='notfound'")
	if !reflect.DeepEqual(n, sql.NullInt64{0, false}) {
		t.Errorf("nullint %v != 0,false", n)
	}

	n = selectNullInt(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Int64")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"='abc'")
	if !reflect.DeepEqual(n, sql.NullInt64{78, true}) {
		t.Errorf("nullint %v != 78, true", n)
	}

	// SelectFloat
	f64 := selectFloat(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Float64")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"='abc'")
	if f64 != 32.2 {
		t.Errorf("float64 %d != 32.2", f64)
	}
	f64 = selectFloat(dbmap, "select min("+columnName(dbmap, TableWithNull{}, "Float64")+") from "+tableName(dbmap, TableWithNull{}))
	if f64 != 32.2 {
		t.Errorf("float64 min %d != 32.2", f64)
	}
	f64 = selectFloat(dbmap, "select count(*) from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"="+bindVar, "asdfasdf")
	if f64 != 0 {
		t.Errorf("float64 no rows %d != 0", f64)
	}

	// SelectNullFloat
	nf := selectNullFloat(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Float64")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"='notfound'")
	if !reflect.DeepEqual(nf, sql.NullFloat64{0, false}) {
		t.Errorf("nullfloat %v != 0,false", nf)
	}

	nf = selectNullFloat(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Float64")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"='abc'")
	if !reflect.DeepEqual(nf, sql.NullFloat64{32.2, true}) {
		t.Errorf("nullfloat %v != 32.2, true", nf)
	}

	// SelectStr
	s := selectStr(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Str")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Int64")+"="+bindVar, 78)
	if s != "abc" {
		t.Errorf("s %s != abc", s)
	}
	s = selectStr(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Str")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"='asdfasdf'")
	if s != "" {
		t.Errorf("s no rows %s != ''", s)
	}

	// SelectNullStr
	ns := selectNullStr(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Str")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Int64")+"="+bindVar, 78)
	if !reflect.DeepEqual(ns, sql.NullString{"abc", true}) {
		t.Errorf("nullstr %v != abc,true", ns)
	}
	ns = selectNullStr(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Str")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"='asdfasdf'")
	if !reflect.DeepEqual(ns, sql.NullString{"", false}) {
		t.Errorf("nullstr no rows %v != '',false", ns)
	}

	// SelectInt/Str with named parameters
	i64 = selectInt(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Int64")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Str")+"=:abc", map[string]string{"abc": "abc"})
	if i64 != 78 {
		t.Errorf("int64 %d != 78", i64)
	}
	ns = selectNullStr(dbmap, "select "+columnName(dbmap, TableWithNull{}, "Str")+" from "+tableName(dbmap, TableWithNull{})+" where "+columnName(dbmap, TableWithNull{}, "Int64")+"=:num", map[string]int{"num": 78})
	if !reflect.DeepEqual(ns, sql.NullString{"abc", true}) {
		t.Errorf("nullstr %v != abc,true", ns)
	}
}

func TestVersionMultipleRows(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	persons := []*Person{
		&Person{0, 0, 0, "Bob", "Smith", 0},
		&Person{0, 0, 0, "Jane", "Smith", 0},
		&Person{0, 0, 0, "Mike", "Smith", 0},
	}

	_insert(dbmap, persons[0], persons[1], persons[2])

	for x, p := range persons {
		if p.Version != 1 {
			t.Errorf("person[%d].Version != 1: %d", x, p.Version)
		}
	}
}

func TestWithStringPk(t *testing.T) {
	dbmap := newDbMap()
	dbmap.AddTableWithName(WithStringPk{}, "string_pk_test").SetKeys(true, "Id")
	_, err := dbmap.Exec("create table string_pk_test (Id varchar(255), Name varchar(255));")
	if err != nil {
		t.Errorf("couldn't create string_pk_test: %v", err)
	}
	defer dropAndClose(dbmap)

	row := &WithStringPk{"1", "foo"}
	err = dbmap.Insert(row)
	if err == nil {
		t.Errorf("Expected error when inserting into table w/non Int PK and autoincr set true")
	}
}

// TestSqlExecutorInterfaceSelects ensures that all gorp.DbMap methods starting with Select...
// are also exposed in the gorp.SqlExecutor interface. Select...  functions can always
// run on Pre/Post hooks.
func TestSqlExecutorInterfaceSelects(t *testing.T) {
	dbMapType := reflect.TypeOf(&gorp.DbMap{})
	sqlExecutorType := reflect.TypeOf((*gorp.SqlExecutor)(nil)).Elem()
	numDbMapMethods := dbMapType.NumMethod()
	for i := 0; i < numDbMapMethods; i += 1 {
		dbMapMethod := dbMapType.Method(i)
		if !strings.HasPrefix(dbMapMethod.Name, "Select") {
			continue
		}
		if _, found := sqlExecutorType.MethodByName(dbMapMethod.Name); !found {
			t.Errorf("Method %s is defined on gorp.DbMap but not implemented in gorp.SqlExecutor",
				dbMapMethod.Name)
		}
	}
}

func TestNullTime(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	// if time is null
	ent := &WithNullTime{
		Id: 0,
		Time: gorp.NullTime{
			Valid: false,
		}}
	err := dbmap.Insert(ent)
	if err != nil {
		t.Error("failed insert on %s", err.Error())
	}
	err = dbmap.SelectOne(ent, `select * from nulltime_test where `+columnName(dbmap, WithNullTime{}, "Id")+`=:Id`, map[string]interface{}{
		"Id": ent.Id,
	})
	if err != nil {
		t.Error("failed select on %s", err.Error())
	}
	if ent.Time.Valid {
		t.Error("gorp.NullTime returns valid but expected null.")
	}

	// if time is not null
	ts, err := time.Parse(time.Stamp, "Jan 2 15:04:05")
	ent = &WithNullTime{
		Id: 1,
		Time: gorp.NullTime{
			Valid: true,
			Time:  ts,
		}}
	err = dbmap.Insert(ent)
	if err != nil {
		t.Error("failed insert on %s", err.Error())
	}
	err = dbmap.SelectOne(ent, `select * from nulltime_test where `+columnName(dbmap, WithNullTime{}, "Id")+`=:Id`, map[string]interface{}{
		"Id": ent.Id,
	})
	if err != nil {
		t.Error("failed select on %s", err.Error())
	}
	if !ent.Time.Valid {
		t.Error("gorp.NullTime returns invalid but expected valid.")
	}
	if ent.Time.Time.UTC() != ts.UTC() {
		t.Errorf("expect %v but got %v.", ts, ent.Time.Time)
	}

	return
}

type WithTime struct {
	Id   int64
	Time time.Time
}

type Times struct {
	One time.Time
	Two time.Time
}

type EmbeddedTime struct {
	Id string
	Times
}

func parseTimeOrPanic(format, date string) time.Time {
	t1, err := time.Parse(format, date)
	if err != nil {
		panic(err)
	}
	return t1
}

// TODO: re-enable next two tests when this is merged:
// https://github.com/ziutek/mymysql/pull/77
//
// This test currently fails w/MySQL b/c tz info is lost
func testWithTime(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	t1 := parseTimeOrPanic("2006-01-02 15:04:05 -0700 MST",
		"2013-08-09 21:30:43 +0800 CST")
	w1 := WithTime{1, t1}
	_insert(dbmap, &w1)

	obj := _get(dbmap, WithTime{}, w1.Id)
	w2 := obj.(*WithTime)
	if w1.Time.UnixNano() != w2.Time.UnixNano() {
		t.Errorf("%v != %v", w1, w2)
	}
}

// See: https://github.com/go-gorp/gorp/issues/86
func testEmbeddedTime(t *testing.T) {
	dbmap := newDbMap()
	dbmap.AddTable(EmbeddedTime{}).SetKeys(false, "Id")
	defer dropAndClose(dbmap)
	err := dbmap.CreateTables()
	if err != nil {
		t.Fatal(err)
	}

	time1 := parseTimeOrPanic("2006-01-02 15:04:05", "2013-08-09 21:30:43")

	t1 := &EmbeddedTime{Id: "abc", Times: Times{One: time1, Two: time1.Add(10 * time.Second)}}
	_insert(dbmap, t1)

	x := _get(dbmap, EmbeddedTime{}, t1.Id)
	t2, _ := x.(*EmbeddedTime)
	if t1.One.UnixNano() != t2.One.UnixNano() || t1.Two.UnixNano() != t2.Two.UnixNano() {
		t.Errorf("%v != %v", t1, t2)
	}
}

func TestWithTimeSelect(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	halfhourago := time.Now().UTC().Add(-30 * time.Minute)

	w1 := WithTime{1, halfhourago.Add(time.Minute * -1)}
	w2 := WithTime{2, halfhourago.Add(time.Second)}
	_insert(dbmap, &w1, &w2)

	var caseIds []int64
	_, err := dbmap.Select(&caseIds, "SELECT "+columnName(dbmap, WithTime{}, "Id")+" FROM time_test WHERE "+columnName(dbmap, WithTime{}, "Time")+" < "+dbmap.Dialect.BindVar(0), halfhourago)

	if err != nil {
		t.Error(err)
	}
	if len(caseIds) != 1 {
		t.Errorf("%d != 1", len(caseIds))
	}
	if caseIds[0] != w1.Id {
		t.Errorf("%d != %d", caseIds[0], w1.Id)
	}
}

func TestInvoicePersonView(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	// Create some rows
	p1 := &Person{0, 0, 0, "bob", "smith", 0}
	dbmap.Insert(p1)

	// notice how we can wire up p1.Id to the invoice easily
	inv1 := &Invoice{0, 0, 0, "xmas order", p1.Id, false}
	dbmap.Insert(inv1)

	// Run your query
	query := "select i." + columnName(dbmap, Invoice{}, "Id") + " InvoiceId, p." + columnName(dbmap, Person{}, "Id") + " PersonId, i." + columnName(dbmap, Invoice{}, "Memo") + ", p." + columnName(dbmap, Person{}, "FName") + " " +
		"from invoice_test i, person_test p " +
		"where i." + columnName(dbmap, Invoice{}, "PersonId") + " = p." + columnName(dbmap, Person{}, "Id")

	// pass a slice of pointers to Select()
	// this avoids the need to type assert after the query is run
	var list []*InvoicePersonView
	_, err := dbmap.Select(&list, query)
	if err != nil {
		panic(err)
	}

	// this should test true
	expected := &InvoicePersonView{inv1.Id, p1.Id, inv1.Memo, p1.FName, 0}
	if !reflect.DeepEqual(list[0], expected) {
		t.Errorf("%v != %v", list[0], expected)
	}
}

func TestQuoteTableNames(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	quotedTableName := dbmap.Dialect.QuoteField("person_test")

	// Use a buffer to hold the log to check generated queries
	logBuffer := &bytes.Buffer{}
	dbmap.TraceOn("", log.New(logBuffer, "gorptest:", log.Lmicroseconds))

	// Create some rows
	p1 := &Person{0, 0, 0, "bob", "smith", 0}
	errorTemplate := "Expected quoted table name %v in query but didn't find it"

	// Check if Insert quotes the table name
	id := dbmap.Insert(p1)
	if !bytes.Contains(logBuffer.Bytes(), []byte(quotedTableName)) {
		t.Errorf(errorTemplate, quotedTableName)
	}
	logBuffer.Reset()

	// Check if Get quotes the table name
	dbmap.Get(Person{}, id)
	if !bytes.Contains(logBuffer.Bytes(), []byte(quotedTableName)) {
		t.Errorf(errorTemplate, quotedTableName)
	}
	logBuffer.Reset()
}

func TestSelectTooManyCols(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	p1 := &Person{0, 0, 0, "bob", "smith", 0}
	p2 := &Person{0, 0, 0, "jane", "doe", 0}
	_insert(dbmap, p1)
	_insert(dbmap, p2)

	obj := _get(dbmap, Person{}, p1.Id)
	p1 = obj.(*Person)
	obj = _get(dbmap, Person{}, p2.Id)
	p2 = obj.(*Person)

	params := map[string]interface{}{
		"Id": p1.Id,
	}

	var p3 FNameOnly
	err := dbmap.SelectOne(&p3, "select * from person_test where "+columnName(dbmap, Person{}, "Id")+"=:Id", params)
	if err != nil {
		if !gorp.NonFatalError(err) {
			t.Error(err)
		}
	} else {
		t.Errorf("Non-fatal error expected")
	}

	if p1.FName != p3.FName {
		t.Errorf("%v != %v", p1.FName, p3.FName)
	}

	var pSlice []FNameOnly
	_, err = dbmap.Select(&pSlice, "select * from person_test order by "+columnName(dbmap, Person{}, "FName")+" asc")
	if err != nil {
		if !gorp.NonFatalError(err) {
			t.Error(err)
		}
	} else {
		t.Errorf("Non-fatal error expected")
	}

	if p1.FName != pSlice[0].FName {
		t.Errorf("%v != %v", p1.FName, pSlice[0].FName)
	}
	if p2.FName != pSlice[1].FName {
		t.Errorf("%v != %v", p2.FName, pSlice[1].FName)
	}
}

func TestSelectSingleVal(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	p1 := &Person{0, 0, 0, "bob", "smith", 0}
	_insert(dbmap, p1)

	obj := _get(dbmap, Person{}, p1.Id)
	p1 = obj.(*Person)

	params := map[string]interface{}{
		"Id": p1.Id,
	}

	var p2 Person
	err := dbmap.SelectOne(&p2, "select * from person_test where "+columnName(dbmap, Person{}, "Id")+"=:Id", params)
	if err != nil {
		t.Error(err)
	}

	if !reflect.DeepEqual(p1, &p2) {
		t.Errorf("%v != %v", p1, &p2)
	}

	// verify SelectOne allows non-struct holders
	var s string
	err = dbmap.SelectOne(&s, "select "+columnName(dbmap, Person{}, "FName")+" from person_test where "+columnName(dbmap, Person{}, "Id")+"=:Id", params)
	if err != nil {
		t.Error(err)
	}
	if s != "bob" {
		t.Error("Expected bob but got: " + s)
	}

	// verify SelectOne requires pointer receiver
	err = dbmap.SelectOne(s, "select "+columnName(dbmap, Person{}, "FName")+" from person_test where "+columnName(dbmap, Person{}, "Id")+"=:Id", params)
	if err == nil {
		t.Error("SelectOne should have returned error for non-pointer holder")
	}

	// verify SelectOne works with uninitialized pointers
	var p3 *Person
	err = dbmap.SelectOne(&p3, "select * from person_test where "+columnName(dbmap, Person{}, "Id")+"=:Id", params)
	if err != nil {
		t.Error(err)
	}

	if !reflect.DeepEqual(p1, p3) {
		t.Errorf("%v != %v", p1, p3)
	}

	// verify that the receiver is still nil if nothing was found
	var p4 *Person
	dbmap.SelectOne(&p3, "select * from person_test where 2<1 AND "+columnName(dbmap, Person{}, "Id")+"=:Id", params)
	if p4 != nil {
		t.Error("SelectOne should not have changed a nil receiver when no rows were found")
	}

	// verify that the error is set to sql.ErrNoRows if not found
	err = dbmap.SelectOne(&p2, "select * from person_test where "+columnName(dbmap, Person{}, "Id")+"=:Id", map[string]interface{}{
		"Id": -2222,
	})
	if err == nil || err != sql.ErrNoRows {
		t.Error("SelectOne should have returned an sql.ErrNoRows")
	}

	_insert(dbmap, &Person{0, 0, 0, "bob", "smith", 0})
	err = dbmap.SelectOne(&p2, "select * from person_test where "+columnName(dbmap, Person{}, "FName")+"='bob'")
	if err == nil {
		t.Error("Expected error when two rows found")
	}

	// tests for #150
	var tInt int64
	var tStr string
	var tBool bool
	var tFloat float64
	primVals := []interface{}{tInt, tStr, tBool, tFloat}
	for _, prim := range primVals {
		err = dbmap.SelectOne(&prim, "select * from person_test where "+columnName(dbmap, Person{}, "Id")+"=-123")
		if err == nil || err != sql.ErrNoRows {
			t.Error("primVals: SelectOne should have returned sql.ErrNoRows")
		}
	}
}

func TestSelectAlias(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	p1 := &IdCreatedExternal{IdCreated: IdCreated{Id: 1, Created: 3}, External: 2}

	// Insert using embedded IdCreated, which reflects the structure of the table
	_insert(dbmap, &p1.IdCreated)

	// Select into IdCreatedExternal type, which includes some fields not present
	// in id_created_test
	var p2 IdCreatedExternal
	err := dbmap.SelectOne(&p2, "select * from id_created_test where "+columnName(dbmap, IdCreatedExternal{}, "Id")+"=1")
	if err != nil {
		t.Error(err)
	}
	if p2.Id != 1 || p2.Created != 3 || p2.External != 0 {
		t.Error("Expected ignored field defaults to not set")
	}

	// Prove that we can supply an aliased value in the select, and that it will
	// automatically map to IdCreatedExternal.External
	err = dbmap.SelectOne(&p2, "SELECT *, 1 AS external FROM id_created_test")
	if err != nil {
		t.Error(err)
	}
	if p2.External != 1 {
		t.Error("Expected select as can map to exported field.")
	}

	var rows *sql.Rows
	var cols []string
	rows, err = dbmap.Db.Query("SELECT * FROM id_created_test")
	cols, err = rows.Columns()
	if err != nil || len(cols) != 2 {
		t.Error("Expected ignored column not created")
	}
}

func TestMysqlPanicIfDialectNotInitialized(t *testing.T) {
	_, driver := dialectAndDriver()
	// this test only applies to MySQL
	if os.Getenv("GORP_TEST_DIALECT") != "mysql" {
		return
	}

	// The expected behaviour is to catch a panic.
	// Here is the deferred function which will check if a panic has indeed occurred :
	defer func() {
		r := recover()
		if r == nil {
			t.Error("db.CreateTables() should panic if db is initialized with an incorrect gorp.MySQLDialect")
		}
	}()

	// invalid MySQLDialect : does not contain Engine or Encoding specification
	dialect := gorp.MySQLDialect{}
	db := &gorp.DbMap{Db: connect(driver), Dialect: dialect}
	db.AddTableWithName(Invoice{}, "invoice")
	// the following call should panic :
	db.CreateTables()
}

func TestSingleColumnKeyDbReturnsZeroRowsUpdatedOnPKChange(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)
	dbmap.AddTableWithName(SingleColumnTable{}, "single_column_table").SetKeys(false, "SomeId")
	err := dbmap.DropTablesIfExists()
	if err != nil {
		t.Error("Drop tables failed")
	}
	err = dbmap.CreateTablesIfNotExists()
	if err != nil {
		t.Error("Create tables failed")
	}
	err = dbmap.TruncateTables()
	if err != nil {
		t.Error("Truncate tables failed")
	}

	sct := SingleColumnTable{
		SomeId: "A Unique Id String",
	}

	count, err := dbmap.Update(&sct)
	if err != nil {
		t.Error(err)
	}
	if count != 0 {
		t.Errorf("Expected 0 updated rows, got %d", count)
	}

}

func TestPrepare(t *testing.T) {
	dbmap := initDbMap()
	defer dropAndClose(dbmap)

	inv1 := &Invoice{0, 100, 200, "prepare-foo", 0, false}
	inv2 := &Invoice{0, 100, 200, "prepare-bar", 0, false}
	_insert(dbmap, inv1, inv2)

	bindVar0 := dbmap.Dialect.BindVar(0)
	bindVar1 := dbmap.Dialect.BindVar(1)
	stmt, err := dbmap.Prepare(fmt.Sprintf("UPDATE invoice_test SET "+columnName(dbmap, Invoice{}, "Memo")+"=%s WHERE "+columnName(dbmap, Invoice{}, "Id")+"=%s", bindVar0, bindVar1))
	if err != nil {
		t.Error(err)
	}
	defer stmt.Close()
	_, err = stmt.Exec("prepare-baz", inv1.Id)
	if err != nil {
		t.Error(err)
	}
	err = dbmap.SelectOne(inv1, "SELECT * from invoice_test WHERE "+columnName(dbmap, Invoice{}, "Memo")+"='prepare-baz'")
	if err != nil {
		t.Error(err)
	}

	trans, err := dbmap.Begin()
	if err != nil {
		t.Error(err)
	}
	transStmt, err := trans.Prepare(fmt.Sprintf("UPDATE invoice_test SET "+columnName(dbmap, Invoice{}, "IsPaid")+"=%s WHERE "+columnName(dbmap, Invoice{}, "Id")+"=%s", bindVar0, bindVar1))
	if err != nil {
		t.Error(err)
	}
	defer transStmt.Close()
	_, err = transStmt.Exec(true, inv2.Id)
	if err != nil {
		t.Error(err)
	}
	err = dbmap.SelectOne(inv2, fmt.Sprintf("SELECT * from invoice_test WHERE "+columnName(dbmap, Invoice{}, "IsPaid")+"=%s", bindVar0), true)
	if err == nil || err != sql.ErrNoRows {
		t.Error("SelectOne should have returned an sql.ErrNoRows")
	}
	err = trans.SelectOne(inv2, fmt.Sprintf("SELECT * from invoice_test WHERE "+columnName(dbmap, Invoice{}, "IsPaid")+"=%s", bindVar0), true)
	if err != nil {
		t.Error(err)
	}
	err = trans.Commit()
	if err != nil {
		t.Error(err)
	}
	err = dbmap.SelectOne(inv2, fmt.Sprintf("SELECT * from invoice_test WHERE "+columnName(dbmap, Invoice{}, "IsPaid")+"=%s", bindVar0), true)
	if err != nil {
		t.Error(err)
	}
}

func BenchmarkNativeCrud(b *testing.B) {
	b.StopTimer()
	dbmap := initDbMapBench()
	defer dropAndClose(dbmap)
	columnId := columnName(dbmap, Invoice{}, "Id")
	columnCreated := columnName(dbmap, Invoice{}, "Created")
	columnUpdated := columnName(dbmap, Invoice{}, "Updated")
	columnMemo := columnName(dbmap, Invoice{}, "Memo")
	columnPersonId := columnName(dbmap, Invoice{}, "PersonId")
	b.StartTimer()

	var insert, sel, update, delete string
	if os.Getenv("GORP_TEST_DIALECT") != "postgres" {
		insert = "insert into invoice_test (" + columnCreated + ", " + columnUpdated + ", " + columnMemo + ", " + columnPersonId + ") values (?, ?, ?, ?)"
		sel = "select " + columnId + ", " + columnCreated + ", " + columnUpdated + ", " + columnMemo + ", " + columnPersonId + " from invoice_test where " + columnId + "=?"
		update = "update invoice_test set " + columnCreated + "=?, " + columnUpdated + "=?, " + columnMemo + "=?, " + columnPersonId + "=? where " + columnId + "=?"
		delete = "delete from invoice_test where " + columnId + "=?"
	} else {
		insert = "insert into invoice_test (" + columnCreated + ", " + columnUpdated + ", " + columnMemo + ", " + columnPersonId + ") values ($1, $2, $3, $4)"
		sel = "select " + columnId + ", " + columnCreated + ", " + columnUpdated + ", " + columnMemo + ", " + columnPersonId + " from invoice_test where " + columnId + "=$1"
		update = "update invoice_test set " + columnCreated + "=$1, " + columnUpdated + "=$2, " + columnMemo + "=$3, " + columnPersonId + "=$4 where " + columnId + "=$5"
		delete = "delete from invoice_test where " + columnId + "=$1"
	}

	inv := &Invoice{0, 100, 200, "my memo", 0, false}

	for i := 0; i < b.N; i++ {
		res, err := dbmap.Db.Exec(insert, inv.Created, inv.Updated,
			inv.Memo, inv.PersonId)
		if err != nil {
			panic(err)
		}

		newid, err := res.LastInsertId()
		if err != nil {
			panic(err)
		}
		inv.Id = newid

		row := dbmap.Db.QueryRow(sel, inv.Id)
		err = row.Scan(&inv.Id, &inv.Created, &inv.Updated, &inv.Memo,
			&inv.PersonId)
		if err != nil {
			panic(err)
		}

		inv.Created = 1000
		inv.Updated = 2000
		inv.Memo = "my memo 2"
		inv.PersonId = 3000

		_, err = dbmap.Db.Exec(update, inv.Created, inv.Updated, inv.Memo,
			inv.PersonId, inv.Id)
		if err != nil {
			panic(err)
		}

		_, err = dbmap.Db.Exec(delete, inv.Id)
		if err != nil {
			panic(err)
		}
	}

}

func BenchmarkGorpCrud(b *testing.B) {
	b.StopTimer()
	dbmap := initDbMapBench()
	defer dropAndClose(dbmap)
	b.StartTimer()

	inv := &Invoice{0, 100, 200, "my memo", 0, true}
	for i := 0; i < b.N; i++ {
		err := dbmap.Insert(inv)
		if err != nil {
			panic(err)
		}

		obj, err := dbmap.Get(Invoice{}, inv.Id)
		if err != nil {
			panic(err)
		}

		inv2, ok := obj.(*Invoice)
		if !ok {
			panic(fmt.Sprintf("expected *Invoice, got: %v", obj))
		}

		inv2.Created = 1000
		inv2.Updated = 2000
		inv2.Memo = "my memo 2"
		inv2.PersonId = 3000
		_, err = dbmap.Update(inv2)
		if err != nil {
			panic(err)
		}

		_, err = dbmap.Delete(inv2)
		if err != nil {
			panic(err)
		}

	}
}

func initDbMapBench() *gorp.DbMap {
	dbmap := newDbMap()
	dbmap.Db.Exec("drop table if exists invoice_test")
	dbmap.AddTableWithName(Invoice{}, "invoice_test").SetKeys(true, "Id")
	err := dbmap.CreateTables()
	if err != nil {
		panic(err)
	}
	return dbmap
}

func initDbMap() *gorp.DbMap {
	dbmap := newDbMap()
	dbmap.AddTableWithName(Invoice{}, "invoice_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(InvoiceTag{}, "invoice_tag_test") //key is set via primarykey attribute
	dbmap.AddTableWithName(AliasTransientField{}, "alias_trans_field_test").SetKeys(true, "id")
	dbmap.AddTableWithName(OverriddenInvoice{}, "invoice_override_test").SetKeys(false, "Id")
	dbmap.AddTableWithName(Person{}, "person_test").SetKeys(true, "Id").SetVersionCol("Version")
	dbmap.AddTableWithName(WithIgnoredColumn{}, "ignored_column_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(IdCreated{}, "id_created_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(TypeConversionExample{}, "type_conv_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(WithEmbeddedStruct{}, "embedded_struct_test").SetKeys(true, "Id")
	//dbmap.AddTableWithName(WithEmbeddedStructConflictingEmbeddedMemberNames{}, "embedded_struct_conflict_name_test").SetKeys(true, "Id")
	//dbmap.AddTableWithName(WithEmbeddedStructSameMemberName{}, "embedded_struct_same_member_name_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(WithEmbeddedStructBeforeAutoincrField{}, "embedded_struct_before_autoincr_test").SetKeys(true, "Id")
	dbmap.AddTableDynamic(&dynTableInst1, "").SetKeys(true, "Id").AddIndex("TenantInst1Index", "Btree", []string{"Name"}).SetUnique(true)
	dbmap.AddTableDynamic(&dynTableInst2, "").SetKeys(true, "Id").AddIndex("TenantInst2Index", "Btree", []string{"Name"}).SetUnique(true)
	dbmap.AddTableWithName(WithEmbeddedAutoincr{}, "embedded_autoincr_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(WithTime{}, "time_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(WithNullTime{}, "nulltime_test").SetKeys(false, "Id")
	dbmap.TypeConverter = testTypeConverter{}
	err := dbmap.DropTablesIfExists()
	if err != nil {
		panic(err)
	}
	err = dbmap.CreateTables()
	if err != nil {
		panic(err)
	}

	err = dbmap.CreateIndex()
	if err != nil {
		panic(err)
	}

	// See #146 and TestSelectAlias - this type is mapped to the same
	// table as IdCreated, but includes an extra field that isn't in the table
	dbmap.AddTableWithName(IdCreatedExternal{}, "id_created_test").SetKeys(true, "Id")

	return dbmap
}

func initDbMapNulls() *gorp.DbMap {
	dbmap := newDbMap()
	dbmap.AddTable(TableWithNull{}).SetKeys(false, "Id")
	err := dbmap.CreateTables()
	if err != nil {
		panic(err)
	}
	return dbmap
}

func newDbMap() *gorp.DbMap {
	dialect, driver := dialectAndDriver()
	dbmap := &gorp.DbMap{Db: connect(driver), Dialect: dialect}
	if debug {
		dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
	}
	return dbmap
}

func dropAndClose(dbmap *gorp.DbMap) {
	dbmap.DropTablesIfExists()
	dbmap.Db.Close()
}

func connect(driver string) *sql.DB {
	dsn := os.Getenv("GORP_TEST_DSN")
	if dsn == "" {
		panic("GORP_TEST_DSN env variable is not set. Please see README.md")
	}

	db, err := sql.Open(driver, dsn)
	if err != nil {
		panic("Error connecting to db: " + err.Error())
	}
	return db
}

func dialectAndDriver() (gorp.Dialect, string) {
	switch os.Getenv("GORP_TEST_DIALECT") {
	case "mysql":
		return gorp.MySQLDialect{"InnoDB", "UTF8"}, "mymysql"
	case "gomysql":
		return gorp.MySQLDialect{"InnoDB", "UTF8"}, "mysql"
	case "postgres":
		return gorp.PostgresDialect{}, "postgres"
	case "sqlite":
		return gorp.SqliteDialect{}, "sqlite3"
	}
	panic("GORP_TEST_DIALECT env variable is not set or is invalid. Please see README.md")
}

func _insert(dbmap *gorp.DbMap, list ...interface{}) {
	err := dbmap.Insert(list...)
	if err != nil {
		panic(err)
	}
}

func _update(dbmap *gorp.DbMap, list ...interface{}) int64 {
	count, err := dbmap.Update(list...)
	if err != nil {
		panic(err)
	}
	return count
}

func _updateColumns(dbmap *gorp.DbMap, filter gorp.ColumnFilter, list ...interface{}) int64 {
	count, err := dbmap.UpdateColumns(filter, list...)
	if err != nil {
		panic(err)
	}
	return count
}

func _del(dbmap *gorp.DbMap, list ...interface{}) int64 {
	count, err := dbmap.Delete(list...)
	if err != nil {
		panic(err)
	}

	return count
}

func _get(dbmap *gorp.DbMap, i interface{}, keys ...interface{}) interface{} {
	obj, err := dbmap.Get(i, keys...)
	if err != nil {
		panic(err)
	}

	return obj
}

func selectInt(dbmap *gorp.DbMap, query string, args ...interface{}) int64 {
	i64, err := gorp.SelectInt(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return i64
}

func selectNullInt(dbmap *gorp.DbMap, query string, args ...interface{}) sql.NullInt64 {
	i64, err := gorp.SelectNullInt(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return i64
}

func selectFloat(dbmap *gorp.DbMap, query string, args ...interface{}) float64 {
	f64, err := gorp.SelectFloat(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return f64
}

func selectNullFloat(dbmap *gorp.DbMap, query string, args ...interface{}) sql.NullFloat64 {
	f64, err := gorp.SelectNullFloat(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return f64
}

func selectStr(dbmap *gorp.DbMap, query string, args ...interface{}) string {
	s, err := gorp.SelectStr(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return s
}

func selectNullStr(dbmap *gorp.DbMap, query string, args ...interface{}) sql.NullString {
	s, err := gorp.SelectNullStr(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return s
}

func rawExec(dbmap *gorp.DbMap, query string, args ...interface{}) sql.Result {
	res, err := dbmap.Exec(query, args...)
	if err != nil {
		panic(err)
	}
	return res
}

func rawSelect(dbmap *gorp.DbMap, i interface{}, query string, args ...interface{}) []interface{} {
	list, err := dbmap.Select(i, query, args...)
	if err != nil {
		panic(err)
	}
	return list
}

func tableName(dbmap *gorp.DbMap, i interface{}) string {
	t := reflect.TypeOf(i)
	if table, err := dbmap.TableFor(t, false); table != nil && err == nil {
		return dbmap.Dialect.QuoteField(table.TableName)
	}
	return t.Name()
}

func columnName(dbmap *gorp.DbMap, i interface{}, fieldName string) string {
	t := reflect.TypeOf(i)
	if table, err := dbmap.TableFor(t, false); table != nil && err == nil {
		return dbmap.Dialect.QuoteField(table.ColMap(fieldName).ColumnName)
	}
	return fieldName
}
