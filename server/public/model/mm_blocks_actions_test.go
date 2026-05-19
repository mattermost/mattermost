// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMergeQueryIntoURL(t *testing.T) {
	t.Run("preserves existing and adds", func(t *testing.T) {
		out, err := MergeQueryIntoURL("https://example.com/hook?existing=1", map[string]string{"a": "b"})
		require.NoError(t, err)
		assert.Contains(t, out, "existing=1")
		assert.Contains(t, out, "a=b")
	})
	t.Run("override duplicate key", func(t *testing.T) {
		out, err := MergeQueryIntoURL("https://example.com?x=old", map[string]string{"x": "new"})
		require.NoError(t, err)
		assert.Contains(t, out, "x=new")
		assert.NotContains(t, out, "x=old")
	})
	t.Run("empty extra", func(t *testing.T) {
		out, err := MergeQueryIntoURL("https://example.com/a", nil)
		require.NoError(t, err)
		assert.Equal(t, "https://example.com/a", out)
	})
	t.Run("invalid url", func(t *testing.T) {
		_, err := MergeQueryIntoURL("://bad", map[string]string{"a": "b"})
		require.Error(t, err)
	})
}

func TestResolveMmBlocksAction(t *testing.T) {
	t.Run("openURL", func(t *testing.T) {
		resolved, err := ResolveMmBlocksAction(&MmBlocksActionSpec{
			Type:  MmBlocksActionTypeOpenURL,
			URL:   "https://example.com/page",
			Query: map[string]string{"a": "b"},
		}, "open1", nil)
		require.NoError(t, err)
		assert.Contains(t, resolved.OpenURLGoto, "a=b")
	})

	t.Run("external merges client query", func(t *testing.T) {
		resolved, err := ResolveMmBlocksAction(&MmBlocksActionSpec{
			Type:    MmBlocksActionTypeExternal,
			URL:     "https://hooks.example.com/x",
			Context: map[string]any{"k": "v"},
		}, "ext1", map[string]string{"client": "q"})
		require.NoError(t, err)
		assert.Contains(t, resolved.ExternalURL, "client=q")
		assert.Equal(t, "v", resolved.Context["k"])
	})

	t.Run("not found", func(t *testing.T) {
		_, err := ResolveMmBlocksAction(nil, "missing", nil)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrMmBlocksActionNotFound)
	})

	t.Run("openURL empty url", func(t *testing.T) {
		_, err := ResolveMmBlocksAction(&MmBlocksActionSpec{Type: MmBlocksActionTypeOpenURL}, "open1", nil)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrMmBlocksOpenURLEmpty)
	})

	t.Run("external empty url", func(t *testing.T) {
		_, err := ResolveMmBlocksAction(&MmBlocksActionSpec{Type: MmBlocksActionTypeExternal}, "ext1", nil)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrMmBlocksActionNotFound)
	})

	t.Run("unknown type", func(t *testing.T) {
		_, err := ResolveMmBlocksAction(&MmBlocksActionSpec{Type: "other", URL: "https://example.com"}, "x", nil)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrMmBlocksActionNotFound)
	})
}

func TestPostGetMmBlocksActionSpec(t *testing.T) {
	p := &Post{}
	p.SetProps(StringInterface{
		PostPropsMmBlocksActions: map[string]any{
			"act1": map[string]any{
				"type":    MmBlocksActionTypeExternal,
				"url":     "https://hooks.example.com/x?keep=yes",
				"context": `{"k":"v"}`,
				"query":   map[string]any{"a": "1", "keep": "no"},
			},
			"open1": map[string]any{
				"type": MmBlocksActionTypeOpenURL,
				"url":  "https://example.com/page",
			},
		},
	})
	ext := p.GetMmBlocksActionSpec("act1")
	require.NotNil(t, ext)
	assert.Equal(t, MmBlocksActionTypeExternal, ext.Type)
	assert.Equal(t, "https://hooks.example.com/x?keep=yes", ext.URL)
	require.NotNil(t, ext.Context)
	assert.Equal(t, "v", ext.Context["k"])
	assert.Equal(t, "1", ext.Query["a"])
	assert.Equal(t, "no", ext.Query["keep"])

	open := p.GetMmBlocksActionSpec("open1")
	require.NotNil(t, open)
	assert.Equal(t, MmBlocksActionTypeOpenURL, open.Type)

	assert.Nil(t, p.GetMmBlocksActionSpec("missing"))
	assert.Nil(t, p.GetMmBlocksActionSpec(""))
}

func TestPostGetMmBlocksActionSpec_encryptedProp(t *testing.T) {
	p := &Post{}
	p.SetProps(StringInterface{
		PostPropsMmBlocksActions: "opaque-ciphertext",
	})
	assert.Nil(t, p.GetMmBlocksActionSpec("any"))
}

func TestPostGetMmBlocksActionSpec_mapContext(t *testing.T) {
	p := &Post{}
	p.SetProps(StringInterface{
		PostPropsMmBlocksActions: map[string]any{
			"act1": map[string]any{
				"type":    MmBlocksActionTypeExternal,
				"url":     "https://hooks.example.com/x",
				"context": map[string]any{"k": "v"},
			},
		},
	})
	spec := p.GetMmBlocksActionSpec("act1")
	require.NotNil(t, spec)
	assert.Equal(t, "v", spec.Context["k"])
}

