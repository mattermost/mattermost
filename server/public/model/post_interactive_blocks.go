// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/shared/markdown"
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
			appendNonWhitespaceOnlyMessage(out, s)
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
				appendNonWhitespaceOnlyMessage(out, s)
			}
		case "section":
			if textBlock, ok := blockMap["text"].(map[string]any); ok {
				if s, ok := textBlock["text"].(string); ok {
					appendNonWhitespaceOnlyMessage(out, s)
				}
			}
			if fields, ok := blockMap["fields"].([]any); ok {
				for _, field := range fields {
					fieldMap, ok := field.(map[string]any)
					if !ok {
						continue
					}
					fieldText, ok := fieldMap["text"].(string)
					if ok {
						appendNonWhitespaceOnlyMessage(out, fieldText)
					}
				}
			}
		case "header":
			if textBlock, ok := blockMap["text"].(map[string]any); ok {
				if s, ok := textBlock["text"].(string); ok {
					appendNonWhitespaceOnlyMessage(out, s)
				}
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
			appendNonWhitespaceOnlyMessage(out, s)
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
			collectAdaptiveCardImageURLsFromItem(item, out)
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

func collectAttachmentsImageURLs(attachments []*MessageAttachment, out *[]string) {
	for _, attachment := range attachments {
		if attachment == nil {
			continue
		}
		if attachment.ImageURL != "" {
			*out = append(*out, attachment.ImageURL)
		}
		if attachment.ThumbURL != "" {
			*out = append(*out, attachment.ThumbURL)
		}
		if attachment.AuthorIcon != "" {
			*out = append(*out, attachment.AuthorIcon)
		}
		if attachment.FooterIcon != "" {
			*out = append(*out, attachment.FooterIcon)
		}
	}
}

const mmactionScheme = "mmaction://"

// collectMmactionIDsFromText collects action ids from mmaction:// markdown links only.
// Inline code, fenced code blocks, and other non-link text are ignored (same approach as mentions).
func collectMmactionIDsFromText(text string, ids map[string]struct{}) {
	markdown.Inspect(text, func(blockOrInline any) bool {
		switch v := blockOrInline.(type) {
		case *markdown.InlineLink:
			collectMmactionIDFromURL(v.Destination(), ids)
		case *markdown.ReferenceLink:
			if v.ReferenceDefinition != nil {
				collectMmactionIDFromURL(v.ReferenceDefinition.Destination(), ids)
			}
		case *markdown.Autolink:
			collectMmactionIDFromURL(v.Destination(), ids)
		}
		return true
	})
}

func collectMmactionIDFromURL(url string, ids map[string]struct{}) {
	if !strings.HasPrefix(url, mmactionScheme) {
		return
	}
	withoutScheme := url[len(mmactionScheme):]
	actionID := withoutScheme
	if i := strings.IndexAny(withoutScheme, "/?#"); i >= 0 {
		actionID = withoutScheme[:i]
	}
	if actionID != "" && mmBlocksActionIDRegex.MatchString(actionID) {
		ids[actionID] = struct{}{}
	}
}

func mergeActionIDs(into, from map[string]struct{}) {
	for id := range from {
		into[id] = struct{}{}
	}
}

func collectMmBlockActionIDsFromMap(m map[string]any, ids map[string]struct{}) {
	typ, _ := m["type"].(string)
	switch typ {
	case "text":
		if s, ok := m["text"].(string); ok {
			collectMmactionIDsFromText(s, ids)
		}
	case "button", "static_select":
		if id, ok := m["action_id"].(string); ok && id != "" {
			ids[id] = struct{}{}
		}
	case "container":
		collectMmBlockActionIDsFromArray(m["content"], ids)
	case "collapsible":
		collectMmBlockActionIDsFromArray(m["header"], ids)
		collectMmBlockActionIDsFromArray(m["content"], ids)
	case "column_set":
		if cols, ok := m["columns"].([]any); ok {
			for _, col := range cols {
				cm, ok := col.(map[string]any)
				if !ok {
					continue
				}
				colTyp, _ := cm["type"].(string)
				if colTyp != "column" {
					continue
				}
				collectMmBlockActionIDsFromArray(cm["items"], ids)
			}
		}
	}
}

func collectMmBlockActionIDsFromArray(raw any, ids map[string]struct{}) {
	arr, ok := interactivePropJSONArray(raw)
	if !ok {
		return
	}
	for _, el := range arr {
		m, ok := el.(map[string]any)
		if !ok {
			continue
		}
		collectMmBlockActionIDsFromMap(m, ids)
	}
}

// CollectMmBlockActionIDs returns action_id values referenced by interactive mm_blocks controls.
func CollectMmBlockActionIDs(blocks []any) map[string]struct{} {
	ids := make(map[string]struct{})
	for _, b := range blocks {
		m, ok := b.(map[string]any)
		if !ok {
			continue
		}
		collectMmBlockActionIDsFromMap(m, ids)
	}
	return ids
}

func collectBlockKitTextMmaction(raw any, ids map[string]struct{}) {
	if raw == nil {
		return
	}
	switch v := raw.(type) {
	case string:
		collectMmactionIDsFromText(v, ids)
	case map[string]any:
		if s, ok := v["text"].(string); ok {
			collectMmactionIDsFromText(s, ids)
		}
	}
}

func collectBlockKitAccessory(accessory map[string]any, ids map[string]struct{}) {
	typ, _ := accessory["type"].(string)
	switch typ {
	case "button", "static_select":
		if id, ok := accessory["action_id"].(string); ok && id != "" {
			ids[id] = struct{}{}
		}
	}
}

func collectBlockKitActionElement(el any, ids map[string]struct{}) {
	e, ok := el.(map[string]any)
	if !ok {
		return
	}
	typ, _ := e["type"].(string)
	switch typ {
	case "button", "static_select":
		if id, ok := e["action_id"].(string); ok && id != "" {
			ids[id] = struct{}{}
		}
	}
}

func collectBlockKitActionIDsFromBlock(m map[string]any, ids map[string]struct{}) {
	typ, _ := m["type"].(string)
	switch typ {
	case "actions":
		if elements, ok := m["elements"].([]any); ok {
			for _, el := range elements {
				collectBlockKitActionElement(el, ids)
			}
		}
	case "section":
		collectBlockKitTextMmaction(m["text"], ids)
		if accessory, ok := m["accessory"].(map[string]any); ok {
			collectBlockKitAccessory(accessory, ids)
		}
		if fields, ok := m["fields"].([]any); ok {
			for _, field := range fields {
				collectBlockKitTextMmaction(field, ids)
			}
		}
	case "markdown":
		collectBlockKitTextMmaction(m["text"], ids)
	case "header":
		collectBlockKitTextMmaction(m["text"], ids)
	}
}

// CollectBlockKitActionIDs returns action_id values from Block Kit blocks (props.blocks).
func CollectBlockKitActionIDs(blocks []any) map[string]struct{} {
	ids := make(map[string]struct{})
	for _, b := range blocks {
		m, ok := b.(map[string]any)
		if !ok {
			continue
		}
		collectBlockKitActionIDsFromBlock(m, ids)
	}
	return ids
}

func collectAdaptiveCardActionElement(action any, ids map[string]struct{}) {
	ac, ok := action.(map[string]any)
	if !ok {
		return
	}
	typ, _ := ac["type"].(string)
	if typ == "Action.Submit" {
		if id, ok := ac["id"].(string); ok && id != "" {
			ids[id] = struct{}{}
		}
	}
}

func collectAdaptiveCardActionIDsFromItem(item any, ids map[string]struct{}) {
	itemMap, ok := item.(map[string]any)
	if !ok {
		return
	}
	typ, _ := itemMap["type"].(string)
	switch typ {
	case "TextBlock":
		if s, ok := itemMap["text"].(string); ok {
			collectMmactionIDsFromText(s, ids)
		}
	case "Container":
		if items, ok := itemMap["items"].([]any); ok {
			for _, nested := range items {
				collectAdaptiveCardActionIDsFromItem(nested, ids)
			}
		}
	case "ColumnSet":
		if columns, ok := itemMap["columns"].([]any); ok {
			for _, column := range columns {
				columnMap, ok := column.(map[string]any)
				if !ok {
					continue
				}
				if items, ok := columnMap["items"].([]any); ok {
					for _, nested := range items {
						collectAdaptiveCardActionIDsFromItem(nested, ids)
					}
				}
			}
		}
	case "ActionSet":
		if actions, ok := itemMap["actions"].([]any); ok {
			for _, action := range actions {
				collectAdaptiveCardActionElement(action, ids)
			}
		}
	}
}

// CollectAdaptiveCardActionIDs returns action ids from Adaptive Cards (props.cards).
func CollectAdaptiveCardActionIDs(cards []any) map[string]struct{} {
	ids := make(map[string]struct{})
	for _, card := range cards {
		cardMap, ok := card.(map[string]any)
		if !ok {
			continue
		}
		if body, ok := cardMap["body"].([]any); ok {
			for _, item := range body {
				collectAdaptiveCardActionIDsFromItem(item, ids)
			}
		}
		if actions, ok := cardMap["actions"].([]any); ok {
			for _, action := range actions {
				collectAdaptiveCardActionElement(action, ids)
			}
		}
	}
	return ids
}

// CollectInteractiveActionIDs returns action ids referenced by interactive post props.
func CollectInteractiveActionIDs(props map[string]any) map[string]struct{} {
	ids := make(map[string]struct{})
	if props == nil {
		return ids
	}
	if raw, ok := props[PostPropsMmBlocks]; ok {
		if blocks, ok := interactivePropJSONArray(raw); ok {
			mergeActionIDs(ids, CollectMmBlockActionIDs(blocks))
		}
	}
	if raw, ok := props[PostPropsBlockKitBlocks]; ok {
		if blocks, ok := interactivePropJSONArray(raw); ok {
			mergeActionIDs(ids, CollectBlockKitActionIDs(blocks))
		}
	}
	if raw, ok := props[PostPropsAdaptiveCards]; ok {
		if cards, ok := interactivePropJSONArray(raw); ok {
			mergeActionIDs(ids, CollectAdaptiveCardActionIDs(cards))
		}
	}
	return ids
}

// CollectInteractiveActionIDsFromPost includes mmaction:// links in the post message.
func CollectInteractiveActionIDsFromPost(o *Post) map[string]struct{} {
	ids := CollectInteractiveActionIDs(o.GetProps())
	if o.Message != "" {
		collectMmactionIDsFromText(o.Message, ids)
	}
	return ids
}

// CollectMmactionIDsFromText returns action ids from mmaction:// links in a string.
func CollectMmactionIDsFromText(text string) map[string]struct{} {
	ids := make(map[string]struct{})
	collectMmactionIDsFromText(text, ids)
	return ids
}

// SubsetMmBlocksActions returns registry entries referenced by actionIDs.
func SubsetMmBlocksActions(allActions any, actionIDs map[string]struct{}) map[string]any {
	if allActions == nil || len(actionIDs) == 0 {
		return nil
	}
	top, ok := allActions.(map[string]any)
	if !ok {
		return nil
	}
	out := make(map[string]any, len(actionIDs))
	for id := range actionIDs {
		if entry, ok := top[id]; ok {
			out[id] = entry
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// RefreshInteractiveActionsOnPost sets mm_blocks_actions to the subset needed by this post's interactive content.
func RefreshInteractiveActionsOnPost(o *Post, allActions any) {
	ids := CollectInteractiveActionIDsFromPost(o)
	props := o.GetProps()
	if props == nil {
		props = make(map[string]any)
	}
	if len(ids) == 0 {
		delete(props, PostPropsMmBlocksActions)
	} else if subset := SubsetMmBlocksActions(allActions, ids); len(subset) > 0 {
		props[PostPropsMmBlocksActions] = subset
	} else {
		delete(props, PostPropsMmBlocksActions)
	}
	o.SetProps(props)
}

// ApplyMmBlocksWithActionsToProps sets mm_blocks and refreshes mm_blocks_actions for the props payload.
func ApplyMmBlocksWithActionsToProps(props map[string]any, blocks []any, allActions any) {
	props[PostPropsMmBlocks] = blocks
	RefreshInteractiveActionsOnPost(&Post{Props: props}, allActions)
}

// validateMmBlocksActionsPairing requires mm_blocks_actions to define exactly the actions
// referenced by mm_blocks, blocks, cards, and mmaction:// links in the post message.
func validateMmBlocksActionsPairing(o *Post, actions map[string]any) error {
	referenced := CollectInteractiveActionIDsFromPost(o)
	if len(referenced) == 0 {
		if len(actions) > 0 {
			return fmt.Errorf("mm_blocks_actions must only define actions referenced by interactive content")
		}
		return nil
	}
	for id := range referenced {
		if _, ok := actions[id]; !ok {
			return fmt.Errorf("mm_blocks_actions missing entry for action_id %q", id)
		}
	}
	for key := range actions {
		if _, ok := referenced[key]; !ok {
			return fmt.Errorf("mm_blocks_actions entry %q is not referenced by interactive content", key)
		}
	}
	return nil
}

// ValidateInteractiveActionsForWebhook checks interactive payloads and mm_blocks_actions are paired.
func ValidateInteractiveActionsForWebhook(o *Post) error {
	return ValidateMmBlocksActions(o)
}

// ValidateMmBlocksActionsForWebhook validates mm_blocks-only webhook payloads (legacy helper).
func ValidateMmBlocksActionsForWebhook(blocks []any, actions any) error {
	return ValidateInteractiveActionsForWebhook(&Post{
		Props: map[string]any{
			PostPropsMmBlocks:        blocks,
			PostPropsMmBlocksActions: actions,
		},
	})
}
