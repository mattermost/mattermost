package dynamodb

import (
	"gopkg.in/check.v1"
)

type ItemSuite struct {
	TableDescriptionT TableDescriptionT
	DynamoDBTest
	WithRange bool
}

func (s *ItemSuite) SetUpSuite(c *check.C) {
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

var item_suite = &ItemSuite{
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

var item_without_range_suite = &ItemSuite{
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

var _ = check.Suite(item_suite)
var _ = check.Suite(item_without_range_suite)

func (s *ItemSuite) TestConditionalAddAttributesItem(c *check.C) {
	if s.WithRange {
		// No rangekey test required
		return
	}

	attrs := []Attribute{
		*NewNumericAttribute("AttrN", "10"),
	}
	pk := &Key{HashKey: "NewHashKeyVal"}

	// Put
	if ok, err := s.table.PutItem("NewHashKeyVal", "", attrs); !ok {
		c.Fatal(err)
	}

	{
		// Put with condition failed
		expected := []Attribute{
			*NewNumericAttribute("AttrN", "0").SetExists(true),
			*NewStringAttribute("AttrNotExists", "").SetExists(false),
		}
		// Add attributes with condition failed
		if ok, err := s.table.ConditionalAddAttributes(pk, attrs, expected); ok {
			c.Errorf("Expect condition does not meet.")
		} else {
			c.Check(err.Error(), check.Matches, "ConditionalCheckFailedException.*")
		}

	}
}

func (s *ItemSuite) TestConditionalPutUpdateDeleteItem(c *check.C) {
	if s.WithRange {
		// No rangekey test required
		return
	}

	attrs := []Attribute{
		*NewStringAttribute("Attr1", "Attr1Val"),
	}
	pk := &Key{HashKey: "NewHashKeyVal"}

	// Put
	if ok, err := s.table.PutItem("NewHashKeyVal", "", attrs); !ok {
		c.Fatal(err)
	}

	{
		// Put with condition failed
		expected := []Attribute{
			*NewStringAttribute("Attr1", "expectedAttr1Val").SetExists(true),
			*NewStringAttribute("AttrNotExists", "").SetExists(false),
		}
		if ok, err := s.table.ConditionalPutItem("NewHashKeyVal", "", attrs, expected); ok {
			c.Errorf("Expect condition does not meet.")
		} else {
			c.Check(err.Error(), check.Matches, "ConditionalCheckFailedException.*")
		}

		// Update attributes with condition failed
		if ok, err := s.table.ConditionalUpdateAttributes(pk, attrs, expected); ok {
			c.Errorf("Expect condition does not meet.")
		} else {
			c.Check(err.Error(), check.Matches, "ConditionalCheckFailedException.*")
		}

		// Delete attributes with condition failed
		if ok, err := s.table.ConditionalDeleteAttributes(pk, attrs, expected); ok {
			c.Errorf("Expect condition does not meet.")
		} else {
			c.Check(err.Error(), check.Matches, "ConditionalCheckFailedException.*")
		}
	}

	{
		expected := []Attribute{
			*NewStringAttribute("Attr1", "Attr1Val").SetExists(true),
		}

		// Add attributes with condition met
		addNewAttrs := []Attribute{
			*NewNumericAttribute("AddNewAttr1", "10"),
			*NewNumericAttribute("AddNewAttr2", "20"),
		}
		if ok, err := s.table.ConditionalAddAttributes(pk, addNewAttrs, expected); !ok {
			c.Errorf("Expect condition met. %s", err)
		}

		// Update attributes with condition met
		updateAttrs := []Attribute{
			*NewNumericAttribute("AddNewAttr1", "100"),
		}
		if ok, err := s.table.ConditionalUpdateAttributes(pk, updateAttrs, expected); !ok {
			c.Errorf("Expect condition met. %s", err)
		}

		// Delete attributes with condition met
		deleteAttrs := []Attribute{
			*NewNumericAttribute("AddNewAttr2", ""),
		}
		if ok, err := s.table.ConditionalDeleteAttributes(pk, deleteAttrs, expected); !ok {
			c.Errorf("Expect condition met. %s", err)
		}

		// Get to verify operations that condition are met
		item, err := s.table.GetItem(pk)
		if err != nil {
			c.Fatal(err)
		}

		if val, ok := item["AddNewAttr1"]; ok {
			c.Check(val, check.DeepEquals, NewNumericAttribute("AddNewAttr1", "100"))
		} else {
			c.Error("Expect AddNewAttr1 attribute to be added and updated")
		}

		if _, ok := item["AddNewAttr2"]; ok {
			c.Error("Expect AddNewAttr2 attribute to be deleted")
		}
	}

	{
		// Put with condition met
		expected := []Attribute{
			*NewStringAttribute("Attr1", "Attr1Val").SetExists(true),
		}
		newattrs := []Attribute{
			*NewStringAttribute("Attr1", "Attr2Val"),
		}
		if ok, err := s.table.ConditionalPutItem("NewHashKeyVal", "", newattrs, expected); !ok {
			c.Errorf("Expect condition met. %s", err)
		}

		// Get to verify Put operation that condition are met
		item, err := s.table.GetItem(pk)
		if err != nil {
			c.Fatal(err)
		}

		if val, ok := item["Attr1"]; ok {
			c.Check(val, check.DeepEquals, NewStringAttribute("Attr1", "Attr2Val"))
		} else {
			c.Error("Expect Attr1 attribute to be updated")
		}
	}

	{
		// Delete with condition failed
		expected := []Attribute{
			*NewStringAttribute("Attr1", "expectedAttr1Val").SetExists(true),
		}
		if ok, err := s.table.ConditionalDeleteItem(pk, expected); ok {
			c.Errorf("Expect condition does not meet.")
		} else {
			c.Check(err.Error(), check.Matches, "ConditionalCheckFailedException.*")
		}
	}

	{
		// Delete with condition met
		expected := []Attribute{
			*NewStringAttribute("Attr1", "Attr2Val").SetExists(true),
		}
		if ok, _ := s.table.ConditionalDeleteItem(pk, expected); !ok {
			c.Errorf("Expect condition met.")
		}

		// Get to verify Delete operation
		_, err := s.table.GetItem(pk)
		c.Check(err.Error(), check.Matches, "Item not found")
	}
}

func (s *ItemSuite) TestConditionExpressionPutUpdateDeleteItem(c *check.C) {
	if s.WithRange {
		// No rangekey test required
		return
	}

	attrs := []Attribute{
		*NewStringAttribute("Attr1", "Attr1Val"),
	}
	pk := &Key{HashKey: "NewHashKeyVal"}

	// Put
	if ok, err := s.table.PutItem("NewHashKeyVal", "", attrs); !ok {
		c.Fatal(err)
	}

	{
		// Put with condition failed
		condition := &Expression{
			Text: "Attr1 = :val AND attribute_not_exists (AttrNotExists)",
			AttributeValues: []Attribute{
				*NewStringAttribute(":val", "expectedAttr1Val"),
			},
		}
		if ok, err := s.table.ConditionExpressionPutItem("NewHashKeyVal", "", attrs, condition); ok {
			c.Errorf("Expect condition does not meet.")
		} else {
			c.Check(err.Error(), check.Matches, "ConditionalCheckFailedException.*")
		}

		// Update attributes with condition failed
		if ok, err := s.table.ConditionExpressionUpdateAttributes(pk, attrs, condition); ok {
			c.Errorf("Expect condition does not meet.")
		} else {
			c.Check(err.Error(), check.Matches, "ConditionalCheckFailedException.*")
		}

		// Delete attributes with condition failed
		if ok, err := s.table.ConditionExpressionDeleteAttributes(pk, attrs, condition); ok {
			c.Errorf("Expect condition does not meet.")
		} else {
			c.Check(err.Error(), check.Matches, "ConditionalCheckFailedException.*")
		}
	}

	{
		condition := &Expression{
			Text: "Attr1 = :val",
			AttributeValues: []Attribute{
				*NewStringAttribute(":val", "Attr1Val"),
			},
		}

		// Add attributes with condition met
		addNewAttrs := []Attribute{
			*NewNumericAttribute("AddNewAttr1", "10"),
			*NewNumericAttribute("AddNewAttr2", "20"),
		}
		if ok, err := s.table.ConditionExpressionAddAttributes(pk, addNewAttrs, condition); !ok {
			c.Errorf("Expect condition met. %s", err)
		}

		// Update attributes with condition met
		updateAttrs := []Attribute{
			*NewNumericAttribute("AddNewAttr1", "100"),
		}
		if ok, err := s.table.ConditionExpressionUpdateAttributes(pk, updateAttrs, condition); !ok {
			c.Errorf("Expect condition met. %s", err)
		}

		// Delete attributes with condition met
		deleteAttrs := []Attribute{
			*NewNumericAttribute("AddNewAttr2", ""),
		}
		if ok, err := s.table.ConditionExpressionDeleteAttributes(pk, deleteAttrs, condition); !ok {
			c.Errorf("Expect condition met. %s", err)
		}

		// Get to verify operations that condition are met
		item, err := s.table.GetItem(pk)
		if err != nil {
			c.Fatal(err)
		}

		if val, ok := item["AddNewAttr1"]; ok {
			c.Check(val, check.DeepEquals, NewNumericAttribute("AddNewAttr1", "100"))
		} else {
			c.Error("Expect AddNewAttr1 attribute to be added and updated")
		}

		if _, ok := item["AddNewAttr2"]; ok {
			c.Error("Expect AddNewAttr2 attribute to be deleted")
		}
	}

	{
		// Put with condition met
		condition := &Expression{
			Text: "Attr1 = :val",
			AttributeValues: []Attribute{
				*NewStringAttribute(":val", "Attr1Val"),
			},
		}
		newattrs := []Attribute{
			*NewStringAttribute("Attr1", "Attr2Val"),
		}
		if ok, err := s.table.ConditionExpressionPutItem("NewHashKeyVal", "", newattrs, condition); !ok {
			c.Errorf("Expect condition met. %s", err)
		}

		// Get to verify Put operation that condition are met
		item, err := s.table.GetItem(pk)
		if err != nil {
			c.Fatal(err)
		}

		if val, ok := item["Attr1"]; ok {
			c.Check(val, check.DeepEquals, NewStringAttribute("Attr1", "Attr2Val"))
		} else {
			c.Error("Expect Attr1 attribute to be updated")
		}
	}

	{
		// Delete with condition failed
		condition := &Expression{
			Text: "Attr1 = :val",
			AttributeValues: []Attribute{
				*NewStringAttribute(":val", "expectedAttr1Val"),
			},
		}
		if ok, err := s.table.ConditionExpressionDeleteItem(pk, condition); ok {
			c.Errorf("Expect condition does not meet.")
		} else {
			c.Check(err.Error(), check.Matches, "ConditionalCheckFailedException.*")
		}
	}

	{
		// Delete with condition met
		condition := &Expression{
			Text: "Attr1 = :val",
			AttributeValues: []Attribute{
				*NewStringAttribute(":val", "Attr2Val"),
			},
		}
		if ok, _ := s.table.ConditionExpressionDeleteItem(pk, condition); !ok {
			c.Errorf("Expect condition met.")
		}

		// Get to verify Delete operation
		_, err := s.table.GetItem(pk)
		c.Check(err.Error(), check.Matches, "Item not found")
	}
}

func (s *ItemSuite) TestPutGetDeleteItem(c *check.C) {
	attrs := []Attribute{
		*NewStringAttribute("Attr1", "Attr1Val"),
	}

	var rk string
	if s.WithRange {
		rk = "1"
	}

	// Put
	if ok, err := s.table.PutItem("NewHashKeyVal", rk, attrs); !ok {
		c.Fatal(err)
	}

	// Get to verify Put operation
	pk := &Key{HashKey: "NewHashKeyVal", RangeKey: rk}
	item, err := s.table.GetItem(pk)
	if err != nil {
		c.Fatal(err)
	}

	if val, ok := item["TestHashKey"]; ok {
		c.Check(val, check.DeepEquals, NewStringAttribute("TestHashKey", "NewHashKeyVal"))
	} else {
		c.Error("Expect TestHashKey to be found")
	}

	if s.WithRange {
		if val, ok := item["TestRangeKey"]; ok {
			c.Check(val, check.DeepEquals, NewNumericAttribute("TestRangeKey", "1"))
		} else {
			c.Error("Expect TestRangeKey to be found")
		}
	}

	// Delete
	if ok, _ := s.table.DeleteItem(pk); !ok {
		c.Fatal(err)
	}

	// Get to verify Delete operation
	_, err = s.table.GetItem(pk)
	c.Check(err.Error(), check.Matches, "Item not found")
}

func (s *ItemSuite) TestUpdateItem(c *check.C) {
	attrs := []Attribute{
		*NewNumericAttribute("count", "0"),
	}

	var rk string
	if s.WithRange {
		rk = "1"
	}

	if ok, err := s.table.PutItem("NewHashKeyVal", rk, attrs); !ok {
		c.Fatal(err)
	}

	// UpdateItem with Add
	attrs = []Attribute{
		*NewNumericAttribute("count", "10"),
	}
	pk := &Key{HashKey: "NewHashKeyVal", RangeKey: rk}
	if ok, err := s.table.AddAttributes(pk, attrs); !ok {
		c.Error(err)
	}

	// Get to verify Add operation
	if item, err := s.table.GetItemConsistent(pk, true); err != nil {
		c.Error(err)
	} else {
		if val, ok := item["count"]; ok {
			c.Check(val, check.DeepEquals, NewNumericAttribute("count", "10"))
		} else {
			c.Error("Expect count to be found")
		}
	}

	// UpdateItem with Put
	attrs = []Attribute{
		*NewNumericAttribute("count", "100"),
	}
	if ok, err := s.table.UpdateAttributes(pk, attrs); !ok {
		c.Error(err)
	}

	// Get to verify Put operation
	if item, err := s.table.GetItem(pk); err != nil {
		c.Fatal(err)
	} else {
		if val, ok := item["count"]; ok {
			c.Check(val, check.DeepEquals, NewNumericAttribute("count", "100"))
		} else {
			c.Error("Expect count to be found")
		}
	}

	// UpdateItem with Delete
	attrs = []Attribute{
		*NewNumericAttribute("count", ""),
	}
	if ok, err := s.table.DeleteAttributes(pk, attrs); !ok {
		c.Error(err)
	}

	// Get to verify Delete operation
	if item, err := s.table.GetItem(pk); err != nil {
		c.Error(err)
	} else {
		if _, ok := item["count"]; ok {
			c.Error("Expect count not to be found")
		}
	}
}

func (s *ItemSuite) TestUpdateItemWithSet(c *check.C) {
	attrs := []Attribute{
		*NewStringSetAttribute("list", []string{"A", "B"}),
	}

	var rk string
	if s.WithRange {
		rk = "1"
	}

	if ok, err := s.table.PutItem("NewHashKeyVal", rk, attrs); !ok {
		c.Error(err)
	}

	// UpdateItem with Add
	attrs = []Attribute{
		*NewStringSetAttribute("list", []string{"C"}),
	}
	pk := &Key{HashKey: "NewHashKeyVal", RangeKey: rk}
	if ok, err := s.table.AddAttributes(pk, attrs); !ok {
		c.Error(err)
	}

	// Get to verify Add operation
	if item, err := s.table.GetItem(pk); err != nil {
		c.Error(err)
	} else {
		if val, ok := item["list"]; ok {
			c.Check(val, check.DeepEquals, NewStringSetAttribute("list", []string{"A", "B", "C"}))
		} else {
			c.Error("Expect count to be found")
		}
	}

	// UpdateItem with Delete
	attrs = []Attribute{
		*NewStringSetAttribute("list", []string{"A"}),
	}
	if ok, err := s.table.DeleteAttributes(pk, attrs); !ok {
		c.Error(err)
	}

	// Get to verify Delete operation
	if item, err := s.table.GetItem(pk); err != nil {
		c.Error(err)
	} else {
		if val, ok := item["list"]; ok {
			c.Check(val, check.DeepEquals, NewStringSetAttribute("list", []string{"B", "C"}))
		} else {
			c.Error("Expect list to be remained")
		}
	}
}

func (s *ItemSuite) TestQueryScanWithMap(c *check.C) {
	attrs := []Attribute{
		*NewMapAttribute("Attr1",
			map[string]*Attribute{
				"SubAttr1": NewStringAttribute("SubAttr1", "SubAttr1Val"),
				"SubAttr2": NewNumericAttribute("SubAttr2", "2"),
			},
		),
	}
	var rk string
	if s.WithRange {
		rk = "1"
	}
	if ok, err := s.table.PutItem("NewHashKeyVal", rk, attrs); !ok {
		c.Fatal(err)
	}
	pk := &Key{HashKey: "NewHashKeyVal", RangeKey: rk}

	// Scan
	if out, err := s.table.Scan(nil); err != nil {
		c.Fatal(err)
	} else {
		if len(out) != 1 {
			c.Fatal("Got no result from scan")
		}
		item := out[0]
		if val, ok := item["Attr1"]; ok {
			c.Check(val, check.DeepEquals, &attrs[0])
		} else {
			c.Error("Expected Attr1 to be found")
		}
	}

	// Query
	q := NewQuery(s.table)
	q.AddKey(pk)
	eq := NewStringAttributeComparison("TestHashKey", COMPARISON_EQUAL, pk.HashKey)
	q.AddKeyConditions([]AttributeComparison{*eq})

	if out, _, err := s.table.QueryTable(q); err != nil {
		c.Fatal(err)
	} else {
		if len(out) != 1 {
			c.Fatal("Got no result from query")
		}
		item := out[0]
		if val, ok := item["Attr1"]; ok {
			c.Check(val, check.DeepEquals, &attrs[0])
		} else {
			c.Fatal("Expected Attr1 to be found")
		}
	}

}

func (s *ItemSuite) TestUpdateItemWithMap(c *check.C) {
	attrs := []Attribute{
		*NewMapAttribute("Attr1",
			map[string]*Attribute{
				"SubAttr1": NewStringAttribute("SubAttr1", "SubAttr1Val"),
				"SubAttr2": NewNumericAttribute("SubAttr2", "2"),
			},
		),
	}
	var rk string
	if s.WithRange {
		rk = "1"
	}
	if ok, err := s.table.PutItem("NewHashKeyVal", rk, attrs); !ok {
		c.Fatal(err)
	}

	// Verify the PutItem operation
	pk := &Key{HashKey: "NewHashKeyVal", RangeKey: rk}
	if item, err := s.table.GetItem(pk); err != nil {
		c.Error(err)
	} else {
		if val, ok := item["Attr1"]; ok {
			c.Check(val, check.DeepEquals, &attrs[0])
		} else {
			c.Error("Expected Attr1 to be found")
		}
	}

	// Update the map attribute via UpdateItem API
	updateAttr := NewStringAttribute(":3", "SubAttr3Val")
	update := &Expression{
		Text: "SET #a.#3 = :3",
		AttributeNames: map[string]string{
			"#a": "Attr1",
			"#3": "SubAttr3",
		},
		AttributeValues: []Attribute{*updateAttr},
	}
	expected := []Attribute{
		*NewMapAttribute("Attr1",
			map[string]*Attribute{
				"SubAttr1": NewStringAttribute("SubAttr1", "SubAttr1Val"),
				"SubAttr2": NewNumericAttribute("SubAttr2", "2"),
				"SubAttr3": NewStringAttribute("SubAttr3", "SubAttr3Val"),
			},
		),
	}
	if ok, err := s.table.UpdateExpressionUpdateAttributes(pk, nil, update); !ok {
		c.Fatal(err)
	}

	// Verify the map attribute field has been updated
	if item, err := s.table.GetItem(pk); err != nil {
		c.Fatal(err)
	} else {
		if val, ok := item["Attr1"]; ok {
			c.Check(val, check.DeepEquals, &expected[0])
		} else {
			c.Fatal("Expected Attr1 to be found")
		}
	}

	// Overwrite the map via UpdateItem API
	newAttrs := []Attribute{
		*NewMapAttribute("Attr1",
			map[string]*Attribute{
				"SubAttr3": NewStringAttribute("SubAttr3", "SubAttr3Val"),
			},
		),
	}
	if ok, err := s.table.UpdateAttributes(pk, newAttrs); !ok {
		c.Error(err)
	}

	// Verify the map attribute has been overwritten
	if item, err := s.table.GetItem(pk); err != nil {
		c.Fatal(err)
	} else {
		if val, ok := item["Attr1"]; ok {
			c.Check(val, check.DeepEquals, &newAttrs[0])
		} else {
			c.Fatal("Expected Attr1 to be found")
		}
	}
}

func (s *ItemSuite) TestPutGetDeleteDocument(c *check.C) {
	k := &Key{HashKey: "NewHashKeyVal"}
	if s.WithRange {
		k.RangeKey = "1"
	}

	in := map[string]interface{}{
		"Attr1": "Attr1Val",
		"Attr2": 12,
	}

	// Put
	if err := s.table.PutDocument(k, in); err != nil {
		c.Fatal(err)
	}

	// Get
	var out map[string]interface{}
	if err := s.table.GetDocument(k, &out); err != nil {
		c.Fatal(err)
	}
	c.Check(out, check.DeepEquals, in)

	// Delete
	if err := s.table.DeleteDocument(k); err != nil {
		c.Fatal(err)
	}
	err := s.table.GetDocument(k, &out)
	c.Check(err.Error(), check.Matches, "Item not found")
}

func (s *ItemSuite) TestPutGetDeleteDocumentTyped(c *check.C) {
	k := &Key{HashKey: "NewHashKeyVal"}
	if s.WithRange {
		k.RangeKey = "1"
	}

	type myInnterStruct struct {
		List []interface{}
	}
	type myStruct struct {
		Attr1  string
		Attr2  int64
		Nested myInnterStruct
	}
	in := myStruct{Attr1: "Attr1Val", Attr2: 1000000, Nested: myInnterStruct{[]interface{}{true, false, nil, "some string", 3.14}}}

	for i := 0; i < 2; i++ {
		// Put - test both struct and pointer to struct
		if i == 0 {
			if err := s.table.PutDocument(k, in); err != nil {
				c.Fatal(err)
			}
		} else {
			if err := s.table.PutDocument(k, &in); err != nil {
				c.Fatal(err)
			}
		}

		// Get
		var out myStruct
		if err := s.table.GetDocument(k, &out); err != nil {
			c.Fatal(err)
		}
		c.Check(out, check.DeepEquals, in)

		// Delete
		if err := s.table.DeleteDocument(k); err != nil {
			c.Fatal(err)
		}
		err := s.table.GetDocument(k, &out)
		c.Check(err.Error(), check.Matches, "Item not found")
	}
}
