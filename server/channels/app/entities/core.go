// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	coreTimeTypeID         = "mm.time"
	coreTimeRFC3339ID      = "mm.time.rfc3339"
	coreTimeClockZoneID    = "mm.time.clock_zone"
	coreTimeRFC3339Pattern = `[0-9]{4}-[0-9]{2}-[0-9]{2}[Tt][0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?(?:[Zz]|[+-][0-9]{2}:[0-9]{2})`
	// Clock + required zone keeps bare times and issue ids from matching.
	// Accepts 16:30 CET, 16.30 CET, 4:30pm CET, 4.30 p.m. CET, 4pm CET.
	coreTimeClockZonePattern = `(?i)(?:(?:[01]?\d|2[0-3])[:.][0-5]\d(?::[0-5]\d)?(?:\s*[ap]\.?m\.?)?|(?:0?[1-9]|1[0-2])(?:[:.][0-5]\d)?\s*[ap]\.?m\.?)\s*(?:UTC|GMT|Z|CET|CEST|EET|EEST|WET|WEST|BST|EST|EDT|CST|CDT|MST|MDT|PST|PDT|AKST|AKDT|HST|IST|JST|KST|AEST|AEDT|ACST|ACDT|AWST|NZST|NZDT)`
)

// Fixed offsets for the abbreviations we recognize. The abbreviation itself
// encodes daylight-saving (CET vs CEST), so we do not need a geo zone database.
var coreTimeZoneOffsets = map[string]int{
	"UTC": 0, "GMT": 0, "Z": 0,
	"CET": 3600, "CEST": 7200,
	"EET": 7200, "EEST": 10800,
	"WET": 0, "WEST": 3600, "BST": 3600,
	"EST": -5 * 3600, "EDT": -4 * 3600,
	"CST": -6 * 3600, "CDT": -5 * 3600,
	"MST": -7 * 3600, "MDT": -6 * 3600,
	"PST": -8 * 3600, "PDT": -7 * 3600,
	"AKST": -9 * 3600, "AKDT": -8 * 3600,
	"HST": -10 * 3600,
	"IST": 5*3600 + 30*60,
	"JST": 9 * 3600, "KST": 9 * 3600,
	"AEST": 10 * 3600, "AEDT": 11 * 3600,
	"ACST": 9*3600 + 30*60, "ACDT": 10*3600 + 30*60,
	"AWST": 8 * 3600,
	"NZST": 12 * 3600, "NZDT": 13 * 3600,
}

var (
	coreTimeClockZoneRE = regexp.MustCompile(`(?i)^(\d{1,2})(?:[:.](\d{2}))?(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*([A-Za-z]{1,5})$`)
	coreTimeHourPMRE    = regexp.MustCompile(`(?i)^(\d{1,2})\s*([ap]\.?m\.?)\s*([A-Za-z]{1,5})$`)
)

func init() {
	ensureCore()
}

func ensureCore() {
	reg.mu.Lock()
	defer reg.mu.Unlock()
	reg.types[coreTimeTypeID] = entityType{
		id:          coreTimeTypeID,
		displayName: "Time",
		owner:       coreOwner,
	}
	ensureCoreMatcher(coreTimeRFC3339ID, coreTimeRFC3339Pattern)
	ensureCoreMatcher(coreTimeClockZoneID, coreTimeClockZonePattern)
	reg.matcherIndex = map[string]int{}
	for i, stored := range reg.matchers {
		reg.matcherIndex[stored.id] = i
	}
	reg.rememberGeneration()
}

func ensureCoreMatcher(id, pattern string) {
	for _, stored := range reg.matchers {
		if stored.id == id {
			return
		}
	}
	reg.matchers = append(reg.matchers, storedMatcher{
		owner: coreOwner,
		matcher: matcher{
			id:          id,
			typeID:      coreTimeTypeID,
			pattern:     regexp.MustCompile(pattern),
			boundary:    "token",
			pluginID:    coreOwner,
			displayName: "Time",
		},
	})
}

// CoreLookup describes a value using a built-in type.
func CoreLookup(_ context.Context, typeID, value string) (*model.EntityCard, error) {
	switch typeID {
	case coreTimeTypeID:
		return coreTimeCard(value)
	default:
		return nil, fmt.Errorf("unsupported entity")
	}
}

