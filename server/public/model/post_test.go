// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostToJSON(t *testing.T) {
	o := Post{Id: NewId(), Message: NewId()}
	j, err := o.ToJSON()
	assert.NoError(t, err)
	var ro Post
	err = json.Unmarshal([]byte(j), &ro)
	assert.NoError(t, err)
	assert.Equal(t, &o, ro.Clone())
}

func TestPostIsValid(t *testing.T) {
	o := Post{}
	maxPostSize := 10000

	appErr := o.IsValid(maxPostSize)
	require.NotNil(t, appErr)

	o.Id = NewId()
	appErr = o.IsValid(maxPostSize)
	require.NotNil(t, appErr)

	o.CreateAt = GetMillis()
	appErr = o.IsValid(maxPostSize)
	require.NotNil(t, appErr)

	o.UpdateAt = GetMillis()
	appErr = o.IsValid(maxPostSize)
	require.NotNil(t, appErr)

	o.UserId = NewId()
	appErr = o.IsValid(maxPostSize)
	require.NotNil(t, appErr)

	o.ChannelId = NewId()
	o.RootId = "123"
	appErr = o.IsValid(maxPostSize)
	require.NotNil(t, appErr)

	o.RootId = ""

	o.Message = strings.Repeat("0", maxPostSize+1)
	appErr = o.IsValid(maxPostSize)
	require.NotNil(t, appErr)

	// In case message property length is too long.
	o.Message = strings.Repeat("0", maxPostSize+1)
	appErr = o.IsValid(maxPostSize)
	require.NotNil(t, appErr)

	o.Message = strings.Repeat("0", maxPostSize)
	appErr = o.IsValid(maxPostSize)
	require.Nil(t, appErr)

	o.Message = "test"
	appErr = o.IsValid(maxPostSize)
	require.Nil(t, appErr)
	o.Type = "junk"
	appErr = o.IsValid(maxPostSize)
	require.NotNil(t, appErr)

	o.Type = PostCustomTypePrefix + "type"
	appErr = o.IsValid(maxPostSize)
	require.Nil(t, appErr)

	o.Type = PostTypeCard
	appErr = o.IsValid(maxPostSize)
	require.Nil(t, appErr)
}

func TestAccessControlTeamPostTypes(t *testing.T) {
	maxPostSize := 10000

	for _, postType := range []string{PostTypeAccessControlTeamRemoval, PostTypeAccessControlTeamAddition} {
		// Persisted to Posts.Type, which is varchar(26).
		require.LessOrEqual(t, len(postType), 26, "post type %q must fit Posts.Type varchar(26)", postType)
		require.True(t, strings.HasPrefix(postType, PostSystemMessagePrefix), "post type %q must be a system message", postType)

		o := Post{
			Id:        NewId(),
			CreateAt:  GetMillis(),
			UpdateAt:  GetMillis(),
			UserId:    NewId(),
			ChannelId: NewId(),
			Message:   "test",
			Type:      postType,
		}
		require.Nil(t, o.IsValid(maxPostSize), "post type %q must be an accepted system type", postType)
	}
}

func TestIsAccessControlTeamMembershipNotification(t *testing.T) {
	cases := []struct {
		name     string
		postType string
		expected bool
	}{
		{"removal DM", PostTypeAccessControlTeamRemoval, true},
		{"addition DM", PostTypeAccessControlTeamAddition, true},
		{"regular post", "", false},
		{"add to team", PostTypeAddToTeam, false},
		{"remove from team", PostTypeRemoveFromTeam, false},
		{"join channel", PostTypeJoinChannel, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := &Post{Type: tc.postType}
			require.Equal(t, tc.expected, p.IsAccessControlTeamMembershipNotification())
		})
	}
}

func TestPostPreSave(t *testing.T) {
	o := Post{Message: "test"}
	o.PreSave()

	require.NotEqual(t, 0, o.CreateAt)

	past := GetMillis() - 1
	o = Post{Message: "test", CreateAt: past}
	o.PreSave()

	require.LessOrEqual(t, o.CreateAt, past)

	o.Etag()
}

func TestPostIsSystemMessage(t *testing.T) {
	post1 := Post{Message: "test_1"}
	post1.PreSave()

	require.False(t, post1.IsSystemMessage())

	post2 := Post{Message: "test_2", Type: PostTypeJoinLeave}
	post2.PreSave()

	require.True(t, post2.IsSystemMessage())
}

