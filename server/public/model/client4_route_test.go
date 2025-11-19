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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinRoutes(tt.join)
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
			result := tt.base.JoinSegments(tt.segment)
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

func TestClientRouteJoinSegments(t *testing.T) {
	tests := []struct {
		name     string
		base     clientRoute
		segments []string
		expected string
		wantErr  bool
	}{
		{
			name:     "multiple valid segments",
			base:     newClientRoute("api"),
			segments: []string{"v4", "users", "me"},
			expected: "/api/v4/users/me",
			wantErr:  false,
		},
		{
			name:     "no segments",
			base:     newClientRoute("api"),
			segments: []string{},
			expected: "/api",
			wantErr:  false,
		},
		{
			name:     "segment with slash - escaped",
			base:     newClientRoute("api"),
			segments: []string{"v4", "users/me"},
			expected: "/api/v4/users%2Fme",
			wantErr:  false,
		},
		{
			name:     "empty segment",
			base:     newClientRoute("api"),
			segments: []string{"v4", "users", "", "me"},
			expected: "/api/v4/users/me",
			wantErr:  false,
		},
		{
			name:     "empty segment at the end",
			base:     newClientRoute("api"),
			segments: []string{"v4", "users", ""},
			expected: "/api/v4/users/",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinSegments(tt.segments...)
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
			route:       newClientRoute("api").JoinRoutes(newClientRoute("v4")),
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
			route:       newClientRoute("api").JoinRoutes(newClientRoute("v4")).JoinSegments("users"),
			expectedURL: "/api/v4/users",
			wantErr:     false,
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
			route:    newClientRoute("api").JoinRoutes(newClientRoute("v4")).JoinSegments("users", "me"),
			expected: "/api/v4/users/me",
			wantErr:  false,
		},
		{
			name:     "route with special characters",
			route:    newClientRoute("api").JoinSegments("hello world"),
			expected: "/api/hello%20world",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := tt.route.String()
			if tt.wantErr {
				require.Error(t, err)
				require.Equal(t, tt.expected, result)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, result)
			}
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
			route: newClientRoute("api").JoinSegments("v4"),
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
