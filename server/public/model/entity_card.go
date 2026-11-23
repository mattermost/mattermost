// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// EntityCard is the read-time detail for one entity. Pattern detection stays
// on the post. This is filled when a reader opens the entity.
type EntityCard struct {
	TypeID    string              `json:"type_id"`
	Value     string              `json:"value"`
	Title     string              `json:"title"`
	Summary   string              `json:"summary,omitempty"`
	Score     string              `json:"score,omitempty"`
	Severity  string              `json:"severity,omitempty"`
	Exploited bool                `json:"exploited,omitempty"`
	Rows      []EntityCardRow     `json:"rows,omitempty"`
	Vector    []EntityCardMetric  `json:"vector,omitempty"`
	Related   []EntityCardLink    `json:"related,omitempty"`
	Sections  []EntityCardSection `json:"sections,omitempty"`
	// Blocks is an optional Mattermost Blocks body (render-only). When set, the
	// client prefers it over Summary, Rows, Vector, and Sections. Title, value,
	// severity, Related, Map, and Instant stay outside the block tree.
	Blocks  json.RawMessage `json:"blocks,omitempty"`
	URL     string          `json:"url,omitempty"`
	Map     *EntityCardMap  `json:"map,omitempty"`
	Instant int64           `json:"instant,omitempty"`
}

// EntityCardFallbackSummary is the legacy English placeholder some clients may
// still receive. It does not count as card body.
const EntityCardFallbackSummary = "No additional information"

// EntityCardHasBody reports whether a card has something to show besides its title and URL.
func EntityCardHasBody(card *EntityCard) bool {
	if card == nil {
		return false
	}
	if card.Summary != "" && card.Summary != EntityCardFallbackSummary {
		return true
	}
	if card.Score != "" || card.Severity != "" || card.Exploited {
		return true
	}
	if len(card.Rows) > 0 || len(card.Vector) > 0 || len(card.Related) > 0 || len(card.Sections) > 0 {
		return true
	}
	if len(card.Blocks) > 0 && string(card.Blocks) != "null" && string(card.Blocks) != "[]" {
		return true
	}
	return card.Map != nil && (len(card.Map.Points) > 0 || len(card.Map.GeoJSON) > 0)
}

const (
	entityMapMaxPoints  = 64
	entityMapMaxGeoJSON = 32 * 1024
)

// NormalizeEntityCard caps a map a plugin returned and drops URLs that are not https, http, or a root-relative path.
// When Blocks is empty, Summary/Rows/Vector/Sections are migrated into Blocks (legacy fields are kept for one cycle).
func NormalizeEntityCard(card *EntityCard) {
	if card == nil {
		return
	}
	card.URL = entityCardURL(card.URL)
	for i := range card.Related {
		card.Related[i].URL = entityCardURL(card.Related[i].URL)
	}
	for i := range card.Sections {
		card.Sections[i].URL = entityCardURL(card.Sections[i].URL)
		for j := range card.Sections[i].Items {
			card.Sections[i].Items[j].URL = entityCardURL(card.Sections[i].Items[j].URL)
		}
	}
	if card.Map != nil {
		card.Map = normalizeEntityCardMap(card.Map)
	}
	card.Blocks = normalizeEntityCardBlocks(card.Blocks)
	if len(card.Blocks) == 0 {
		if migrated := migrateEntityCardBodyToBlocks(card); len(migrated) > 0 {
			card.Blocks = normalizeEntityCardBlocks(migrated)
		}
	}
}

func entityCardURL(raw string) string {
	if raw == "" || strings.ContainsAny(raw, " \t\r\n\\") {
		return ""
	}
	if strings.HasPrefix(raw, "/") && !strings.HasPrefix(raw, "//") && !strings.Contains(raw, "..") {
		return raw
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return ""
	}
	return raw
}

func normalizeEntityCardMap(drawing *EntityCardMap) *EntityCardMap {
	switch drawing.Kind {
	case "point", "cell", "runway":
	default:
		return nil
	}
	limit := entityMapMaxPoints
	switch drawing.Kind {
	case "point":
		limit = 1
	case "runway":
		limit = 2
	}
	points := make([]EntityCardPin, 0, len(drawing.Points))
	for _, point := range drawing.Points {
		if len(points) >= limit {
			break
		}
		if point.Lat != point.Lat || point.Lon != point.Lon || point.Lat < -90 || point.Lat > 90 || point.Lon < -180 || point.Lon > 180 {
			continue
		}
		points = append(points, point)
	}
	var geo json.RawMessage
	if len(drawing.GeoJSON) > 0 && len(drawing.GeoJSON) <= entityMapMaxGeoJSON && json.Valid(drawing.GeoJSON) {
		geo = drawing.GeoJSON
	}
	if len(points) == 0 && len(geo) == 0 {
		return nil
	}
	return &EntityCardMap{Kind: drawing.Kind, Points: points, GeoJSON: geo}
}

