// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"maps"
	"strings"

	"github.com/mattermost/mattermost/server/public/shared/markdown"
)

func appendHumanReadableInteractiveStrings(o *Post, out []string) []string {
	props := o.GetProps()
	if props == nil {
		return out
	}
	if raw, ok := props[PostPropsMmBlocks]; ok {
		out = appendHumanStringsFromMmBlocks(raw, out)
	}
	if raw, ok := props[PostPropsBlockKitBlocks]; ok {
		out = appendHumanStringsFromBlockKitTree(raw, out)
	}
	if raw, ok := props[PostPropsAdaptiveCards]; ok {
		out = appendHumanStringsFromAdaptiveCardsTree(raw, out)
	}
	return out
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

func appendHumanStringsFromMmBlocks(raw any, out []string) []string {
	blocks, ok := interactivePropJSONArray(raw)
	if !ok {
		return out
	}
	for _, b := range blocks {
		m, ok := b.(map[string]any)
		if !ok {
			continue
		}
		out = appendHumanStringsFromMmBlockMap(m, out)
	}
	return out
}

func appendHumanStringsFromMmBlockMap(m map[string]any, out []string) []string {
	typ, _ := m["type"].(string)
	switch typ {
	case "text":
		if s, ok := m["text"].(string); ok {
			out = appendNonWhitespaceOnlyMessage(out, s)
		}
	case "container":
		out = appendHumanStringsFromMmBlocksArray(m["content"], out)
	case "collapsible":
		out = appendHumanStringsFromMmBlocksArray(m["header"], out)
		out = appendHumanStringsFromMmBlocksArray(m["content"], out)
	case "column_set":
		if cols, ok := m["columns"].([]any); ok {
			for _, col := range cols {
				cm, ok := col.(map[string]any)
				if !ok {
					continue
				}
				colItems, ok := cm["items"].([]any)
				if !ok {
					continue
				}
				out = appendHumanStringsFromMmBlocksArray(colItems, out)
			}
		}
	}
	return out
}

func appendHumanStringsFromMmBlocksArray(raw any, out []string) []string {
	arr, ok := interactivePropJSONArray(raw)
	if !ok {
		return out
	}
	for _, el := range arr {
		m, ok := el.(map[string]any)
		if !ok {
			continue
		}
		out = appendHumanStringsFromMmBlockMap(m, out)
	}
	return out
}

func appendHumanStringsFromBlockKitTree(v any, out []string) []string {
	blocks, ok := v.([]any)
	if !ok {
		return out
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
				out = appendNonWhitespaceOnlyMessage(out, s)
			}
		case "section":
			if textBlock, ok := blockMap["text"].(map[string]any); ok {
				if s, ok := textBlock["text"].(string); ok {
					out = appendNonWhitespaceOnlyMessage(out, s)
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
						out = appendNonWhitespaceOnlyMessage(out, fieldText)
					}
				}
			}
		case "header":
			if textBlock, ok := blockMap["text"].(map[string]any); ok {
				if s, ok := textBlock["text"].(string); ok {
					out = appendNonWhitespaceOnlyMessage(out, s)
				}
			}
		}
	}
	return out
}

func appendHumanStringsFromAdaptiveCardsTree(v any, out []string) []string {
	cards, ok := v.([]any)
	if !ok {
		return out
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
			out = appendHumanStringsFromAdaptiveCardsItem(item, out)
		}
	}
	return out
}

func appendHumanStringsFromAdaptiveCardsItem(item any, out []string) []string {
	itemMap, ok := item.(map[string]any)
	if !ok {
		return out
	}
	typ, _ := itemMap["type"].(string)
	switch typ {
	case "TextBlock":
		if s, ok := itemMap["text"].(string); ok {
			out = appendNonWhitespaceOnlyMessage(out, s)
		}
	case "Container":
		if items, ok := itemMap["items"].([]any); ok {
			for _, item := range items {
				out = appendHumanStringsFromAdaptiveCardsItem(item, out)
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
					out = appendHumanStringsFromAdaptiveCardsItem(item, out)
				}
			}
		}
	}
	return out
}