func coreTimeCard(value string) (*model.EntityCard, error) {
	parsed, err := parseCoreTime(value)
	if err != nil {
		return nil, err
	}
	utc := parsed.UTC()
	blocks, err := json.Marshal([]map[string]any{
		{
			"type": "text",
			"text": fmt.Sprintf("**UTC:** %s", utc.Format("15:04 MST")),
		},
		{
			"type":      "text",
			"text":      fmt.Sprintf("As written: %s", value),
			"is_subtle": true,
		},
	})
	if err != nil {
		return nil, err
	}
	return &model.EntityCard{
		TypeID:  coreTimeTypeID,
		Value:   value,
		Title:   "Timestamp",
		Instant: utc.UnixMilli(),
		Blocks:  blocks,
	}, nil
}

func parseCoreTime(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, fmt.Errorf("unsupported entity")
	}
	normalized := strings.ToUpper(value)
	if parsed, err := time.Parse(time.RFC3339Nano, normalized); err == nil {
		return parsed, nil
	}
	if parsed, err := time.Parse(time.RFC3339, normalized); err == nil {
		return parsed, nil
	}
	if parsed, err := parseCoreTimeClockZone(value); err == nil {
		return parsed, nil
	}
	return time.Time{}, fmt.Errorf("unsupported entity")
}

func parseCoreTimeClockZone(value string) (time.Time, error) {
	compact := collapseSpaces(value)
	if m := coreTimeClockZoneRE.FindStringSubmatch(compact); m != nil {
		hour, err := strconv.Atoi(m[1])
		if err != nil {
			return time.Time{}, fmt.Errorf("unsupported entity")
		}
		minute := 0
		if m[2] != "" {
			minute, err = strconv.Atoi(m[2])
			if err != nil {
				return time.Time{}, fmt.Errorf("unsupported entity")
			}
		}
		second := 0
		if m[3] != "" {
			second, err = strconv.Atoi(m[3])
			if err != nil {
				return time.Time{}, fmt.Errorf("unsupported entity")
			}
		}
		meridiem := m[4]
		zone := strings.ToUpper(m[5])
		if meridiem == "" && m[2] == "" {
			return time.Time{}, fmt.Errorf("unsupported entity")
		}
		hour, err = applyMeridiem(hour, meridiem)
		if err != nil {
			return time.Time{}, err
		}
		return clockInZone(hour, minute, second, zone)
	}
	if m := coreTimeHourPMRE.FindStringSubmatch(compact); m != nil {
		hour, err := strconv.Atoi(m[1])
		if err != nil {
			return time.Time{}, fmt.Errorf("unsupported entity")
		}
		hour, err = applyMeridiem(hour, m[2])
		if err != nil {
			return time.Time{}, err
		}
		return clockInZone(hour, 0, 0, strings.ToUpper(m[3]))
	}
	return time.Time{}, fmt.Errorf("unsupported entity")
}

func collapseSpaces(value string) string {
	var b strings.Builder
	b.Grow(len(value))
	prevSpace := false
	for _, r := range value {
		if unicode.IsSpace(r) {
			if !prevSpace {
				b.WriteByte(' ')
				prevSpace = true
			}
			continue
		}
		prevSpace = false
		b.WriteRune(r)
	}
	return strings.TrimSpace(b.String())
}

func applyMeridiem(hour int, meridiem string) (int, error) {
	meridiem = strings.ToLower(strings.ReplaceAll(meridiem, ".", ""))
	switch meridiem {
	case "":
		if hour < 0 || hour > 23 {
			return 0, fmt.Errorf("unsupported entity")
		}
		return hour, nil
	case "am":
		if hour < 1 || hour > 12 {
			return 0, fmt.Errorf("unsupported entity")
		}
		if hour == 12 {
			return 0, nil
		}
		return hour, nil
	case "pm":
		if hour < 1 || hour > 12 {
			return 0, fmt.Errorf("unsupported entity")
		}
		if hour == 12 {
			return 12, nil
		}
		return hour + 12, nil
	default:
		return 0, fmt.Errorf("unsupported entity")
	}
}

func clockInZone(hour, minute, second int, zone string) (time.Time, error) {
	if minute < 0 || minute > 59 || second < 0 || second > 59 {
		return time.Time{}, fmt.Errorf("unsupported entity")
	}
	offset, ok := coreTimeZoneOffsets[zone]
	if !ok {
		return time.Time{}, fmt.Errorf("unsupported entity")
	}
	loc := time.FixedZone(zone, offset)
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), hour, minute, second, 0, loc), nil
}
