package gorp

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	_ "github.com/ziutek/mymysql/godrv"
)

// verify interface compliance
var _ Dialect = SqliteDialect{}
var _ Dialect = PostgresDialect{}
var _ Dialect = MySQLDialect{}
var _ Dialect = SqlServerDialect{}
var _ Dialect = OracleDialect{}

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

func (me *Invoice) GetId() int64 { return me.Id }
func (me *Invoice) Rand() {
	me.Memo = fmt.Sprintf("random %d", rand.Int63())
	me.Created = rand.Int63()
	me.Updated = rand.Int63()
}

type InvoiceTag struct {
	Id       int64 `db:"myid"`
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
	Time NullTime
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

func (me testTypeConverter) FromDb(target interface{}) (CustomScanner, bool) {
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
		return CustomScanner{new(string), target, binder}, true
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
		return CustomScanner{new(string), target, binder}, true
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
		return CustomScanner{new(time.Time), target, binder}, true
	}

	return CustomScanner{}, false
}

func (p *Person) PreInsert(s SqlExecutor) error {
	p.Created = time.Now().UnixNano()
	p.Updated = p.Created
	if p.FName == "badname" {
		return fmt.Errorf("Invalid name: %s", p.FName)
	}
	return nil
}

func (p *Person) PostInsert(s SqlExecutor) error {
	p.LName = "postinsert"
	return nil
}

func (p *Person) PreUpdate(s SqlExecutor) error {
	p.FName = "preupdate"
	return nil
}

func (p *Person) PostUpdate(s SqlExecutor) error {
	p.LName = "postupdate"
	return nil
}

func (p *Person) PreDelete(s SqlExecutor) error {
	p.FName = "predelete"
	return nil
}

func (p *Person) PostDelete(s SqlExecutor) error {
	p.LName = "postdelete"
	return nil
}

func (p *Person) PostGet(s SqlExecutor) error {
	p.LName = "postget"
	return nil
}