func appendMmBlockImageURLs(out []string, raw any) []string {
	blocks, ok := interactivePropJSONArray(raw)
	if !ok {
		return out
	}
	for _, b := range blocks {
		m, ok := b.(map[string]any)
		if !ok {
			continue
		}
		out = appendMmBlockMapImageURLs(out, m)
	}
	return out
}

func appendMmBlockMapImageURLs(out []string, m map[string]any) []string {
	typ, _ := m["type"].(string)
	switch typ {
	case "image":
		if u, ok := m["url"].(string); ok {
			out = append(out, u)
		}
	case "container":
		out = appendMmBlocksArrayImageURLs(out, m["content"])
	case "collapsible":
		out = appendMmBlocksArrayImageURLs(out, m["header"])
		out = appendMmBlocksArrayImageURLs(out, m["content"])
	case "column_set":
		if cols, ok := m["columns"].([]any); ok {
			for _, col := range cols {
				cm, ok := col.(map[string]any)
				if !ok {
					continue
				}
				colItems, ok := cm["items"].([]any)
				if !ok {
					continue
				}
				for _, item := range colItems {
					out = appendMmBlocksArrayImageURLs(out, item)
				}
			}
		}
	}
	return out
}

func appendMmBlocksArrayImageURLs(out []string, raw any) []string {
	arr, ok := interactivePropJSONArray(raw)
	if !ok {
		return out
	}
	for _, el := range arr {
		m, ok := el.(map[string]any)
		if !ok {
			continue
		}
		out = appendMmBlockMapImageURLs(out, m)
	}
	return out
}

func appendBlockKitImageURLs(out []string, v any) []string {
	blocks, ok := interactivePropJSONArray(v)
	if !ok {
		return out
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
					out = append(out, u)
				}
			}
		case "image":
			if u, ok := blockMap["image_url"].(string); ok {
				out = append(out, u)
			}
		}
	}
	return out
}

func appendAdaptiveCardImageURLs(out []string, v any) []string {
	cards, ok := interactivePropJSONArray(v)
	if !ok {
		return out
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
			out = appendAdaptiveCardImageURLsFromItem(out, item)
		}
	}
	return out
}

func appendAdaptiveCardImageURLsFromItem(out []string, item any) []string {
	itemMap, ok := item.(map[string]any)
	if !ok {
		return out
	}
	typ, _ := itemMap["type"].(string)
	switch typ {
	case "Container":
		if items, ok := itemMap["items"].([]any); ok {
			for _, item := range items {
				out = appendAdaptiveCardImageURLsFromItem(out, item)
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
					out = appendAdaptiveCardImageURLsFromItem(out, item)
				}
			}
		}
	case "Image":
		if u, ok := itemMap["url"].(string); ok {
			out = append(out, u)
		}
	}
	return out
}

func appendAttachmentsImageURLs(out []string, attachments []*MessageAttachment) []string {
	for _, attachment := range attachments {
		if attachment == nil {
			continue
		}
		if attachment.ImageURL != "" {
			out = append(out, attachment.ImageURL)
		}
		if attachment.ThumbURL != "" {
			out = append(out, attachment.ThumbURL)
		}
		if attachment.AuthorIcon != "" {
			out = append(out, attachment.AuthorIcon)
		}
		if attachment.FooterIcon != "" {
			out = append(out, attachment.FooterIcon)
		}
	}
	return out
}

const mmactionScheme = "mmaction://"

// appendMmactionIDsFromText appends action ids from mmaction:// markdown links only.
// Inline code, fenced code blocks, and other non-link text are ignored (same approach as mentions).
func appendMmactionIDsFromText(ids map[string]struct{}, text string) map[string]struct{} {
	if ids == nil {
		ids = make(map[string]struct{})
	}
	markdown.Inspect(text, func(blockOrInline any) bool {
		switch v := blockOrInline.(type) {
		case *markdown.InlineLink:
			ids = appendMmactionIDFromURL(ids, v.Destination())
		case *markdown.ReferenceLink:
			if v.ReferenceDefinition != nil {
				ids = appendMmactionIDFromURL(ids, v.ReferenceDefinition.Destination())
			}
		case *markdown.Autolink:
			ids = appendMmactionIDFromURL(ids, v.Destination())
		}
		return true
	})
	return ids
}

