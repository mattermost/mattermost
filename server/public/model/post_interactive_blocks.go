// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

func appendHumanReadableInteractiveStrings(o *Post, out *[]string) {
	props := o.GetProps()
	if props == nil {
		return
	}
	if raw, ok := props[PostPropsMmBlocks]; ok {
		appendHumanStringsFromMmBlocks(raw, out)
	}
	if raw, ok := props[PostPropsBlockKitBlocks]; ok {
		appendHumanStringsFromBlockKitTree(raw, out)
	}
	if raw, ok := props[PostPropsAdaptiveCards]; ok {
		appendHumanStringsFromAdaptiveCardsTree(raw, out)
	}
}

func interactivePropJSONArray(raw any) ([]any, bool) {
	switch v := raw.(type) {
	case []any:
		return v, true
	default:
		return nil, false
	}
}

func interactivePropJSONArrayNonEmpty(raw any) bool {
	arr, ok := interactivePropJSONArray(raw)
	return ok && len(arr) > 0
}

func appendHumanStringsFromMmBlocks(raw any, out *[]string) {
	blocks, ok := interactivePropJSONArray(raw)
	if !ok {
		return
	}
	for _, b := range blocks {
		m, ok := b.(map[string]any)
		if !ok {
			continue
		}
		appendHumanStringsFromMmBlockMap(m, out)
	}
}

