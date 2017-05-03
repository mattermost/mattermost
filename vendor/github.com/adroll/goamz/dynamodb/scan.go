package dynamodb

import (
	"errors"
	"fmt"
	"log"

	simplejson "github.com/bitly/go-simplejson"
)

func (t *Table) FetchPartialResults(query ScanQuery) ([]map[string]*Attribute, StartKey, error) {
	jsonResponse, err := t.Server.queryServer(target("Scan"), query)
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

func (t *Table) FetchResultCallbackIterator(query ScanQuery, cb func(map[string]*Attribute) error) error {
	for {
		results, lastEvaluatedKey, err := t.FetchPartialResults(query)
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

func (t *Table) ScanPartial(attributeComparisons []AttributeComparison, exclusiveStartKey StartKey) ([]map[string]*Attribute, StartKey, error) {
	return t.ParallelScanPartialLimit(attributeComparisons, exclusiveStartKey, 0, 0, 0)
}

func (t *Table) ScanPartialLimit(attributeComparisons []AttributeComparison, exclusiveStartKey StartKey, limit int64) ([]map[string]*Attribute, StartKey, error) {
	return t.ParallelScanPartialLimit(attributeComparisons, exclusiveStartKey, 0, 0, limit)
}

func (t *Table) ParallelScanPartial(attributeComparisons []AttributeComparison, exclusiveStartKey StartKey, segment, totalSegments int) ([]map[string]*Attribute, StartKey, error) {
	return t.ParallelScanPartialLimit(attributeComparisons, exclusiveStartKey, segment, totalSegments, 0)
}

func (t *Table) ParallelScanPartialLimit(attributeComparisons []AttributeComparison, exclusiveStartKey StartKey, segment, totalSegments int, limit int64) ([]map[string]*Attribute, StartKey, error) {
	q := NewQuery(t)
	q.AddScanFilter(attributeComparisons)
	if exclusiveStartKey != nil {
		q.AddExclusiveStartKey(exclusiveStartKey)
	}
	if totalSegments > 0 {
		q.AddParallelScanConfiguration(segment, totalSegments)
	}
	if limit > 0 {
		q.AddLimit(limit)
	}
	return t.FetchPartialResults(q)
}

func (t *Table) FetchResults(query ScanQuery) ([]map[string]*Attribute, error) {
	results, _, err := t.FetchPartialResults(query)
	return results, err
}

func (t *Table) Scan(attributeComparisons []AttributeComparison) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddScanFilter(attributeComparisons)
	return t.FetchResults(q)
}

func (t *Table) ParallelScan(attributeComparisons []AttributeComparison, segment int, totalSegments int) ([]map[string]*Attribute, error) {
	q := NewQuery(t)
	q.AddScanFilter(attributeComparisons)
	q.AddParallelScanConfiguration(segment, totalSegments)
	return t.FetchResults(q)
}

func (t *Table) ScanCallbackIterator(attributeComparisons []AttributeComparison, cb func(map[string]*Attribute) error) error {
	q := NewQuery(t)
	q.AddScanFilter(attributeComparisons)
	return t.FetchResultCallbackIterator(q, cb)
}

func parseKey(t *Table, s map[string]interface{}) *Key {
	k := &Key{}

	hk := t.Key.KeyAttribute
	if v, ok := s[hk.Name].(map[string]interface{}); ok {
		switch hk.Type {
		case TYPE_NUMBER, TYPE_STRING, TYPE_BINARY:
			if key, ok := v[hk.Type].(string); ok {
				k.HashKey = key
			} else {
				log.Printf("type assertion to string failed for : %s\n", hk.Type)
				return nil
			}
		default:
			log.Printf("invalid primary key hash type : %s\n", hk.Type)
			return nil
		}
	} else {
		log.Printf("type assertion to map[string]interface{} failed for : %s\n", hk.Name)
		return nil
	}

	if t.Key.HasRange() {
		rk := t.Key.RangeAttribute
		if v, ok := s[rk.Name].(map[string]interface{}); ok {
			switch rk.Type {
			case TYPE_NUMBER, TYPE_STRING, TYPE_BINARY:
				if key, ok := v[rk.Type].(string); ok {
					k.RangeKey = key
				} else {
					log.Printf("type assertion to string failed for : %s\n", rk.Type)
					return nil
				}
			default:
				log.Printf("invalid primary key range type : %s\n", rk.Type)
				return nil
			}
		} else {
			log.Printf("type assertion to map[string]interface{} failed for : %s\n", rk.Name)
			return nil
		}
	}

	return k
}
