package dynamodb

import (
	"errors"
	"fmt"

	simplejson "github.com/bitly/go-simplejson"
)

type Query interface {
	Marshal() ([]byte, error)
}

type ScanQuery interface {
	Query
	AddExclusiveStartKey(key StartKey) error
	AddExclusiveStartTableName(table string) error
}

func (t *Table) Query(attributeComparisons []AttributeComparison) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	return RunQuery(q, t)
}

func (t *Table) QueryOnIndex(attributeComparisons []AttributeComparison, indexName string) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	return RunQuery(q, t)
}

func (t *Table) LimitedQuery(attributeComparisons []AttributeComparison, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	return RunQuery(q, t)
}

func (t *Table) LimitedQueryOnIndex(attributeComparisons []AttributeComparison, indexName string, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.AddLimit(limit)
	return RunQuery(q, t)
}

func (t *Table) CountQuery(attributeComparisons []AttributeComparison) (int64, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddSelect("COUNT")
	jsonResponse, err := t.Server.queryServer(target("Query"), q)
	if err != nil {
		return 0, err
	}
	json, err := simplejson.NewJson(jsonResponse)
	if err != nil {
		return 0, err
	}

	itemCount, err := json.Get("Count").Int64()
	if err != nil {
		return 0, err
	}

	return itemCount, nil
}

func (t *Table) QueryTable(q Query) ([]map[string]*Attribute, StartKey, error) {
	jsonResponse, err := t.Server.queryServer(target("Query"), q)
	if err != nil {
		return nil, nil, err
	}

	json, err := simplejson.NewJson(jsonResponse)
	if err != nil {
		return nil, nil, err
	}

	itemCount, err := json.Get("Count").Int()
	if err != nil {
		message := fmt.Sprintf("Unexpected response %s", jsonResponse)
		return nil, nil, errors.New(message)
	}

	results := make([]map[string]*Attribute, itemCount)

	for i, _ := range results {
		item, err := json.Get("Items").GetIndex(i).Map()
		if err != nil {
			message := fmt.Sprintf("Unexpected response %s", jsonResponse)
			return nil, nil, errors.New(message)
		}
		results[i] = parseAttributes(item)
	}

	var lastEvaluatedKey StartKey
	if lastKeyMap := json.Get("LastEvaluatedKey").MustMap(); lastKeyMap != nil {
		lastEvaluatedKey = lastKeyMap
	}

	return results, lastEvaluatedKey, nil

}

func (t *Table) QueryCallbackIterator(attributeComparisons []AttributeComparison, cb func(map[string]*Attribute) error) error {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	return t.QueryTableCallbackIterator(q, cb)
}

func (t *Table) QueryOnIndexCallbackIterator(attributeComparisons []AttributeComparison, indexName string, cb func(map[string]*Attribute) error) error {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	return t.QueryTableCallbackIterator(q, cb)
}

func (t *Table) LimitedQueryCallbackIterator(attributeComparisons []AttributeComparison, limit int64, cb func(map[string]*Attribute) error) error {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	return t.QueryTableCallbackIterator(q, cb)
}

func (t *Table) LimitedQueryOnIndexCallbackIterator(attributeComparisons []AttributeComparison, indexName string, limit int64, cb func(map[string]*Attribute) error) error {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.AddLimit(limit)
	return t.QueryTableCallbackIterator(q, cb)
}

func (t *Table) QueryTableCallbackIterator(query ScanQuery, cb func(map[string]*Attribute) error) error {
	for {
		results, lastEvaluatedKey, err := t.QueryTable(query)
		if err != nil {
			return err
		}
		for _, item := range results {
			if err := cb(item); err != nil {
				return err
			}
		}

		if lastEvaluatedKey == nil {
			break
		}
		query.AddExclusiveStartKey(lastEvaluatedKey)
	}

	return nil
}

func RunQuery(q Query, t *Table) ([]map[string]*Attribute, error) {

	result, _, err := t.QueryTable(q)

	if err != nil {
		return nil, err

	}

	return result, err

}