func TestPostIsNotificationSuppressed(t *testing.T) {
	post := &Post{Message: "test"}
	post.AddProp(PostPropsSilentNotification, true)
	require.True(t, post.IsNotificationSuppressed())

	post.AddProp(PostPropsForceNotification, NewId())
	require.False(t, post.IsNotificationSuppressed())

	post2 := &Post{Message: "test"}
	post2.AddProp(PostPropsForceNotification, false)
	require.False(t, post2.HasForceNotification())

	post3 := &Post{Message: "test"}
	post3.AddProp(PostPropsForceNotification, true)
	require.True(t, post3.HasForceNotification())
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

	require.Nil(t, post1.GetProp(PropsAddChannelMember))
	require.Nil(t, post1.GetProp(PostPropsForceNotification))

	post2 := &Post{
		Message: "test",
		Props: StringInterface{
			PropsAddChannelMember:      "test",
			PostPropsForceNotification: "test",
		},
	}

	post2.SanitizeProps()

	require.Nil(t, post2.GetProp(PropsAddChannelMember))
	require.Nil(t, post2.GetProp(PostPropsForceNotification))

	post3 := &Post{
		Message: "test",
		Props: StringInterface{
			PropsAddChannelMember:      "no good",
			PostPropsForceNotification: "no good",
			PostPropsAttachments:       "good",
			PostPropsFromWebhook:       "user-settable in v11",
			PostPropsFromBot:           "user-settable in v11",
			PostPropsFromOAuthApp:      "user-settable in v11",
			PostPropsFromPlugin:        "user-settable in v11",
		},
	}

	post3.SanitizeProps()

	require.Nil(t, post3.GetProp(PropsAddChannelMember))
	require.Nil(t, post3.GetProp(PostPropsForceNotification))

	require.NotNil(t, post3.GetProp(PostPropsAttachments))

	// The from_* identity markers are NOT stripped by default in v11 — they
	// remain user-settable for backward compatibility with the user-PAT-
	// impersonation idiom. Hardened mode rejects from_webhook and from_plugin
	// via ContainsIntegrationsReservedProps; from_bot and from_oauth_app are
	// not currently in that reserved set. v12 will move all four into the
	// default strip list along with override_username/override_icon_url.
	require.Equal(t, "user-settable in v11", post3.GetProp(PostPropsFromWebhook))
	require.Equal(t, "user-settable in v11", post3.GetProp(PostPropsFromBot))
	require.Equal(t, "user-settable in v11", post3.GetProp(PostPropsFromOAuthApp))
	require.Equal(t, "user-settable in v11", post3.GetProp(PostPropsFromPlugin))

	// Federated post: notification-policy markers (silent/force) were verified
	// by the origin cluster and must survive sanitization on the receiving side.
	// The non-integration system prop (PropsAddChannelMember) is still stripped
	// — it's a synthesis marker for local "user added to channel" system posts
	// and doesn't belong on federated posts regardless. RemoteId is server-set
	// (SanitizeInput on the API4 path wipes any client-supplied value), so this
	// branch can't be reached by forgery. The from_* identity markers also
	// survive but that's not federation-specific — they aren't in the default
	// strip list under hardened-OFF in v11 either way.
	remoteId := "remote-cluster-1"
	post4 := &Post{
		Message:  "test",
		RemoteId: &remoteId,
		Props: StringInterface{
			PropsAddChannelMember:       "should-be-stripped",
			PostPropsForceNotification:  "preserved-id",
			PostPropsSilentNotification: true,
			PostPropsFromWebhook:        "true",
			PostPropsFromBot:            "true",
			PostPropsFromOAuthApp:       "true",
			PostPropsFromPlugin:         "true",
		},
	}

	post4.SanitizeProps()

	require.Nil(t, post4.GetProp(PropsAddChannelMember), "non-integration system prop must still be stripped from federated posts")
	require.Equal(t, "preserved-id", post4.GetProp(PostPropsForceNotification))
	require.Equal(t, true, post4.GetProp(PostPropsSilentNotification))
	require.Equal(t, "true", post4.GetProp(PostPropsFromWebhook))
	require.Equal(t, "true", post4.GetProp(PostPropsFromBot))
	require.Equal(t, "true", post4.GetProp(PostPropsFromOAuthApp))
	require.Equal(t, "true", post4.GetProp(PostPropsFromPlugin))

	// Empty-string RemoteId must NOT be treated as federated — it's the zero
	// value SanitizeInput sets when wiping a client-forged value. silent_notification
	// gets stripped just like for posts with no RemoteId field at all.
	emptyRemoteId := ""
	post5 := &Post{
		Message:  "test",
		RemoteId: &emptyRemoteId,
		Props: StringInterface{
			PostPropsSilentNotification: true,
		},
	}

	post5.SanitizeProps()

	require.Nil(t, post5.GetProp(PostPropsSilentNotification), "empty RemoteId must not be treated as federated")
}

func TestPost_ContainsIntegrationsReservedProps(t *testing.T) {
	post1 := &Post{
		Message: "test",
	}
	keys1 := post1.ContainsIntegrationsReservedProps()
	require.Len(t, keys1, 0)

	post2 := &Post{
		Message: "test",
		Props: StringInterface{
			PostPropsFromWebhook:        "true",
			PostPropsWebhookDisplayName: "overridden_display_name",
			PostPropsOverrideUsername:   "overridden_username",
			PostPropsOverrideIconURL:    "a-custom-url",
			PostPropsOverrideIconEmoji:  ":custom_emoji_name:",
			PostPropsMmBlocksActions: map[string]any{
				"btn1": map[string]any{
					"type": MmBlocksActionTypeExternal,
					"url":  "http://example.com/hook",
				},
			},
		},
	}
	keys2 := post2.ContainsIntegrationsReservedProps()
	require.Len(t, keys2, 6)
	require.Contains(t, keys2, PostPropsMmBlocksActions)

	post3 := &Post{
		Message: "test",
		Props: StringInterface{
			PostPropsSilentNotification: true,
			PostPropsForceNotification:  NewId(),
		},
	}
	keys3 := post3.ContainsIntegrationsReservedProps()
	require.Len(t, keys3, 2)
	require.Contains(t, keys3, PostPropsSilentNotification)
	require.Contains(t, keys3, PostPropsForceNotification)
}

