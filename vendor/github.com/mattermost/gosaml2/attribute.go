package saml2

import "github.com/mattermost/gosaml2/types"

// Values is a convenience wrapper for a map of strings to Attributes, which
// can be used for easy access to the string values of Attribute lists.
type Values map[string]types.Attribute

// Get is a safe method (nil maps will not panic) for returning the first value
// for an attribute at a key, or the empty string if none exists.
func (vals Values) Get(k string) string {
	if vals == nil {
		return ""
	}
	if v, ok := vals[k]; ok && len(v.Values) > 0 {
		return string(v.Values[0].Value)
	}
	return ""
}
