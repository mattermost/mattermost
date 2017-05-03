package kinesis

import (
	"encoding/json"
)

type msi map[string]interface{}
type Query struct {
	buffer msi
}

func NewEmptyQuery() *Query {
	return &Query{msi{}}
}

func NewQueryWithStream(streamName string) *Query {
	q := &Query{msi{}}
	q.AddStreamName(streamName)
	return q
}

func (q *Query) AddExclusiveStartShardId(shardId string) {
	q.buffer["ExclusiveStartShardId"] = shardId
}

func (q *Query) AddLimit(limit int) {
	q.buffer["Limit"] = limit
}

func (q *Query) AddStreamName(name string) {
	q.buffer["StreamName"] = name
}

func (q *Query) AddShardCount(count int) {
	q.buffer["ShardCount"] = count
}

func (q *Query) AddShardIterator(iterator string) {
	q.buffer["ShardIterator"] = iterator
}

func (q *Query) AddShardId(id string) {
	q.buffer["ShardId"] = id
}

func (q *Query) AddShardIteratorType(t ShardIteratorType) {
	q.buffer["ShardIteratorType"] = t
}

func (q *Query) AddStartingSequenceNumber(sequenceNumber string) {
	q.buffer["StartingSequenceNumber"] = sequenceNumber
}

func (q *Query) AddData(data []byte) {
	q.buffer["Data"] = data
}

func (q *Query) AddExplicitHashKey(hashKey string) {
	q.buffer["ExplicitHashKey"] = hashKey
}

func (q *Query) AddPartitionKey(partitionKey string) {
	q.buffer["PartitionKey"] = partitionKey
}

func (q *Query) AddSequenceNumberForOrdering(sequenceNumber string) {
	q.buffer["SequenceNumberForOrdering"] = sequenceNumber
}

func (q *Query) AddRecords(records []PutRecordsRequestEntry) {
	q.buffer["Records"] = records
}

func (q *Query) AddShardToMerge(shard string) {
	q.buffer["ShardToMerge"] = shard
}

func (q *Query) AddAdjacentShardToMerge(shard string) {
	q.buffer["AdjacentShardToMerge"] = shard
}

func (q *Query) AddShardToSplit(shard string) {
	q.buffer["ShardToSplit"] = shard
}

func (q *Query) AddNewStartingHashKey(hashKey string) {
	q.buffer["NewStartingHashKey"] = hashKey
}

func (q *Query) String() string {
	bytes, err := json.Marshal(q.buffer)
	if err != nil {
		panic(err)
	}
	return string(bytes)
}