func TestPostPatch_ContainsIntegrationsReservedProps(t *testing.T) {
	postPatch1 := &PostPatch{
		Props: &StringInterface{
			PostPropsFromWebhook: "true",
		},
	}
	keys1 := postPatch1.ContainsIntegrationsReservedProps()
	require.Len(t, keys1, 1)

	postPatch2 := &PostPatch{}
	keys2 := postPatch2.ContainsIntegrationsReservedProps()
	require.Len(t, keys2, 0)
}

func TestPost_AttachmentsEqual(t *testing.T) {
	post1 := &Post{}
	post2 := &Post{}
	for name, tc := range map[string]struct {
		Attachments1 []*MessageAttachment
		Attachments2 []*MessageAttachment
		Expected     bool
	}{
		"Empty": {
			nil,
			nil,
			true,
		},
		"DifferentLength": {
			[]*MessageAttachment{
				{
					Text: "Hello World",
				},
			},
			nil,
			false,
		},
		"EqualText": {
			[]*MessageAttachment{
				{
					Text: "Hello World",
				},
			},
			[]*MessageAttachment{
				{
					Text: "Hello World",
				},
			},
			true,
		},
		"DifferentText": {
			[]*MessageAttachment{
				{
					Text: "Hello World",
				},
			},
			[]*MessageAttachment{
				{
					Text: "Hello World 2",
				},
			},
			false,
		},
		"DifferentColor": {
			[]*MessageAttachment{
				{
					Text:  "Hello World",
					Color: "#152313",
				},
			},
			[]*MessageAttachment{
				{
					Text: "Hello World 2",
				},
			},
			false,
		},
		"EqualFields": {
			[]*MessageAttachment{
				{
					Fields: []*MessageAttachmentField{
						{
							Title: "Hello World",
							Value: "FooBar",
						},
						{
							Title: "Hello World2",
							Value: "FooBar2",
						},
					},
				},
			},
			[]*MessageAttachment{
				{
					Fields: []*MessageAttachmentField{
						{
							Title: "Hello World",
							Value: "FooBar",
						},
						{
							Title: "Hello World2",
							Value: "FooBar2",
						},
					},
				},
			},
			true,
		},
		"DifferentFields": {
			[]*MessageAttachment{
				{
					Fields: []*MessageAttachmentField{
						{
							Title: "Hello World",
							Value: "FooBar",
						},
					},
				},
			},
			[]*MessageAttachment{
				{
					Fields: []*MessageAttachmentField{
						{
							Title: "Hello World",
							Value: "FooBar",
							Short: false,
						},
						{
							Title: "Hello World2",
							Value: "FooBar2",
							Short: true,
						},
					},
				},
			},
			false,
		},
		"EqualActions": {
			[]*MessageAttachment{
				{
					Actions: []*PostAction{
						{
							Name: "FooBar",
							Options: []*PostActionOptions{
								{
									Text:  "abcdef",
									Value: "abcdef",
								},
							},
							Integration: &PostActionIntegration{
								URL: "http://localhost",
								Context: map[string]any{
									"context": "foobar",
									"test":    123,
								},
							},
						},
					},
				},
			},
			[]*MessageAttachment{
				{
					Actions: []*PostAction{
						{
							Name: "FooBar",
							Options: []*PostActionOptions{
								{
									Text:  "abcdef",
									Value: "abcdef",
								},
							},
							Integration: &PostActionIntegration{
								URL: "http://localhost",
								Context: map[string]any{
									"context": "foobar",
									"test":    123,
								},
							},
						},
					},
				},
			},
			true,
		},
		"DifferentActions": {
			[]*MessageAttachment{
				{
					Actions: []*PostAction{
						{
							Name: "FooBar",
							Options: []*PostActionOptions{
								{
									Text:  "abcdef",
									Value: "abcdef",
								},
							},
							Integration: &PostActionIntegration{
								URL: "http://localhost",
								Context: map[string]any{
									"context": "foobar",
									"test":    "mattermost",
								},
							},
						},
					},
				},
			},
			[]*MessageAttachment{
				{
					Actions: []*PostAction{
						{
							Name: "FooBar",
							Options: []*PostActionOptions{
								{
									Text:  "abcdef",
									Value: "abcdef",
								},
							},
							Integration: &PostActionIntegration{
								URL: "http://localhost",
								Context: map[string]any{
									"context": "foobar",
									"test":    123,
								},
							},
						},
					},
				},
			},
			false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			post1.AddProp(PostPropsAttachments, tc.Attachments1)
			post2.AddProp(PostPropsAttachments, tc.Attachments2)
			assert.Equal(t, tc.Expected, post1.AttachmentsEqual(post2))
		})
	}
}

var markdownSample, markdownSampleWithRewrittenImageURLs string

func init() {
	bytes, err := os.ReadFile("testdata/markdown-sample.md")
	if err != nil {
		panic(err)
	}
	markdownSample = string(bytes)

	bytes, err = os.ReadFile("testdata/markdown-sample-with-rewritten-image-urls.md")
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
	for b.Loop() {
		rewriteImageURLsSink = RewriteImageURLs(markdownSample, func(url string) string {
			return "rewritten:" + url
		})
	}
}

func TestPostShallowCopy(t *testing.T) {
	var dst *Post
	p := &Post{
		Id: NewId(),
	}

	err := p.ShallowCopy(dst)
	require.Error(t, err)

	dst = &Post{}
	err = p.ShallowCopy(dst)
	require.NoError(t, err)
	require.Equal(t, p, dst)
	require.Condition(t, func() bool {
		return p != dst
	})
}

