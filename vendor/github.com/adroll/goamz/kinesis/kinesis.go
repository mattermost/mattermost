package kinesis

import (
	"encoding/json"
	"github.com/AdRoll/goamz/aws"
	"io/ioutil"
	"log"
	"net/http"
	"strings"
	"time"
)

const debug = false

// New creates a new Kinesis object.
func New(auth aws.Auth, region aws.Region) *Kinesis {
	return &Kinesis{auth, region}
}

// This operation adds a new Amazon Kinesis stream to your AWS account.
func (k *Kinesis) CreateStream(name string, shardCount int) error {
	target := target("CreateStream")
	query := NewQueryWithStream(name)
	query.AddShardCount(shardCount)
	_, err := k.query(target, query)
	return err
}

// This operation deletes a stream and all of its shards and data.
func (k *Kinesis) DeleteStream(name string) error {
	target := target("DeleteStream")
	query := NewQueryWithStream(name)
	_, err := k.query(target, query)
	return err
}

// This operation returns the following information about the stream: the current status of the stream,
// the stream Amazon Resource Name (ARN), and an array of shard objects that comprise the stream.
func (k *Kinesis) DescribeStream(name string) (resp *StreamDescription, err error) {
	target := target("DescribeStream")
	query := NewQueryWithStream(name)

	body, err := k.query(target, query)
	if err != nil {
		return nil, err
	}

	dsr := &DescribeStreamResponse{}

	err = json.Unmarshal(body, dsr)
	return &dsr.StreamDescription, err
}

// This operation returns one or more data records from a shard.
func (k *Kinesis) GetRecords(shardIterator string, limit int) (resp *GetRecordsResponse, err error) {
	target := target("GetRecords")
	query := NewEmptyQuery()
	query.AddLimit(limit)
	query.AddShardIterator(shardIterator)

	body, err := k.query(target, query)
	if err != nil {
		return nil, err
	}

	grr := &GetRecordsResponse{}
	err = json.Unmarshal(body, grr)

	return grr, err
}

// This operation returns a shard iterator in ShardIterator.
// The shard iterator specifies the position in the shard from which you want to start reading data records sequentially.
func (k *Kinesis) GetShardIterator(shardId, streamName string, iteratorType ShardIteratorType, sequenceNumber string) (resp *GetShardIteratorResponse, err error) {
	target := target("GetShardIterator")
	query := NewQueryWithStream(streamName)
	query.AddShardId(shardId)
	query.AddShardIteratorType(iteratorType)

	if sequenceNumber != "" {
		query.AddStartingSequenceNumber(sequenceNumber)
	}

	body, err := k.query(target, query)
	if err != nil {
		return nil, err
	}

	gsr := &GetShardIteratorResponse{}
	err = json.Unmarshal(body, gsr)

	return gsr, err
}

// This operation returns an array of the names of all the streams that are associated
// with the AWS account making the ListStreams request.
func (k *Kinesis) ListStreams() (resp *ListStreamResponse, err error) {
	target := target("ListStreams")
	query := NewEmptyQuery()
	query.AddLimit(10)

	body, err := k.query(target, query)
	if err != nil {
		return nil, err
	}

	lsr := &ListStreamResponse{}
	err = json.Unmarshal(body, lsr)
	return lsr, err
}

// This operation merges two adjacent shards in a stream and
// combines them into a single shard to reduce the stream's capacity to ingest and transport data.
func (k *Kinesis) MergeShards(streamName, shardToMerge, adjacentShard string) error {
	target := target("MergeShards")
	query := NewQueryWithStream(streamName)
	query.AddShardToMerge(shardToMerge)
	query.AddAdjacentShardToMerge(adjacentShard)

	_, err := k.query(target, query)

	return err
}

// This operation puts a data record into an Amazon Kinesis stream from a producer.
func (k *Kinesis) PutRecord(streamName, partitionKey string, data []byte, hashKey, sequenceNumber string) (resp *PutRecordResponse, err error) {
	target := target("PutRecord")
	query := NewQueryWithStream(streamName)
	query.AddPartitionKey(partitionKey)
	query.AddData(data)

	if hashKey != "" {
		query.AddExplicitHashKey(hashKey)
	}

	if sequenceNumber != "" {
		query.AddSequenceNumberForOrdering(sequenceNumber)
	}

	body, err := k.query(target, query)
	if err != nil {
		return nil, err
	}

	prr := &PutRecordResponse{}
	err = json.Unmarshal(body, prr)

	return prr, err
}

// This operation puts multiple data records into an Amazon Kinesis stream from a producer.
func (k *Kinesis) PutRecords(streamName string, records []PutRecordsRequestEntry) (resp *PutRecordsResponse, err error) {
	target := target("PutRecords")
	query := NewQueryWithStream(streamName)
	query.AddRecords(records)

	body, err := k.query(target, query)
	if err != nil {
		return nil, err
	}

	prr := &PutRecordsResponse{}
	err = json.Unmarshal(body, prr)

	return prr, err
}

// This operation splits a shard into two new shards in the stream,
// to increase the stream's capacity to ingest and transport data.
func (k *Kinesis) SplitShard(streamName, shard, startingHashKey string) error {
	target := target("SplitShard")
	query := NewQueryWithStream(streamName)
	query.AddNewStartingHashKey(startingHashKey)
	query.AddShardToSplit(shard)

	_, err := k.query(target, query)

	return err
}

func (k *Kinesis) query(target string, query *Query) ([]byte, error) {
	data := strings.NewReader(query.String())
	hreq, err := http.NewRequest("POST", k.Region.KinesisEndpoint+"/", data)

	if err != nil {
		return nil, err
	}

	hreq.Header.Set("Content-Type", "application/x-amz-json-1.1")
	hreq.Header.Set("X-Amz-Date", time.Now().UTC().Format(aws.ISO8601BasicFormat))
	hreq.Header.Set("X-Amz-Target", target)

	if k.Auth.Token() != "" {
		hreq.Header.Set("X-Amz-Security-Token", k.Auth.Token())
	}

	signer := aws.NewV4Signer(k.Auth, "kinesis", k.Region)
	signer.Sign(hreq)

	resp, err := http.DefaultClient.Do(hreq)

	if err != nil {
		log.Printf("kinesis: Error calling Amazon\n: %v", err)
		return nil, err
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Printf("kinesis: Could not read response body\n")
		return nil, err
	}

	if debug {
		log.Printf("kinesis: response:\n")
		log.Printf("kinesis: %s", string(body))
	}

	// "A response code of 200 indicates the operation was successful."
	if resp.StatusCode != 200 {
		err = buildError(resp, body)
		return nil, err
	}

	return body, nil
}

func buildError(r *http.Response, jsonBody []byte) error {
	kinesisError := &Error{
		StatusCode: r.StatusCode,
		Status:     r.Status,
	}

	err := json.Unmarshal(jsonBody, kinesisError)
	if err != nil {
		log.Printf("kinesis: Failed to parse body as JSON")
		return err
	}

	return kinesisError
}

func target(name string) string {
	return "Kinesis_20131202." + name
}
