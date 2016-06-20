package dynamodb_test

import (
	simplejson "github.com/bitly/go-simplejson"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/dynamodb"
	. "gopkg.in/check.v1"
)

type QueryBuilderSuite struct {
	server *dynamodb.Server
}

var _ = Suite(&QueryBuilderSuite{})

func (s *QueryBuilderSuite) SetUpSuite(c *C) {
	auth := &aws.Auth{AccessKey: "", SecretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY"}
	s.server = &dynamodb.Server{*auth, aws.USEast}
}

func (s *QueryBuilderSuite) TestEmptyQuery(c *C) {
	q := dynamodb.NewEmptyQuery()
	queryString := q.String()
	expectedString := "{}"
	c.Check(queryString, Equals, expectedString)

	if expectedString != queryString {
		c.Fatalf("Unexpected Query String : %s\n", queryString)
	}
}

func (s *QueryBuilderSuite) TestAddWriteRequestItems(c *C) {
	primary := dynamodb.NewStringAttribute("WidgetFoo", "")
	secondary := dynamodb.NewNumericAttribute("Created", "")
	key := dynamodb.PrimaryKey{primary, secondary}
	table := s.server.NewTable("FooData", key)

	primary2 := dynamodb.NewStringAttribute("TestHashKey", "")
	secondary2 := dynamodb.NewNumericAttribute("TestRangeKey", "")
	key2 := dynamodb.PrimaryKey{primary2, secondary2}
	table2 := s.server.NewTable("TestTable", key2)

	q := dynamodb.NewEmptyQuery()

	attribute1 := dynamodb.NewNumericAttribute("testing", "4")
	attribute2 := dynamodb.NewNumericAttribute("testingbatch", "2111")
	attribute3 := dynamodb.NewStringAttribute("testingstrbatch", "mystr")
	item1 := []dynamodb.Attribute{*attribute1, *attribute2, *attribute3}

	attribute4 := dynamodb.NewNumericAttribute("testing", "444")
	attribute5 := dynamodb.NewNumericAttribute("testingbatch", "93748249272")
	attribute6 := dynamodb.NewStringAttribute("testingstrbatch", "myotherstr")
	item2 := []dynamodb.Attribute{*attribute4, *attribute5, *attribute6}

	attributeDel1 := dynamodb.NewStringAttribute("TestHashKeyDel", "DelKey")
	attributeDel2 := dynamodb.NewNumericAttribute("TestRangeKeyDel", "7777777")
	itemDel := []dynamodb.Attribute{*attributeDel1, *attributeDel2}

	attributeTest1 := dynamodb.NewStringAttribute("TestHashKey", "MyKey")
	attributeTest2 := dynamodb.NewNumericAttribute("TestRangeKey", "0193820384293")
	itemTest := []dynamodb.Attribute{*attributeTest1, *attributeTest2}

	tableItems := map[*dynamodb.Table]map[string][][]dynamodb.Attribute{}
	actionItems := make(map[string][][]dynamodb.Attribute)
	actionItems["Put"] = [][]dynamodb.Attribute{item1, item2}
	actionItems["Delete"] = [][]dynamodb.Attribute{itemDel}
	tableItems[table] = actionItems

	actionItems2 := make(map[string][][]dynamodb.Attribute)
	actionItems2["Put"] = [][]dynamodb.Attribute{itemTest}
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
	c.Check(queryJson, DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestAddExpectedQuery(c *C) {
	primary := dynamodb.NewStringAttribute("domain", "")
	key := dynamodb.PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := dynamodb.NewQuery(table)
	q.AddKey(table, &dynamodb.Key{HashKey: "test"})

	expected := []dynamodb.Attribute{
		*dynamodb.NewStringAttribute("domain", "expectedTest").SetExists(true),
		*dynamodb.NewStringAttribute("testKey", "").SetExists(false),
	}
	q.AddExpected(expected)

	queryJson, err := simplejson.NewJson([]byte(q.String()))
	if err != nil {
		c.Fatal(err)
	}

	expectedJson, err := simplejson.NewJson([]byte(`
	{
		"Expected": {
			"domain": {
				"Exists": "true",
				"Value": {
					"S": "expectedTest"
				}
			},
			"testKey": {
				"Exists": "false"
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
	c.Check(queryJson, DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestGetItemQuery(c *C) {
	primary := dynamodb.NewStringAttribute("domain", "")
	key := dynamodb.PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := dynamodb.NewQuery(table)
	q.AddKey(table, &dynamodb.Key{HashKey: "test"})

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
		c.Check(queryJson, DeepEquals, expectedJson)
	}

	// Use ConsistentRead
	{
		q.ConsistentRead(true)
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
		c.Check(queryJson, DeepEquals, expectedJson)
	}
}

func (s *QueryBuilderSuite) TestUpdateQuery(c *C) {
	primary := dynamodb.NewStringAttribute("domain", "")
	rangek := dynamodb.NewNumericAttribute("time", "")
	key := dynamodb.PrimaryKey{primary, rangek}
	table := s.server.NewTable("sites", key)

	countAttribute := dynamodb.NewNumericAttribute("count", "4")
	attributes := []dynamodb.Attribute{*countAttribute}

	q := dynamodb.NewQuery(table)
	q.AddKey(table, &dynamodb.Key{HashKey: "test", RangeKey: "1234"})
	q.AddUpdates(attributes, "ADD")

	queryJson, err := simplejson.NewJson([]byte(q.String()))
	if err != nil {
		c.Fatal(err)
	}
	expectedJson, err := simplejson.NewJson([]byte(`
{
	"AttributeUpdates": {
		"count": {
			"Action": "ADD",
			"Value": {
				"N": "4"
			}
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
	c.Check(queryJson, DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestAddUpdates(c *C) {
	primary := dynamodb.NewStringAttribute("domain", "")
	key := dynamodb.PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := dynamodb.NewQuery(table)
	q.AddKey(table, &dynamodb.Key{HashKey: "test"})

	attr := dynamodb.NewStringSetAttribute("StringSet", []string{"str", "str2"})

	q.AddUpdates([]dynamodb.Attribute{*attr}, "ADD")

	queryJson, err := simplejson.NewJson([]byte(q.String()))
	if err != nil {
		c.Fatal(err)
	}
	expectedJson, err := simplejson.NewJson([]byte(`
{
	"AttributeUpdates": {
		"StringSet": {
			"Action": "ADD",
			"Value": {
				"SS": ["str", "str2"]
			}
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
	c.Check(queryJson, DeepEquals, expectedJson)
}

func (s *QueryBuilderSuite) TestAddKeyConditions(c *C) {
	primary := dynamodb.NewStringAttribute("domain", "")
	key := dynamodb.PrimaryKey{primary, nil}
	table := s.server.NewTable("sites", key)

	q := dynamodb.NewQuery(table)
	acs := []dynamodb.AttributeComparison{
		*dynamodb.NewStringAttributeComparison("domain", "EQ", "example.com"),
		*dynamodb.NewStringAttributeComparison("path", "EQ", "/"),
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
	c.Check(queryJson, DeepEquals, expectedJson)
}