func TestPostClone(t *testing.T) {
	p := &Post{
		Id: NewId(),
	}

	pp := p.Clone()
	require.Equal(t, p, pp)
	require.Condition(t, func() bool {
		return p != pp
	})
	require.Condition(t, func() bool {
		return &p.propsMu != &pp.propsMu
	})
}

func BenchmarkClonePost(b *testing.B) {
	p := Post{}
	for b.Loop() {
		_ = p.Clone()
	}
}

func BenchmarkPostPropsGet_indirect(b *testing.B) {
	p := Post{
		Props: make(StringInterface),
	}
	for b.Loop() {
		_ = p.GetProps()
	}
}

func BenchmarkPostPropsGet_direct(b *testing.B) {
	p := Post{
		Props: make(StringInterface),
	}
	for b.Loop() {
		_ = p.Props
	}
}

func BenchmarkPostPropsAdd_indirect(b *testing.B) {
	p := Post{
		Props: make(StringInterface),
	}
	for b.Loop() {
		p.AddProp("test", "somevalue")
	}
}

func BenchmarkPostPropsAdd_direct(b *testing.B) {
	p := Post{
		Props: make(StringInterface),
	}
	for b.Loop() {
		p.Props["test"] = "somevalue"
	}
}

func BenchmarkPostPropsDel_indirect(b *testing.B) {
	p := Post{
		Props: make(StringInterface),
	}
	p.AddProp("test", "somevalue")
	for b.Loop() {
		p.DelProp("test")
	}
}

func BenchmarkPostPropsDel_direct(b *testing.B) {
	p := Post{
		Props: make(StringInterface),
	}
	for b.Loop() {
		delete(p.Props, "test")
	}
}

func BenchmarkPostPropGet_direct(b *testing.B) {
	p := Post{
		Props: make(StringInterface),
	}
	p.Props["somekey"] = "somevalue"
	for b.Loop() {
		_ = p.Props["somekey"]
	}
}

func BenchmarkPostPropGet_indirect(b *testing.B) {
	p := Post{
		Props: make(StringInterface),
	}
	p.Props["somekey"] = "somevalue"
	for b.Loop() {
		_ = p.GetProp("somekey")
	}
}

// TestPostPropsDataRace tries to trigger data race conditions related to Post.Props.
// It's meant to be run with the -race flag.
func TestPostPropsDataRace(t *testing.T) {
	p := Post{Message: "test"}

	wg := sync.WaitGroup{}
	wg.Add(7)

	go func() {
		for range 100 {
			p.AddProp("test", "test")
		}
		wg.Done()
	}()

	go func() {
		for range 100 {
			_ = p.GetProp("test")
		}
		wg.Done()
	}()

	go func() {
		for range 100 {
			p.AddProp("test", "test2")
		}
		wg.Done()
	}()

	go func() {
		for range 100 {
			_ = p.GetProps()["test"]
		}
		wg.Done()
	}()

	go func() {
		for range 100 {
			p.DelProp("test")
		}
		wg.Done()
	}()

	go func() {
		for range 100 {
			p.SetProps(make(StringInterface))
		}
		wg.Done()
	}()

	go func() {
		for range 100 {
			_ = p.Clone()
		}
		wg.Done()
	}()

	wg.Wait()
}

func Test_findAtChannelMention(t *testing.T) {
	testCases := []struct {
		Name    string
		Message string
		Mention string
		Found   bool
	}{
		{
			"Returns mention for @here wrapped by spaces",
			"hi guys @here wrapped by spaces",
			"@here",
			true,
		},
		{
			"Returns mention for @all wrapped by spaces",
			"hi guys @all wrapped by spaces",
			"@all",
			true,
		},
		{
			"Returns mention for @channel wrapped by spaces",
			"hi guys @channel wrapped by spaces",
			"@channel",
			true,
		},
		{
			"Returns mention for @here wrapped by dash",
			"-@here-",
			"@here",
			true,
		},
		{
			"Returns mention for @all wrapped by back tick",
			"`@all`",
			"@all",
			true,
		},
		{
			"Returns mention for @channel wrapped by tags",
			"<@channel>",
			"@channel",
			true,
		},
		{
			"Returns mention for @channel wrapped by asterisks",
			"*@channel*",
			"@channel",
			true,
		},
		{
			"Does not return mention when prefixed by letters",
			"hi@channel",
			"",
			false,
		},
		{
			"Does not return mention when suffixed by letters",
			"hi @channelanotherword",
			"",
			false,
		},
		{
			"Returns mention when prefixed by word ending in special character",
			"hi-@channel",
			"@channel",
			true,
		},
		{
			"Returns mention when suffixed by word starting in special character",
			"hi @channel-guys",
			"@channel",
			true,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			mention, found := findAtChannelMention(tc.Message)
			assert.Equal(t, tc.Mention, mention)
			assert.Equal(t, tc.Found, found)
		})
	}
}