const (
	entityCardMaxBlocks     = 100
	entityCardMaxBlockBytes = 32 * 1024
)

func normalizeEntityCardBlocks(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	if !json.Valid(raw) {
		return nil
	}
	var blocks []any
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return nil
	}
	budget := entityCardMaxBlocks
	cleaned := sanitizeEntityBlocks(blocks, 0, &budget)
	if len(cleaned) == 0 {
		return nil
	}
	return marshalEntityBlocksWithinCap(cleaned)
}

func marshalEntityBlocksWithinCap(blocks []any) json.RawMessage {
	for len(blocks) > 0 {
		out, err := json.Marshal(blocks)
		if err != nil {
			return nil
		}
		if len(out) <= entityCardMaxBlockBytes {
			return out
		}
		blocks = blocks[:len(blocks)-1]
	}
	return nil
}

func sanitizeEntityBlocks(blocks []any, depth int, budget *int) []any {
	if depth > 32 || budget == nil || *budget <= 0 {
		return nil
	}
	out := make([]any, 0, len(blocks))
	for _, raw := range blocks {
		if *budget <= 0 {
			break
		}
		block, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		typ, _ := block["type"].(string)
		switch typ {
		case "button", "static_select":
			continue
		case "text":
			text, _ := block["text"].(string)
			if text == "" {
				continue
			}
			*budget--
			out = append(out, map[string]any{
				"type": "text",
				"text": text,
			})
			if subtle, ok := block["is_subtle"].(bool); ok && subtle {
				out[len(out)-1].(map[string]any)["is_subtle"] = true
			}
			if size, ok := block["size"].(string); ok && (size == "small" || size == "default") {
				out[len(out)-1].(map[string]any)["size"] = size
			}
		case "divider":
			*budget--
			out = append(out, map[string]any{"type": "divider"})
		case "image":
			url, _ := block["url"].(string)
			alt, _ := block["alt_text"].(string)
			if url == "" || alt == "" {
				continue
			}
			*budget--
			next := map[string]any{"type": "image", "url": url, "alt_text": alt}
			if title, ok := block["title"].(string); ok && title != "" {
				next["title"] = title
			}
			out = append(out, next)
		case "fields":
			if next := sanitizeEntityFieldsBlock(block, budget); next != nil {
				out = append(out, next)
			}
		case "container", "collapsible":
			if *budget <= 0 {
				break
			}
			*budget--
			next := map[string]any{"type": typ}
			if content, ok := block["content"].([]any); ok {
				next["content"] = sanitizeEntityBlocks(content, depth+1, budget)
			}
			if header, ok := block["header"].([]any); ok {
				next["header"] = sanitizeEntityBlocks(header, depth+1, budget)
			}
			if typ == "collapsible" {
				header, _ := next["header"].([]any)
				content, _ := next["content"].([]any)
				if len(header) == 0 || len(content) == 0 {
					continue
				}
				if collapsed, ok := block["collapsed"].(bool); ok {
					next["collapsed"] = collapsed
				}
			} else {
				content, _ := next["content"].([]any)
				if len(content) == 0 {
					continue
				}
				copyEntityBlockLayout(block, next)
			}
			out = append(out, next)
		case "column_set":
			if *budget <= 0 {
				break
			}
			*budget--
			next := map[string]any{"type": "column_set"}
			cols, _ := block["columns"].([]any)
			cleanedCols := make([]any, 0, len(cols))
			for _, colRaw := range cols {
				col, ok := colRaw.(map[string]any)
				if !ok {
					continue
				}
				if colType, _ := col["type"].(string); colType != "" && colType != "column" {
					continue
				}
				if *budget <= 0 {
					break
				}
				*budget--
				colNext := map[string]any{"type": "column"}
				if items, ok := col["items"].([]any); ok {
					colNext["items"] = sanitizeEntityBlocks(items, depth+1, budget)
				}
				items, _ := colNext["items"].([]any)
				if len(items) == 0 {
					continue
				}
				if width, ok := col["width"].(string); ok && (width == "auto" || width == "stretch") {
					colNext["width"] = width
				}
				cleanedCols = append(cleanedCols, colNext)
			}
			if len(cleanedCols) == 0 {
				continue
			}
			next["columns"] = cleanedCols
			out = append(out, next)
		case "column":
			if *budget <= 0 {
				break
			}
			*budget--
			next := map[string]any{"type": "column"}
			if items, ok := block["items"].([]any); ok {
				next["items"] = sanitizeEntityBlocks(items, depth+1, budget)
			}
			items, _ := next["items"].([]any)
			if len(items) == 0 {
				continue
			}
			out = append(out, next)
		}
	}
	return out
}

