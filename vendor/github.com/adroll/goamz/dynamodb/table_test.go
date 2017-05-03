package dynamodb

import (
	"fmt"
	"gopkg.in/check.v1"
)

type TableSuite struct {
	TableDescriptionT TableDescriptionT
	DynamoDBTest
}

func (s *TableSuite) SetUpSuite(c *check.C) {
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
}

var table_suite = &TableSuite{
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
}

var table_suite_gsi = &TableSuite{
	TableDescriptionT: TableDescriptionT{
		TableName: "DynamoDBTestMyTable2",
		AttributeDefinitions: []AttributeDefinitionT{
			AttributeDefinitionT{"UserId", "S"},
			AttributeDefinitionT{"OSType", "S"},
			AttributeDefinitionT{"IMSI", "S"},
		},
		KeySchema: []KeySchemaT{
			KeySchemaT{"UserId", "HASH"},
			KeySchemaT{"OSType", "RANGE"},
		},
		ProvisionedThroughput: ProvisionedThroughputT{
			ReadCapacityUnits:  1,
			WriteCapacityUnits: 1,
		},
		GlobalSecondaryIndexes: []GlobalSecondaryIndexT{
			GlobalSecondaryIndexT{
				IndexName: "IMSIIndex",
				KeySchema: []KeySchemaT{
					KeySchemaT{"IMSI", "HASH"},
				},
				Projection: ProjectionT{
					ProjectionType: "KEYS_ONLY",
				},
				ProvisionedThroughput: ProvisionedThroughputT{
					ReadCapacityUnits:  1,
					WriteCapacityUnits: 1,
				},
			},
		},
	},
}

func (s *TableSuite) TestCreateListTableGsi(c *check.C) {
	status, err := s.server.CreateTable(s.TableDescriptionT)
	if err != nil {
		fmt.Printf("err %#v", err)
		c.Fatal(err)
	}
	if status != "ACTIVE" && status != "CREATING" {
		c.Error("Expect status to be ACTIVE or CREATING")
	}

	s.WaitUntilStatus(c, "ACTIVE")

	tables, err := s.server.ListTables()
	if err != nil {
		c.Fatal(err)
	}
	c.Check(len(tables), check.Not(check.Equals), 0)
	c.Check(findTableByName(tables, s.TableDescriptionT.TableName), check.Equals, true)
}

var _ = check.Suite(table_suite)
var _ = check.Suite(table_suite_gsi)
