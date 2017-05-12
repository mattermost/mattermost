package dynamizer

import (
	"bytes"
	"encoding/json"
	"math"
	"reflect"
	"testing"
)

type mySimpleStruct struct {
	String  string `json:"string"`
	Int     int
	Uint    uint `json:"uint"`
	Float32 float32
	Float64 float64
	Bool    bool
	Null    *interface{}
}

type myComplexStruct struct {
	Simple []mySimpleStruct
}

type dynamizerTestInput struct {
	input    interface{}
	expected string
}

var dynamizerTestInputs = []dynamizerTestInput{
	// Scalar tests
	dynamizerTestInput{
		input:    map[string]interface{}{"string": "some string"},
		expected: `{"string":{"S":"some string"}}`},
	dynamizerTestInput{
		input:    map[string]interface{}{"bool": true},
		expected: `{"bool":{"BOOL":true}}`},
	dynamizerTestInput{
		input:    map[string]interface{}{"bool": false},
		expected: `{"bool":{"BOOL":false}}`},
	dynamizerTestInput{
		input:    map[string]interface{}{"null": nil},
		expected: `{"null":{"NULL":true}}`},
	dynamizerTestInput{
		input:    map[string]interface{}{"float": 3.14},
		expected: `{"float":{"N":"3.14"}}`},
	dynamizerTestInput{
		input:    map[string]interface{}{"float": math.MaxFloat32},
		expected: `{"float":{"N":"340282346638528860000000000000000000000"}}`},
	dynamizerTestInput{
		input:    map[string]interface{}{"float": math.MaxFloat64},
		expected: `{"float":{"N":"179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"}}`},
	dynamizerTestInput{
		input:    map[string]interface{}{"int": int(12)},
		expected: `{"int":{"N":"12"}}`},
	// List
	dynamizerTestInput{
		input:    map[string]interface{}{"list": []interface{}{"a string", 12, 3.14, true, nil, false}},
		expected: `{"list":{"L":[{"S":"a string"},{"N":"12"},{"N":"3.14"},{"BOOL":true},{"NULL":true},{"BOOL":false}]}}`},
	// Map
	dynamizerTestInput{
		input:    map[string]interface{}{"map": map[string]interface{}{"nestedint": 12}},
		expected: `{"map":{"M":{"nestedint":{"N":"12"}}}}`},
	dynamizerTestInput{
		input:    &map[string]interface{}{"map": map[string]interface{}{"nestedint": 12}},
		expected: `{"map":{"M":{"nestedint":{"N":"12"}}}}`},
	// Structs
	dynamizerTestInput{
		input:    mySimpleStruct{},
		expected: `{"Bool":{"BOOL":false},"Float32":{"N":"0"},"Float64":{"N":"0"},"Int":{"N":"0"},"Null":{"NULL":true},"string":{"S":""},"uint":{"N":"0"}}`},
	dynamizerTestInput{
		input:    &mySimpleStruct{},
		expected: `{"Bool":{"BOOL":false},"Float32":{"N":"0"},"Float64":{"N":"0"},"Int":{"N":"0"},"Null":{"NULL":true},"string":{"S":""},"uint":{"N":"0"}}`},
	dynamizerTestInput{
		input:    myComplexStruct{},
		expected: `{"Simple":{"NULL":true}}`},
	dynamizerTestInput{
		input:    myComplexStruct{Simple: []mySimpleStruct{mySimpleStruct{}, mySimpleStruct{}}},
		expected: `{"Simple":{"L":[{"M":{"Bool":{"BOOL":false},"Float32":{"N":"0"},"Float64":{"N":"0"},"Int":{"N":"0"},"Null":{"NULL":true},"string":{"S":""},"uint":{"N":"0"}}},{"M":{"Bool":{"BOOL":false},"Float32":{"N":"0"},"Float64":{"N":"0"},"Int":{"N":"0"},"Null":{"NULL":true},"string":{"S":""},"uint":{"N":"0"}}}]}}`},
}

func TestToDynamo(t *testing.T) {
	for _, test := range dynamizerTestInputs {
		testToDynamo(t, test.input, test.expected)
	}
}

func testToDynamo(t *testing.T, in interface{}, expectedString string) {
	var expected interface{}
	var buf bytes.Buffer
	buf.WriteString(expectedString)
	if err := json.Unmarshal(buf.Bytes(), &expected); err != nil {
		t.Fatal(err)
	}
	actual, err := ToDynamo(in)
	if err != nil {
		t.Fatal(err)
	}
	compareObjects(t, expected, actual)
}

