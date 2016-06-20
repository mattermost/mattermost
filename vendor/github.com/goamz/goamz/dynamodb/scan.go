package dynamodb

import (
	"errors"
	"fmt"
	simplejson "github.com/bitly/go-simplejson"
)

func (t *Table) FetchResults(query *Query) ([]map[string]*Attribute, error) {
	jsonResponse, err := t.Server.queryServer(target("Scan"), query)
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
