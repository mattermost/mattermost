package kinesis

import (
	"fmt"
	"github.com/AdRoll/goamz/aws"
)

type ShardIteratorType string
type StreamStatus string

const (

	// Start reading exactly from the position denoted by a specific sequence number.
	ShardIteratorAtSequenceNumber ShardIteratorType = "AT_SEQUENCE_NUMBER"

	// Start reading right after the position denoted by a specific sequence number.
	ShardIteratorAfterSequenceNumber ShardIteratorType = "AFTER_SEQUENCE_NUMBER"

	// Start reading at the last untrimmed record in the shard in the system,
	// which is the oldest data record in the shard.
	ShardIteratorTrimHorizon ShardIteratorType = "TRIM_HORIZON"

	// Start reading just after the most recent record in the shard,
	// so that you always read the most recent data in the shard.
	ShardIteratorLatest ShardIteratorType = "LATEST"

	// The stream is being created. Upon receiving a CreateStream request,
	// Amazon Kinesis immediately returns and sets StreamStatus to CREATING.
	StreamStatusCreating StreamStatus = "CREATING"

	// The stream is being deleted. After a DeleteStream request,
	// the specified stream is in the DELETING state until Amazon Kinesis completes the deletion.
	StreamStatusDeleting StreamStatus = "DELETING"

	// The stream exists and is ready for read and write operations or deletion.
	// You should perform read and write operations only on an ACTIVE stream.
	StreamStatusActive StreamStatus = "ACTIVE"

	// Shards in the stream are being merged or split.
	// Read and write operations continue to work while the stream is in the UPDATING state.
	StreamStatusUpdating StreamStatus = "UPDATING"
)

// Main Kinesis object
type Kinesis struct {
	aws.Auth
	aws.Region
}

// The range of possible hash key values for the shard, which is a set of ordered contiguous positive integers.
type HashKeyRange struct {
	EndingHashKey   string
	StartingHashKey string
}

func (h HashKeyRange) String() string {
	return fmt.Sprintf("{EndingHashKey: %s, StartingHashKey: %s}\n",
		h.EndingHashKey, h.StartingHashKey)
}

// The range of possible sequence numbers for the shard.
type SequenceNumberRange struct {
	EndingSequenceNumber   string
	StartingSequenceNumber string
}

func (s SequenceNumberRange) String() string {
	return fmt.Sprintf("{EndingSequenceNumber: %s, StartingSequenceNumber: %s}\n",
		s.EndingSequenceNumber, s.StartingSequenceNumber)
}

// A uniquely identified group of data records in an Amazon Kinesis stream.
type Shard struct {
	AdjacentParentShardId string
	HashKeyRange          HashKeyRange
	ParentShardId         string
	SequenceNumberRange   SequenceNumberRange
	ShardId               string
}

// Description of a Stream
type StreamDescription struct {
	HasMoreShards bool
	Shards        []Shard
	StreamARN     string
	StreamName    string
	StreamStatus  StreamStatus
}

// The unit of data of the Amazon Kinesis stream, which is composed of a sequence number,
// a partition key, and a data blob.
type Record struct {
	Data           []byte
	PartitionKey   string
	SequenceNumber string
}

// Represents the output of a DescribeStream operation.
type DescribeStreamResponse struct {
	StreamDescription StreamDescription
}

// Represents the output of a GetRecords operation.
type GetRecordsResponse struct {
	NextShardIterator string
	Records           []Record
}

// Represents the output of a GetShardIterator operation.
type GetShardIteratorResponse struct {
	ShardIterator string
}

// Represents the output of a ListStreams operation.
type ListStreamResponse struct {
	HasMoreStreams bool
	StreamNames    []string
}

// Represents the output of a PutRecord operation.
type PutRecordResponse struct {
	SequenceNumber string
	ShardId        string
}

// The unit of data put to the Amazon Kinesis stream by PutRecords, which includes
// a partition key, a hash key, and a data blob.
type PutRecordsRequestEntry struct {
	PartitionKey string
	HashKey      string `json:"ExplicitHashKey,omitempty"`
	Data         []byte
}

// Represents the output of a PutRecords operation.
type PutRecordsResponse struct {
	FailedRecordCount int
	Records           []PutRecordsResultEntry
}

type PutRecordsResultEntry struct {
	ErrorCode      string
	ErrorMessage   string
	SequenceNumber string
	ShardId        string
}

// Error represents an error in an operation with Kinesis(following goamz/Dynamodb)
type Error struct {
	StatusCode int // HTTP status code (200, 403, ...)
	Status     string
	Code       string `json:"__type"`
	Message    string `json:"message"`
}

func (e Error) Error() string {
	return fmt.Sprintf("[HTTP %d] %s : %s\n", e.StatusCode, e.Code, e.Message)
}
