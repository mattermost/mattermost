// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifymentions

import (
	"reflect"
	"testing"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"

	mm_model "github.com/mattermost/mattermost-server/server/v7/model"
)

func Test_extractMentions(t *testing.T) {
	tests := []struct {
		name  string
		block *model.Block
		want  map[string]struct{}
	}{
		{name: "empty", block: makeBlock(""), want: makeMap()},
		{name: "zero mentions", block: makeBlock("This is some text."), want: makeMap()},
		{name: "one mention", block: makeBlock("Hello @user1"), want: makeMap("user1")},
		{name: "multiple mentions", block: makeBlock("Hello @user1, @user2 and @user3"), want: makeMap("user1", "user2", "user3")},
		{name: "include period", block: makeBlock("Hello @user1."), want: makeMap("user1.")},
		{name: "include underscore", block: makeBlock("Hello @user1_"), want: makeMap("user1_")},
		{name: "don't include comma", block: makeBlock("Hello @user1,"), want: makeMap("user1")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := extractMentions(tt.block); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("extractMentions() = %v, want %v", got, tt.want)
			}
		})
	}
}

func makeBlock(text string) *model.Block {
	return &model.Block{
		ID:    mm_model.NewId(),
		Type:  model.TypeComment,
		Title: text,
	}
}

func makeMap(mentions ...string) map[string]struct{} {
	m := make(map[string]struct{})
	for _, mention := range mentions {
		m[mention] = struct{}{}
	}
	return m
}
