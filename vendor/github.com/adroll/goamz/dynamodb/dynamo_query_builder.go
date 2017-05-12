package dynamodb

import (
	"encoding/json"
	"fmt"
	"github.com/AdRoll/goamz/dynamodb/dynamizer"
)

const (
	// MaxGetBatchSize limits the maximum number of items per batch get
	// operation. Note also that the total size of all the items retrieved
	// cannot exceed 16 MB, but that limit is not enforced client side.
	// cf: http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html
	MaxGetBatchSize = 100

	// MaxPutBatchSize limits the maximum number of items per batch put
	// operation. Note also that the total size of all the items written
	// cannot exceed 16 MB, but that limit is not enforced client side.
	// cf: http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html
	MaxPutBatchSize = 25
)

type DynamoQuery struct {
	TableName      string               `json:",omitempty"`
	ConsistentRead bool                 `json:",omitempty"`
	Item           dynamizer.DynamoItem `json:",omitempty"`
	Key            dynamizer.DynamoItem `json:",omitempty"`
	table          *Table
}

type DynamoResponse struct {
	Item dynamizer.DynamoItem `json:",omitempty"`
}

type batchGetPerTableQuery struct {
	Keys           []dynamizer.DynamoItem `json:",omitempty"`
	ConsistentRead bool                   `json:",omitempty"`
}

type DynamoBatchGetQuery struct {
	RequestItems map[string]*batchGetPerTableQuery `json:",omitempty"`
	table        *Table
}

type DynamoBatchGetResponse struct {
	Responses       map[string][]dynamizer.DynamoItem
	UnprocessedKeys map[string]*batchGetPerTableQuery
}

type batchPutPerTableQuery struct {
	PutRequest struct {
		Item dynamizer.DynamoItem `json:",omitempty"`
	} `json:",omitempty"`
}

type DynamoBatchPutQuery struct {
	RequestItems map[string][]*batchPutPerTableQuery `json:",omitempty"`
	table        *Table
}

type DynamoBatchPutResponse struct {
	UnprocessedItems map[string][]*batchPutPerTableQuery
}

func NewDynamoQuery(t *Table) *DynamoQuery {
	q := &DynamoQuery{table: t}
	q.TableName = t.Name
	return q
}

func (q *DynamoQuery) AddKey(key *Key) error {
	// Add in the hash/range keys.
	keys, err := buildKeyMap(q.table, key)
	if err != nil {
		return err
	}
	q.Key = keys
	return nil
}

func attributeFromDynamoAttribute(a *dynamizer.DynamoAttribute) (*Attribute, error) {
	attr := &Attribute{}
	if a.S != nil {
		attr.Type = "S"
		attr.Value = *a.S
		return attr, nil
	}

	if a.N != "" {
		attr.Type = "N"
		attr.Value = a.N
		return attr, nil
	}

	return nil, fmt.Errorf("Only string and numeric attributes are supported")
}

func dynamoAttributeFromAttribute(attr *Attribute, value string) (*dynamizer.DynamoAttribute, error) {
	a := &dynamizer.DynamoAttribute{}
	switch attr.Type {
	case "S":
		a.S = new(string)
		*a.S = value
	case "N":
		a.N = value
	default:
		return nil, fmt.Errorf("Only string and numeric attributes are supported")
	}
	return a, nil
}

func buildKeyMap(table *Table, key *Key) (dynamizer.DynamoItem, error) {
	if key.HashKey == "" {
		return nil, fmt.Errorf("HashKey is always required")
	}

	k := table.Key
	keyMap := make(dynamizer.DynamoItem)
	hashKey, err := dynamoAttributeFromAttribute(k.KeyAttribute, key.HashKey)
	if err != nil {
		return nil, err
	}
	keyMap[k.KeyAttribute.Name] = hashKey
	if k.HasRange() {
		if key.RangeKey == "" {
			return nil, fmt.Errorf("RangeKey is required by the table")
		}
		rangeKey, err := dynamoAttributeFromAttribute(k.RangeAttribute, key.RangeKey)
		if err != nil {
			return nil, err
		}
		keyMap[k.RangeAttribute.Name] = rangeKey
	}
	return keyMap, nil
}

func (q *DynamoQuery) AddItem(key *Key, item dynamizer.DynamoItem) error {
	// Add in the hash/range keys.
	keys, err := buildKeyMap(q.table, key)
	if err != nil {
		return err
	}
	for k, v := range keys {
		item[k] = v
	}

	q.Item = item

	return nil
}

func (q *DynamoQuery) SetConsistentRead(consistent bool) error {
	q.ConsistentRead = consistent
	return nil
}

func (q *DynamoQuery) Marshal() ([]byte, error) {
	return json.Marshal(q)
}

func NewDynamoBatchGetQuery(t *Table) *DynamoBatchGetQuery {
	q := &DynamoBatchGetQuery{table: t}
	q.RequestItems = map[string]*batchGetPerTableQuery{
		t.Name: &batchGetPerTableQuery{
			Keys:           make([]dynamizer.DynamoItem, 0, MaxGetBatchSize),
			ConsistentRead: false,
		},
	}
	return q
}

func (q *DynamoBatchGetQuery) AddKey(key *Key) error {
	tq := q.RequestItems[q.table.Name]
	if len(tq.Keys) >= MaxGetBatchSize {
		return fmt.Errorf("Cannot add key, max batch size (%d) exceeded", MaxGetBatchSize)
	}
	keys, err := buildKeyMap(q.table, key)
	if err != nil {
		return err
	}
	tq.Keys = append(tq.Keys, keys)
	return nil
}

func (q *DynamoBatchGetQuery) SetConsistentRead(consistent bool) error {
	tq := q.RequestItems[q.table.Name]
	tq.ConsistentRead = consistent
	return nil
}

func (q *DynamoBatchGetQuery) Marshal() ([]byte, error) {
	return json.Marshal(q)
}

func NewDynamoBatchPutQuery(t *Table) *DynamoBatchPutQuery {
	q := &DynamoBatchPutQuery{table: t}
	q.RequestItems = map[string][]*batchPutPerTableQuery{
		t.Name: make([]*batchPutPerTableQuery, 0, MaxPutBatchSize),
	}
	return q
}

func (q *DynamoBatchPutQuery) AddItem(key *Key, item dynamizer.DynamoItem) error {
	if len(q.RequestItems[q.table.Name]) >= MaxPutBatchSize {
		return fmt.Errorf("Cannot add item, max batch size (%d) exceeded", MaxPutBatchSize)
	}

	// Add in the hash/range keys.
	keys, err := buildKeyMap(q.table, key)
	if err != nil {
		return err
	}
	for k, v := range keys {
		item[k] = v
	}

	tq := &batchPutPerTableQuery{}
	tq.PutRequest.Item = item

	q.RequestItems[q.table.Name] = append(q.RequestItems[q.table.Name], tq)

	return nil
}

func (q *DynamoBatchPutQuery) Marshal() ([]byte, error) {
	return json.Marshal(q)
}