func sanitizeEntityFieldsBlock(block map[string]any, budget *int) map[string]any {
	if budget == nil || *budget <= 0 {
		return nil
	}
	rawFields, ok := block["fields"].([]any)
	if !ok {
		return nil
	}
	*budget--
	fields := make([]any, 0, len(rawFields))
	for _, raw := range rawFields {
		if *budget <= 0 {
			break
		}
		fm, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		label, _ := fm["label"].(string)
		value, _ := fm["value"].(string)
		if label == "" && value == "" {
			continue
		}
		*budget--
		field := map[string]any{"label": label, "value": value}
		if short, ok := fm["short"].(bool); ok && short {
			field["short"] = true
		}
		if url, ok := fm["url"].(string); ok {
			if cleaned := entityCardURL(url); cleaned != "" {
				field["url"] = cleaned
			}
		}
		if typeID, ok := fm["type_id"].(string); ok && typeID != "" {
			field["type_id"] = typeID
		}
		if tone, ok := fm["tone"].(string); ok && mmFieldToneOK(tone) {
			field["tone"] = tone
		}
		fields = append(fields, field)
	}
	if len(fields) == 0 {
		return nil
	}
	return map[string]any{"type": "fields", "fields": fields}
}

func copyEntityBlockLayout(src, dst map[string]any) {
	if border, ok := src["border"].(bool); ok && border {
		dst["border"] = true
	}
	if accent, ok := src["accent_color"].(string); ok && accent != "" {
		dst["accent_color"] = accent
	}
	if flow, ok := src["flow"].(string); ok && (flow == "horizontal" || flow == "vertical") {
		dst["flow"] = flow
	}
	if gap, ok := src["gap"].(string); ok && gap != "" {
		dst["gap"] = gap
	}
	if background, ok := src["background"].(string); ok && background != "" {
		dst["background"] = background
	}
}

func migrateEntityCardBodyToBlocks(card *EntityCard) json.RawMessage {
	if card == nil {
		return nil
	}
	var parts []json.RawMessage
	if card.Summary != "" && card.Summary != EntityCardFallbackSummary {
		if text, err := MarshalMmTextBlock(card.Summary, false); err == nil && text != nil {
			parts = append(parts, text)
		}
	}
	if len(card.Rows) > 0 {
		fields := make([]MmField, 0, len(card.Rows))
		for _, row := range card.Rows {
			fields = append(fields, MmField{Label: row.Label, Value: row.Value, TypeID: row.TypeID, Short: row.Short})
		}
		if block, err := MarshalMmFieldsBlock(fields); err == nil && block != nil {
			parts = append(parts, block)
		}
	}
	if len(card.Vector) > 0 {
		fields := make([]MmField, 0, len(card.Vector))
		for _, metric := range card.Vector {
			tone := ""
			if metric.Severe {
				tone = MmFieldToneDanger
			} else {
				tone = MmFieldToneFromQualitative(metric.Value)
			}
			fields = append(fields, MmField{Label: metric.Metric, Value: metric.Value, Short: true, Tone: tone})
		}
		if block, err := MarshalMmFieldsBlock(fields); err == nil && block != nil {
			parts = append(parts, block)
		}
	}
	for _, section := range card.Sections {
		var content []json.RawMessage
		for _, item := range section.Items {
			line := sectionItemMarkdown(item)
			if line == "" {
				continue
			}
			if text, err := MarshalMmTextBlock(line, false); err == nil && text != nil {
				content = append(content, text)
			}
		}
		if len(content) == 0 && section.URL != "" {
			if text, err := MarshalMmTextBlock(fmt.Sprintf("[Open the full list](%s)", section.URL), false); err == nil && text != nil {
				content = append(content, text)
			}
		}
		header := section.Title
		if section.Count > 0 {
			header = fmt.Sprintf("%s (%d)", section.Title, section.Count)
		}
		if block, err := MarshalMmCollapsibleBlock(header, content, true); err == nil && block != nil {
			parts = append(parts, block)
		}
	}
	out, err := MarshalMmBlocks(parts...)
	if err != nil {
		return nil
	}
	return out
}

