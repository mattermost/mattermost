// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "testing"

func TestNormalizeEntityCardCapsTheDrawing(t *testing.T) {
	card := &EntityCard{Map: &EntityCardMap{
		Kind: "point",
		Points: []EntityCardPin{
			{Lat: 21.3, Lon: -157.9},
			{Lat: 1, Lon: 2},
			{Lat: 99, Lon: 0},
		},
		GeoJSON: []byte(`not json`),
	}}
	NormalizeEntityCard(card)
	if card.Map == nil || len(card.Map.Points) != 1 || card.Map.Points[0].Lat != 21.3 || len(card.Map.GeoJSON) != 0 {
		t.Fatalf("point map = %#v", card.Map)
	}

	runway := &EntityCard{Map: &EntityCardMap{Kind: "runway", Points: []EntityCardPin{{Lat: 1, Lon: 2}, {Lat: 3, Lon: 4}, {Lat: 5, Lon: 6}}}}
	NormalizeEntityCard(runway)
	if runway.Map == nil || len(runway.Map.Points) != 2 {
		t.Fatalf("runway map = %#v", runway.Map)
	}

	unknown := &EntityCard{Map: &EntityCardMap{Kind: "route", Points: []EntityCardPin{{Lat: 1, Lon: 2}}}}
	NormalizeEntityCard(unknown)
	if unknown.Map != nil {
		t.Fatalf("unknown kind kept %#v", unknown.Map)
	}
}

func TestNormalizeEntityCardDropsUnsafeURLs(t *testing.T) {
	card := &EntityCard{
		URL: "javascript:alert(1)",
		Related: []EntityCardLink{{
			Label: "keep",
			URL:   "https://attack.mitre.org/techniques/T1059/001/",
		}, {
			Label: "drop",
			URL:   "data:text/html,hi",
		}},
		Sections: []EntityCardSection{{
			Title: "Notes",
			URL:   "/plugins/com.example/page",
			Items: []EntityCardItem{{URL: "javascript:alert(1)"}, {URL: "http://example.com/a"}},
		}},
	}
	NormalizeEntityCard(card)
	if card.URL != "" || card.Related[0].URL == "" || card.Related[1].URL != "" || card.Sections[0].URL == "" || card.Sections[0].Items[0].URL != "" || card.Sections[0].Items[1].URL == "" {
		t.Fatalf("card urls = %#v", card)
	}
}
