package model

import (
	"fmt"
	"net/url"
	"strings"
)

// clientRoute is a thin wrapper around url.URL, with additional methods
// validating special URL path segments, like IDs, emails or emoji names, and
// which tracks any errors encountered while building it.
//
// It exposes several JoinXYZ functions, which validate the XYZ entity passed
// (if it's a valid ID, channel name, email...) that can be chained to build
// routes. These functions store an internal error if the validation fails.
//
// This error is then returned when calling either URL or String, which both
// return the underlying url.URL (its raw form or converted to string), only
// if there were no errors when building the whole route.
type clientRoute struct {
	url url.URL
	err error
}

func newClientRoute(v string) clientRoute {
	var r clientRoute
	r.url = *r.url.JoinPath(url.PathEscape(v))
	return r
}

func (r clientRoute) JoinRoute(newRoute clientRoute) clientRoute {
	if r.err != nil {
		return r
	}

	if newRoute.err != nil {
		r.err = newRoute.err
		return r
	}

	r.url = *r.url.JoinPath(newRoute.url.String())
	return r
}

func (r clientRoute) JoinSegment(v string) clientRoute {
	if strings.Contains(v, "/") {
		r.err = fmt.Errorf("%q contains slashes", v)
		return r
	}

	return r.JoinRoute(newClientRoute(v))
}

func (r clientRoute) JoinSegments(values ...string) clientRoute {
	for _, v := range values {
		r = r.JoinSegment(v)
	}
	return r
}

func (r clientRoute) JoinId(v string) clientRoute {
	if !IsValidId(v) {
		r.err = fmt.Errorf("%q is not a valid ID", v)
		return r
	}

	return r.JoinSegment(v)
}

func (r clientRoute) JoinUsername(v string) clientRoute {
	if !IsValidUsername(v) {
		r.err = fmt.Errorf("%q is not a valid username", v)
		return r
	}

	return r.JoinSegment(v)
}

func (r clientRoute) JoinTeamname(v string) clientRoute {
	if !IsValidTeamName(v) {
		r.err = fmt.Errorf("%q is not a valid team name", v)
		return r
	}

	return r.JoinSegment(v)
}

func (r clientRoute) JoinChannelname(v string) clientRoute {
	if !IsValidChannelIdentifier(v) {
		r.err = fmt.Errorf("%q is not a valid channel name", v)
		return r
	}

	return r.JoinSegment(v)
}

func (r clientRoute) JoinEmail(v string) clientRoute {
	if !IsValidEmail(v) {
		r.err = fmt.Errorf("%q is not a valid email", v)
		return r
	}

	return r.JoinSegment(v)
}

func (r clientRoute) JoinEmojiname(v string) clientRoute {
	if err := IsValidEmojiName(v); err != nil {
		r.err = fmt.Errorf("%q is not a valid emoji name: %w", v, err)
		return r
	}

	return r.JoinSegment(v)
}

func (r clientRoute) URL() (*url.URL, error) {
	if r.err != nil {
		return nil, r.err
	}

	// Make a copy and ensure there is a leading slash
	urlCopy := r.url
	path, err := url.JoinPath("/", r.url.String())
	if err != nil {
		return nil, err
	}
	urlCopy.Path = path
	return &urlCopy, nil
}

func (r clientRoute) String() (string, error) {
	if r.err != nil {
		return "", r.err
	}

	// Make sure that there is a leading slash
	return url.JoinPath("/", r.url.String())
}