func sectionItemMarkdown(item EntityCardItem) string {
	label := item.Head
	if item.URL != "" {
		host := item.URL
		if parsed, err := url.Parse(item.URL); err == nil && parsed.Host != "" {
			host = parsed.Host
		}
		if label != "" {
			label = fmt.Sprintf("[%s — %s](%s)", item.Head, host, item.URL)
		} else {
			label = fmt.Sprintf("[%s](%s)", host, item.URL)
		}
	}
	switch {
	case label != "" && item.Text != "" && item.Text != item.URL:
		return label + "\n" + item.Text
	case label != "":
		return label
	case item.Text != "":
		return item.Text
	default:
		return ""
	}
}

// WalkEntityCardBlocks mutates each fields[].type_id through fn and returns the updated Blocks JSON.
func WalkEntityCardBlocks(raw json.RawMessage, fn func(typeID string) string) json.RawMessage {
	if len(raw) == 0 || fn == nil {
		return raw
	}
	var blocks []any
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return raw
	}
	walkEntityBlocksTypeIDs(blocks, fn)
	out, err := json.Marshal(blocks)
	if err != nil {
		return raw
	}
	return out
}

func walkEntityBlocksTypeIDs(blocks []any, fn func(typeID string) string) {
	for _, raw := range blocks {
		block, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		switch block["type"] {
		case "fields":
			fields, _ := block["fields"].([]any)
			for _, fieldRaw := range fields {
				field, ok := fieldRaw.(map[string]any)
				if !ok {
					continue
				}
				typeID, _ := field["type_id"].(string)
				if typeID == "" {
					continue
				}
				if next := fn(typeID); next == "" {
					delete(field, "type_id")
				} else {
					field["type_id"] = next
				}
			}
		case "container":
			if content, ok := block["content"].([]any); ok {
				walkEntityBlocksTypeIDs(content, fn)
			}
		case "collapsible":
			if header, ok := block["header"].([]any); ok {
				walkEntityBlocksTypeIDs(header, fn)
			}
			if content, ok := block["content"].([]any); ok {
				walkEntityBlocksTypeIDs(content, fn)
			}
		case "column_set":
			cols, _ := block["columns"].([]any)
			for _, colRaw := range cols {
				col, ok := colRaw.(map[string]any)
				if !ok {
					continue
				}
				if items, ok := col["items"].([]any); ok {
					walkEntityBlocksTypeIDs(items, fn)
				}
			}
		case "column":
			if items, ok := block["items"].([]any); ok {
				walkEntityBlocksTypeIDs(items, fn)
			}
		}
	}
}

// EntityCardMap is a drawing for the side panel. Core caps it. The plugin's webapp paints it.
type EntityCardMap struct {
	Kind    string          `json:"kind"`
	Points  []EntityCardPin `json:"points,omitempty"`
	GeoJSON json.RawMessage `json:"geojson,omitempty"`
}

// EntityCardPin is one labeled position. A runway uses two. A cell uses its ring in order.
type EntityCardPin struct {
	Lat   float64 `json:"lat"`
	Lon   float64 `json:"lon"`
	Label string  `json:"label,omitempty"`
}

type EntityCardRow struct {
	Label  string `json:"label"`
	Value  string `json:"value"`
	TypeID string `json:"type_id,omitempty"`
	Short  bool   `json:"short,omitempty"`
}

type EntityCardMetric struct {
	Metric string `json:"metric"`
	Value  string `json:"value"`
	Severe bool   `json:"severe,omitempty"`
}

type EntityCardLink struct {
	Label  string `json:"label"`
	Text   string `json:"text,omitempty"`
	// Value is the hop identity when TypeID is set. Text stays the display label
	// (often id + name). When Value is empty, clients hop on Text.
	Value  string `json:"value,omitempty"`
	URL    string `json:"url,omitempty"`
	TypeID string `json:"type_id,omitempty"`
}

type EntityCardSection struct {
	Title string           `json:"title"`
	Count int              `json:"count"`
	URL   string           `json:"url,omitempty"`
	Items []EntityCardItem `json:"items,omitempty"`
}

type EntityCardItem struct {
	Head string `json:"head,omitempty"`
	Text string `json:"text,omitempty"`
	URL  string `json:"url,omitempty"`
}
