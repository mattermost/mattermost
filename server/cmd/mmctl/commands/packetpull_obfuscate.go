// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"encoding/json"
	"strings"
)

// obfuscateConfigJSON obfuscates sensitive fields in a Mattermost config.json file
// Returns the obfuscated JSON bytes, count of fields obfuscated, and any error
func obfuscateConfigJSON(jsonBytes []byte) ([]byte, int, error) {
	// Parse to validate it's valid JSON and collect sensitive values
	var config map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &config); err != nil {
		return nil, 0, err
	}

	// Collect all sensitive field paths and their values
	sensitiveValues := make(map[string]bool)
	count := 0
	collectSensitiveValues(config, &count, sensitiveValues)

	// Now do string-based replacement on the original JSON to preserve order and formatting
	result := string(jsonBytes)

	// For each unique sensitive value, replace it with REDACTED
	// We need to be careful to only replace actual string values, not keys
	for value := range sensitiveValues {
		if value == "" {
			continue
		}
		// Escape the value for JSON (handle quotes, backslashes, etc.)
		escapedValue := escapeJSONString(value)
		// Replace "originalValue" with "***REDACTED***"
		// Using exact match to avoid partial replacements
		result = strings.ReplaceAll(result, `"`+escapedValue+`"`, `"***REDACTED***"`)
	}

	// Validate the result is still valid JSON
	var validation interface{}
	if err := json.Unmarshal([]byte(result), &validation); err != nil {
		return nil, 0, err
	}

	return []byte(result), count, nil
}

// collectSensitiveValues walks the config and collects values that should be obfuscated
func collectSensitiveValues(data map[string]interface{}, count *int, values map[string]bool) {
	sensitiveKeywords := []string{
		"password", "secret", "key", "token", "privatekey", "apikey",
		"cert", "credential", "dsn", "datasource", "connectionstring", "bearer",
		"oauth", "signature", "salt",
	}

	for key, value := range data {
		normalizedKey := strings.ToLower(key)

		isSensitive := false
		for _, keyword := range sensitiveKeywords {
			if strings.Contains(normalizedKey, keyword) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			switch v := value.(type) {
			case string:
				if v != "" {
					values[v] = true
					*count++
				}
			case map[string]interface{}:
				collectSensitiveValues(v, count, values)
			case []interface{}:
				collectSensitiveArray(v, count, values)
			}
		} else {
			switch v := value.(type) {
			case map[string]interface{}:
				collectSensitiveValues(v, count, values)
			case []interface{}:
				collectSensitiveArray(v, count, values)
			}
		}
	}
}

// collectSensitiveArray walks an array and collects sensitive values
func collectSensitiveArray(data []interface{}, count *int, values map[string]bool) {
	for _, item := range data {
		switch v := item.(type) {
		case map[string]interface{}:
			collectSensitiveValues(v, count, values)
		case []interface{}:
			collectSensitiveArray(v, count, values)
		}
	}
}

// escapeJSONString escapes a string value as it would appear in JSON
// This handles quotes, backslashes, and other special characters
func escapeJSONString(s string) string {
	// Use json.Marshal to get the proper escaping, then strip the surrounding quotes
	encoded, _ := json.Marshal(s)
	if len(encoded) >= 2 {
		return string(encoded[1 : len(encoded)-1])
	}
	return s
}

// Legacy functions kept for compatibility but not used
func obfuscateMap(data map[string]interface{}, count *int) {
	// This is no longer used but kept to avoid breaking imports
}

func obfuscateArray(data []interface{}, count *int) {
	// This is no longer used but kept to avoid breaking imports
}
