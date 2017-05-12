package dynamodb

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"

	"gopkg.in/check.v1"
)

type BatchSuite struct {
	TableDescriptionT TableDescriptionT
	DynamoDBTest
	WithRange bool
}

func (s *BatchSuite) SetUpSuite(c *check.C) {
	setUpAuth(c)
	s.DynamoDBTest.TableDescriptionT = s.TableDescriptionT
	s.server = New(dynamodb_auth, dynamodb_region)
	pk, err := s.TableDescriptionT.BuildPrimaryKey()
	if err != nil {
		c.Skip(err.Error())
	}
	s.table = s.server.NewTable(s.TableDescriptionT.TableName, pk)

	// Cleanup
	s.TearDownSuite(c)
	_, err = s.server.CreateTable(s.TableDescriptionT)
	if err != nil {
		c.Fatal(err)
	}
	s.WaitUntilStatus(c, "ACTIVE")
}

var batch_suite = &BatchSuite{
	TableDescriptionT: TableDescriptionT{
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
	},
	WithRange: false,
}

var batch_suite_with_range = &BatchSuite{
	TableDescriptionT: TableDescriptionT{
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
	},
	WithRange: true,
}

var _ = check.Suite(batch_suite)
var _ = check.Suite(batch_suite_with_range)

func (s *BatchSuite) TestBatchGetDocument(c *check.C) {
	numKeys := 3
	keys := make([]*Key, 0, numKeys)
	ins := make([]map[string]interface{}, 0, numKeys)
	outs := make([]map[string]interface{}, numKeys)
	for i := 0; i < numKeys; i++ {
		k := &Key{HashKey: "NewHashKeyVal" + strconv.Itoa(i)}
		if s.WithRange {
			k.RangeKey = strconv.Itoa(12 + i)
		}

		in := map[string]interface{}{
			"Attr1": "Attr1Val" + strconv.Itoa(i),
			"Attr2": 12 + i,
		}

		if i%2 == 0 { // only add the even keys
			if err := s.table.PutDocument(k, in); err != nil {
				c.Fatal(err)
			}
		}

		keys = append(keys, k)
		ins = append(ins, in)
	}

	errs, err := s.table.BatchGetDocument(keys, true, outs)
	if err != nil {
		c.Fatal(err)
	}

	for i := 0; i < numKeys; i++ {
		if i%2 == 0 {
			c.Assert(errs[i], check.Equals, nil)
			c.Assert(outs[i], check.DeepEquals, ins[i])
		} else {
			c.Assert(errs[i], check.Equals, ErrNotFound)
		}
	}
}

func (s *BatchSuite) TestBatchGetDocumentTyped(c *check.C) {
	type myInnterStruct struct {
		List []interface{}
	}
	type myStruct struct {
		Attr1  string
		Attr2  int64
		Nested myInnterStruct
	}

	numKeys := 3
	keys := make([]*Key, 0, numKeys)
	ins := make([]myStruct, 0, numKeys)
	outs := make([]myStruct, numKeys)

	for i := 0; i < numKeys; i++ {
		k := &Key{HashKey: "NewHashKeyVal" + strconv.Itoa(i)}
		if s.WithRange {
			k.RangeKey = strconv.Itoa(12 + i)
		}

		in := myStruct{
			Attr1:  "Attr1Val" + strconv.Itoa(i),
			Attr2:  1000000 + int64(i),
			Nested: myInnterStruct{[]interface{}{true, false, nil, "some string", 3.14}},
		}

		if i%2 == 0 { // only add the even keys
			if err := s.table.PutDocument(k, in); err != nil {
				c.Fatal(err)
			}
		}

		keys = append(keys, k)
		ins = append(ins, in)
	}

	errs, err := s.table.BatchGetDocument(keys, true, outs)
	if err != nil {
		c.Fatal(err)
	}

	for i := 0; i < numKeys; i++ {
		if i%2 == 0 {
			c.Assert(errs[i], check.Equals, nil)
			c.Assert(outs[i], check.DeepEquals, ins[i])
		} else {
			c.Assert(errs[i], check.Equals, ErrNotFound)
		}
	}
}