func TestMmBlocksActionCookie_ActionSpec(t *testing.T) {
	var nilCookie *MmBlocksActionCookie
	assert.Nil(t, nilCookie.ActionSpec("a"))

	cookie := &MmBlocksActionCookie{
		Actions: map[string]map[string]any{
			"ext": {
				"type": MmBlocksActionTypeExternal,
				"url":  "https://example.com/hook",
			},
		},
	}
	spec := cookie.ActionSpec("ext")
	require.NotNil(t, spec)
	assert.Equal(t, MmBlocksActionTypeExternal, spec.Type)
	assert.Nil(t, cookie.ActionSpec("missing"))
	assert.Nil(t, cookie.ActionSpec(""))
}

func TestStripMmBlocksActionSecrets(t *testing.T) {
	p := &Post{}
	p.SetProps(StringInterface{
		PostPropsMmBlocksActions: map[string]any{
			"a": map[string]any{
				"type": MmBlocksActionTypeExternal,
				"url":  "https://secret",
			},
		},
	})
	p.StripMmBlocksActionSecrets()
	assert.Nil(t, p.GetProp(PostPropsMmBlocksActions))
}

func TestStripMmBlocksActionSecrets_StringNoop(t *testing.T) {
	p := &Post{}
	p.SetProps(StringInterface{
		PostPropsMmBlocksActions: "opaque-ciphertext",
	})
	p.StripMmBlocksActionSecrets()
	assert.Equal(t, "opaque-ciphertext", p.GetProp(PostPropsMmBlocksActions))
}

func TestAddMmBlocksActionCookies_ReplacesWithEncryptedString(t *testing.T) {
	secret := make([]byte, 32)
	for i := range secret {
		secret[i] = byte(i + 1)
	}
	p := &Post{}
	p.Id = "postid"
	p.ChannelId = "chid"
	p.UserId = "userid1"
	p.SetProps(StringInterface{
		PostPropsMmBlocksActions: map[string]any{
			"a1": map[string]any{
				"type":    MmBlocksActionTypeExternal,
				"url":     "https://example.com/hook?keep=1",
				"context": `{"k":"v"}`,
				"query":   map[string]any{"keep": "2", "a": "b"},
			},
		},
	})
	AddMmBlocksActionCookies(p, secret)
	raw := p.GetProp(PostPropsMmBlocksActions)
	s, ok := raw.(string)
	require.True(t, ok)
	require.NotEmpty(t, s)

	plain, err := DecryptPostActionCookie(s, secret)
	require.NoError(t, err)
	legacy, mm, err := ParseDecryptedActionCookiePayload(plain)
	require.NoError(t, err)
	require.Nil(t, legacy)
	require.NotNil(t, mm)
	require.Equal(t, MmBlocksActionCookieKind, mm.Kind)
	spec := mm.ActionSpec("a1")
	require.NotNil(t, spec)
	require.NotNil(t, spec.Context)
	assert.Equal(t, "v", spec.Context["k"])
	assert.Equal(t, "postid", mm.PostId)
	assert.Equal(t, "chid", mm.ChannelId)
	assert.Contains(t, spec.URL, "example.com")
	assert.Equal(t, "b", spec.Query["a"])
	assert.Equal(t, "2", spec.Query["keep"])
}

func TestAddMmBlocksActionCookies_rootPostIdAndRetain(t *testing.T) {
	secret := make([]byte, 32)
	p := &Post{Id: "postid", RootId: "rootid", ChannelId: "chid"}
	p.SetProps(StringInterface{
		PostPropsFromWebhook: "true",
		PostPropsMmBlocksActions: map[string]any{
			"a1": map[string]any{
				"type": MmBlocksActionTypeOpenURL,
				"url":  "https://example.com",
			},
		},
	})
	AddMmBlocksActionCookies(p, secret)

	plain, err := DecryptPostActionCookie(p.GetProp(PostPropsMmBlocksActions).(string), secret)
	require.NoError(t, err)
	_, mm, err := ParseDecryptedActionCookiePayload(plain)
	require.NoError(t, err)
	assert.Equal(t, "rootid", mm.RootPostId)
	assert.Equal(t, "true", mm.RetainProps[PostPropsFromWebhook])
}

func TestParseDecryptedActionCookiePayload_LegacyPostActionCookie(t *testing.T) {
	c := &PostActionCookie{
		PostId:    "p1",
		ChannelId: "c1",
		Integration: &PostActionIntegration{
			URL: "https://hooks.example.com/x",
		},
	}
	b, err := json.Marshal(c)
	require.NoError(t, err)
	legacy, mm, err := ParseDecryptedActionCookiePayload(string(b))
	require.NoError(t, err)
	require.NotNil(t, legacy)
	require.Nil(t, mm)
	assert.Equal(t, "p1", legacy.PostId)
	assert.Equal(t, "https://hooks.example.com/x", legacy.Integration.URL)
}

func TestParseDecryptedActionCookiePayload_MmBlocksCookie(t *testing.T) {
	mm := &MmBlocksActionCookie{
		Kind:      MmBlocksActionCookieKind,
		PostId:    "p1",
		ChannelId: "c1",
		Actions: map[string]map[string]any{
			"a": {"type": MmBlocksActionTypeOpenURL, "url": "https://example.com"},
		},
	}
	b, err := json.Marshal(mm)
	require.NoError(t, err)
	legacy, parsed, err := ParseDecryptedActionCookiePayload(string(b))
	require.NoError(t, err)
	require.Nil(t, legacy)
	require.NotNil(t, parsed)
	assert.Equal(t, MmBlocksActionCookieKind, parsed.Kind)
	assert.Equal(t, "p1", parsed.PostId)
}

func TestParseDecryptedActionCookiePayload_InvalidJSON(t *testing.T) {
	_, _, err := ParseDecryptedActionCookiePayload("{")
	require.Error(t, err)
}
