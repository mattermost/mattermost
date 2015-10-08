// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestPostListJson(t *testing.T) {

	pl := PostList{}
	p1 := &Post{Id: NewId(), Message: NewId()}
	pl.AddPost(p1)
	p2 := &Post{Id: NewId(), Message: NewId()}
	pl.AddPost(p2)

	pl.AddOrder(p1.Id)
	pl.AddOrder(p2.Id)

	json := pl.ToJson()
	rpl := PostListFromJson(strings.NewReader(json))

	if rpl.Posts[p1.Id].Message != p1.Message {
		t.Fatal("failed to serialize")
	}

	if rpl.Posts[p2.Id].Message != p2.Message {
		t.Fatal("failed to serialize")
	}

	if rpl.Order[1] != p2.Id {
		t.Fatal("failed to serialize")
	}
}
