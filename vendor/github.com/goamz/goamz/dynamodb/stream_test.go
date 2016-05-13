package dynamodb_test

import (
	"strconv"

	"github.com/goamz/goamz/dynamodb"
	. "gopkg.in/check.v1"
)

type StreamSuite struct {
	TableDescriptionT dynamodb.TableDescriptionT
	DynamoDBTest
}

func (s *StreamSuite) SetUpSuite(c *C) {
	setUpAuth(c)
	s.DynamoDBTest.TableDescriptionT = s.TableDescriptionT
	s.server = &dynamodb.Server{dynamodb_auth, dynamodb_region}
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

var stream_suite_keys_only = &StreamSuite{
	TableDescriptionT: dynamodb.TableDescriptionT{
		TableName: "StreamTable",
		AttributeDefinitions: []dynamodb.AttributeDefinitionT{
			dynamodb.AttributeDefinitionT{"TestHashKey", "S"},
			dynamodb.AttributeDefinitionT{"TestRangeKey", "N"},
		},
		KeySchema: []dynamodb.KeySchemaT{
			dynamodb.KeySchemaT{"TestHashKey", "HASH"},
			dynamodb.KeySchemaT{"TestRangeKey", "RANGE"},
		},
		ProvisionedThroughput: dynamodb.ProvisionedThroughputT{
			ReadCapacityUnits:  1,
			WriteCapacityUnits: 1,
		},
		StreamSpecification: dynamodb.StreamSpecificationT{
			StreamEnabled:  true,
			StreamViewType: "KEYS_ONLY",
		},
	},
}

var stream_suite_new_image = &StreamSuite{
	TableDescriptionT: dynamodb.TableDescriptionT{
		TableName: "StreamTable",
		AttributeDefinitions: []dynamodb.AttributeDefinitionT{
			dynamodb.AttributeDefinitionT{"TestHashKey", "S"},
			dynamodb.AttributeDefinitionT{"TestRangeKey", "N"},
		},
		KeySchema: []dynamodb.KeySchemaT{
			dynamodb.KeySchemaT{"TestHashKey", "HASH"},
			dynamodb.KeySchemaT{"TestRangeKey", "RANGE"},
		},
		ProvisionedThroughput: dynamodb.ProvisionedThroughputT{
			ReadCapacityUnits:  1,
			WriteCapacityUnits: 1,
		},
		StreamSpecification: dynamodb.StreamSpecificationT{
			StreamEnabled:  true,
			StreamViewType: "NEW_IMAGE",
		},
	},
}

var _ = Suite(stream_suite_keys_only)
var _ = Suite(stream_suite_new_image)

func (s *StreamSuite) TestStream(c *C) {
	checkStream(s.table, c)
}

func checkStream(table *dynamodb.Table, c *C) {
	// list the table's streams
	streams, err := table.ListStreams("")
	if err != nil {
		c.Fatal(err)
	}
	c.Check(len(streams), Not(Equals), 0)
	c.Check(streams[0].TableName, Equals, table.Name)

	// stick a couple of items in the table
	attrs := []dynamodb.Attribute{
		*dynamodb.NewStringAttribute("TestAttr", "0"),
	}
	if ok, err := table.PutItem("0", "0", attrs); !ok {
		c.Fatal(err)
	}
	attrs = []dynamodb.Attribute{
		*dynamodb.NewStringAttribute("TestAttr", "1"),
	}
	if ok, err := table.PutItem("1", "1", attrs); !ok {
		c.Fatal(err)
	}

	// create a stream object
	stream := table.Server.NewStream(streams[0].StreamArn)

	// describe the steam
	desc, err := stream.DescribeStream("")
	if err != nil {
		c.Fatal(err)
	}

	tableDesc, err := table.DescribeTable()
	if err != nil {
		c.Fatal(err)
	}

	c.Check(desc.KeySchema[0], Equals, tableDesc.KeySchema[0])
	c.Check(desc.StreamArn, Equals, streams[0].StreamArn)
	c.Check(desc.StreamStatus, Equals, "ENABLED")
	c.Check(desc.StreamViewType, Equals, tableDesc.StreamSpecification.StreamViewType)
	c.Check(desc.TableName, Equals, table.Name)
	c.Check(len(desc.Shards), Equals, 1)

	// get a shard iterator
	shardIt, err := stream.GetShardIterator(desc.Shards[0].ShardId, "TRIM_HORIZON", "")
	if err != nil {
		c.Fatal(err)
	}
	c.Check(len(shardIt), Not(Equals), 0)

	// poll for records
	nextIt, records, err := stream.GetRecords(shardIt)
	if err != nil {
		c.Fatal(err)
	}
	c.Check(len(nextIt), Not(Equals), 0)
	c.Check(len(records), Equals, 2)

	for index, record := range records {
		c.Check(record.EventSource, Equals, "aws:dynamodb")
		c.Check(record.EventName, Equals, "INSERT")
		c.Check(len(record.EventID), Not(Equals), 0)

		// look at the actual record
		streamRec := record.StreamRecord
		c.Check(streamRec.StreamViewType, Equals, desc.StreamViewType)
		c.Check(len(streamRec.SequenceNumber), Not(Equals), 0)
		if streamRec.SizeBytes <= 0 {
			c.Errorf("Expected greater-than-zero size, got: %d", streamRec.SizeBytes)
		}
		// check the keys
		if streamRec.StreamViewType == "KEYS_ONLY" {
			checkKeys(streamRec.Keys, index, c)
		}
		// check the image
		if streamRec.StreamViewType == "NEW_IMAGE" {
			checkNewImage(streamRec.NewImage, index, c)
		}
	}
}

func checkKeys(keys map[string]*dynamodb.Attribute, expect int, c *C) {
	c.Check(len(keys), Equals, 2)
	value, err := strconv.Atoi(keys["TestHashKey"].Value)
	if err != nil {
		c.Fatal(err)
	}
	c.Check(value, Equals, expect)
	value, err = strconv.Atoi(keys["TestRangeKey"].Value)
	if err != nil {
		c.Fatal(err)
	}
	c.Check(value, Equals, expect)
}

func checkNewImage(image map[string]*dynamodb.Attribute, expect int, c *C) {
	c.Check(len(image), Equals, 3)
	value, err := strconv.Atoi(image["TestHashKey"].Value)
	if err != nil {
		c.Fatal(err)
	}
	c.Check(value, Equals, expect)
	value, err = strconv.Atoi(image["TestRangeKey"].Value)
	if err != nil {
		c.Fatal(err)
	}
	c.Check(value, Equals, expect)
	value, err = strconv.Atoi(image["TestAttr"].Value)
	if err != nil {
		c.Fatal(err)
	}
	c.Check(value, Equals, expect)
}