func (s *BatchSuite) TestBatchGetDocumentUnprocessedKeys(c *check.C) {
	// Here we test what happens if DynamoDB returns partial success and returns
	// some keys in the UnprocessedKeys field. To do so, we setup a fake endpoint
	// for DynamoDB which will simply returns a canned response. This is more
	// efficient than loading enough data into DynamoDB local to force it over
	// the 16mb limit.
	endpoint := s.server.Region.DynamoDBEndpoint
	defer func() {
		s.server.Region.DynamoDBEndpoint = endpoint
	}()
	invocations := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawjson := `{"Responses":{"DynamoDBTestMyTable":[{"Nested":{"M":{"List":{"L":[{"BOOL":true},{"BOOL":false},{"NULL":true},{"S":"some string"},{"N":"3.14"}]}}},"TestHashKey":{"S":"NewHashKeyVal0"},"Attr1":{"S":"Attr1Val0"},"Attr2":{"N":"1000000"},"TestRangeKey":{"N":"12"}}]},"UnprocessedKeys":{"DynamoDBTestMyTable":{"Keys":[{"TestHashKey":{"S":"NewHashKeyVal2"},"TestRangeKey":{"N":"14"}},{"TestHashKey":{"S":"NewHashKeyVal1"},"TestRangeKey":{"N":"13"}}],"ConsistentRead":true}}}`
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, rawjson)
		// Restore the endpoint so any retries succeed.
		s.server.Region.DynamoDBEndpoint = endpoint
		invocations++
	}))
	defer server.Close()
	s.server.Region.DynamoDBEndpoint = server.URL

	type myInnterStruct struct {
		List []interface{}
	}
	type myStruct struct {
		Attr1  string
		Attr2  int64
		Nested myInnterStruct
	}

	numKeys := 3
	keys := make([]*Key, 0, numKeys)
	outs := make([]myStruct, numKeys)

	for i := 0; i < numKeys; i++ {
		k := &Key{HashKey: "NewHashKeyVal" + strconv.Itoa(i)}
		if s.WithRange {
			k.RangeKey = strconv.Itoa(12 + i)
		}

		keys = append(keys, k)
	}

	errs, err := s.table.BatchGetDocument(keys, true, outs)
	if err != nil {
		c.Fatal(err)
	}

	// Make sure our fake endpoint was called exactly once.
	c.Assert(invocations, check.Equals, 1)

	// Confirm that each key was processed.
	for i := 0; i < numKeys; i++ {
		if i == 0 {
			c.Assert(errs[i], check.Equals, nil)
		} else {
			c.Assert(errs[i], check.Equals, ErrNotFound)
		}
	}
}

func (s *BatchSuite) TestBatchGetDocumentSizeExceeded(c *check.C) {
	numKeys := MaxGetBatchSize + 1
	keys := make([]*Key, 0, numKeys)
	outs := make([]map[string]interface{}, numKeys)
	for i := 0; i < numKeys; i++ {
		k := &Key{HashKey: "NewHashKeyVal" + strconv.Itoa(i)}
		if s.WithRange {
			k.RangeKey = strconv.Itoa(12 + i)
		}
		keys = append(keys, k)
	}

	_, err := s.table.BatchGetDocument(keys, true, outs)
	if err == nil {
		c.Fatal("Expected max batch size exceeded error")
	} else {
		c.Assert(err.Error(), check.Equals, "Cannot add key, max batch size (100) exceeded")
	}
}

func (s *BatchSuite) TestBatchPutDocument(c *check.C) {
	numKeys := 3
	keys := make([]*Key, 0, numKeys)
	ins := make([]map[string]interface{}, 0, numKeys)
	outs := make([]map[string]interface{}, numKeys)
	for i := 0; i < numKeys; i++ {
		k := &Key{HashKey: "NewHashKeyVal" + strconv.Itoa(i)}
		if s.WithRange {
			k.RangeKey = strconv.Itoa(12 + i)
		}

		in := map[string]interface{}{
			"Attr1": "Attr1Val" + strconv.Itoa(i),
			"Attr2": 12 + i,
		}

		keys = append(keys, k)
		ins = append(ins, in)
	}

	errs, err := s.table.BatchPutDocument(keys, ins)
	if err != nil {
		c.Fatal(err)
	}
	for i := 0; i < numKeys; i++ {
		c.Assert(errs[i], check.Equals, nil)
	}

	errs, err = s.table.BatchGetDocument(keys, true, outs)
	if err != nil {
		c.Fatal(err)
	}

	for i := 0; i < numKeys; i++ {
		c.Assert(errs[i], check.Equals, nil)
		c.Assert(outs[i], check.DeepEquals, ins[i])
	}
}

