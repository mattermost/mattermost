// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"maps"
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
	if len(raw) > entityCardMaxBlockBytes || !json.Valid(raw) {
		return nil
	}
	var blocks []any
	if err := json.Unmarshal(raw, &blocks); err != nil {
		return nil
	}
	cleaned := sanitizeEntityBlocks(blocks, 0)
	if len(cleaned) == 0 {
		return nil
	}
	if len(cleaned) > entityCardMaxBlocks {
		cleaned = cleaned[:entityCardMaxBlocks]
	}
	out, err := json.Marshal(cleaned)
	if err != nil || len(out) > entityCardMaxBlockBytes {
		return nil
	}
	return out
}

func sanitizeEntityBlocks(blocks []any, depth int) []any {
	if depth > 32 {
		return nil
	}
	out := make([]any, 0, len(blocks))
	for _, raw := range blocks {
		block, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		typ, _ := block["type"].(string)
		switch typ {
		case "button", "static_select":
			continue
		case "text", "image", "divider":
			out = append(out, block)
		case "container", "collapsible":
			next := copyEntityBlock(block)
			if content, ok := block["content"].([]any); ok {
				next["content"] = sanitizeEntityBlocks(content, depth+1)
			}
			if header, ok := block["header"].([]any); ok {
				next["header"] = sanitizeEntityBlocks(header, depth+1)
			}
			out = append(out, next)
		case "column_set":
			next := copyEntityBlock(block)
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
				colNext := copyEntityBlock(col)
				colNext["type"] = "column"
				if items, ok := col["items"].([]any); ok {
					colNext["items"] = sanitizeEntityBlocks(items, depth+1)
				}
				cleanedCols = append(cleanedCols, colNext)
			}
			next["columns"] = cleanedCols
			out = append(out, next)
		case "column":
			next := copyEntityBlock(block)
			if items, ok := block["items"].([]any); ok {
				next["items"] = sanitizeEntityBlocks(items, depth+1)
			}
			out = append(out, next)
		}
	}
	return out
}

func copyEntityBlock(block map[string]any) map[string]any {
	next := make(map[string]any, len(block))
	maps.Copy(next, block)
	return next
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
	Label string `json:"label"`
	Value string `json:"value"`
}

type EntityCardMetric struct {
	Metric string `json:"metric"`
	Value  string `json:"value"`
	Severe bool   `json:"severe,omitempty"`
}

type EntityCardLink struct {
	Label  string `json:"label"`
	Text   string `json:"text,omitempty"`
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