type PersistentUser struct {
	Key            int32
	Id             string
	PassedTraining bool
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
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
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
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
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
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
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
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
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

	arr, err := dbmap.Select(pu, "select * from PersistentUser")
	if err != nil {
		panic(err)
	}
	if !reflect.DeepEqual(pu, arr[0]) {
		t.Errorf("%v!=%v", pu, arr[0])
	}

	// prove we can get the results back in a slice
	var puArr []*PersistentUser
	_, err = dbmap.Select(&puArr, "select * from PersistentUser")
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
	_, err = dbmap.Select(&puValues, "select * from PersistentUser")
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
	_, err = dbmap.Select(&idArr, "select Id from PersistentUser")
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
	_, err = dbmap.Select(&keyArr, "select mykey from PersistentUser")
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
	_, err = dbmap.Select(&passedArr, "select PassedTraining from PersistentUser")
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
	_, err = dbmap.Select(&stringArr, "select Id from PersistentUser")
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
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
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
	_, err = dbmap.Select(&puArr, "select * from PersistentUser where mykey = :Key", map[string]interface{}{
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
	_, err = dbmap.Select(&puArr, "select * from PersistentUser where mykey = :Key", map[string]int{
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
select * from PersistentUser
 where mykey = :Key
   and PassedTraining = :PassedTraining
   and Id = :Id`, map[string]interface{}{
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
select * from PersistentUser
 where mykey = :Key
   and Id != 'abc:def'`, map[string]interface{}{
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
	result, err := dbmap.Exec("delete from PersistentUser where mykey = :Key", map[string]interface{}{
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
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
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
select * from PersistentUser
 where mykey = :Key
   and PassedTraining = :PassedTraining
   and Id = :Id`, pu)
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
delete from PersistentUser
 where mykey = :Key
   and PassedTraining = :PassedTraining
   and Id = :Id`, pu)
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
	noResultsSQL := "select * from invoice_test where id=99999"
	var r1 []*Invoice
	_rawselect(dbmap, &r1, noResultsSQL)
	if r1 == nil {
		t.Errorf("r1==nil")
	}

	r2 := _rawselect(dbmap, Invoice{}, noResultsSQL)
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
	if _, ok := err.(OptimisticLockError); !ok {
		t.Errorf("update - Expected OptimisticLockError, got: %v", err)
	}
	if count != -1 {
		t.Errorf("update - Expected -1 count, got: %d", count)
	}

	count, err = dbmap.Delete(p1)
	if _, ok := err.(OptimisticLockError); !ok {
		t.Errorf("delete - Expected OptimisticLockError, got: %v", err)
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
	_rawexec(dbmap, "insert into TableWithNull values (10, null, "+
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

func TestColumnProps(t *testing.T) {
	dbmap := newDbMap()
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
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

	query := "select i.Id InvoiceId, p.Id PersonId, i.Memo, p.FName " +
		"from invoice_test i, person_test p " +
		"where i.PersonId = p.Id"
	list := _rawselect(dbmap, InvoicePersonView{}, query)
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
	_rawselect(dbmap, &persons, "select * from person_test where id = "+bindVar, p1.Id)
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
		memo, err := trans.SelectStr("select memo from invoice_test")
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
}

func testCrudInternal(t *testing.T, dbmap *DbMap, val testable) {
	table, _, err := dbmap.tableForPointer(val, false)
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
	rows, err := dbmap.Select(val, "select * from "+table.TableName)
	if err != nil {
		t.Errorf("couldn't select * from %s err=%v", table.TableName, err)
	} else if len(rows) != 1 {
		t.Errorf("unexpected row count in %s: %d", table.TableName, len(rows))
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

	ess := _rawselect(dbmap, WithEmbeddedStruct{}, "select * from embedded_struct_test")
	if !reflect.DeepEqual(es2, ess[0]) {
		t.Errorf("%v != %v", es2, ess[0])
	}
}

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
	i64 := selectInt(dbmap, "select Int64 from TableWithNull where Str='abc'")
	if i64 != 78 {
		t.Errorf("int64 %d != 78", i64)
	}
	i64 = selectInt(dbmap, "select count(*) from TableWithNull")
	if i64 != 1 {
		t.Errorf("int64 count %d != 1", i64)
	}
	i64 = selectInt(dbmap, "select count(*) from TableWithNull where Str="+bindVar, "asdfasdf")
	if i64 != 0 {
		t.Errorf("int64 no rows %d != 0", i64)
	}

	// SelectNullInt
	n := selectNullInt(dbmap, "select Int64 from TableWithNull where Str='notfound'")
	if !reflect.DeepEqual(n, sql.NullInt64{0, false}) {
		t.Errorf("nullint %v != 0,false", n)
	}

	n = selectNullInt(dbmap, "select Int64 from TableWithNull where Str='abc'")
	if !reflect.DeepEqual(n, sql.NullInt64{78, true}) {
		t.Errorf("nullint %v != 78, true", n)
	}

	// SelectFloat
	f64 := selectFloat(dbmap, "select Float64 from TableWithNull where Str='abc'")
	if f64 != 32.2 {
		t.Errorf("float64 %d != 32.2", f64)
	}
	f64 = selectFloat(dbmap, "select min(Float64) from TableWithNull")
	if f64 != 32.2 {
		t.Errorf("float64 min %d != 32.2", f64)
	}
	f64 = selectFloat(dbmap, "select count(*) from TableWithNull where Str="+bindVar, "asdfasdf")
	if f64 != 0 {
		t.Errorf("float64 no rows %d != 0", f64)
	}

	// SelectNullFloat
	nf := selectNullFloat(dbmap, "select Float64 from TableWithNull where Str='notfound'")
	if !reflect.DeepEqual(nf, sql.NullFloat64{0, false}) {
		t.Errorf("nullfloat %v != 0,false", nf)
	}

	nf = selectNullFloat(dbmap, "select Float64 from TableWithNull where Str='abc'")
	if !reflect.DeepEqual(nf, sql.NullFloat64{32.2, true}) {
		t.Errorf("nullfloat %v != 32.2, true", nf)
	}

	// SelectStr
	s := selectStr(dbmap, "select Str from TableWithNull where Int64="+bindVar, 78)
	if s != "abc" {
		t.Errorf("s %s != abc", s)
	}
	s = selectStr(dbmap, "select Str from TableWithNull where Str='asdfasdf'")
	if s != "" {
		t.Errorf("s no rows %s != ''", s)
	}

	// SelectNullStr
	ns := selectNullStr(dbmap, "select Str from TableWithNull where Int64="+bindVar, 78)
	if !reflect.DeepEqual(ns, sql.NullString{"abc", true}) {
		t.Errorf("nullstr %v != abc,true", ns)
	}
	ns = selectNullStr(dbmap, "select Str from TableWithNull where Str='asdfasdf'")
	if !reflect.DeepEqual(ns, sql.NullString{"", false}) {
		t.Errorf("nullstr no rows %v != '',false", ns)
	}

	// SelectInt/Str with named parameters
	i64 = selectInt(dbmap, "select Int64 from TableWithNull where Str=:abc", map[string]string{"abc": "abc"})
	if i64 != 78 {
		t.Errorf("int64 %d != 78", i64)
	}
	ns = selectNullStr(dbmap, "select Str from TableWithNull where Int64=:num", map[string]int{"num": 78})
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
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
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

// TestSqlExecutorInterfaceSelects ensures that all DbMap methods starting with Select...
// are also exposed in the SqlExecutor interface. Select...  functions can always
// run on Pre/Post hooks.
func TestSqlExecutorInterfaceSelects(t *testing.T) {
	dbMapType := reflect.TypeOf(&DbMap{})
	sqlExecutorType := reflect.TypeOf((*SqlExecutor)(nil)).Elem()
	numDbMapMethods := dbMapType.NumMethod()
	for i := 0; i < numDbMapMethods; i += 1 {
		dbMapMethod := dbMapType.Method(i)
		if !strings.HasPrefix(dbMapMethod.Name, "Select") {
			continue
		}
		if _, found := sqlExecutorType.MethodByName(dbMapMethod.Name); !found {
			t.Errorf("Method %s is defined on DbMap but not implemented in SqlExecutor",
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
		Time: NullTime{
			Valid: false,
		}}
	err := dbmap.Insert(ent)
	if err != nil {
		t.Error("failed insert on %s", err.Error())
	}
	err = dbmap.SelectOne(ent, `select * from nulltime_test where Id=:Id`, map[string]interface{}{
		"Id": ent.Id,
	})
	if err != nil {
		t.Error("failed select on %s", err.Error())
	}
	if ent.Time.Valid {
		t.Error("NullTime returns valid but expected null.")
	}

	// if time is not null
	ts, err := time.Parse(time.Stamp, "Jan 2 15:04:05")
	ent = &WithNullTime{
		Id: 1,
		Time: NullTime{
			Valid: true,
			Time:  ts,
		}}
	err = dbmap.Insert(ent)
	if err != nil {
		t.Error("failed insert on %s", err.Error())
	}
	err = dbmap.SelectOne(ent, `select * from nulltime_test where Id=:Id`, map[string]interface{}{
		"Id": ent.Id,
	})
	if err != nil {
		t.Error("failed select on %s", err.Error())
	}
	if !ent.Time.Valid {
		t.Error("NullTime returns invalid but expected valid.")
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
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
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
	_, err := dbmap.Select(&caseIds, "SELECT id FROM time_test WHERE Time < "+dbmap.Dialect.BindVar(0), halfhourago)

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
	query := "select i.Id InvoiceId, p.Id PersonId, i.Memo, p.FName " +
		"from invoice_test i, person_test p " +
		"where i.PersonId = p.Id"

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
	err := dbmap.SelectOne(&p3, "select * from person_test where Id=:Id", params)
	if err != nil {
		if !NonFatalError(err) {
			t.Error(err)
		}
	} else {
		t.Errorf("Non-fatal error expected")
	}

	if p1.FName != p3.FName {
		t.Errorf("%v != %v", p1.FName, p3.FName)
	}

	var pSlice []FNameOnly
	_, err = dbmap.Select(&pSlice, "select * from person_test order by fname asc")
	if err != nil {
		if !NonFatalError(err) {
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
	err := dbmap.SelectOne(&p2, "select * from person_test where Id=:Id", params)
	if err != nil {
		t.Error(err)
	}

	if !reflect.DeepEqual(p1, &p2) {
		t.Errorf("%v != %v", p1, &p2)
	}

	// verify SelectOne allows non-struct holders
	var s string
	err = dbmap.SelectOne(&s, "select FName from person_test where Id=:Id", params)
	if err != nil {
		t.Error(err)
	}
	if s != "bob" {
		t.Error("Expected bob but got: " + s)
	}

	// verify SelectOne requires pointer receiver
	err = dbmap.SelectOne(s, "select FName from person_test where Id=:Id", params)
	if err == nil {
		t.Error("SelectOne should have returned error for non-pointer holder")
	}

	// verify SelectOne works with uninitialized pointers
	var p3 *Person
	err = dbmap.SelectOne(&p3, "select * from person_test where Id=:Id", params)
	if err != nil {
		t.Error(err)
	}

	if !reflect.DeepEqual(p1, p3) {
		t.Errorf("%v != %v", p1, p3)
	}

	// verify that the receiver is still nil if nothing was found
	var p4 *Person
	dbmap.SelectOne(&p3, "select * from person_test where 2<1 AND Id=:Id", params)
	if p4 != nil {
		t.Error("SelectOne should not have changed a nil receiver when no rows were found")
	}

	// verify that the error is set to sql.ErrNoRows if not found
	err = dbmap.SelectOne(&p2, "select * from person_test where Id=:Id", map[string]interface{}{
		"Id": -2222,
	})
	if err == nil || err != sql.ErrNoRows {
		t.Error("SelectOne should have returned an sql.ErrNoRows")
	}

	_insert(dbmap, &Person{0, 0, 0, "bob", "smith", 0})
	err = dbmap.SelectOne(&p2, "select * from person_test where Fname='bob'")
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
		err = dbmap.SelectOne(&prim, "select * from person_test where Id=-123")
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
	err := dbmap.SelectOne(&p2, "select * from id_created_test where Id=1")
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
			t.Error("db.CreateTables() should panic if db is initialized with an incorrect MySQLDialect")
		}
	}()

	// invalid MySQLDialect : does not contain Engine or Encoding specification
	dialect := MySQLDialect{}
	db := &DbMap{Db: connect(driver), Dialect: dialect}
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
	stmt, err := dbmap.Prepare(fmt.Sprintf("UPDATE invoice_test SET Memo=%s WHERE Id=%s", bindVar0, bindVar1))
	if err != nil {
		t.Error(err)
	}
	defer stmt.Close()
	_, err = stmt.Exec("prepare-baz", inv1.Id)
	if err != nil {
		t.Error(err)
	}
	err = dbmap.SelectOne(inv1, "SELECT * from invoice_test WHERE Memo='prepare-baz'")
	if err != nil {
		t.Error(err)
	}

	trans, err := dbmap.Begin()
	if err != nil {
		t.Error(err)
	}
	transStmt, err := trans.Prepare(fmt.Sprintf("UPDATE invoice_test SET IsPaid=%s WHERE Id=%s", bindVar0, bindVar1))
	if err != nil {
		t.Error(err)
	}
	defer transStmt.Close()
	_, err = transStmt.Exec(true, inv2.Id)
	if err != nil {
		t.Error(err)
	}
	err = dbmap.SelectOne(inv2, fmt.Sprintf("SELECT * from invoice_test WHERE IsPaid=%s", bindVar0), true)
	if err == nil || err != sql.ErrNoRows {
		t.Error("SelectOne should have returned an sql.ErrNoRows")
	}
	err = trans.SelectOne(inv2, fmt.Sprintf("SELECT * from invoice_test WHERE IsPaid=%s", bindVar0), true)
	if err != nil {
		t.Error(err)
	}
	err = trans.Commit()
	if err != nil {
		t.Error(err)
	}
	err = dbmap.SelectOne(inv2, fmt.Sprintf("SELECT * from invoice_test WHERE IsPaid=%s", bindVar0), true)
	if err != nil {
		t.Error(err)
	}
}

func BenchmarkNativeCrud(b *testing.B) {
	b.StopTimer()
	dbmap := initDbMapBench()
	defer dropAndClose(dbmap)
	b.StartTimer()

	insert := "insert into invoice_test (Created, Updated, Memo, PersonId) values (?, ?, ?, ?)"
	sel := "select Id, Created, Updated, Memo, PersonId from invoice_test where Id=?"
	update := "update invoice_test set Created=?, Updated=?, Memo=?, PersonId=? where Id=?"
	delete := "delete from invoice_test where Id=?"

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

func initDbMapBench() *DbMap {
	dbmap := newDbMap()
	dbmap.Db.Exec("drop table if exists invoice_test")
	dbmap.AddTableWithName(Invoice{}, "invoice_test").SetKeys(true, "Id")
	err := dbmap.CreateTables()
	if err != nil {
		panic(err)
	}
	return dbmap
}

func initDbMap() *DbMap {
	dbmap := newDbMap()
	dbmap.AddTableWithName(Invoice{}, "invoice_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(InvoiceTag{}, "invoice_tag_test").SetKeys(true, "myid")
	dbmap.AddTableWithName(AliasTransientField{}, "alias_trans_field_test").SetKeys(true, "id")
	dbmap.AddTableWithName(OverriddenInvoice{}, "invoice_override_test").SetKeys(false, "Id")
	dbmap.AddTableWithName(Person{}, "person_test").SetKeys(true, "Id").SetVersionCol("Version")
	dbmap.AddTableWithName(WithIgnoredColumn{}, "ignored_column_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(IdCreated{}, "id_created_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(TypeConversionExample{}, "type_conv_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(WithEmbeddedStruct{}, "embedded_struct_test").SetKeys(true, "Id")
	dbmap.AddTableWithName(WithEmbeddedStructBeforeAutoincrField{}, "embedded_struct_before_autoincr_test").SetKeys(true, "Id")
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

	// See #146 and TestSelectAlias - this type is mapped to the same
	// table as IdCreated, but includes an extra field that isn't in the table
	dbmap.AddTableWithName(IdCreatedExternal{}, "id_created_test").SetKeys(true, "Id")

	return dbmap
}

func initDbMapNulls() *DbMap {
	dbmap := newDbMap()
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
	dbmap.AddTable(TableWithNull{}).SetKeys(false, "Id")
	err := dbmap.CreateTables()
	if err != nil {
		panic(err)
	}
	return dbmap
}

func newDbMap() *DbMap {
	dialect, driver := dialectAndDriver()
	dbmap := &DbMap{Db: connect(driver), Dialect: dialect}
	dbmap.TraceOn("", log.New(os.Stdout, "gorptest: ", log.Lmicroseconds))
	return dbmap
}

func dropAndClose(dbmap *DbMap) {
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

func dialectAndDriver() (Dialect, string) {
	switch os.Getenv("GORP_TEST_DIALECT") {
	case "mysql":
		return MySQLDialect{"InnoDB", "UTF8"}, "mymysql"
	case "gomysql":
		return MySQLDialect{"InnoDB", "UTF8"}, "mysql"
	case "postgres":
		return PostgresDialect{}, "postgres"
	case "sqlite":
		return SqliteDialect{}, "sqlite3"
	}
	panic("GORP_TEST_DIALECT env variable is not set or is invalid. Please see README.md")
}

func _insert(dbmap *DbMap, list ...interface{}) {
	err := dbmap.Insert(list...)
	if err != nil {
		panic(err)
	}
}

func _update(dbmap *DbMap, list ...interface{}) int64 {
	count, err := dbmap.Update(list...)
	if err != nil {
		panic(err)
	}
	return count
}

func _del(dbmap *DbMap, list ...interface{}) int64 {
	count, err := dbmap.Delete(list...)
	if err != nil {
		panic(err)
	}

	return count
}

func _get(dbmap *DbMap, i interface{}, keys ...interface{}) interface{} {
	obj, err := dbmap.Get(i, keys...)
	if err != nil {
		panic(err)
	}

	return obj
}

func selectInt(dbmap *DbMap, query string, args ...interface{}) int64 {
	i64, err := SelectInt(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return i64
}

func selectNullInt(dbmap *DbMap, query string, args ...interface{}) sql.NullInt64 {
	i64, err := SelectNullInt(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return i64
}

func selectFloat(dbmap *DbMap, query string, args ...interface{}) float64 {
	f64, err := SelectFloat(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return f64
}

func selectNullFloat(dbmap *DbMap, query string, args ...interface{}) sql.NullFloat64 {
	f64, err := SelectNullFloat(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return f64
}

func selectStr(dbmap *DbMap, query string, args ...interface{}) string {
	s, err := SelectStr(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return s
}

func selectNullStr(dbmap *DbMap, query string, args ...interface{}) sql.NullString {
	s, err := SelectNullStr(dbmap, query, args...)
	if err != nil {
		panic(err)
	}

	return s
}

func _rawexec(dbmap *DbMap, query string, args ...interface{}) sql.Result {
	res, err := dbmap.Exec(query, args...)
	if err != nil {
		panic(err)
	}
	return res
}

func _rawselect(dbmap *DbMap, i interface{}, query string, args ...interface{}) []interface{} {
	list, err := dbmap.Select(i, query, args...)
	if err != nil {
		panic(err)
	}
	return list
}
