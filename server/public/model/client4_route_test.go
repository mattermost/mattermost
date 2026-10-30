package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewClientRoute(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple path",
			input:    "api",
			expected: "/api",
		},
		{
			name:     "path with special characters",
			input:    "hello world",
			expected: "/hello%20world",
		},
		{
			name:     "path with slashes",
			input:    "api/v4",
			expected: "/api%2Fv4",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			route := newClientRoute(tt.input)
			result, err := route.String()
			require.NoError(t, err)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestClientRouteJoinRoute(t *testing.T) {
	tests := []struct {
		name     string
		base     clientRoute
		join     clientRoute
		expected string
		wantErr  bool
	}{
		{
			name:     "join two valid routes",
			base:     newClientRoute("api"),
			join:     newClientRoute("v4"),
			expected: "/api/v4",
			wantErr:  false,
		},
		{
			name:    "join a route built from a rejected path element",
			base:    newClientRoute("api"),
			join:    newClientRoute(".."),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.Join(tt.join)
			str, err := result.String()
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, str)
			}
		})
	}
}

func TestClientRouteJoinSegment(t *testing.T) {
	tests := []struct {
		name     string
		base     clientRoute
		segment  string
		expected string
		wantErr  bool
	}{
		{
			name:     "valid segment",
			base:     newClientRoute("api"),
			segment:  "v4",
			expected: "/api/v4",
			wantErr:  false,
		},
		{
			name:     "segment with spaces",
			base:     newClientRoute("api"),
			segment:  "hello world",
			expected: "/api/hello%20world",
			wantErr:  false,
		},
		{
			name:     "segment with slash - escaped",
			base:     newClientRoute("api"),
			segment:  "v4/users",
			expected: "/api/v4%2Fusers",
			wantErr:  false,
		},
		{
			name:     "empty segment",
			base:     newClientRoute("api"),
			segment:  "",
			expected: "/api/",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.Join(tt.segment)
			str, err := result.String()
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, str)
			}
		})
	}
}

func TestClientRouteJoin(t *testing.T) {
	tests := []struct {
		name     string
		base     clientRoute
		segments []any
		expected string
		wantErr  bool
	}{
		{
			name:     "multiple valid segments",
			base:     newClientRoute("api"),
			segments: []any{"v4", "users", "me"},
			expected: "/api/v4/users/me",
			wantErr:  false,
		},
		{
			name:     "no segments",
			base:     newClientRoute("api"),
			segments: []any{},
			expected: "/api",
			wantErr:  false,
		},
		{
			name:     "segment with slash - escaped",
			base:     newClientRoute("api"),
			segments: []any{"v4", "users/me"},
			expected: "/api/v4/users%2Fme",
			wantErr:  false,
		},
		{
			name:     "empty segment",
			base:     newClientRoute("api"),
			segments: []any{"v4", "users", "", "me"},
			expected: "/api/v4/users/me",
			wantErr:  false,
		},
		{
			name:     "empty segment at the end",
			base:     newClientRoute("api"),
			segments: []any{"v4", "users", ""},
			expected: "/api/v4/users/",
			wantErr:  false,
		},
		{
			name:     "dot-dot segment among valid segments",
			base:     newClientRoute("api"),
			segments: []any{"v4", "..", "users"},
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.Join(tt.segments...)
			str, err := result.String()
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, str)
			}
		})
	}
}

func TestClientRouteURL(t *testing.T) {
	tests := []struct {
		name        string
		route       clientRoute
		expectedURL string
		wantErr     bool
	}{
		{
			name:        "simple route",
			route:       newClientRoute("api").Join(newClientRoute("v4")),
			expectedURL: "/api/v4",
			wantErr:     false,
		},
		{
			name:        "empty route",
			route:       clientRoute{},
			expectedURL: "/",
			wantErr:     false,
		},
		{
			name:        "complex route",
			route:       newClientRoute("api").Join(newClientRoute("v4"), "users"),
			expectedURL: "/api/v4/users",
			wantErr:     false,
		},
		{
			name:    "dot-dot path element is rejected",
			route:   newClientRoute("users").Join("username", ".."),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := tt.route.URL()
			if tt.wantErr {
				require.Error(t, err)
				require.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
				require.Equal(t, tt.expectedURL, result.Path)
			}
		})
	}
}

