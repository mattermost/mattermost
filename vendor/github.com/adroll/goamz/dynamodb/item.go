package dynamodb

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"

	"github.com/AdRoll/goamz/dynamodb/dynamizer"
	simplejson "github.com/bitly/go-simplejson"
)

type BatchGetItem struct {
	Server *Server
	Keys   map[*Table][]Key
}

type BatchWriteItem struct {
	Server      *Server
	ItemActions map[*Table]map[string][][]Attribute
}

func (t *Table) BatchGetItems(keys []Key) *BatchGetItem {
	batchGetItem := &BatchGetItem{t.Server, make(map[*Table][]Key)}

	batchGetItem.Keys[t] = keys
	return batchGetItem
}

func (t *Table) BatchWriteItems(itemActions map[string][][]Attribute) *BatchWriteItem {
	batchWriteItem := &BatchWriteItem{t.Server, make(map[*Table]map[string][][]Attribute)}

	batchWriteItem.ItemActions[t] = itemActions
	return batchWriteItem
}

func (batchGetItem *BatchGetItem) AddTable(t *Table, keys *[]Key) *BatchGetItem {
	batchGetItem.Keys[t] = *keys
	return batchGetItem
}

func (batchWriteItem *BatchWriteItem) AddTable(t *Table, itemActions *map[string][][]Attribute) *BatchWriteItem {
	batchWriteItem.ItemActions[t] = *itemActions
	return batchWriteItem
}

func (batchGetItem *BatchGetItem) Execute() (map[string][]map[string]*Attribute, error) {
	q := NewEmptyQuery()
	q.AddGetRequestItems(batchGetItem.Keys)

	jsonResponse, err := batchGetItem.Server.queryServer(target("BatchGetItem"), q)
	if err != nil {
		return nil, err
	}

	json, err := simplejson.NewJson(jsonResponse)

	if err != nil {
		return nil, err
	}

	results := make(map[string][]map[string]*Attribute)

	tables, err := json.Get("Responses").Map()
	if err != nil {
		message := fmt.Sprintf("Unexpected response %s", jsonResponse)
		return nil, errors.New(message)
	}

	for table, entries := range tables {
		var tableResult []map[string]*Attribute

		jsonEntriesArray, ok := entries.([]interface{})
		if !ok {
			message := fmt.Sprintf("Unexpected response %s", jsonResponse)
			return nil, errors.New(message)
		}

		for _, entry := range jsonEntriesArray {
			item, ok := entry.(map[string]interface{})
			if !ok {
				message := fmt.Sprintf("Unexpected response %s", jsonResponse)
				return nil, errors.New(message)
			}

			unmarshalledItem := parseAttributes(item)
			tableResult = append(tableResult, unmarshalledItem)
		}

		results[table] = tableResult
	}

	return results, nil
}

func (batchWriteItem *BatchWriteItem) Execute() (map[string]interface{}, error) {
	q := NewEmptyQuery()
	q.AddWriteRequestItems(batchWriteItem.ItemActions)

	jsonResponse, err := batchWriteItem.Server.queryServer(target("BatchWriteItem"), q)

	if err != nil {
		return nil, err
	}

	json, err := simplejson.NewJson(jsonResponse)

	if err != nil {
		return nil, err
	}

	unprocessed, err := json.Get("UnprocessedItems").Map()
	if err != nil {
		message := fmt.Sprintf("Unexpected response %s", jsonResponse)
		return nil, errors.New(message)
	}

	if len(unprocessed) == 0 {
		return nil, nil
	} else {
		return unprocessed, errors.New("One or more unprocessed items.")
	}

}

func (t *Table) GetItem(key *Key) (map[string]*Attribute, error) {
	return t.getItem(key, false)
}

func (t *Table) GetItemConsistent(key *Key, consistentRead bool) (map[string]*Attribute, error) {
	return t.getItem(key, consistentRead)
}

