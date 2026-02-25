// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"encoding/json"
	"strings"
)

// sensitiveKeywords are substrings matched case-insensitively against JSON field names
// to identify values that should be redacted.
var sensitiveKeywords = []string{
	"password", "secret", "key", "token", "privatekey", "apikey",
	"cert", "credential", "dsn", "datasource", "connectionstring", "bearer",
	"oauth", "signature", "salt",
}

// obfuscateConfigJSON obfuscates sensitive fields in a Mattermost config.json file.
// It walks the parsed JSON tree and redacts sensitive string values in-place,
// then re-marshals. Returns the obfuscated JSON bytes, count of fields obfuscated, and any error.
func obfuscateConfigJSON(jsonBytes []byte) ([]byte, int, error) {
	var config map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &config); err != nil {
		return nil, 0, err
	}

	count := 0
	redactSensitiveFields(config, &count)

	result, err := json.MarshalIndent(config, "", "    ")
	if err != nil {
		return nil, 0, err
	}

	return result, count, nil
}

// isSensitiveKey returns true if the key contains a sensitive keyword (case-insensitive).
func isSensitiveKey(key string) bool {
	normalizedKey := strings.ToLower(key)
	for _, keyword := range sensitiveKeywords {
		if strings.Contains(normalizedKey, keyword) {
			return true
		}
	}
	return false
}

// redactSensitiveFields walks a JSON object and replaces sensitive string values with "***REDACTED***".
func redactSensitiveFields(data map[string]interface{}, count *int) {
	for key, value := range data {
		if isSensitiveKey(key) {
			switch v := value.(type) {
			case string:
				if v != "" {
					data[key] = "***REDACTED***"
					*count++
				}
			case map[string]interface{}:
				redactSensitiveFields(v, count)
			case []interface{}:
				redactSensitiveArray(v, count)
			}
		} else {
			switch v := value.(type) {
			case map[string]interface{}:
				redactSensitiveFields(v, count)
			case []interface{}:
				redactSensitiveArray(v, count)
			}
		}
	}
}

// redactSensitiveArray walks a JSON array and redacts sensitive fields in any nested objects.
func redactSensitiveArray(data []interface{}, count *int) {
	for _, item := range data {
		switch v := item.(type) {
		case map[string]interface{}:
			redactSensitiveFields(v, count)
		case []interface{}:
			redactSensitiveArray(v, count)
		}
	}
}