func appendHumanStringsFromMmBlockMap(m map[string]any, out *[]string) {
	typ, _ := m["type"].(string)
	switch typ {
	case "text":
		if s, ok := m["text"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
	case "container":
		appendHumanStringsFromMmBlocksArray(m["content"], out)
	case "collapsible":
		appendHumanStringsFromMmBlocksArray(m["header"], out)
		appendHumanStringsFromMmBlocksArray(m["content"], out)
	case "column_set":
		if cols, ok := m["columns"].([]any); ok {
			for _, col := range cols {
				cm, ok := col.(map[string]any)
				if !ok {
					continue
				}
				appendHumanStringsFromMmBlockMap(cm, out)
			}
		}
	case "column":
		appendHumanStringsFromMmBlocksArray(m["items"], out)
	}
}

func appendHumanStringsFromMmBlocksArray(raw any, out *[]string) {
	arr, ok := interactivePropJSONArray(raw)
	if !ok {
		return
	}
	for _, el := range arr {
		m, ok := el.(map[string]any)
		if !ok {
			continue
		}
		appendHumanStringsFromMmBlockMap(m, out)
	}
}

func appendHumanStringsFromBlockKitTree(v any, out *[]string) {
	blocks, ok := v.([]any)
	if !ok {
		return
	}
	for _, block := range blocks {
		blockMap, ok := block.(map[string]any)
		if !ok {
			continue
		}
		typ, _ := blockMap["type"].(string)
		switch typ {
		case "markdown":
			if s, ok := blockMap["text"].(string); ok {
				appendTrimmedNonEmptyString(out, s)
			}
		case "section":
			if s, ok := blockMap["text"].(string); ok {
				appendTrimmedNonEmptyString(out, s)
			}
			if fields, ok := blockMap["fields"].([]any); ok {
				for _, field := range fields {
					fieldMap, ok := field.(map[string]any)
					if !ok {
						continue
					}
					fieldText, ok := fieldMap["text"].(string)
					if ok {
						appendTrimmedNonEmptyString(out, fieldText)
					}
				}
			}
		case "header":
			if s, ok := blockMap["text"].(string); ok {
				appendTrimmedNonEmptyString(out, s)
			}
		}
	}
}

func appendHumanStringsFromAdaptiveCardsTree(v any, out *[]string) {
	cards, ok := v.([]any)
	if !ok {
		return
	}
	for _, card := range cards {
		cardMap, ok := card.(map[string]any)
		if !ok {
			continue
		}
		body, ok := cardMap["body"].([]any)
		if !ok {
			continue
		}
		for _, item := range body {
			appendHumanStringsFromAdaptiveCardsItem(item, out)
		}
	}
}

func appendHumanStringsFromAdaptiveCardsItem(item any, out *[]string) {
	itemMap, ok := item.(map[string]any)
	if !ok {
		return
	}
	typ, _ := itemMap["type"].(string)
	switch typ {
	case "TextBlock":
		if s, ok := itemMap["text"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
	case "Container":
		if items, ok := itemMap["items"].([]any); ok {
			for _, item := range items {
				appendHumanStringsFromAdaptiveCardsItem(item, out)
			}
		}
	case "ColumnSet":
		if columns, ok := itemMap["columns"].([]any); ok {
			for _, column := range columns {
				columnMap, ok := column.(map[string]any)
				if !ok {
					continue
				}
				itemMap, ok := columnMap["items"].([]any)
				if !ok {
					continue
				}
				for _, item := range itemMap {
					appendHumanStringsFromAdaptiveCardsItem(item, out)
				}
			}
		}
	}
}

func collectMmBlockImageURLs(raw any) []string {
	blocks, ok := interactivePropJSONArray(raw)
	if !ok {
		return nil
	}
	var out []string
	for _, b := range blocks {
		m, ok := b.(map[string]any)
		if !ok {
			continue
		}
		walkMmBlockMapForImageURLs(m, &out)
	}
	return out
}

func walkMmBlockMapForImageURLs(m map[string]any, out *[]string) {
	typ, _ := m["type"].(string)
	switch typ {
	case "image":
		if u, ok := m["url"].(string); ok {
			*out = append(*out, u)
		}
	case "container":
		walkMmBlocksArrayForImageURLs(m["content"], out)
	case "collapsible":
		walkMmBlocksArrayForImageURLs(m["header"], out)
		walkMmBlocksArrayForImageURLs(m["content"], out)
	case "column_set":
		if cols, ok := m["columns"].([]any); ok {
			for _, col := range cols {
				cm, ok := col.(map[string]any)
				if !ok {
					continue
				}
				walkMmBlockMapForImageURLs(cm, out)
			}
		}
	case "column":
		walkMmBlocksArrayForImageURLs(m["items"], out)
	}
}

func walkMmBlocksArrayForImageURLs(raw any, out *[]string) {
	arr, ok := interactivePropJSONArray(raw)
	if !ok {
		return
	}
	for _, el := range arr {
		m, ok := el.(map[string]any)
		if !ok {
			continue
		}
		walkMmBlockMapForImageURLs(m, out)
	}
}

func collectBlockKitImageURLs(v any, out *[]string) {
	blocks, ok := interactivePropJSONArray(v)
	if !ok {
		return
	}
	for _, block := range blocks {
		blockMap, ok := block.(map[string]any)
		if !ok {
			continue
		}
		typ, _ := blockMap["type"].(string)
		switch typ {
		case "section":
			if accessory, ok := blockMap["accessory"].(map[string]any); ok {
				accessoryType, _ := accessory["type"].(string)
				if accessoryType != "image" {
					continue
				}

				if u, ok := accessory["image_url"].(string); ok {
					*out = append(*out, u)
				}
			}
		case "image":
			if u, ok := blockMap["image_url"].(string); ok {
				*out = append(*out, u)
			}
		}
	}
}

func collectAdaptiveCardImageURLs(v any, out *[]string) {
	cards, ok := interactivePropJSONArray(v)
	if !ok {
		return
	}
	for _, card := range cards {
		cardMap, ok := card.(map[string]any)
		if !ok {
			continue
		}
		body, ok := cardMap["body"].([]any)
		if !ok {
			continue
		}
		for _, item := range body {
			itemMap, ok := item.(map[string]any)
			if !ok {
				continue
			}
			typ, _ := itemMap["type"].(string)
			switch typ {
			case "Image":
				if u, ok := itemMap["url"].(string); ok {
					*out = append(*out, u)
				}
			}
		}
	}
}

func collectAdaptiveCardImageURLsFromItem(item any, out *[]string) {
	itemMap, ok := item.(map[string]any)
	if !ok {
		return
	}
	typ, _ := itemMap["type"].(string)
	switch typ {
	case "Container":
		if items, ok := itemMap["items"].([]any); ok {
			for _, item := range items {
				collectAdaptiveCardImageURLsFromItem(item, out)
			}
		}
	case "ColumnSet":
		if columns, ok := itemMap["columns"].([]any); ok {
			for _, column := range columns {
				columnMap, ok := column.(map[string]any)
				if !ok {
					continue
				}
				items, ok := columnMap["items"].([]any)
				if !ok {
					continue
				}
				for _, item := range items {
					collectAdaptiveCardImageURLsFromItem(item, out)
				}
			}
		}
	case "Image":
		if u, ok := itemMap["url"].(string); ok {
			*out = append(*out, u)
		}
	}
}