func (t *Table) getItem(key *Key, consistentRead bool) (map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKey(key)

	if consistentRead {
		q.SetConsistentRead(consistentRead)
	}

	jsonResponse, err := t.Server.queryServer(target("GetItem"), q)
	if err != nil {
		return nil, err
	}

	json, err := simplejson.NewJson(jsonResponse)
	if err != nil {
		return nil, err
	}

	itemJson, ok := json.CheckGet("Item")
	if !ok {
		// We got an empty from amz. The item doesn't exist.
		return nil, ErrNotFound
	}

	item, err := itemJson.Map()
	if err != nil {
		message := fmt.Sprintf("Unexpected response %s", jsonResponse)
		return nil, errors.New(message)
	}

	return parseAttributes(item), nil
}

func (t *Table) getKeyFromItem(item dynamizer.DynamoItem) (Key, error) {
	key := Key{}
	attr, err := attributeFromDynamoAttribute(item[t.Key.KeyAttribute.Name])
	if err != nil {
		return key, err
	}
	key.HashKey = attr.Value
	if t.Key.HasRange() {
		attr, err := attributeFromDynamoAttribute(item[t.Key.RangeAttribute.Name])
		if err != nil {
			return key, err
		}
		key.RangeKey = attr.Value
	}
	return key, nil
}

func (t *Table) deleteKeyFromItem(item dynamizer.DynamoItem) {
	delete(item, t.Key.KeyAttribute.Name)
	if t.Key.HasRange() {
		delete(item, t.Key.RangeAttribute.Name)
	}
}

func (t *Table) GetDocument(key *Key, v interface{}) error {
	return t.GetDocumentConsistent(key, false, v)
}

func (t *Table) GetDocumentConsistent(key *Key, consistentRead bool, v interface{}) error {
	q := NewDynamoQuery(t)
	q.AddKey(key)

	if consistentRead {
		q.SetConsistentRead(consistentRead)
	}

	jsonResponse, err := t.Server.queryServer(target("GetItem"), q)
	if err != nil {
		return err
	}

	// Deserialize from []byte to JSON.
	var response DynamoResponse
	err = json.Unmarshal(jsonResponse, &response)
	if err != nil {
		return err
	}

	// If Item is nil the item doesn't exist.
	if response.Item == nil {
		return ErrNotFound
	}

	// Delete the keys from the response.
	t.deleteKeyFromItem(response.Item)

	// Convert back to standard struct/JSON object.
	err = dynamizer.FromDynamo(response.Item, v)
	if err != nil {
		return err
	}

	return nil
}

func (t *Table) PutItem(hashKey string, rangeKey string, attributes []Attribute) (bool, error) {
	return t.putItem(hashKey, rangeKey, attributes, nil, nil)
}

func (t *Table) ConditionalPutItem(hashKey, rangeKey string, attributes, expected []Attribute) (bool, error) {
	return t.putItem(hashKey, rangeKey, attributes, expected, nil)
}

func (t *Table) ConditionExpressionPutItem(hashKey, rangeKey string, attributes []Attribute, condition *Expression) (bool, error) {
	return t.putItem(hashKey, rangeKey, attributes, nil, condition)
}

func (t *Table) putItem(hashKey, rangeKey string, attributes, expected []Attribute, condition *Expression) (bool, error) {
	if len(attributes) == 0 {
		return false, errors.New("At least one attribute is required.")
	}

	q := NewQuery(t)

	keys := t.Key.Clone(hashKey, rangeKey)
	attributes = append(attributes, keys...)

	q.AddItem(attributes)

	if expected != nil {
		q.AddExpected(expected)
	}

	if condition != nil {
		q.AddConditionExpression(condition)
	}

	jsonResponse, err := t.Server.queryServer(target("PutItem"), q)
	if err != nil {
		return false, err
	}

	_, err = simplejson.NewJson(jsonResponse)
	if err != nil {
		return false, err
	}

	return true, nil
}

