package dynamodb

import (
	"bytes"
	"encoding/json"
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/dynamodb/dynamizer"
	"reflect"
	"testing"
)

func TestDynamoQuery(t *testing.T) {
	region := aws.Region{DynamoDBEndpoint: "http://127.0.0.1:8000"}
	auth := aws.Auth{AccessKey: "DUMMY_KEY", SecretKey: "DUMMY_SECRET"}
	server := New(auth, region)
	desc := TableDescriptionT{
		TableName: "DynamoDBTestMyTable",
		AttributeDefinitions: []AttributeDefinitionT{
			AttributeDefinitionT{"TestHashKey", "S"},
		},
		KeySchema: []KeySchemaT{
			KeySchemaT{"TestHashKey", "HASH"},
		},
		ProvisionedThroughput: ProvisionedThroughputT{
			ReadCapacityUnits:  1,
			WriteCapacityUnits: 1,
		},
	}
	pk, err := desc.BuildPrimaryKey()
	if err != nil {
		panic(err)
	}
	table := server.NewTable(desc.TableName, pk)

	testGetQuery(t, table, true, `{"TableName":"DynamoDBTestMyTable","ConsistentRead":true,"Key":{"TestHashKey":{"S":"NewHashKeyVal"}}}`)
	testGetQuery(t, table, false, `{"TableName":"DynamoDBTestMyTable","Key":{"TestHashKey":{"S":"NewHashKeyVal"}}}`)
	testPutQuery(t, table, `{"TableName":"DynamoDBTestMyTable","Item":{"Attr1":{"S":"Attr1Val"},"Attr2":{"N":"12"},"TestHashKey":{"S":"NewHashKeyVal"}}}`)
	testDeleteQuery(t, table, false, `{"TableName":"DynamoDBTestMyTable","Key":{"TestHashKey":{"S":"NewHashKeyVal"}}}`)
}

func TestDynamoQueryWithRange(t *testing.T) {
	region := aws.Region{DynamoDBEndpoint: "http://127.0.0.1:8000"}
	auth := aws.Auth{AccessKey: "DUMMY_KEY", SecretKey: "DUMMY_SECRET"}
	server := New(auth, region)
	desc := TableDescriptionT{
		TableName: "DynamoDBTestMyTable",
		AttributeDefinitions: []AttributeDefinitionT{
			AttributeDefinitionT{"TestHashKey", "S"},
			AttributeDefinitionT{"TestRangeKey", "N"},
		},
		KeySchema: []KeySchemaT{
			KeySchemaT{"TestHashKey", "HASH"},
			KeySchemaT{"TestRangeKey", "RANGE"},
		},
		ProvisionedThroughput: ProvisionedThroughputT{
			ReadCapacityUnits:  1,
			WriteCapacityUnits: 1,
		},
	}
	pk, err := desc.BuildPrimaryKey()
	if err != nil {
		panic(err)
	}
	table := server.NewTable(desc.TableName, pk)

	testGetQuery(t, table, true, `{"TableName":"DynamoDBTestMyTable","ConsistentRead":true,"Key":{"TestHashKey":{"S":"NewHashKeyVal"},"TestRangeKey":{"N":"12"}}}`)
	testGetQuery(t, table, false, `{"TableName":"DynamoDBTestMyTable","Key":{"TestHashKey":{"S":"NewHashKeyVal"},"TestRangeKey":{"N":"12"}}}`)
	testPutQuery(t, table, `{"TableName":"DynamoDBTestMyTable","Item":{"Attr1":{"S":"Attr1Val"},"Attr2":{"N":"12"},"TestHashKey":{"S":"NewHashKeyVal"},"TestRangeKey":{"N":"12"}}}`)
	testDeleteQuery(t, table, false, `{"TableName":"DynamoDBTestMyTable","Key":{"TestHashKey":{"S":"NewHashKeyVal"},"TestRangeKey":{"N":"12"}}}`)
}

func testPutQuery(t *testing.T, table *Table, expected string) {
	var key *Key
	if table.Key.HasRange() {
		key = &Key{HashKey: "NewHashKeyVal", RangeKey: "12"}
	} else {
		key = &Key{HashKey: "NewHashKeyVal"}
	}

	data := map[string]interface{}{
		"Attr1": "Attr1Val",
		"Attr2": 12}
	item, err := dynamizer.ToDynamo(data)
	if err != nil {
		t.Fatal(err)
	}

	q := NewDynamoQuery(table)
	if err := q.AddItem(key, item); err != nil {
		t.Fatal(err)
	}

	actual, err := q.Marshal()
	if err != nil {
		t.Fatal(err)
	}
	compareJSONStrings(t, expected, actual)
}

func testGetQuery(t *testing.T, table *Table, consistent bool, expected string) {
	var key *Key
	if table.Key.HasRange() {
		key = &Key{HashKey: "NewHashKeyVal", RangeKey: "12"}
	} else {
		key = &Key{HashKey: "NewHashKeyVal"}
	}

	q := NewDynamoQuery(table)
	if err := q.AddKey(key); err != nil {
		t.Fatal(err)
	}
	if err := q.SetConsistentRead(consistent); err != nil {
		t.Fatal(err)
	}

	actual, err := q.Marshal()
	if err != nil {
		t.Fatal(err)
	}
	compareJSONStrings(t, expected, actual)
}

func testDeleteQuery(t *testing.T, table *Table, consistent bool, expected string) {
	var key *Key
	if table.Key.HasRange() {
		key = &Key{HashKey: "NewHashKeyVal", RangeKey: "12"}
	} else {
		key = &Key{HashKey: "NewHashKeyVal"}
	}

	q := NewDynamoQuery(table)
	if err := q.AddKey(key); err != nil {
		t.Fatal(err)
	}

	actual, err := q.Marshal()
	if err != nil {
		t.Fatal(err)
	}
	compareJSONStrings(t, expected, actual)
}

// What we're trying to do here is compare the JSON encoded values, but we can't
// to a simple encode + string compare since JSON encoding is not ordered. So
// what we do is JSON encode, then JSON decode into untyped maps, and then
// finally do a recursive comparison.
func compareJSONStrings(t *testing.T, expected string, actual []byte) {
	var expectedBytes bytes.Buffer
	expectedBytes.WriteString(expected)
	var expectedUntyped, actualUntyped map[string]interface{}
	err := json.Unmarshal(expectedBytes.Bytes(), &expectedUntyped)
	if err != nil {
		t.Fatal(err)
	}
	err = json.Unmarshal(actual, &actualUntyped)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(expectedUntyped, actualUntyped) {
		t.Fatalf("Expected %s, got %s", expected, actual)
	}
}