func appendMmactionIDFromURL(ids map[string]struct{}, url string) map[string]struct{} {
	if !strings.HasPrefix(url, mmactionScheme) {
		return ids
	}
	if ids == nil {
		ids = make(map[string]struct{})
	}
	withoutScheme := url[len(mmactionScheme):]
	actionID := withoutScheme
	if i := strings.IndexAny(withoutScheme, "/?#"); i >= 0 {
		actionID = withoutScheme[:i]
	}
	if actionID != "" && mmBlocksActionIDRegex.MatchString(actionID) {
		ids[actionID] = struct{}{}
	}
	return ids
}

func mergeActionIDs(into, from map[string]struct{}) {
	maps.Copy(into, from)
}

func interactiveControlDisabled(m map[string]any) bool {
	disabled, ok := m["disabled"].(bool)
	return ok && disabled
}

func appendMmBlockActionIDsFromMap(ids map[string]struct{}, m map[string]any) map[string]struct{} {
	typ, _ := m["type"].(string)
	switch typ {
	case "text":
		if s, ok := m["text"].(string); ok {
			ids = appendMmactionIDsFromText(ids, s)
		}
	case "button", "static_select":
		if interactiveControlDisabled(m) {
			break
		}
		if id, ok := m["action_id"].(string); ok && id != "" {
			if ids == nil {
				ids = make(map[string]struct{})
			}
			ids[id] = struct{}{}
		}
	case "container":
		ids = appendMmBlockActionIDsFromArray(ids, m["content"])
	case "collapsible":
		ids = appendMmBlockActionIDsFromArray(ids, m["header"])
		ids = appendMmBlockActionIDsFromArray(ids, m["content"])
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
				ids = appendMmBlockActionIDsFromArray(ids, cm["items"])
			}
		}
	}
	return ids
}

func appendMmBlockActionIDsFromArray(ids map[string]struct{}, raw any) map[string]struct{} {
	arr, ok := interactivePropJSONArray(raw)
	if !ok {
		return ids
	}
	for _, el := range arr {
		m, ok := el.(map[string]any)
		if !ok {
			continue
		}
		ids = appendMmBlockActionIDsFromMap(ids, m)
	}
	return ids
}

// CollectMmBlockActionIDs returns action_id values referenced by interactive mm_blocks controls.
func CollectMmBlockActionIDs(blocks []any) map[string]struct{} {
	var ids map[string]struct{}
	for _, b := range blocks {
		m, ok := b.(map[string]any)
		if !ok {
			continue
		}
		ids = appendMmBlockActionIDsFromMap(ids, m)
	}
	return ids
}

func appendBlockKitTextMmaction(ids map[string]struct{}, raw any) map[string]struct{} {
	if raw == nil {
		return ids
	}
	switch v := raw.(type) {
	case string:
		return appendMmactionIDsFromText(ids, v)
	case map[string]any:
		if s, ok := v["text"].(string); ok {
			return appendMmactionIDsFromText(ids, s)
		}
	}
	return ids
}

func appendBlockKitAccessory(ids map[string]struct{}, accessory map[string]any) map[string]struct{} {
	typ, _ := accessory["type"].(string)
	switch typ {
	case "button", "static_select":
		if interactiveControlDisabled(accessory) {
			return ids
		}
		if id, ok := accessory["action_id"].(string); ok && id != "" {
			if ids == nil {
				ids = make(map[string]struct{})
			}
			ids[id] = struct{}{}
		}
	}
	return ids
}

func appendBlockKitActionElement(ids map[string]struct{}, el any) map[string]struct{} {
	e, ok := el.(map[string]any)
	if !ok {
		return ids
	}
	typ, _ := e["type"].(string)
	switch typ {
	case "button", "static_select":
		if interactiveControlDisabled(e) {
			return ids
		}
		if id, ok := e["action_id"].(string); ok && id != "" {
			if ids == nil {
				ids = make(map[string]struct{})
			}
			ids[id] = struct{}{}
		}
	}
	return ids
}