func (t *Table) PutDocument(key *Key, data interface{}) error {
	item, err := dynamizer.ToDynamo(data)
	if err != nil {
		return err
	}

	q := NewDynamoQuery(t)
	q.AddItem(key, item)

	jsonResponse, err := t.Server.queryServer(target("PutItem"), q)
	if err != nil {
		return err
	}

	// A successful PUT returns an empty JSON object. Simply checking for valid
	// JSON here.
	var response map[string]interface{}
	err = json.Unmarshal(jsonResponse, &response)
	if err != nil {
		return err
	}

	return nil
}

func (t *Table) deleteItem(key *Key, expected []Attribute, condition *Expression) (bool, error) {
	q := NewQuery(t)
	q.AddKey(key)

	if expected != nil {
		q.AddExpected(expected)
	}

	if condition != nil {
		q.AddConditionExpression(condition)
	}

	jsonResponse, err := t.Server.queryServer(target("DeleteItem"), q)

	if err != nil {
		return false, err
	}

	_, err = simplejson.NewJson(jsonResponse)
	if err != nil {
		return false, err
	}

	return true, nil
}

func (t *Table) DeleteItem(key *Key) (bool, error) {
	return t.deleteItem(key, nil, nil)
}

func (t *Table) ConditionalDeleteItem(key *Key, expected []Attribute) (bool, error) {
	return t.deleteItem(key, expected, nil)
}

func (t *Table) ConditionExpressionDeleteItem(key *Key, condition *Expression) (bool, error) {
	return t.deleteItem(key, nil, condition)
}

func (t *Table) DeleteDocument(key *Key) error {
	q := NewDynamoQuery(t)
	q.AddKey(key)

	jsonResponse, err := t.Server.queryServer(target("DeleteItem"), q)
	if err != nil {
		return err
	}

	// A successful DELETE returns an empty JSON object. Simply checking for
	// valid JSON here.
	var response map[string]interface{}
	err = json.Unmarshal(jsonResponse, &response)
	if err != nil {
		return err
	}

	return nil
}

func (t *Table) AddAttributes(key *Key, attributes []Attribute) (bool, error) {
	return t.modifyAttributes(key, attributes, nil, nil, nil, "ADD")
}

func (t *Table) UpdateAttributes(key *Key, attributes []Attribute) (bool, error) {
	return t.modifyAttributes(key, attributes, nil, nil, nil, "PUT")
}

func (t *Table) DeleteAttributes(key *Key, attributes []Attribute) (bool, error) {
	return t.modifyAttributes(key, attributes, nil, nil, nil, "DELETE")
}

func (t *Table) ConditionalAddAttributes(key *Key, attributes, expected []Attribute) (bool, error) {
	return t.modifyAttributes(key, attributes, expected, nil, nil, "ADD")
}

func (t *Table) ConditionalUpdateAttributes(key *Key, attributes, expected []Attribute) (bool, error) {
	return t.modifyAttributes(key, attributes, expected, nil, nil, "PUT")
}

func (t *Table) ConditionalDeleteAttributes(key *Key, attributes, expected []Attribute) (bool, error) {
	return t.modifyAttributes(key, attributes, expected, nil, nil, "DELETE")
}

func (t *Table) ConditionExpressionAddAttributes(key *Key, attributes []Attribute, condition *Expression) (bool, error) {
	return t.modifyAttributes(key, attributes, nil, condition, nil, "ADD")
}

func (t *Table) ConditionExpressionUpdateAttributes(key *Key, attributes []Attribute, condition *Expression) (bool, error) {
	return t.modifyAttributes(key, attributes, nil, condition, nil, "PUT")
}

func (t *Table) ConditionExpressionDeleteAttributes(key *Key, attributes []Attribute, condition *Expression) (bool, error) {
	return t.modifyAttributes(key, attributes, nil, condition, nil, "DELETE")
}

func (t *Table) UpdateExpressionUpdateAttributes(key *Key, condition, update *Expression) (bool, error) {
	return t.modifyAttributes(key, nil, nil, condition, update, "")
}

