// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"fmt"
	"math"
	"strconv"
)

// Response is a map containing the response when sending a message to a remote cluster.
type Response map[string]interface{}

func (r Response) String(key string) (string, error) {
	if val, ok := r[key]; ok {
		return fmt.Sprintf("%v", val), nil
	}
	return "", fmt.Errorf("%s not found", key)
}

func (r Response) Int64(key string) (int64, error) {
	val, ok := r[key]
	if !ok {
		return 0, fmt.Errorf("%s not found", key)
	}
	switch v := val.(type) {
	case int:
		return int64(v), nil
	case int64:
		return v, nil
	case float32:
		return int64(math.Round(float64(v))), nil
	case float64:
		return int64(math.Round(v)), nil
	case string:
		return strconv.ParseInt(v, 10, 64)
	}
	return 0, fmt.Errorf("%s cannot be converted to int64", key)
}

func (r Response) StringSlice(key string) ([]string, error) {
	val, ok := r[key]
	if !ok {
		return nil, fmt.Errorf("%s not found", key)
	}
	switch v := val.(type) {
	case []string:
		return v, nil
	case []interface{}:
		return interfaceSlicetoStringSlice(v), nil
	}
	return nil, fmt.Errorf("%s is not an array/slice of strings", key)
}

func (r Response) IsSuccess() bool {
	status, _ := r.String(ResponseStatusKey)
	return status == ResponseStatusOK
}

func (r Response) Error() string {
	if status, _ := r.String(ResponseStatusKey); status == ResponseStatusFail {
		errString, _ := r.String(ResponseErrorKey)
		return fmt.Sprintf("%s: %s", status, errString)
	}
	return ""
}

func interfaceSlicetoStringSlice(v []interface{}) []string {
	if v == nil {
		return nil
	}
	out := make([]string, 0, len(v))
	for _, vv := range v {
		out = append(out, fmt.Sprintf("%v", vv))
	}
	return out
}
