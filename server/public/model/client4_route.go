package model

import (
	"errors"
	"net/url"
	"strings"
)

var errInvalidClientRouteSegment = errors.New("invalid client route segment")

type clientRoute struct {
	segments []string
	err      error
}

func cleanSegment(segment string) (string, error) {
	for _, part := range strings.Split(segment, "/") {
		if part == "." || part == ".." {
			return "", errInvalidClientRouteSegment
		}
	}
	return url.PathEscape(segment), nil
}

func newClientRoute(segment string) clientRoute {
	return clientRoute{}.Join(segment)
}

func (r clientRoute) Join(segments ...any) clientRoute {
	for _, segment := range segments {
		if s, ok := segment.(string); ok {
			cleaned, err := cleanSegment(s)
			if err != nil && r.err == nil {
				r.err = err
			}
			if err == nil {
				r.segments = append(r.segments, cleaned)
			}
		}

		if s, ok := segment.(clientRoute); ok {
			if s.err != nil && r.err == nil {
				r.err = s.err
			}
			r.segments = append(r.segments, s.segments...)
		}
	}

	return r
}

func (r clientRoute) URL() (*url.URL, error) {
	path, err := r.String()
	if err != nil {
		return nil, err
	}
	return &url.URL{Path: path}, nil
}

func (r clientRoute) String() (string, error) {
	if r.err != nil {
		return "", r.err
	}
	// Make sure that there is a leading slash
	return url.JoinPath("/", strings.Join(r.segments, "/"))
}