func (s *BatchSuite) TestBatchPutDocumentTyped(c *check.C) {
	type myInnterStruct struct {
		List []interface{}
	}
	type myStruct struct {
		Attr1  string
		Attr2  int64
		Nested myInnterStruct
	}

	numKeys := 3
	keys := make([]*Key, 0, numKeys)
	ins := make([]myStruct, 0, numKeys)
	outs := make([]myStruct, numKeys)

	for i := 0; i < numKeys; i++ {
		k := &Key{HashKey: "NewHashKeyVal" + strconv.Itoa(i)}
		if s.WithRange {
			k.RangeKey = strconv.Itoa(12 + i)
		}

		in := myStruct{
			Attr1:  "Attr1Val" + strconv.Itoa(i),
			Attr2:  1000000 + int64(i),
			Nested: myInnterStruct{[]interface{}{true, false, nil, "some string", 3.14}},
		}

		keys = append(keys, k)
		ins = append(ins, in)
	}

	errs, err := s.table.BatchPutDocument(keys, ins)
	if err != nil {
		c.Fatal(err)
	}

	errs, err = s.table.BatchGetDocument(keys, true, outs)
	if err != nil {
		c.Fatal(err)
	}

	for i := 0; i < numKeys; i++ {
		c.Assert(errs[i], check.Equals, nil)
		c.Assert(outs[i], check.DeepEquals, ins[i])
	}
}

func (s *BatchSuite) TestBatchPutDocumentUnprocessedItems(c *check.C) {
	// Here we test what happens if DynamoDB returns partial success and returns
	// some items in the UnprocessedItems field. To do so, we setup a fake
	// endpoint for DynamoDB which will simply returns a canned response.
	endpoint := s.server.Region.DynamoDBEndpoint
	defer func() {
		s.server.Region.DynamoDBEndpoint = endpoint
	}()
	invocations := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawjson := `{"UnprocessedItems":{"DynamoDBTestMyTable":[{"PutRequest":{"Item":{"Attr1":{"S":"Attr1Val1"},"Attr2":{"N":"1000001"},"Nested":{"M":{"List":{"L":[{"BOOL":true},{"BOOL":false},{"NULL":true},{"S":"some string"},{"N":"3.14"}]}}},"TestHashKey":{"S":"NewHashKeyVal1"},"TestRangeKey":{"N":"13"}}}},{"PutRequest":{"Item":{"Attr1":{"S":"Attr1Val2"},"Attr2":{"N":"1000002"},"Nested":{"M":{"List":{"L":[{"BOOL":true},{"BOOL":false},{"NULL":true},{"S":"some string"},{"N":"3.14"}]}}},"TestHashKey":{"S":"NewHashKeyVal2"},"TestRangeKey":{"N":"14"}}}}]}}`
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, rawjson)
		// Restore the endpoint so any retries succeed.
		s.server.Region.DynamoDBEndpoint = endpoint
		invocations++
	}))
	defer server.Close()
	s.server.Region.DynamoDBEndpoint = server.URL

	type myInnterStruct struct {
		List []interface{}
	}
	type myStruct struct {
		Attr1  string
		Attr2  int64
		Nested myInnterStruct
	}

	numKeys := 3
	keys := make([]*Key, 0, numKeys)
	ins := make([]myStruct, 0, numKeys)

	for i := 0; i < numKeys; i++ {
		k := &Key{HashKey: "NewHashKeyVal" + strconv.Itoa(i)}
		if s.WithRange {
			k.RangeKey = strconv.Itoa(12 + i)
		}

		in := myStruct{
			Attr1:  "Attr1Val" + strconv.Itoa(i),
			Attr2:  1000000 + int64(i),
			Nested: myInnterStruct{[]interface{}{true, false, nil, "some string", 3.14}},
		}

		keys = append(keys, k)
		ins = append(ins, in)
	}

	errs, err := s.table.BatchPutDocument(keys, ins)
	if err != nil {
		c.Fatal(err)
	}

	// Make sure our fake endpoint was called exactly once.
	c.Assert(invocations, check.Equals, 1)

	// Confirm that each key was processed.
	for i := 0; i < numKeys; i++ {
		c.Assert(errs[i], check.Equals, nil)
	}
}

func (s *BatchSuite) TestBatchPutDocumentSizeExceeded(c *check.C) {
	numKeys := MaxPutBatchSize + 1
	keys := make([]*Key, 0, numKeys)
	ins := make([]map[string]interface{}, 0, numKeys)
	for i := 0; i < numKeys; i++ {
		k := &Key{HashKey: "NewHashKeyVal" + strconv.Itoa(i)}
		if s.WithRange {
			k.RangeKey = strconv.Itoa(12 + i)
		}
		in := map[string]interface{}{}

		keys = append(keys, k)
		ins = append(ins, in)
	}

	_, err := s.table.BatchPutDocument(keys, ins)
	if err == nil {
		c.Fatal("Expected max batch size exceeded error")
	} else {
		c.Assert(err.Error(), check.Equals, "Cannot add item, max batch size (25) exceeded")
	}
}
