//
// goamz - Go packages to interact with the Amazon Web Services.
//
//   https://wiki.ubuntu.com/goamz
//
// Written by Tim Bart <tim@fewagainstmany.com>
package kinesis_test

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/AdRoll/goamz/kinesis"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"
)

// assert fails the test if the condition is false.
func assert(tb testing.TB, condition bool, msg string, v ...interface{}) {
	if !condition {
		_, file, line, _ := runtime.Caller(1)
		fmt.Printf("\033[31m%s:%d: "+msg+"\033[39m\n\n", append([]interface{}{filepath.Base(file), line}, v...)...)
		tb.FailNow()
	}
}

// ok fails the test if an err is not nil.
func ok(tb testing.TB, err error) {
	if err != nil {
		_, file, line, _ := runtime.Caller(1)
		fmt.Printf("\033[31m%s:%d: unexpected error: %s\033[39m\n\n", filepath.Base(file), line, err.Error())
		tb.FailNow()
	}
}

// equals fails the test if exp is not equal to act.
func equals(tb testing.TB, exp, act interface{}) {
	if !reflect.DeepEqual(exp, act) {
		_, file, line, _ := runtime.Caller(1)
		fmt.Printf("\033[31m%s:%d:\n\n\texp: %#v\n\n\tgot: %#v\033[39m\n\n", filepath.Base(file), line, exp, act)
		tb.FailNow()
	}
}

func TestDescribeStreamResponse(t *testing.T) {
	resp := &kinesis.DescribeStreamResponse{}
	err := json.Unmarshal([]byte(describeStream), resp)

	ok(t, err)
	equals(t, false, resp.StreamDescription.HasMoreShards)
	equals(t, 3, len(resp.StreamDescription.Shards))
	equals(t, "arn:aws:kinesis:us-east-1:052958737983:exampleStreamName", resp.StreamDescription.StreamARN)
	equals(t, "exampleStreamName", resp.StreamDescription.StreamName)
	equals(t, kinesis.StreamStatusActive, resp.StreamDescription.StreamStatus)
}

func TestGetRecordsResponse(t *testing.T) {
	resp := &kinesis.GetRecordsResponse{}
	err := json.Unmarshal([]byte(getRecords), resp)

	ok(t, err)
	equals(t, 1, len(resp.Records))
	equals(t, "XzxkYXRhPl8w", base64.StdEncoding.EncodeToString(resp.Records[0].Data))
	equals(t, "partitionKey", resp.Records[0].PartitionKey)
	equals(t, "21269319989652663814458848515492872193", resp.Records[0].SequenceNumber)
}

func TestGetShardIteratorResponse(t *testing.T) {
	resp := &kinesis.GetShardIteratorResponse{}
	err := json.Unmarshal([]byte(getShardIterator), resp)

	ok(t, err)
	equals(t, "AAAAAAAAAAETY", resp.ShardIterator[:13])
}

func TestListStreams(t *testing.T) {
	resp := &kinesis.ListStreamResponse{}
	err := json.Unmarshal([]byte(listStreams), resp)

	ok(t, err)
	equals(t, false, resp.HasMoreStreams)
	equals(t, 1, len(resp.StreamNames))
	equals(t, "exampleStreamName", resp.StreamNames[0])
}

func TestPutRecord(t *testing.T) {
	resp := &kinesis.PutRecordResponse{}
	err := json.Unmarshal([]byte(putRecord), resp)

	ok(t, err)
	equals(t, "21269319989653637946712965403778482177", resp.SequenceNumber)
	equals(t, "shardId-000000000001", resp.ShardId)
}

func TestPutRecords(t *testing.T) {
	resp := &kinesis.PutRecordsResponse{}
	err := json.Unmarshal([]byte(putRecords), resp)

	ok(t, err)
	equals(t, 0, resp.FailedRecordCount)
	equals(t, 1, len(resp.Records))
	equals(t, "49543463076548007577105092703039560359975228518395019266", resp.Records[0].SequenceNumber)
	equals(t, "shardId-000000000000", resp.Records[0].ShardId)
}