func TestClientRouteString(t *testing.T) {
	tests := []struct {
		name     string
		route    clientRoute
		expected string
		wantErr  bool
	}{
		{
			name:     "simple route",
			route:    newClientRoute("api"),
			expected: "/api",
			wantErr:  false,
		},
		{
			name:     "empty route",
			route:    clientRoute{},
			expected: "/",
			wantErr:  false,
		},
		{
			name:     "complex route",
			route:    newClientRoute("api").Join(newClientRoute("v4"), "users", "me"),
			expected: "/api/v4/users/me",
			wantErr:  false,
		},
		{
			name:     "route with special characters",
			route:    newClientRoute("api").Join("hello world"),
			expected: "/api/hello%20world",
			wantErr:  false,
		},
		{
			name:     "plain username segment is preserved",
			route:    newClientRoute("users").Join("username", "john"),
			expected: "/users/username/john",
			wantErr:  false,
		},
		{
			name:     "username with a single embedded dot is preserved",
			route:    newClientRoute("users").Join("username", "jo.hn"),
			expected: "/users/username/jo.hn",
			wantErr:  false,
		},
		{
			name:     "username with adjacent dots is preserved",
			route:    newClientRoute("users").Join("username", "jo..hn"),
			expected: "/users/username/jo..hn",
			wantErr:  false,
		},
		{
			name:     "three-dot username is preserved",
			route:    newClientRoute("users").Join("username", "..."),
			expected: "/users/username/...",
			wantErr:  false,
		},
		{
			name:     "username with leading adjacent dots is preserved",
			route:    newClientRoute("users").Join("username", "..foo"),
			expected: "/users/username/..foo",
			wantErr:  false,
		},
		{
			name:     "username with trailing adjacent dots is preserved",
			route:    newClientRoute("users").Join("username", "foo.."),
			expected: "/users/username/foo..",
			wantErr:  false,
		},
		{
			name:    "dot-only path element is rejected",
			route:   newClientRoute("").Join("."),
			wantErr: true,
		},
		{
			name:    "dot-dot path element is rejected",
			route:   newClientRoute("").Join(".."),
			wantErr: true,
		},
		{
			name:    "parent path element in segment is rejected",
			route:   newClientRoute("").Join("../me"),
			wantErr: true,
		},
		{
			name:    "parent path element inside segment is rejected",
			route:   newClientRoute("").Join("api/../v4"),
			wantErr: true,
		},
		{
			name:     "route with control characters, which make url.JoinPath to error out",
			route:    newClientRoute("[fe80::1%en0]"),
			expected: "/%5Bfe80::1%25en0%5D",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := tt.route.String()
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestClientRouteLeadingSlash(t *testing.T) {
	tests := []struct {
		name  string
		route clientRoute
	}{
		{
			name:  "single segment",
			route: newClientRoute("api"),
		},
		{
			name:  "multiple segments",
			route: newClientRoute("api").Join("v4"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test String() has leading slash
			str, err := tt.route.String()
			require.NoError(t, err)
			require.True(t, len(str) > 0 && str[0] == '/', "String() result should have leading slash")

			// Test URL() has leading slash
			u, err := tt.route.URL()
			require.NoError(t, err)
			require.True(t, len(u.Path) > 0 && u.Path[0] == '/', "URL() result path should have leading slash")
		})
	}
}

func TestClean(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		wantErr  bool
	}{
		{
			name:     "simple string",
			input:    "api",
			expected: "api",
		},
		{
			name:     "plain username",
			input:    "john",
			expected: "john",
		},
		{
			name:     "username with a single embedded dot",
			input:    "jo.hn",
			expected: "jo.hn",
		},
		{
			name:     "username with adjacent dots",
			input:    "jo..hn",
			expected: "jo..hn",
		},
		{
			name:     "string with spaces",
			input:    "hello world",
			expected: "hello%20world",
		},
		{
			name:     "string with slashes",
			input:    "api/v4",
			expected: "api%2Fv4",
		},
		{
			name:    "just two dots",
			input:   "..",
			wantErr: true,
		},
		{
			name:    "two dots at start",
			input:   "../api",
			wantErr: true,
		},
		{
			name:    "two dots at end",
			input:   "api/..",
			wantErr: true,
		},
		{
			name:    "two dots in middle",
			input:   "api/../v4",
			wantErr: true,
		},
		{
			name:    "multiple two dots",
			input:   "../../api",
			wantErr: true,
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "special characters",
			input:    "user@example.com",
			expected: "user@example.com",
		},
		{
			name:    "single dot",
			input:   ".",
			wantErr: true,
		},
		{
			name:     "three dots",
			input:    "...",
			expected: "...",
		},
		{
			name:     "four dots",
			input:    "....",
			expected: "....",
		},
		{
			name:     "leading dot that is not a lone path element",
			input:    ".foo",
			expected: ".foo",
		},
		{
			name:     "trailing dot that is not a lone path element",
			input:    "foo.",
			expected: "foo.",
		},
		{
			name:     "leading adjacent dots that are not a lone path element",
			input:    "..foo",
			expected: "..foo",
		},
		{
			name:     "trailing adjacent dots that are not a lone path element",
			input:    "foo..",
			expected: "foo..",
		},
		{
			name:    "dot path element inside a slashed segment",
			input:   "foo/./bar",
			wantErr: true,
		},
		{
			name:    "dot-dot path element after a leading slash",
			input:   "/..",
			wantErr: true,
		},
		{
			name:     "percent-encoded dots are escaped",
			input:    "%2E%2E",
			expected: "%252E%252E",
		},
		{
			name:     "fullwidth dot is escaped",
			input:    "jo\uFF0Ehn",
			expected: "jo%EF%BC%8Ehn",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := cleanSegment(tt.input)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expected, result)
		})
	}
}
