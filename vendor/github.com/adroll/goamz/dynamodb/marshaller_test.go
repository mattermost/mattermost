package dynamodb

import (
	"gopkg.in/check.v1"
	"time"
)

type TestSubStruct struct {
	SubBool        bool
	SubInt         int
	SubString      string
	SubStringArray []string
}

type TestStruct struct {
	TestBool        bool
	TestInt         int
	TestInt32       int32
	TestInt64       int64
	TestUint        uint
	TestFloat32     float32
	TestFloat64     float64
	TestString      string
	TestByteArray   []byte
	TestStringArray []string
	TestIntArray    []int
	TestInt8Array   []int8
	TestFloatArray  []float64
	TestSub         TestSubStruct
}

type TestStructTime struct {
	TestTime time.Time
}

func testObject() *TestStruct {
	return &TestStruct{
		TestBool:        true,
		TestInt:         -99,
		TestInt32:       999,
		TestInt64:       9999,
		TestUint:        99,
		TestFloat32:     9.9999,
		TestFloat64:     99.999999,
		TestString:      "test",
		TestByteArray:   []byte("bytes"),
		TestStringArray: []string{"test1", "test2", "test3", "test4"},
		TestIntArray:    []int{0, 1, 12, 123, 1234, 12345},
		TestInt8Array:   []int8{0, 1, 12, 123},
		TestFloatArray:  []float64{0.1, 1.1, 1.2, 1.23, 1.234, 1.2345},
		TestSub: TestSubStruct{
			SubBool:        true,
			SubInt:         2,
			SubString:      "subtest",
			SubStringArray: []string{"sub1", "sub2", "sub3"},
		},
	}
}

func testObjectTime() *TestStructTime {
	t, _ := time.Parse("Jan 2, 2006 at 3:04pm", "Mar 3, 2003 at 5:03pm")
	return &TestStructTime{
		TestTime: t,
	}
}

func testObjectWithZeroValues() *TestStruct {
	return &TestStruct{}
}

func testObjectWithNilSets() *TestStruct {
	return &TestStruct{
		TestBool:        true,
		TestInt:         -99,
		TestInt32:       999,
		TestInt64:       9999,
		TestUint:        99,
		TestFloat32:     9.9999,
		TestFloat64:     99.999999,
		TestString:      "test",
		TestByteArray:   []byte("bytes"),
		TestStringArray: []string(nil),
		TestIntArray:    []int(nil),
		TestFloatArray:  []float64(nil),
		TestSub: TestSubStruct{
			SubBool:        true,
			SubInt:         2,
			SubString:      "subtest",
			SubStringArray: []string{"sub1", "sub2", "sub3"},
		},
	}
}
func testObjectWithEmptySets() *TestStruct {
	return &TestStruct{
		TestBool:        true,
		TestInt:         -99,
		TestInt32:       999,
		TestInt64:       9999,
		TestUint:        99,
		TestFloat32:     9.9999,
		TestFloat64:     99.999999,
		TestString:      "test",
		TestByteArray:   []byte("bytes"),
		TestStringArray: []string{},
		TestIntArray:    []int{},
		TestFloatArray:  []float64{},
		TestSub: TestSubStruct{
			SubBool:        true,
			SubInt:         2,
			SubString:      "subtest",
			SubStringArray: []string{"sub1", "sub2", "sub3"},
		},
	}
}

func testAttrs() []Attribute {
	return []Attribute{
		Attribute{Type: "N", Name: "TestBool", Value: "1", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestInt", Value: "-99", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestInt32", Value: "999", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestInt64", Value: "9999", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestUint", Value: "99", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestFloat32", Value: "9.9999", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestFloat64", Value: "99.999999", SetValues: []string(nil)},
		Attribute{Type: "S", Name: "TestString", Value: "test", SetValues: []string(nil)},
		Attribute{Type: "S", Name: "TestByteArray", Value: "Ynl0ZXM=", SetValues: []string(nil)},
		Attribute{Type: "SS", Name: "TestStringArray", Value: "", SetValues: []string{"test1", "test2", "test3", "test4"}},
		Attribute{Type: "NS", Name: "TestIntArray", Value: "", SetValues: []string{"0", "1", "12", "123", "1234", "12345"}},
		Attribute{Type: "NS", Name: "TestInt8Array", Value: "", SetValues: []string{"0", "1", "12", "123"}},
		Attribute{Type: "NS", Name: "TestFloatArray", Value: "", SetValues: []string{"0.1", "1.1", "1.2", "1.23", "1.234", "1.2345"}},
		Attribute{Type: "S", Name: "TestSub", Value: `{"SubBool":true,"SubInt":2,"SubString":"subtest","SubStringArray":["sub1","sub2","sub3"]}`, SetValues: []string(nil)},
	}
}

func testAttrsTime() []Attribute {
	return []Attribute{
		Attribute{Type: "S", Name: "TestTime", Value: "\"2003-03-03T17:03:00Z\"", SetValues: []string(nil)},
	}
}

