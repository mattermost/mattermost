package model

import (
	"fmt"
	"net/url"
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
			name:     "base has error",
			base:     clientRoute{err: fmt.Errorf("test error")},
			join:     newClientRoute("v4"),
			expected: "",
			wantErr:  true,
		},
		{
			name:     "join has error",
			base:     newClientRoute("api"),
			join:     clientRoute{err: fmt.Errorf("test error")},
			expected: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinRoute(tt.join)
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
			name:     "segment with slash - should error",
			base:     newClientRoute("api"),
			segment:  "v4/users",
			expected: "",
			wantErr:  true,
		},
		{
			name:     "empty segment",
			base:     newClientRoute("api"),
			segment:  "",
			expected: "/api",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinSegment(tt.segment)
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
			name:     "segment with slash - should error",
			base:     newClientRoute("api"),
			segments: []string{"v4", "users/me"},
			expected: "",
			wantErr:  true,
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

func TestClientRouteJoinId(t *testing.T) {
	tests := []struct {
		name     string
		base     clientRoute
		id       string
		expected string
		wantErr  bool
	}{
		{
			name:     "valid ID",
			base:     newClientRoute("api"),
			id:       "abcdefghijklmnopqrstuvwxyz",
			expected: "/api/abcdefghijklmnopqrstuvwxyz",
			wantErr:  false,
		},
		{
			name:     "invalid ID - too short",
			base:     newClientRoute("api"),
			id:       "short",
			expected: "",
			wantErr:  true,
		},
		{
			name:     "invalid ID - empty",
			base:     newClientRoute("api"),
			id:       "",
			expected: "",
			wantErr:  true,
		},
		{
			name:     "invalid ID - special characters",
			base:     newClientRoute("api"),
			id:       "abcdefghijklmnopqrstuvwx!",
			expected: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinId(tt.id)
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

func TestClientRouteJoinUsername(t *testing.T) {
	tests := []struct {
		name     string
		base     clientRoute
		username string
		expected string
		wantErr  bool
	}{
		{
			name:     "valid username",
			base:     newClientRoute("api"),
			username: "john.doe",
			expected: "/api/john.doe",
			wantErr:  false,
		},
		{
			name:     "valid username with numbers",
			base:     newClientRoute("api"),
			username: "user123",
			expected: "/api/user123",
			wantErr:  false,
		},
		{
			name:     "invalid username - too short",
			base:     newClientRoute("api"),
			username: "",
			expected: "",
			wantErr:  true,
		},
		{
			name:     "invalid username - special characters",
			base:     newClientRoute("api"),
			username: "user@name",
			expected: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinUsername(tt.username)
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

func TestClientRouteJoinTeamname(t *testing.T) {
	tests := []struct {
		name     string
		base     clientRoute
		teamname string
		expected string
		wantErr  bool
	}{
		{
			name:     "valid team name",
			base:     newClientRoute("api"),
			teamname: "myteam",
			expected: "/api/myteam",
			wantErr:  false,
		},
		{
			name:     "valid team name with dash",
			base:     newClientRoute("api"),
			teamname: "my-team",
			expected: "/api/my-team",
			wantErr:  false,
		},
		{
			name:     "invalid team name - empty",
			base:     newClientRoute("api"),
			teamname: "",
			expected: "",
			wantErr:  true,
		},
		{
			name:     "invalid team name - special characters",
			base:     newClientRoute("api"),
			teamname: "team@name",
			expected: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinTeamname(tt.teamname)
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

func TestClientRouteJoinChannelname(t *testing.T) {
	tests := []struct {
		name        string
		base        clientRoute
		channelname string
		expected    string
		wantErr     bool
	}{
		{
			name:        "valid channel name",
			base:        newClientRoute("api"),
			channelname: "mychannel",
			expected:    "/api/mychannel",
			wantErr:     false,
		},
		{
			name:        "valid channel name with dash",
			base:        newClientRoute("api"),
			channelname: "my-channel",
			expected:    "/api/my-channel",
			wantErr:     false,
		},
		{
			name:        "invalid channel name - empty",
			base:        newClientRoute("api"),
			channelname: "",
			expected:    "",
			wantErr:     true,
		},
		{
			name:        "invalid channel name - special characters",
			base:        newClientRoute("api"),
			channelname: "channel@name",
			expected:    "",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinChannelname(tt.channelname)
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

func TestClientRouteJoinEmail(t *testing.T) {
	tests := []struct {
		name     string
		base     clientRoute
		email    string
		expected string
		wantErr  bool
	}{
		{
			name:     "valid email",
			base:     newClientRoute("api"),
			email:    "user@example.com",
			expected: "/api/user@example.com",
			wantErr:  false,
		},
		{
			name:     "valid email with dots",
			base:     newClientRoute("api"),
			email:    "user.name@example.com",
			expected: "/api/user.name@example.com",
			wantErr:  false,
		},
		{
			name:     "invalid email - no @",
			base:     newClientRoute("api"),
			email:    "userexample.com",
			expected: "",
			wantErr:  true,
		},
		{
			name:     "invalid email - empty",
			base:     newClientRoute("api"),
			email:    "",
			expected: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinEmail(tt.email)
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

func TestClientRouteJoinEmojiname(t *testing.T) {
	tests := []struct {
		name      string
		base      clientRoute
		emojiname string
		expected  string
		wantErr   bool
	}{
		{
			name:      "valid emoji name",
			base:      newClientRoute("api"),
			emojiname: "custom_test_emoji",
			expected:  "/api/custom_test_emoji",
			wantErr:   false,
		},
		{
			name:      "valid emoji name with underscore",
			base:      newClientRoute("api"),
			emojiname: "my_custom_emoji",
			expected:  "/api/my_custom_emoji",
			wantErr:   false,
		},
		{
			name:      "invalid emoji name - empty",
			base:      newClientRoute("api"),
			emojiname: "",
			expected:  "",
			wantErr:   true,
		},
		{
			name:      "invalid emoji name - special characters",
			base:      newClientRoute("api"),
			emojiname: "smile!",
			expected:  "",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.base.JoinEmojiname(tt.emojiname)
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
			route:       newClientRoute("api").JoinRoute(newClientRoute("v4")),
			expectedURL: "/api/v4",
			wantErr:     false,
		},
		{
			name:        "route with error",
			route:       clientRoute{err: fmt.Errorf("test error")},
			expectedURL: "",
			wantErr:     true,
		},
		{
			name:        "empty route",
			route:       clientRoute{},
			expectedURL: "/",
			wantErr:     false,
		},
		{
			name:        "complex route",
			route:       newClientRoute("api").JoinRoute(newClientRoute("v4")).JoinSegment("users"),
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
			name:     "route with error",
			route:    clientRoute{err: fmt.Errorf("test error")},
			expected: "",
			wantErr:  true,
		},
		{
			name:     "empty route",
			route:    clientRoute{},
			expected: "/",
			wantErr:  false,
		},
		{
			name:     "complex route",
			route:    newClientRoute("api").JoinRoute(newClientRoute("v4")).JoinSegment("users").JoinSegment("me"),
			expected: "/api/v4/users/me",
			wantErr:  false,
		},
		{
			name:     "route with special characters",
			route:    newClientRoute("api").JoinSegment("hello world"),
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

func TestClientRouteErrorPropagation(t *testing.T) {
	t.Run("error propagates through chain", func(t *testing.T) {
		// Create a route with an error in the middle
		route := newClientRoute("api").
			JoinSegment("invalid/segment"). // This will cause an error
			JoinSegment("v4").
			JoinSegment("users")

		_, err := route.String()
		require.Error(t, err)
		require.Contains(t, err.Error(), "contains slashes")
	})

	t.Run("error from validation propagates", func(t *testing.T) {
		route := newClientRoute("api").
			JoinId("invalid-id"). // This will cause an error
			JoinSegment("test")

		_, err := route.String()
		require.Error(t, err)
		require.Contains(t, err.Error(), "not a valid ID")
	})
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
			route: newClientRoute("api").JoinSegment("v4"),
		},
		{
			name:  "empty route",
			route: clientRoute{url: url.URL{}},
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