func appendBlockKitActionIDsFromBlock(ids map[string]struct{}, m map[string]any) map[string]struct{} {
	typ, _ := m["type"].(string)
	switch typ {
	case "actions":
		if elements, ok := m["elements"].([]any); ok {
			for _, el := range elements {
				ids = appendBlockKitActionElement(ids, el)
			}
		}
	case "section":
		ids = appendBlockKitTextMmaction(ids, m["text"])
		if accessory, ok := m["accessory"].(map[string]any); ok {
			ids = appendBlockKitAccessory(ids, accessory)
		}
		if fields, ok := m["fields"].([]any); ok {
			for _, field := range fields {
				ids = appendBlockKitTextMmaction(ids, field)
			}
		}
	case "markdown":
		ids = appendBlockKitTextMmaction(ids, m["text"])
	case "header":
		ids = appendBlockKitTextMmaction(ids, m["text"])
	}
	return ids
}

// CollectBlockKitActionIDs returns action_id values from Block Kit blocks (props.blocks).
func CollectBlockKitActionIDs(blocks []any) map[string]struct{} {
	var ids map[string]struct{}
	for _, b := range blocks {
		m, ok := b.(map[string]any)
		if !ok {
			continue
		}
		ids = appendBlockKitActionIDsFromBlock(ids, m)
	}
	return ids
}

func appendAdaptiveCardActionElement(ids map[string]struct{}, action any) map[string]struct{} {
	ac, ok := action.(map[string]any)
	if !ok {
		return ids
	}
	typ, _ := ac["type"].(string)
	if typ == "Action.Submit" {
		if id, ok := ac["id"].(string); ok && id != "" {
			if ids == nil {
				ids = make(map[string]struct{})
			}
			ids[id] = struct{}{}
		}
	}
	return ids
}

func appendAdaptiveCardActionIDsFromItem(ids map[string]struct{}, item any) map[string]struct{} {
	itemMap, ok := item.(map[string]any)
	if !ok {
		return ids
	}
	typ, _ := itemMap["type"].(string)
	switch typ {
	case "TextBlock":
		if s, ok := itemMap["text"].(string); ok {
			ids = appendMmactionIDsFromText(ids, s)
		}
	case "Container":
		if items, ok := itemMap["items"].([]any); ok {
			for _, nested := range items {
				ids = appendAdaptiveCardActionIDsFromItem(ids, nested)
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
						ids = appendAdaptiveCardActionIDsFromItem(ids, nested)
					}
				}
			}
		}
	case "ActionSet":
		if actions, ok := itemMap["actions"].([]any); ok {
			for _, action := range actions {
				ids = appendAdaptiveCardActionElement(ids, action)
			}
		}
	}
	return ids
}

// CollectAdaptiveCardActionIDs returns action ids from Adaptive Cards (props.cards).
func CollectAdaptiveCardActionIDs(cards []any) map[string]struct{} {
	var ids map[string]struct{}
	for _, card := range cards {
		cardMap, ok := card.(map[string]any)
		if !ok {
			continue
		}
		if body, ok := cardMap["body"].([]any); ok {
			for _, item := range body {
				ids = appendAdaptiveCardActionIDsFromItem(ids, item)
			}
		}
		if actions, ok := cardMap["actions"].([]any); ok {
			for _, action := range actions {
				ids = appendAdaptiveCardActionElement(ids, action)
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
		ids = appendMmactionIDsFromText(ids, o.Message)
	}
	return ids
}

// CollectMmactionIDsFromText returns action ids from mmaction:// links in a string.
func CollectMmactionIDsFromText(text string) map[string]struct{} {
	return appendMmactionIDsFromText(nil, text)
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
// When props is nil, a new map is allocated and returned.
func ApplyMmBlocksWithActionsToProps(props map[string]any, blocks []any, allActions any) StringInterface {
	if props == nil {
		props = make(map[string]any)
	}
	props[PostPropsMmBlocks] = blocks
	RefreshInteractiveActionsOnPost(&Post{Props: props}, allActions)
	return props
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
