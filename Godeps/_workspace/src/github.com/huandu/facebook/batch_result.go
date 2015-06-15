// A facebook graph api client in go.
// https://github.com/huandu/facebook/
//
// Copyright 2012 - 2015, Huan Du
// Licensed under the MIT license
// https://github.com/huandu/facebook/blob/master/LICENSE

package facebook

import (
	"encoding/json"
	"net/http"
)

type batchResultHeader struct {
	Name  string `facebook=",required"`
	Value string `facebook=",required"`
}

type batchResultData struct {
	Code    int                 `facebook=",required"`
	Headers []batchResultHeader `facebook=",required"`
	Body    string              `facebook=",required"`
}

func newBatchResult(res Result) (*BatchResult, error) {
	var data batchResultData
	err := res.Decode(&data)

	if err != nil {
		return nil, err
	}

	result := &BatchResult{
		StatusCode: data.Code,
		Header:     http.Header{},
		Body:       data.Body,
	}

	err = json.Unmarshal([]byte(result.Body), &result.Result)

	if err != nil {
		return nil, err
	}

	// add headers to result.
	for _, header := range data.Headers {
		result.Header.Add(header.Name, header.Value)
	}

	return result, nil
}
