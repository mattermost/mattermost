package dynamodb

import (
	"encoding/json"
	"fmt"
	"reflect"
	"time"

	"github.com/AdRoll/goamz/dynamodb/dynamizer"
)

// Fake error for use with the retry strategy. Any keys returned in the
// UnprocessedKeys/UnprocessedItems arrays are assumed to be because of
// throttling.
var errProvisionedThroughputExceeded = &Error{Code: "ProvisionedThroughputExceededException"}

func (t *Table) BatchGetDocument(keys []*Key, consistentRead bool, v interface{}) ([]error, error) {
	numKeys := len(keys)

	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Slice {
		return nil, fmt.Errorf("v must be a slice with the same length as keys")
	} else if rv.Len() != numKeys {
		return nil, fmt.Errorf("v must be a slice with the same length as keys")
	}

	// Create a map to track which keys have been processed, since DynamoDB
	// doesn't return items in any particular order.
	//
	// N.B. This map is of type Key - not *Key - so that equality is based on
	// the hash and range key values, not the pointer address.
	processed := make(map[Key]bool)
	errs := make([]error, numKeys)

	numRetries := 0
	target := target("BatchGetItem")
	for {
		q := NewDynamoBatchGetQuery(t)

		// Add requested keys to the query, skipping over those for which we
		// already have responses.
		for _, key := range keys {
			if _, ok := processed[*key]; ok {
				continue
			}
			if err := q.AddKey(key); err != nil {
				return nil, err
			}
		}

		if consistentRead {
			q.SetConsistentRead(consistentRead)
		}

		jsonResponse, err := t.Server.queryServer(target, q)
		if err != nil {
			return nil, err
		}

		var response DynamoBatchGetResponse
		err = json.Unmarshal(jsonResponse, &response)
		if err != nil {
			return nil, err
		}

		// DynamoDB doesn't return the items in any particular order, but we promise
		// callers that we will. So we build a map of key to response to match up
		// inputs to return values.
		responses := make(map[Key]dynamizer.DynamoItem)
		for _, item := range response.Responses[t.Name] {
			key, err := t.getKeyFromItem(item)
			if err != nil {
				return nil, err
			}
			t.deleteKeyFromItem(item)
			responses[key] = item
		}

		// Handle unprocessed keys. We return a special error code so that the
		// caller can decide how to handle the partial result. This allows callers
		// to utilize the responses we do have available right away.
		unprocessed := make(map[Key]bool)
		numUnprocessed := 0
		if r, ok := response.UnprocessedKeys[t.Name]; ok {
			for _, item := range r.Keys {
				key, err := t.getKeyFromItem(item)
				if err != nil {
					return nil, err
				}
				unprocessed[key] = true
				numUnprocessed++
			}
		}

		// Package the responses maintaining the original ordering as specified
		// by the caller. Set ErrNotProcessed for all unprocessed in keys in
		// case we don't retry.
		for i, key := range keys {
			if _, ok := processed[*key]; ok {
				continue
			}

			if item, ok := responses[*key]; ok {
				errs[i] = dynamizer.FromDynamo(item, rv.Index(i))
				processed[*key] = true
			} else if _, ok := unprocessed[*key]; !ok {
				errs[i] = ErrNotFound
				processed[*key] = true
			} else {
				errs[i] = ErrNotProcessed
			}
		}

		// If we are done, or we're not going to retry, return now.
		if numUnprocessed == 0 || !t.Server.RetryPolicy.ShouldRetry(target, nil, errProvisionedThroughputExceeded, numRetries) {
			return errs, nil
		}

		// Sleep according to the retry strategy and then attempt again with the
		// remaining keys.
		time.Sleep(t.Server.RetryPolicy.Delay(target, nil, errProvisionedThroughputExceeded, numRetries))
		numRetries++
	}
}

func (t *Table) BatchPutDocument(keys []*Key, v interface{}) ([]error, error) {
	numKeys := len(keys)

	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Slice {
		return nil, fmt.Errorf("v must be a slice with the same length as keys")
	} else if rv.Len() != numKeys {
		return nil, fmt.Errorf("v must be a slice with the same length as keys")
	}

	// Create a map to track which keys have been processed, since DynamoDB
	// doesn't return items in any particular order.
	//
	// N.B. This map is of type Key - not *Key - so that equality is based on
	// the hash and range key values, not the pointer address.
	processed := make(map[Key]bool)
	errs := make([]error, numKeys)

	numRetries := 0
	target := target("BatchWriteItem")
	for {
		q := NewDynamoBatchPutQuery(t)

		// Add requested keys to the query, skipping over those for which we
		// already have responses.
		for i, key := range keys {
			if _, ok := processed[*key]; ok {
				continue
			}

			item, err := dynamizer.ToDynamo(rv.Index(i).Interface())
			if err != nil {
				return nil, err
			}
			if err := q.AddItem(key, item); err != nil {
				return nil, err
			}
		}

		jsonResponse, err := t.Server.queryServer(target, q)
		if err != nil {
			return nil, err
		}

		var response DynamoBatchPutResponse
		err = json.Unmarshal(jsonResponse, &response)
		if err != nil {
			return nil, err
		}

		// Handle unprocessed items. We return a special error code so that the
		// caller can decide how to handle the partial result. This allows callers
		// to move on from successful writes immediately.
		unprocessed := make(map[Key]bool)
		numUnprocessed := 0
		if r, ok := response.UnprocessedItems[t.Name]; ok {
			for _, item := range r {
				key, err := t.getKeyFromItem(item.PutRequest.Item)
				if err != nil {
					return nil, err
				}
				unprocessed[key] = true
				numUnprocessed++
			}
		}

		// Package the responses maintaining the original ordering as specified
		// by the caller. Set ErrNotProcessed for all unprocessed in keys in
		// case we don't retry.
		for i, key := range keys {
			if _, ok := processed[*key]; ok {
				continue
			}

			if _, ok := unprocessed[*key]; ok {
				errs[i] = ErrNotProcessed
			} else {
				errs[i] = nil
				processed[*key] = true
			}
		}

		// If we are done, or we're not going to retry, return now.
		if numUnprocessed == 0 || !t.Server.RetryPolicy.ShouldRetry(target, nil, errProvisionedThroughputExceeded, numRetries) {
			return errs, nil
		}

		// Sleep according to the retry strategy and then attempt again with the
		// remaining keys.
		time.Sleep(t.Server.RetryPolicy.Delay(target, nil, errProvisionedThroughputExceeded, numRetries))
		numRetries++
	}
}
