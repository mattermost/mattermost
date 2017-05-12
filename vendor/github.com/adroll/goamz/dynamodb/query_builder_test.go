package dynamodb

import (
	"github.com/AdRoll/goamz/aws"
	simplejson "github.com/bitly/go-simplejson"
	"gopkg.in/check.v1"
)

type QueryBuilderSuite struct {
	server *Server
}

var _ = check.Suite(&QueryBuilderSuite{})

func (s *QueryBuilderSuite) SetUpSuite(c *check.C) {
	auth := &aws.Auth{AccessKey: "", SecretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY"}
	s.server = New(*auth, aws.USEast)
}

func (s *QueryBuilderSuite) TestEmptyQuery(c *check.C) {
	q := NewEmptyQuery()
	queryString := q.String()
	expectedString := "{}"
	c.Check(queryString, check.Equals, expectedString)

	if expectedString != queryString {
		c.Fatalf("Unexpected Query String : %s\n", queryString)
	}
}

func (s *QueryBuilderSuite) TestAddWriteRequestItems(c *check.C) {
	primary := NewStringAttribute("WidgetFoo", "")
	secondary := NewNumericAttribute("Created", "")
	key := PrimaryKey{primary, secondary}
	table := s.server.NewTable("FooData", key)

	primary2 := NewStringAttribute("TestHashKey", "")
	secondary2 := NewNumericAttribute("TestRangeKey", "")
	key2 := PrimaryKey{primary2, secondary2}
	table2 := s.server.NewTable("TestTable", key2)

	q := NewEmptyQuery()

	attribute1 := NewNumericAttribute("testing", "4")
	attribute2 := NewNumericAttribute("testingbatch", "2111")
	attribute3 := NewStringAttribute("testingstrbatch", "mystr")
	item1 := []Attribute{*attribute1, *attribute2, *attribute3}

	attribute4 := NewNumericAttribute("testing", "444")
	attribute5 := NewNumericAttribute("testingbatch", "93748249272")
	attribute6 := NewStringAttribute("testingstrbatch", "myotherstr")
	item2 := []Attribute{*attribute4, *attribute5, *attribute6}

	attributeDel1 := NewStringAttribute("TestHashKeyDel", "DelKey")
	attributeDel2 := NewNumericAttribute("TestRangeKeyDel", "7777777")
	itemDel := []Attribute{*attributeDel1, *attributeDel2}

	attributeTest1 := NewStringAttribute("TestHashKey", "MyKey")
	attributeTest2 := NewNumericAttribute("TestRangeKey", "0193820384293")
	itemTest := []Attribute{*attributeTest1, *attributeTest2}

	tableItems := map[*Table]map[string][][]Attribute{}
	actionItems := make(map[string][][]Attribute)
	actionItems["Put"] = [][]Attribute{item1, item2}
	actionItems["Delete"] = [][]Attribute{itemDel}
	tableItems[table] = actionItems

	actionItems2 := make(map[string][][]Attribute)
	actionItems2["Put"] = [][]Attribute{itemTest}
	tableItems[table2] = actionItems2

	q.AddWriteRequestItems(tableItems)

	queryJson, err := simplejson.NewJson([]byte(q.String()))
	if err != nil {
		c.Fatal(err)
	}

	expectedJson, err := simplejson.NewJson([]byte(`
{
  "RequestItems": {
    "TestTable": [
      {
        "PutRequest": {
          "Item": {
            "TestRangeKey": {
              "N": "0193820384293"
            },
            "TestHashKey": {
              "S": "MyKey"
            }
          }
        }
      }
    ],
    "FooData": [
      {
        "DeleteRequest": {
          "Key": {
            "TestRangeKeyDel": {
              "N": "7777777"
            },
            "TestHashKeyDel": {
              "S": "DelKey"
            }
          }
        }
      },
      {
        "PutRequest": {
          "Item": {
            "testingstrbatch": {
              "S": "mystr"
            },
            "testingbatch": {
              "N": "2111"
            },
            "testing": {
              "N": "4"
            }
          }
        }
      },
      {
        "PutRequest": {
          "Item": {
            "testingstrbatch": {
              "S": "myotherstr"
            },
            "testingbatch": {
              "N": "93748249272"
            },
            "testing": {
              "N": "444"
            }
          }
        }
      }
    ]
  }
}
	`))
	if err != nil {
		c.Fatal(err)
	}
	c.Check(queryJson, check.DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestAddExpectedQuery(c *check.C) {
	primary := NewStringAttribute("domain", "")
	key := PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := NewQuery(table)
	q.AddKey(&Key{HashKey: "test"})

	expected := []Attribute{
		*NewStringAttribute("domain", "expectedTest").SetExists(true),
		*NewStringAttribute("testKey", "").SetExists(false),
	}
	q.AddExpected(expected)

	queryJson, err := simplejson.NewJson([]byte(q.String()))
	if err != nil {
		c.Fatal(err)
	}

	expectedJson, err := simplejson.NewJson([]byte(`
	{
		"ConditionExpression": "#Expected0 = :Expected0 AND attribute_not_exists (#Expected1)",
		"ExpressionAttributeNames": {
			"#Expected0": "domain",
			"#Expected1": "testKey"
		},
		"ExpressionAttributeValues": {
			":Expected0": {
				"S":"expectedTest"
			}
		},
		"Key": {
			"domain": {
				"S": "test"
			}
		},
		"TableName": "sites"
	}
	`))
	if err != nil {
		c.Fatal(err)
	}
	c.Check(queryJson, check.DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestGetItemQuery(c *check.C) {
	primary := NewStringAttribute("domain", "")
	key := PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := NewQuery(table)
	q.AddKey(&Key{HashKey: "test"})

	{
		queryJson, err := simplejson.NewJson([]byte(q.String()))
		if err != nil {
			c.Fatal(err)
		}

		expectedJson, err := simplejson.NewJson([]byte(`
		{
			"Key": {
				"domain": {
					"S": "test"
				}
			},
			"TableName": "sites"
		}
		`))
		if err != nil {
			c.Fatal(err)
		}
		c.Check(queryJson, check.DeepEquals, expectedJson)
	}

	// Use ConsistentRead
	{
		q.SetConsistentRead(true)
		queryJson, err := simplejson.NewJson([]byte(q.String()))
		if err != nil {
			c.Fatal(err)
		}

		expectedJson, err := simplejson.NewJson([]byte(`
		{
			"ConsistentRead": "true",
			"Key": {
				"domain": {
					"S": "test"
				}
			},
			"TableName": "sites"
		}
		`))
		if err != nil {
			c.Fatal(err)
		}
		c.Check(queryJson, check.DeepEquals, expectedJson)
	}
}

func (s *QueryBuilderSuite) TestUpdateQuery(c *check.C) {
	primary := NewStringAttribute("domain", "")
	rangek := NewNumericAttribute("time", "")
	key := PrimaryKey{primary, rangek}
	table := s.server.NewTable("sites", key)

	countAttribute := NewNumericAttribute("count", "4")
	attributes := []Attribute{*countAttribute}

	q := NewQuery(table)
	q.AddKey(&Key{HashKey: "test", RangeKey: "1234"})
	q.AddUpdates(attributes, "ADD")

	queryJson, err := simplejson.NewJson([]byte(q.String()))
	if err != nil {
		c.Fatal(err)
	}
	expectedJson, err := simplejson.NewJson([]byte(`
{
	"UpdateExpression":"ADD #Updates0 :Updates0",
	"ExpressionAttributeNames": {
		"#Updates0": "count"
	},
	"ExpressionAttributeValues": {
		":Updates0": {
			"N": "4"
		}
	},
	"Key": {
		"domain": {
			"S": "test"
		},
		"time": {
			"N": "1234"
		}
	},
	"TableName": "sites"
}
	`))
	if err != nil {
		c.Fatal(err)
	}
	c.Check(queryJson, check.DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestAddUpdates(c *check.C) {
	primary := NewStringAttribute("domain", "")
	key := PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := NewQuery(table)
	q.AddKey(&Key{HashKey: "test"})

	attr := NewStringSetAttribute("StringSet", []string{"str", "str2"})

	q.AddUpdates([]Attribute{*attr}, "ADD")

	queryJson, err := simplejson.NewJson([]byte(q.String()))
	if err != nil {
		c.Fatal(err)
	}
	expectedJson, err := simplejson.NewJson([]byte(`
{
	"UpdateExpression": "ADD #Updates0 :Updates0",
	"ExpressionAttributeNames": {
		"#Updates0": "StringSet"
	},
	"ExpressionAttributeValues": {
		":Updates0": {
			"SS": ["str", "str2"]
		}
	},
	"Key": {
		"domain": {
			"S": "test"
		}
	},
	"TableName": "sites"
}
	`))
	if err != nil {
		c.Fatal(err)
	}
	c.Check(queryJson, check.DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestMapUpdates(c *check.C) {
	primary := NewStringAttribute("domain", "")
	key := PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := NewQuery(table)
	q.AddKey(&Key{HashKey: "test"})

	subAttr1 := NewStringAttribute(":Updates1", "subval1")
	subAttr2 := NewNumericAttribute(":Updates2", "2")
	exp := &Expression{
		Text: "SET #Updates0.#Updates1=:Updates1, #Updates0.#Updates2=:Updates2",
		AttributeNames: map[string]string{
			"#Updates0": "Map",
			"#Updates1": "submap1",
			"#Updates2": "submap2",
		},
		AttributeValues: []Attribute{*subAttr1, *subAttr2},
	}
	q.AddUpdateExpression(exp)
	queryJson, err := simplejson.NewJson([]byte(q.String()))
	if err != nil {
		c.Fatal(err)
	}
	expectedJson, err := simplejson.NewJson([]byte(`
{
	"UpdateExpression": "SET #Updates0.#Updates1=:Updates1, #Updates0.#Updates2=:Updates2",
	"ExpressionAttributeNames": {
		"#Updates0": "Map",
		"#Updates1": "submap1",
		"#Updates2": "submap2"
	},
	"ExpressionAttributeValues": {
        ":Updates1": {"S": "subval1"},
        ":Updates2": {"N": "2"}
	},
	"Key": {
		"domain": {
			"S": "test"
		}
	},
	"TableName": "sites"
}
	`))
	if err != nil {
		c.Fatal(err)
	}
	c.Check(queryJson, check.DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestAddKeyConditions(c *check.C) {
	primary := NewStringAttribute("domain", "")
	key := PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := NewQuery(table)
	acs := []AttributeComparison{
		*NewStringAttributeComparison("domain", "EQ", "example.com"),
		*NewStringAttributeComparison("path", "EQ", "/"),
	}
	q.AddKeyConditions(acs)
	queryJson, err := simplejson.NewJson([]byte(q.String()))

	if err != nil {
		c.Fatal(err)
	}

	expectedJson, err := simplejson.NewJson([]byte(`
{
  "KeyConditions": {
    "domain": {
      "AttributeValueList": [
        {
          "S": "example.com"
        }
      ],
      "ComparisonOperator": "EQ"
    },
    "path": {
      "AttributeValueList": [
        {
          "S": "/"
        }
      ],
      "ComparisonOperator": "EQ"
    }
  },
  "TableName": "sites"
}
	`))
	if err != nil {
		c.Fatal(err)
	}
	c.Check(queryJson, check.DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestAddQueryFilterConditions(c *check.C) {
	primary := NewStringAttribute("domain", "")
	key := PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := NewQuery(table)
	acs := []AttributeComparison{
		*NewStringAttributeComparison("domain", "EQ", "example.com"),
	}
	qf := []AttributeComparison{
		*NewNumericAttributeComparison("count", COMPARISON_GREATER_THAN, 5),
	}
	q.AddKeyConditions(acs)
	q.AddQueryFilter(qf)
	queryJson, err := simplejson.NewJson([]byte(q.String()))

	if err != nil {
		c.Fatal(err)
	}

	expectedJson, err := simplejson.NewJson([]byte(`
{
  "KeyConditions": {
    "domain": {
      "AttributeValueList": [
        {
          "S": "example.com"
        }
      ],
      "ComparisonOperator": "EQ"
    }
  },
  "QueryFilter": {
    "count": {
      "AttributeValueList": [
        { "N": "5" }
      ],
      "ComparisonOperator": "GT"
    }
  },
  "TableName": "sites"
}
	`))
	if err != nil {
		c.Fatal(err)
	}
	c.Check(queryJson, check.DeepEquals, expectedJson)
}
