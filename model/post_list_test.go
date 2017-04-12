// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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

func TestPostListExtend(t *testing.T) {
	l1 := PostList{}

	p1 := &Post{Id: NewId(), Message: NewId()}
	l1.AddPost(p1)
	l1.AddOrder(p1.Id)

	p2 := &Post{Id: NewId(), Message: NewId()}
	l1.AddPost(p2)
	l1.AddOrder(p2.Id)

	l2 := PostList{}

	p3 := &Post{Id: NewId(), Message: NewId()}
	l2.AddPost(p3)
	l2.AddOrder(p3.Id)

	l2.Extend(&l1)

	if len(l1.Posts) != 2 || len(l1.Order) != 2 {
		t.Fatal("extending l2 changed l1")
	} else if len(l2.Posts) != 3 {
		t.Fatal("failed to extend posts l2")
	} else if l2.Order[0] != p3.Id || l2.Order[1] != p1.Id || l2.Order[2] != p2.Id {
		t.Fatal("failed to extend order of l2")
	}

	if len(l1.Posts) != 2 || len(l1.Order) != 2 {
		t.Fatal("extending l2 again changed l1")
	} else if len(l2.Posts) != 3 || len(l2.Order) != 3 {
		t.Fatal("extending l2 again changed l2")
	}
}
