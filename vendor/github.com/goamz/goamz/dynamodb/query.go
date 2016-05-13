package dynamodb

import (
	"errors"
	"fmt"
	simplejson "github.com/bitly/go-simplejson"
)

func (t *Table) Query(attributeComparisons []AttributeComparison) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	return runQuery(q, t)
}

func (t *Table) QueryOnIndex(attributeComparisons []AttributeComparison, indexName string) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	return runQuery(q, t)
}

func (t *Table) QueryOnIndexDescending(attributeComparisons []AttributeComparison, indexName string) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.ScanIndexDescending()
	return runQuery(q, t)
}

func (t *Table) LimitedQuery(attributeComparisons []AttributeComparison, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	return runQuery(q, t)
}

func (t *Table) LimitedQueryOnIndex(attributeComparisons []AttributeComparison, indexName string, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.AddLimit(limit)
	return runQuery(q, t)
}

func (t *Table) LimitedQueryDescending(attributeComparisons []AttributeComparison, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddLimit(limit)
	q.ScanIndexDescending()
	return runQuery(q, t)
}

func (t *Table) LimitedQueryOnIndexDescending(attributeComparisons []AttributeComparison, indexName string, limit int64) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddIndex(indexName)
	q.AddLimit(limit)
	q.ScanIndexDescending()
	return runQuery(q, t)
}

func (t *Table) CountQuery(attributeComparisons []AttributeComparison) (int64, error) {
	q := NewQuery(t)
	q.AddKeyConditions(attributeComparisons)
	q.AddSelect("COUNT")
	jsonResponse, err := t.Server.queryServer("DynamoDB_20120810.Query", q)
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

func runQuery(q *Query, t *Table) ([]map[string]*Attribute, error) {
	jsonResponse, err := t.Server.queryServer("DynamoDB_20120810.Query", q)
	if err != nil {
		return nil, err
	}

	json, err := simplejson.NewJson(jsonResponse)
	if err != nil {
		return nil, err
	}

	itemCount, err := json.Get("Count").Int()
	if err != nil {
		message := fmt.Sprintf("Unexpected response %s", jsonResponse)
		return nil, errors.New(message)
	}

	results := make([]map[string]*Attribute, itemCount)

	for i, _ := range results {
		item, err := json.Get("Items").GetIndex(i).Map()
		if err != nil {
			message := fmt.Sprintf("Unexpected response %s", jsonResponse)
			return nil, errors.New(message)
		}
		results[i] = parseAttributes(item)
	}
	return results, nil
}