func (t *Table) modifyAttributes(key *Key, attributes, expected []Attribute, condition, update *Expression, action string) (bool, error) {

	if len(attributes) == 0 && update == nil {
		return false, errors.New("At least one attribute is required.")
	}

	q := NewQuery(t)
	q.AddKey(key)

	if len(attributes) > 0 {
		q.AddUpdates(attributes, action)
	}
	if update != nil {
		q.AddUpdateExpression(update)
	}

	if expected != nil {
		q.AddExpected(expected)
	}

	if condition != nil {
		q.AddConditionExpression(condition)
	}

	jsonResponse, err := t.Server.queryServer(target("UpdateItem"), q)

	if err != nil {
		return false, err
	}

	_, err = simplejson.NewJson(jsonResponse)
	if err != nil {
		return false, err
	}

	return true, nil
}

func parseAttributes(s map[string]interface{}) map[string]*Attribute {
	results := map[string]*Attribute{}
	for key, v := range s {
		switch v.(type) {
		case map[string]interface{}:
			attr := parseAttribute(v.(map[string]interface{}))
			if attr != nil {
				attr.Name = key
				results[key] = attr
			}
		}
	}
	return results

}

func parseAttribute(v map[string]interface{}) *Attribute {
	if val, ok := v[TYPE_STRING].(string); ok {
		return &Attribute{
			Type:  TYPE_STRING,
			Value: val,
		}
	} else if val, ok := v[TYPE_NUMBER].(string); ok {
		return &Attribute{
			Type:  TYPE_NUMBER,
			Value: val,
		}
	} else if val, ok := v[TYPE_BINARY].(string); ok {
		return &Attribute{
			Type:  TYPE_BINARY,
			Value: val,
		}
	} else if vals, ok := v[TYPE_STRING_SET].([]interface{}); ok {
		arry := make([]string, len(vals))
		for i, ivalue := range vals {
			if val, ok := ivalue.(string); ok {
				arry[i] = val
			}
		}
		return &Attribute{
			Type:      TYPE_STRING_SET,
			SetValues: arry,
		}
	} else if vals, ok := v[TYPE_NUMBER_SET].([]interface{}); ok {
		arry := make([]string, len(vals))
		for i, ivalue := range vals {
			if val, ok := ivalue.(string); ok {
				arry[i] = val
			}
		}
		return &Attribute{
			Type:      TYPE_NUMBER_SET,
			SetValues: arry,
		}
	} else if vals, ok := v[TYPE_BINARY_SET].([]interface{}); ok {
		arry := make([]string, len(vals))
		for i, ivalue := range vals {
			if val, ok := ivalue.(string); ok {
				arry[i] = val
			}
		}
		return &Attribute{
			Type:      TYPE_BINARY_SET,
			SetValues: arry,
		}
	} else if vals, ok := v[TYPE_MAP].(map[string]interface{}); ok {
		m := parseAttributes(vals)
		return &Attribute{
			Type:      TYPE_MAP,
			MapValues: m,
		}
	} else if vals, ok := v[TYPE_LIST].([]interface{}); ok {
		arry := make([]*Attribute, len(vals))
		for i, ivalue := range vals {
			if iivalue, iok := ivalue.(map[string]interface{}); iok {
				arry[i] = parseAttribute(iivalue)
			} else {
				log.Printf("parse list attribute failed for : %s\n ", ivalue)
			}
		}

		return &Attribute{
			Type:       TYPE_LIST,
			ListValues: arry,
		}
	} else if val, ok := v[TYPE_BOOL].(bool); ok {
		return &Attribute{
			Type:  TYPE_BOOL,
			Value: strconv.FormatBool(val),
		}
	} else if val, ok := v[TYPE_NULL].(bool); ok {
		return &Attribute{
			Type:  TYPE_NULL,
			Value: strconv.FormatBool(val),
		}
	} else {
		log.Printf("parse attribute failed for : %s\n ", v)
	}
	return nil

}