func testAttrsWithZeroValues() []Attribute {
	return []Attribute{
		Attribute{Type: "N", Name: "TestBool", Value: "0", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestInt", Value: "0", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestInt32", Value: "0", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestInt64", Value: "0", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestUint", Value: "0", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestFloat32", Value: "0", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestFloat64", Value: "0", SetValues: []string(nil)},
		Attribute{Type: "S", Name: "TestSub", Value: `{"SubBool":false,"SubInt":0,"SubString":"","SubStringArray":null}`, SetValues: []string(nil)},
	}
}

func testAttrsWithNilSets() []Attribute {
	return []Attribute{
		Attribute{Type: "N", Name: "TestBool", Value: "1", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestInt", Value: "-99", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestInt32", Value: "999", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestInt64", Value: "9999", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestUint", Value: "99", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestFloat32", Value: "9.9999", SetValues: []string(nil)},
		Attribute{Type: "N", Name: "TestFloat64", Value: "99.999999", SetValues: []string(nil)},
		Attribute{Type: "S", Name: "TestString", Value: "test", SetValues: []string(nil)},
		Attribute{Type: "S", Name: "TestByteArray", Value: "Ynl0ZXM=", SetValues: []string(nil)},
		Attribute{Type: "S", Name: "TestSub", Value: `{"SubBool":true,"SubInt":2,"SubString":"subtest","SubStringArray":["sub1","sub2","sub3"]}`, SetValues: []string(nil)},
	}
}

type MarshallerSuite struct {
}

var _ = check.Suite(&MarshallerSuite{})

func (s *MarshallerSuite) TestMarshal(c *check.C) {
	testObj := testObject()
	attrs, err := MarshalAttributes(testObj)
	if err != nil {
		c.Errorf("Error from MarshalAttributes: %#v", err)
	}

	expected := testAttrs()
	c.Check(attrs, check.DeepEquals, expected)
}

func (s *MarshallerSuite) TestUnmarshal(c *check.C) {
	testObj := &TestStruct{}

	attrMap := map[string]*Attribute{}
	attrs := testAttrs()
	for i, _ := range attrs {
		attrMap[attrs[i].Name] = &attrs[i]
	}

	err := UnmarshalAttributes(&attrMap, testObj)
	if err != nil {
		c.Fatalf("Error from UnmarshalAttributes: %#v (Built: %#v)", err, testObj)
	}

	expected := testObject()
	c.Check(testObj, check.DeepEquals, expected)
}

func (s *MarshallerSuite) TestMarshalTime(c *check.C) {
	testObj := testObjectTime()
	attrs, err := MarshalAttributes(testObj)
	if err != nil {
		c.Errorf("Error from MarshalAttributes: %#v", err)
	}

	expected := testAttrsTime()
	c.Check(attrs, check.DeepEquals, expected)
}

func (s *MarshallerSuite) TestUnmarshalTime(c *check.C) {
	testObj := &TestStructTime{}

	attrMap := map[string]*Attribute{}
	attrs := testAttrsTime()
	for i, _ := range attrs {
		attrMap[attrs[i].Name] = &attrs[i]
	}

	err := UnmarshalAttributes(&attrMap, testObj)
	if err != nil {
		c.Fatalf("Error from UnmarshalAttributes: %#v (Built: %#v)", err, testObj)
	}

	expected := testObjectTime()
	c.Check(testObj, check.DeepEquals, expected)
}

func (s *MarshallerSuite) TestMarshalNilSets(c *check.C) {
	testObj := testObjectWithNilSets()
	attrs, err := MarshalAttributes(testObj)
	if err != nil {
		c.Errorf("Error from MarshalAttributes: %#v", err)
	}

	expected := testAttrsWithNilSets()
	c.Check(attrs, check.DeepEquals, expected)
}

func (s *MarshallerSuite) TestMarshalZeroValues(c *check.C) {
	testObj := testObjectWithZeroValues()
	attrs, err := MarshalAttributes(testObj)
	if err != nil {
		c.Errorf("Error from MarshalAttributes: %#v", err)
	}

	expected := testAttrsWithZeroValues()
	c.Check(attrs, check.DeepEquals, expected)
}

func (s *MarshallerSuite) TestMarshalEmptySets(c *check.C) {
	testObj := testObjectWithEmptySets()
	attrs, err := MarshalAttributes(testObj)
	if err != nil {
		c.Errorf("Error from MarshalAttributes: %#v", err)
	}

	expected := testAttrsWithNilSets()
	c.Check(attrs, check.DeepEquals, expected)
}

func (s *MarshallerSuite) TestUnmarshalEmptySets(c *check.C) {
	testObj := &TestStruct{}

	attrMap := map[string]*Attribute{}
	attrs := testAttrsWithNilSets()
	for i, _ := range attrs {
		attrMap[attrs[i].Name] = &attrs[i]
	}

	err := UnmarshalAttributes(&attrMap, testObj)
	if err != nil {
		c.Fatalf("Error from UnmarshalAttributes: %#v (Built: %#v)", err, testObj)
	}

	expected := testObjectWithNilSets()
	c.Check(testObj, check.DeepEquals, expected)
}
