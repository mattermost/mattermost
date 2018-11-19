// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"io/ioutil"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPostToJson(t *testing.T) {
	o := Post{Id: NewId(), Message: NewId()}
	j := o.ToJson()
	ro := PostFromJson(strings.NewReader(j))

	assert.NotNil(t, ro)
	assert.Equal(t, o, *ro)
}

func TestPostFromJsonError(t *testing.T) {
	ro := PostFromJson(strings.NewReader(""))
	assert.Nil(t, ro)
}

func TestPostIsValid(t *testing.T) {
	o := Post{}
	maxPostSize := 10000

	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.Id = NewId()
	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.CreateAt = GetMillis()
	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.UpdateAt = GetMillis()
	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.UserId = NewId()
	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.ChannelId = NewId()
	o.RootId = "123"
	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.RootId = ""
	o.ParentId = "123"
	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.ParentId = NewId()
	o.RootId = ""
	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.ParentId = ""
	o.Message = strings.Repeat("0", maxPostSize+1)
	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.Message = strings.Repeat("0", maxPostSize)
	if err := o.IsValid(maxPostSize); err != nil {
		t.Fatal(err)
	}

	o.Message = "test"
	if err := o.IsValid(maxPostSize); err != nil {
		t.Fatal(err)
	}

	o.Type = "junk"
	if err := o.IsValid(maxPostSize); err == nil {
		t.Fatal("should be invalid")
	}

	o.Type = POST_CUSTOM_TYPE_PREFIX + "type"
	if err := o.IsValid(maxPostSize); err != nil {
		t.Fatal(err)
	}
}

func TestPostPreSave(t *testing.T) {
	o := Post{Message: "test"}
	o.PreSave()

	if o.CreateAt == 0 {
		t.Fatal("should be set")
	}

	past := GetMillis() - 1
	o = Post{Message: "test", CreateAt: past}
	o.PreSave()

	if o.CreateAt > past {
		t.Fatal("should not be updated")
	}

	o.Etag()
}

func TestPostIsSystemMessage(t *testing.T) {
	post1 := Post{Message: "test_1"}
	post1.PreSave()

	if post1.IsSystemMessage() {
		t.Fatalf("TestPostIsSystemMessage failed, expected post1.IsSystemMessage() to be false")
	}

	post2 := Post{Message: "test_2", Type: POST_JOIN_LEAVE}
	post2.PreSave()
	if !post2.IsSystemMessage() {
		t.Fatalf("TestPostIsSystemMessage failed, expected post2.IsSystemMessage() to be true")
	}
}

func TestPostChannelMentions(t *testing.T) {
	post := Post{Message: "~a ~b ~b ~c/~d."}
	assert.Equal(t, []string{"a", "b", "c", "d"}, post.ChannelMentions())
}

func TestPostSanitizeProps(t *testing.T) {
	post1 := &Post{
		Message: "test",
	}

	post1.SanitizeProps()

	if post1.Props[PROPS_ADD_CHANNEL_MEMBER] != nil {
		t.Fatal("should be nil")
	}

	post2 := &Post{
		Message: "test",
		Props: StringInterface{
			PROPS_ADD_CHANNEL_MEMBER: "test",
		},
	}

	post2.SanitizeProps()

	if post2.Props[PROPS_ADD_CHANNEL_MEMBER] != nil {
		t.Fatal("should be nil")
	}

	post3 := &Post{
		Message: "test",
		Props: StringInterface{
			PROPS_ADD_CHANNEL_MEMBER: "no good",
			"attachments":            "good",
		},
	}

	post3.SanitizeProps()

	if post3.Props[PROPS_ADD_CHANNEL_MEMBER] != nil {
		t.Fatal("should be nil")
	}

	if post3.Props["attachments"] == nil {
		t.Fatal("should not be nil")
	}
}

var markdownSample, markdownSampleWithRewrittenImageURLs string

func init() {
	bytes, err := ioutil.ReadFile("testdata/markdown-sample.md")
	if err != nil {
		panic(err)
	}
	markdownSample = string(bytes)

	bytes, err = ioutil.ReadFile("testdata/markdown-sample-with-rewritten-image-urls.md")
	if err != nil {
		panic(err)
	}
	markdownSampleWithRewrittenImageURLs = string(bytes)
}

func TestRewriteImageURLs(t *testing.T) {
	for name, tc := range map[string]struct {
		Markdown string
		Expected string
	}{
		"Empty": {
			Markdown: ``,
			Expected: ``,
		},
		"NoImages": {
			Markdown: `foo`,
			Expected: `foo`,
		},
		"Link": {
			Markdown: `[foo](/url)`,
			Expected: `[foo](/url)`,
		},
		"Image": {
			Markdown: `![foo](/url)`,
			Expected: `![foo](rewritten:/url)`,
		},
		"SpacedURL": {
			Markdown: `![foo]( /url )`,
			Expected: `![foo]( rewritten:/url )`,
		},
		"Title": {
			Markdown: `![foo](/url "title")`,
			Expected: `![foo](rewritten:/url "title")`,
		},
		"Parentheses": {
			Markdown: `![foo](/url(1) "title")`,
			Expected: `![foo](rewritten:/url\(1\) "title")`,
		},
		"AngleBrackets": {
			Markdown: `![foo](</url\<1\>\\> "title")`,
			Expected: `![foo](<rewritten:/url\<1\>\\> "title")`,
		},
		"MultipleLines": {
			Markdown: `![foo](
				</url\<1\>\\>
				"title"
			)`,
			Expected: `![foo](
				<rewritten:/url\<1\>\\>
				"title"
			)`,
		},
		"ReferenceLink": {
			Markdown: `[foo]: </url\<1\>\\> "title"
		 		[foo]`,
			Expected: `[foo]: </url\<1\>\\> "title"
		 		[foo]`,
		},
		"ReferenceImage": {
			Markdown: `[foo]: </url\<1\>\\> "title"
		 		![foo]`,
			Expected: `[foo]: <rewritten:/url\<1\>\\> "title"
		 		![foo]`,
		},
		"MultipleReferenceImages": {
			Markdown: `[foo]: </url1> "title"
				[bar]: </url2>
				[baz]: /url3 "title"
				[qux]: /url4
				![foo]![qux]`,
			Expected: `[foo]: <rewritten:/url1> "title"
				[bar]: </url2>
				[baz]: /url3 "title"
				[qux]: rewritten:/url4
				![foo]![qux]`,
		},
		"DuplicateReferences": {
			Markdown: `[foo]: </url1> "title"
				[foo]: </url2>
				[foo]: /url3 "title"
				[foo]: /url4
				![foo]![foo]![foo]`,
			Expected: `[foo]: <rewritten:/url1> "title"
				[foo]: </url2>
				[foo]: /url3 "title"
				[foo]: /url4
				![foo]![foo]![foo]`,
		},
		"TrailingURL": {
			Markdown: "![foo]\n\n[foo]: /url",
			Expected: "![foo]\n\n[foo]: rewritten:/url",
		},
		"Sample": {
			Markdown: markdownSample,
			Expected: markdownSampleWithRewrittenImageURLs,
		},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.Expected, RewriteImageURLs(tc.Markdown, func(url string) string {
				return "rewritten:" + url
			}))
		})
	}
}

var rewriteImageURLsSink string

func BenchmarkRewriteImageURLs(b *testing.B) {
	for i := 0; i < b.N; i++ {
		rewriteImageURLsSink = RewriteImageURLs(markdownSample, func(url string) string {
			return "rewritten:" + url
		})
	}
}
