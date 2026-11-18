// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
)

func TestMaskURLCredentials(t *testing.T) {
	t.Parallel()

	for in, want := range map[string]string{
		"http://search.example.com:9200":                   "http://search.example.com:9200",
		"http://user:pass@search.example.com:9200":         "http://****@search.example.com:9200",
		"https://token@search.example.com":                 "https://****@search.example.com",
		"https://user:p@ss@search.example.com/x@y":         "https://****@search.example.com/x@y",
		"https://user:password@push.example.com/version":   "https://****@push.example.com/version",
		"https://user:p@ss@push.example.com/version":       "https://****@push.example.com/version",
		"a http://u:p@one.example.com b ftp://x@two":       "a http://****@one.example.com b ftp://****@two",
		"no url here, user@example.com":                    "no url here, user@example.com",
		"https://api.example.com?email=ops@example.net":    "https://api.example.com?email=ops@example.net",
		"https://api.example.com/v1?email=ops@example.net": "https://api.example.com/v1?email=ops@example.net",
		"https://api.example.com#ops@example.net":          "https://api.example.com#ops@example.net",
		"https://user:p@ss@api.example.com?email=a@b.c":    "https://****@api.example.com?email=a@b.c",
	} {
		assert.Equal(t, want, MaskURLCredentials(in), in)
	}
}

func TestSanitizeJobError(t *testing.T) {
	t.Parallel()

	t.Run("a short error is only masked", func(t *testing.T) {
		assert.Equal(t,
			"LDAP Result Code 200: ldap://****@ldap.example.com:389: connection refused",
			SanitizeJobError("LDAP Result Code 200: ldap://admin:hunter2@ldap.example.com:389: connection refused"))
	})

	t.Run("an error at the limit is kept whole", func(t *testing.T) {
		exact := strings.Repeat("x", maxJobErrorRunes)
		assert.Equal(t, exact, SanitizeJobError(exact))
	})

	t.Run("a long error is truncated on a rune boundary", func(t *testing.T) {
		got := SanitizeJobError(strings.Repeat("ü", maxJobErrorRunes+10))

		assert.True(t, utf8.ValidString(got))
		assert.Equal(t, strings.Repeat("ü", maxJobErrorRunes)+"…", got)
	})

	t.Run("credentials are masked before the error is truncated", func(t *testing.T) {
		got := SanitizeJobError("s3://AKIA:secret@bucket.example.com " + strings.Repeat("y", maxJobErrorRunes))

		assert.True(t, strings.HasPrefix(got, "s3://****@bucket.example.com "))
		assert.NotContains(t, got, "secret")
		assert.Equal(t, maxJobErrorRunes+1, utf8.RuneCountInString(got))
	})
}
