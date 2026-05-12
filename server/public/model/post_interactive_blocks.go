// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"strings"
)

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
		for _, card := range adaptiveCardPayloadRoots(raw) {
			appendHumanStringsFromAdaptiveCardsTree(card, out)
		}
	}
}

func interactivePropJSONArray(raw any) ([]any, bool) {
	switch v := raw.(type) {
	case []any:
		return v, true
	case nil:
		return nil, false
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return nil, false
		}
		var arr []any
		if err := json.Unmarshal(b, &arr); err != nil {
			return nil, false
		}
		return arr, true
	}
}

func interactivePropJSONArrayNonEmpty(raw any) bool {
	arr, ok := interactivePropJSONArray(raw)
	return ok && len(arr) > 0
}

func adaptiveCardsPropNonEmpty(raw any) bool {
	return len(adaptiveCardPayloadRoots(raw)) > 0
}

func adaptiveCardPayloadRoots(raw any) []any {
	if raw == nil {
		return nil
	}
	if arr, ok := raw.([]any); ok {
		return arr
	}
	if m, ok := raw.(map[string]any); ok {
		return []any{m}
	}
	b, err := json.Marshal(raw)
	if err != nil {
		return nil
	}
	var asMap map[string]any
	if err := json.Unmarshal(b, &asMap); err == nil && asMap != nil {
		return []any{asMap}
	}
	var asArr []any
	if err := json.Unmarshal(b, &asArr); err == nil {
		return asArr
	}
	return nil
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
	case "button":
		if s, ok := m["text"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		if s, ok := m["tooltip"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
	case "static_select":
		if s, ok := m["placeholder"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		if opts, ok := m["options"].([]any); ok {
			for _, opt := range opts {
				om, ok := opt.(map[string]any)
				if !ok {
					continue
				}
				if s, ok := om["text"].(string); ok {
					appendTrimmedNonEmptyString(out, s)
				}
			}
		}
	case "image":
		if s, ok := m["alt_text"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		if s, ok := m["title"].(string); ok {
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
	default:
		for _, key := range []string{"content", "items", "header", "columns"} {
			appendHumanStringsFromMmBlocksArray(m[key], out)
		}
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
	switch val := v.(type) {
	case map[string]any:
		if t, _ := val["type"].(string); t == "mrkdwn" || t == "plain_text" {
			if s, ok := val["text"].(string); ok {
				appendTrimmedNonEmptyString(out, s)
			}
		}
		if s, ok := val["alt_text"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		if s, ok := val["placeholder"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		if s, ok := val["title"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		if s, ok := val["label"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		for _, key := range []string{"elements", "fields", "blocks", "accessory", "option_groups", "options", "text", "title", "label", "confirm"} {
			if child, ok := val[key]; ok && child != nil {
				appendHumanStringsFromBlockKitTree(child, out)
			}
		}
	case []any:
		for _, el := range val {
			appendHumanStringsFromBlockKitTree(el, out)
		}
	}
}

func appendHumanStringsFromAdaptiveCardsTree(v any, out *[]string) {
	switch val := v.(type) {
	case map[string]any:
		if s, ok := val["text"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		if s, ok := val["title"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		if s, ok := val["altText"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		if s, ok := val["alt_text"].(string); ok {
			appendTrimmedNonEmptyString(out, s)
		}
		typeStr, _ := val["type"].(string)
		if strings.EqualFold(typeStr, "Input.Text") {
			if s, ok := val["placeholder"].(string); ok {
				appendTrimmedNonEmptyString(out, s)
			}
		}
		for _, key := range []string{"body", "items", "columns", "elements", "actions", "card", "cards", "selectAction", "fallbackText"} {
			if child, ok := val[key]; ok && child != nil {
				appendHumanStringsFromAdaptiveCardsTree(child, out)
			}
		}
	case []any:
		for _, el := range val {
			appendHumanStringsFromAdaptiveCardsTree(el, out)
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
	default:
		for _, key := range []string{"content", "items", "header", "columns"} {
			walkMmBlocksArrayForImageURLs(m[key], out)
		}
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
	switch val := v.(type) {
	case map[string]any:
		if t, _ := val["type"].(string); t == "image" {
			if u, ok := val["image_url"].(string); ok {
				*out = append(*out, u)
			}
		}
		for _, key := range []string{"elements", "fields", "blocks", "accessory", "option_groups", "options", "text"} {
			if child, ok := val[key]; ok && child != nil {
				collectBlockKitImageURLs(child, out)
			}
		}
	case []any:
		for _, el := range val {
			collectBlockKitImageURLs(el, out)
		}
	}
}

func collectAdaptiveCardImageURLs(v any, out *[]string) {
	switch val := v.(type) {
	case map[string]any:
		typeStr, _ := val["type"].(string)
		if strings.EqualFold(typeStr, "Image") {
			if u, ok := val["url"].(string); ok {
				*out = append(*out, u)
			}
		}
		for _, key := range []string{"body", "items", "columns", "elements", "actions", "card", "cards", "selectAction", "fallbackText"} {
			if child, ok := val[key]; ok && child != nil {
				collectAdaptiveCardImageURLs(child, out)
			}
		}
	case []any:
		for _, el := range val {
			collectAdaptiveCardImageURLs(el, out)
		}
	}
}