func TestPostDisableMentionHighlights(t *testing.T) {
	post := &Post{}

	testCases := []struct {
		Name            string
		Message         string
		ExpectedProps   StringInterface
		ExpectedMention string
	}{
		{
			"Does nothing for post with no mentions",
			"Sample message with no mentions",
			StringInterface(nil),
			"",
		},
		{
			"Sets PostPropsMentionHighlightDisabled and returns mention",
			"Sample message with @here",
			StringInterface{PostPropsMentionHighlightDisabled: true},
			"@here",
		},
		{
			"Sets PostPropsMentionHighlightDisabled and returns mention",
			"Sample message with @channel",
			StringInterface{PostPropsMentionHighlightDisabled: true},
			"@channel",
		},
		{
			"Sets PostPropsMentionHighlightDisabled and returns mention",
			"Sample message with @all",
			StringInterface{PostPropsMentionHighlightDisabled: true},
			"@all",
		},
	}
	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			post.Message = tc.Message
			mention := post.DisableMentionHighlights()
			assert.Equal(t, tc.ExpectedMention, mention)
			assert.Equal(t, tc.ExpectedProps, post.Props)
			post.Props = StringInterface{}
		})
	}
}

func TestPostPatchDisableMentionHighlights(t *testing.T) {
	patch := &PostPatch{}

	testCases := []struct {
		Name          string
		Message       string
		ExpectedProps *StringInterface
	}{
		{
			"Does nothing for post with no mentions",
			"Sample message with no mentions",
			nil,
		},
		{
			"Sets PostPropsMentionHighlightDisabled",
			"Sample message with @here",
			&StringInterface{PostPropsMentionHighlightDisabled: true},
		},
		{
			"Sets PostPropsMentionHighlightDisabled",
			"Sample message with @channel",
			&StringInterface{PostPropsMentionHighlightDisabled: true},
		},
		{
			"Sets PostPropsMentionHighlightDisabled",
			"Sample message with @all",
			&StringInterface{PostPropsMentionHighlightDisabled: true},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			message := tc.Message
			patch.Message = &message
			patch.DisableMentionHighlights()
			if tc.ExpectedProps == nil {
				assert.Nil(t, patch.Props)
			} else {
				assert.Equal(t, *tc.ExpectedProps, *patch.Props)
			}
			patch.Props = nil
		})
	}

	t.Run("TestNilMessage", func(t *testing.T) {
		patch.Message = nil
		patch.DisableMentionHighlights()
		// Useless assertion to prevent compiler elision.
		assert.Nil(t, patch.Message)
	})
}

func TestPostAttachments(t *testing.T) {
	p := &Post{
		Props: map[string]any{
			PostPropsAttachments: []byte(`[{
				"actions" : {null}
			}]
			`),
		},
	}

	t.Run("empty actions", func(t *testing.T) {
		p.Props[PostPropsAttachments] = []any{
			map[string]any{"actions": []any{}},
		}
		attachments := p.Attachments()
		require.Empty(t, attachments[0].Actions)
	})

	t.Run("a couple of actions", func(t *testing.T) {
		p.Props[PostPropsAttachments] = []any{
			map[string]any{"actions": []any{
				map[string]any{"id": "test1"}, map[string]any{"id": "test2"}},
			},
		}

		attachments := p.Attachments()
		require.Len(t, attachments[0].Actions, 2)
		require.Equal(t, attachments[0].Actions[0].Id, "test1")
		require.Equal(t, attachments[0].Actions[1].Id, "test2")
	})

	t.Run("should ignore null actions", func(t *testing.T) {
		p.Props[PostPropsAttachments] = []any{
			map[string]any{"actions": []any{
				map[string]any{"id": "test1"}, nil, map[string]any{"id": "test2"}, nil, nil},
			},
		}

		attachments := p.Attachments()
		require.Len(t, attachments[0].Actions, 2)
		require.Equal(t, attachments[0].Actions[0].Id, "test1")
		require.Equal(t, attachments[0].Actions[1].Id, "test2")
	})

	t.Run("nil fields", func(t *testing.T) {
		p.Props[PostPropsAttachments] = []any{
			map[string]any{"fields": []any{
				map[string]any{"value": ":emoji1:"},
				nil,
				map[string]any{"value": ":emoji2:"},
			},
			},
		}

		attachments := p.Attachments()
		require.Len(t, attachments[0].Fields, 2)
		assert.Equal(t, attachments[0].Fields[0].Value, ":emoji1:")
		assert.Equal(t, attachments[0].Fields[1].Value, ":emoji2:")
	})
}

func TestPostForPlugin(t *testing.T) {
	t.Run("post type custom_up_notification for plugin should have no requested features prop", func(t *testing.T) {
		p := &Post{
			Type: fmt.Sprintf("%sup_notification", PostCustomTypePrefix),
		}
		props := make(StringInterface)
		props["requested_features"] = "test_requested_features_map"
		p.SetProps(props)

		require.NotNil(t, p.GetProp("requested_features"))

		pluginPost := p.ForPlugin()
		require.Nil(t, pluginPost.GetProp("requested_features"))
	})

	t.Run("non post type custom_up_notification for plugin should have requested features prop", func(t *testing.T) {
		p := &Post{
			Type: PostTypeReminder,
		}
		props := make(StringInterface)
		props["requested_features"] = "test_requested_features_map"
		p.SetProps(props)

		require.NotNil(t, p.GetProp("requested_features"))

		pluginPost := p.ForPlugin()
		require.NotNil(t, pluginPost.GetProp("requested_features"))
	})
}

func TestPostPriority(t *testing.T) {
	p := &Post{
		Metadata: &PostMetadata{},
	}
	require.False(t, p.IsUrgent())

	p.Metadata.Priority = &PostPriority{}
	require.False(t, p.IsUrgent())

	p.Metadata.Priority.Priority = new(PostPriorityUrgent)
	require.True(t, p.IsUrgent())
}