func TestFromDynamo(t *testing.T) {
	// Using the same inputs from TestToDynamo, test the reverse mapping.
	for _, test := range dynamizerTestInputs {
		testFromDynamo(t, test.expected, test.input)
	}
}

func testFromDynamo(t *testing.T, inputString string, expected interface{}) {
	var item DynamoItem
	var buf bytes.Buffer
	buf.WriteString(inputString)
	if err := json.Unmarshal(buf.Bytes(), &item); err != nil {
		t.Fatal(err)
	}
	var actual map[string]interface{}
	if err := FromDynamo(item, &actual); err != nil {
		t.Fatal(err)
	}
	compareObjects(t, expected, actual)
}

// TestStruct tests that we get a typed struct back
func TestStruct(t *testing.T) {
	expected := mySimpleStruct{String: "this is a string", Int: 1000000, Uint: 18446744073709551615, Float64: 3.14}
	dynamized, err := ToDynamo(expected)
	if err != nil {
		t.Fatal(err)
	}
	var actual mySimpleStruct
	err = FromDynamo(dynamized, &actual)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(expected, actual) {
		t.Fatalf("Did not get back the expected typed struct")
	}
}

// TestStructSlice tests that we get typed structs back while operating on an
// array of slices.
func TestStructSlice(t *testing.T) {
	expected := mySimpleStruct{String: "this is a string", Int: 1000000, Uint: 18446744073709551615, Float64: 3.14}
	dynamized, err := ToDynamo(expected)
	if err != nil {
		t.Fatal(err)
	}
	actual := make([]mySimpleStruct, 1)
	rv := reflect.ValueOf(actual)
	err = FromDynamo(dynamized, rv.Index(0))
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(expected, actual[0]) {
		t.Fatalf("Did not get back the expected typed struct")
	}
}

func TestBadInput(t *testing.T) {
	var dynamized DynamoItem
	var out interface{}
	err := FromDynamo(dynamized, out)
	if err == nil {
		t.Fatal("Expected error")
	}
	if err.Error() != "v must be a non-nil pointer to a map[string]interface{} or struct (or an addressable reflect.Value), got zero-value" {
		t.Fatalf("Expected `v must be a non-nil pointer to a map[string]interface{} or struct (or an addressable reflect.Value), got zero-value`, got `%s`", err.Error())
	}
	var out2 map[string]interface{}
	err = FromDynamo(dynamized, out2)
	if err == nil {
		t.Fatal("Expected error")
	}
	if err.Error() != "v must be a non-nil pointer to a map[string]interface{} or struct (or an addressable reflect.Value), got map[string]interface {}" {
		t.Fatalf("Expected `v must be a non-nil pointer to a map[string]interface{} or struct (or an addressable reflect.Value), got map[string]interface {}`, got `%s`", err.Error())
	}
	var out3 mySimpleStruct
	rv := reflect.ValueOf(&out3)
	err = FromDynamo(dynamized, rv)
	if err == nil {
		t.Fatal("Expected error")
	}
	if err.Error() != "v is not addressable" {
		t.Fatalf("Expected `v is not addressable`, got `%s`", err.Error())
	}
}

// What we're trying to do here is compare the JSON encoded values, but we can't
// to a simple encode + string compare since JSON encoding is not ordered. So
// what we do is JSON encode, then JSON decode into untyped maps, and then
// finally do a recursive comparison.
func compareObjects(t *testing.T, expected interface{}, actual interface{}) {
	expectedBytes, err := json.Marshal(expected)
	if err != nil {
		t.Fatal(err)
		return
	}
	actualBytes, err := json.Marshal(actual)
	if err != nil {
		t.Fatal(err)
		return
	}
	var expectedUntyped, actualUntyped map[string]interface{}
	err = json.Unmarshal(expectedBytes, &expectedUntyped)
	if err != nil {
		t.Fatal(err)
		return
	}
	err = json.Unmarshal(actualBytes, &actualUntyped)
	if err != nil {
		t.Fatal(err)
		return
	}
	if !reflect.DeepEqual(expectedUntyped, actualUntyped) {
		t.Fatalf("Expected %s, got %s", string(expectedBytes), string(actualBytes))
	}
}
