// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWikiLinkIsValid(t *testing.T) {
	src := NewId()
	dst := NewId()

	cases := []struct {
		name    string
		link    WikiLink
		wantErr string
	}{
		{
			name:    "valid with creator",
			link:    WikiLink{SourceId: src, DestinationId: dst, CreatorId: NewId()},
			wantErr: "",
		},
		{
			name:    "valid without creator",
			link:    WikiLink{SourceId: src, DestinationId: dst},
			wantErr: "",
		},
		{
			name:    "invalid source id",
			link:    WikiLink{SourceId: "not-an-id", DestinationId: dst},
			wantErr: "model.wiki_link.is_valid.source_id.app_error",
		},
		{
			name:    "empty source id",
			link:    WikiLink{SourceId: "", DestinationId: dst},
			wantErr: "model.wiki_link.is_valid.source_id.app_error",
		},
		{
			name:    "invalid destination id",
			link:    WikiLink{SourceId: src, DestinationId: "bad"},
			wantErr: "model.wiki_link.is_valid.destination_id.app_error",
		},
		{
			name:    "invalid creator id",
			link:    WikiLink{SourceId: src, DestinationId: dst, CreatorId: "bad"},
			wantErr: "model.wiki_link.is_valid.creator_id.app_error",
		},
		{
			name:    "self link rejected",
			link:    WikiLink{SourceId: src, DestinationId: src},
			wantErr: "model.wiki_link.is_valid.self_link.app_error",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.link.IsValid()
			if tc.wantErr == "" {
				assert.Nil(t, err)
				return
			}
			require.NotNil(t, err)
			assert.Equal(t, tc.wantErr, err.Id)
		})
	}
}

func TestWikiLinkPreSave(t *testing.T) {
	l := &WikiLink{SourceId: NewId(), DestinationId: NewId()}
	l.PreSave()
	assert.NotZero(t, l.CreateAt)

	existing := GetMillis() - 1000
	l2 := &WikiLink{SourceId: NewId(), DestinationId: NewId(), CreateAt: existing}
	l2.PreSave()
	assert.Equal(t, existing, l2.CreateAt, "PreSave should not overwrite non-zero CreateAt")
}

func TestWikiLinkAuditable(t *testing.T) {
	l := &WikiLink{
		SourceId:      "src",
		DestinationId: "dst",
		CreateAt:      42,
		CreatorId:     "creator",
	}
	m := l.Auditable()
	assert.Equal(t, "src", m["source_id"])
	assert.Equal(t, "dst", m["destination_id"])
	assert.Equal(t, int64(42), m["create_at"])
	assert.Equal(t, "creator", m["creator_id"])
}