func TestPost_HasUnsafeLinks(t *testing.T) {
	t.Run("nil props", func(t *testing.T) {
		p := &Post{}
		require.False(t, p.HasUnsafeLinks())
	})

	t.Run("missing prop", func(t *testing.T) {
		p := &Post{Props: StringInterface{"other": "x"}}
		require.False(t, p.HasUnsafeLinks())
	})

	t.Run("true", func(t *testing.T) {
		p := &Post{Props: StringInterface{PostPropsUnsafeLinks: "true"}}
		require.True(t, p.HasUnsafeLinks())
	})

	t.Run("false string is not unsafe", func(t *testing.T) {
		p := &Post{Props: StringInterface{PostPropsUnsafeLinks: "false"}}
		require.False(t, p.HasUnsafeLinks())
	})

	t.Run("non-string is not unsafe", func(t *testing.T) {
		p := &Post{Props: StringInterface{PostPropsUnsafeLinks: true}}
		require.False(t, p.HasUnsafeLinks())
	})
}

func TestPost_AllStrings(t *testing.T) {
	t.Run("messageOnly", func(t *testing.T) {
		p := &Post{Message: "  hello  "}
		assert.Equal(t, []string{"  hello  "}, p.AllStrings(AllStringsOptions{}))
	})

	t.Run("emptyMessage", func(t *testing.T) {
		p := &Post{Message: "   "}
		assert.Empty(t, p.AllStrings(AllStringsOptions{}))
	})

	t.Run("interactiveProps", func(t *testing.T) {
		p := &Post{
			Message: "root",
			Props: StringInterface{
				PostPropsMmBlocks: []any{
					map[string]any{"type": "text", "text": "mm-line"},
					map[string]any{"type": "button", "text": "OK", "action_id": "act"},
				},
				PostPropsBlockKitBlocks: []any{
					map[string]any{"type": "image", "image_url": "https://example.com/i.png", "alt_text": "logo"},
				},
				PostPropsAdaptiveCards: []any{
					map[string]any{"type": "AdaptiveCard", "version": "1.0", "body": []any{
						map[string]any{"type": "TextBlock", "text": "card-line"},
					}},
				},
			},
		}
		got := p.AllStrings(AllStringsOptions{})
		require.Contains(t, got, "root")
		require.Contains(t, got, "mm-line")
		require.NotContains(t, got, "OK")
		require.NotContains(t, got, "act")
		require.NotContains(t, got, "https://example.com/i.png")
		require.NotContains(t, got, "logo")
		require.Contains(t, got, "card-line")
	})

	t.Run("omitInteractiveBlocks", func(t *testing.T) {
		p := &Post{
			Message: "root",
			Props: StringInterface{
				PostPropsMmBlocks: []any{
					map[string]any{"type": "text", "text": "mm-line"},
				},
				PostPropsBlockKitBlocks: []any{
					map[string]any{
						"type": "section",
						"text": map[string]any{
							"type": "mrkdwn",
							"text": "block kit-line",
						},
					},
				},
				PostPropsAdaptiveCards: []any{
					map[string]any{
						"type": "AdaptiveCard",
						"body": []any{
							map[string]any{"type": "TextBlock", "text": "card-line"},
						},
					},
				},
			},
		}
		got := p.AllStrings(AllStringsOptions{OmitInteractiveBlocks: true})
		require.Contains(t, got, "root")
		require.NotContains(t, got, "mm-line")
		require.NotContains(t, got, "block kit-line")
		require.NotContains(t, got, "card-line")
	})

	t.Run("blockKitHeaderPlainText", func(t *testing.T) {
		p := &Post{
			Props: StringInterface{
				PostPropsBlockKitBlocks: []any{
					map[string]any{
						"type": "header",
						"text": map[string]any{
							"type":  "plain_text",
							"text":  "Section title",
							"emoji": true,
						},
					},
				},
			},
		}
		got := p.AllStrings(AllStringsOptions{})
		require.Contains(t, got, "Section title")
	})

	t.Run("includesMessageAttachments", func(t *testing.T) {
		p := &Post{
			Message: "hi",
			Props: StringInterface{
				PostPropsAttachments: []*MessageAttachment{
					{
						AuthorName: "author",
						Fallback:   "fallback",
						Title:      "T",
						Text:       "body",
						Pretext:    "pre",
						Footer:     "footer line",
					},
					{Fields: []*MessageAttachmentField{{Title: "Col", Value: "f1"}, {Title: "N", Value: 7}}},
				},
			},
		}
		got := p.AllStrings(AllStringsOptions{})
		require.Contains(t, got, "hi")
		require.Contains(t, got, "author")
		require.NotContains(t, got, "fallback")
		require.Contains(t, got, "T")
		require.Contains(t, got, "body")
		require.Contains(t, got, "pre")
		require.Contains(t, got, "footer line")
		require.Contains(t, got, "Col")
		require.Contains(t, got, "f1")
		require.Contains(t, got, "N")
		require.Contains(t, got, "7")
	})

	t.Run("interactivePropsWithoutMessage", func(t *testing.T) {
		p := &Post{
			Props: StringInterface{
				PostPropsMmBlocks: []any{
					map[string]any{"type": "button", "text": "Go", "action_id": "x"},
				},
			},
		}
		got := p.AllStrings(AllStringsOptions{})
		require.Len(t, got, 0)
	})

	t.Run("nilProps", func(t *testing.T) {
		p := &Post{Message: "x", Props: nil}
		assert.Equal(t, []string{"x"}, p.AllStrings(AllStringsOptions{}))
	})
}

func TestPost_PropsIsValid(t *testing.T) {
	tests := map[string]struct {
		props   StringInterface
		wantErr string
	}{
		"valid empty props": {
			props:   nil,
			wantErr: "",
		},
		"valid props": {
			props: StringInterface{
				"key": "value",
			},
			wantErr: "",
		},
		"valid added_user_id": {
			props: StringInterface{
				PostPropsAddedUserId: NewId(),
			},
			wantErr: "",
		},
		"valid delete_by": {
			props: StringInterface{
				PostPropsDeleteBy: NewId(),
			},
			wantErr: "",
		},
		"valid override_icon_url": {
			props: StringInterface{
				PostPropsOverrideIconURL: "https://example.com/icon.png",
			},
			wantErr: "",
		},
		"valid override_icon_emoji": {
			props: StringInterface{
				PostPropsOverrideIconEmoji: ":smile:",
			},
			wantErr: "",
		},
		"valid override_username": {
			props: StringInterface{
				PostPropsOverrideUsername: "testuser",
			},
			wantErr: "",
		},
		"valid from_webhook": {
			props: StringInterface{
				PostPropsFromWebhook: "true",
			},
			wantErr: "",
		},
		"valid from_bot": {
			props: StringInterface{
				PostPropsFromBot: "true",
			},
			wantErr: "",
		},
		"valid from_oauth_app": {
			props: StringInterface{
				PostPropsFromOAuthApp: "true",
			},
			wantErr: "",
		},
		"valid from_plugin": {
			props: StringInterface{
				PostPropsFromPlugin: "true",
			},
			wantErr: "",
		},
		"valid unsafe_links": {
			props: StringInterface{
				PostPropsUnsafeLinks: "true",
			},
			wantErr: "",
		},
		"valid webhook_display_name": {
			props: StringInterface{
				PostPropsWebhookDisplayName: "My Webhook",
			},
			wantErr: "",
		},
		"valid mention_highlight_disabled": {
			props: StringInterface{
				PostPropsMentionHighlightDisabled: true,
			},
			wantErr: "",
		},
		"valid disable_group_highlight": {
			props: StringInterface{
				PostPropsGroupHighlightDisabled: true,
			},
			wantErr: "",
		},
		"valid previewed_post": {
			props: StringInterface{
				PostPropsPreviewedPost: NewId(),
			},
			wantErr: "",
		},
		"valid force_notification": {
			props: StringInterface{
				PostPropsForceNotification: true,
			},
			wantErr: "",
		},
		"valid silent_notification": {
			props: StringInterface{
				PostPropsSilentNotification: true,
			},
			wantErr: "",
		},
		"valid multiple props": {
			props: StringInterface{
				PostPropsFromWebhook:              "true",
				PostPropsOverrideUsername:         "webhook-user",
				PostPropsOverrideIconURL:          "https://example.com/icon.png",
				PostPropsWebhookDisplayName:       "My Webhook",
				PostPropsMentionHighlightDisabled: true,
			},
			wantErr: "",
		},
		"valid mm_blocks array is treated as opaque data": {
			props: StringInterface{
				PostPropsMmBlocks: []any{
					map[string]any{"type": "text", "content": "Hello world"},
					map[string]any{"type": "divider"},
				},
			},
			wantErr: "",
		},
		"valid mm_blocks with unknown block types is treated as opaque data": {
			props: StringInterface{
				PostPropsMmBlocks: []any{
					map[string]any{"type": "unknown_future_block_type", "foo": "bar"},
				},
			},
			wantErr: "",
		},
		"valid mm_blocks with empty blocks prop": {
			props: StringInterface{
				PostPropsMmBlocks:       []any{map[string]any{"type": "text", "text": "a"}},
				PostPropsBlockKitBlocks: []any{},
			},
			wantErr: "",
		},
		"valid attachments with empty mm_blocks array": {
			props: StringInterface{
				PostPropsMmBlocks: []any{},
				PostPropsAttachments: []*MessageAttachment{
					{Fallback: "f"},
				},
			},
			wantErr: "",
		},
		"invalid multiple interactive payloads mm_blocks and blocks": {
			props: StringInterface{
				PostPropsMmBlocks: []any{map[string]any{"type": "text", "text": "a"}},
				PostPropsBlockKitBlocks: []any{
					map[string]any{"type": "section", "text": map[string]any{"type": "mrkdwn", "text": "b"}},
				},
			},
			wantErr: "at most one interactive payload",
		},
		"invalid multiple interactive payloads attachments and cards": {
			props: StringInterface{
				PostPropsAdaptiveCards: []any{map[string]any{"type": "AdaptiveCard", "version": "1.0", "body": []any{}}},
				PostPropsAttachments: []*MessageAttachment{
					{Fallback: "f"},
				},
			},
			wantErr: "at most one interactive payload",
		},
		"invalid added_user_id type": {
			props: StringInterface{
				PostPropsAddedUserId: 123,
			},
			wantErr: "added_user_id prop must be a string",
		},
		"invalid added_user_id value": {
			props: StringInterface{
				PostPropsAddedUserId: "invalid-id",
			},
			wantErr: "added_user_id prop must be a valid user ID",
		},
		"invalid delete_by type": {
			props: StringInterface{
				PostPropsDeleteBy: 123,
			},
			wantErr: "delete_by prop must be a string",
		},
		"invalid delete_by value": {
			props: StringInterface{
				PostPropsDeleteBy: "invalid-id",
			},
			wantErr: "delete_by prop must be a valid user ID",
		},
		"invalid override_icon_url type": {
			props: StringInterface{
				PostPropsOverrideIconURL: 123,
			},
			wantErr: "override_icon_url prop must be a string",
		},
		"invalid override_icon_url value": {
			props: StringInterface{
				PostPropsOverrideIconURL: "not-a-url",
			},
			wantErr: "override_icon_url prop must be a valid URL",
		},
		"invalid override_icon_emoji type": {
			props: StringInterface{
				PostPropsOverrideIconEmoji: 123,
			},
			wantErr: "override_icon_emoji prop must be a string",
		},
		"invalid override_username type": {
			props: StringInterface{
				PostPropsOverrideUsername: 123,
			},
			wantErr: "override_username prop must be a string",
		},
		"invalid from_webhook type": {
			props: StringInterface{
				PostPropsFromWebhook: 123,
			},
			wantErr: "from_webhook prop must be a string",
		},
		"invalid from_webhook value": {
			props: StringInterface{
				PostPropsFromWebhook: "false",
			},
			wantErr: "from_webhook prop must be \"true\"",
		},
		"invalid from_bot type": {
			props: StringInterface{
				PostPropsFromBot: 123,
			},
			wantErr: "from_bot prop must be a string",
		},
		"invalid from_bot value": {
			props: StringInterface{
				PostPropsFromBot: "false",
			},
			wantErr: "from_bot prop must be \"true\"",
		},
		"invalid from_oauth_app type": {
			props: StringInterface{
				PostPropsFromOAuthApp: 123,
			},
			wantErr: "from_oauth_app prop must be a string",
		},
		"invalid from_oauth_app value": {
			props: StringInterface{
				PostPropsFromOAuthApp: "false",
			},
			wantErr: "from_oauth_app prop must be \"true\"",
		},
		"invalid from_plugin type": {
			props: StringInterface{
				PostPropsFromPlugin: 123,
			},
			wantErr: "from_plugin prop must be a string",
		},
		"invalid from_plugin value": {
			props: StringInterface{
				PostPropsFromPlugin: "false",
			},
			wantErr: "from_plugin prop must be \"true\"",
		},
		"invalid unsafe_links type": {
			props: StringInterface{
				PostPropsUnsafeLinks: 123,
			},
			wantErr: "unsafe_links prop must be a string",
		},
		"invalid unsafe_links value": {
			props: StringInterface{
				PostPropsUnsafeLinks: "false",
			},
			wantErr: "unsafe_links prop must be \"true\"",
		},
		"invalid webhook_display_name type": {
			props: StringInterface{
				PostPropsWebhookDisplayName: 123,
			},
			wantErr: "webhook_display_name prop must be a string",
		},
		"invalid mention_highlight_disabled type": {
			props: StringInterface{
				PostPropsMentionHighlightDisabled: "true",
			},
			wantErr: "mention_highlight_disabled prop must be a boolean",
		},
		"invalid disable_group_highlight type": {
			props: StringInterface{
				PostPropsGroupHighlightDisabled: "true",
			},
			wantErr: "disable_group_highlight prop must be a boolean",
		},
		"invalid previewed_post type": {
			props: StringInterface{
				PostPropsPreviewedPost: 123,
			},
			wantErr: "previewed_post prop must be a string",
		},
		"invalid previewed_post value": {
			props: StringInterface{
				PostPropsPreviewedPost: "invalid-id",
			},
			wantErr: "previewed_post prop must be a valid post ID",
		},
		"invalid force_notification type": {
			props: StringInterface{
				PostPropsForceNotification: "true",
			},
			wantErr: "force_notification prop must be a boolean",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			p := &Post{}
			p.SetProps(tc.props)
			err := p.propsIsValid()
			if tc.wantErr == "" {
				assert.NoError(t, err)
			} else {
				assert.ErrorContains(t, err, tc.wantErr)
			}
		})
	}
}

func TestMembershipSystemPostTypes(t *testing.T) {
	types := MembershipSystemPostTypes()
	require.NotEmpty(t, types)

	expected := []string{
		PostTypeJoinLeave,
		PostTypeAddRemove,
		PostTypeJoinChannel,
		PostTypeGuestJoinChannel,
		PostTypeLeaveChannel,
		PostTypeJoinTeam,
		PostTypeLeaveTeam,
		PostTypeAddToChannel,
		PostTypeAddGuestToChannel,
		PostTypeRemoveFromChannel,
		PostTypeAddToTeam,
		PostTypeRemoveFromTeam,
	}
	require.ElementsMatch(t, expected, types)
}

func TestIsMembershipSystemPost(t *testing.T) {
	t.Run("nil post returns false", func(t *testing.T) {
		require.False(t, IsMembershipSystemPost(nil))
	})

	t.Run("regular message post returns false", func(t *testing.T) {
		require.False(t, IsMembershipSystemPost(&Post{Type: ""}))
	})

	t.Run("custom post type returns false", func(t *testing.T) {
		require.False(t, IsMembershipSystemPost(&Post{Type: "custom_some_type"}))
	})

	for _, postType := range MembershipSystemPostTypes() {
		t.Run("returns true for "+postType, func(t *testing.T) {
			require.True(t, IsMembershipSystemPost(&Post{Type: postType}))
		})
	}
}
