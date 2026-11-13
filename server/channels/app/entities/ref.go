// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"regexp"
	"strings"
)

// CoreOwner owns the built-in types. Other owners may attach matchers and providers to them.
const CoreOwner = "mm"

const (
	refSeparator = ":"
	maxOwnerLen  = 190
	maxNameLen   = 80
)

var (
	ownerPattern = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)
	namePattern  = regexp.MustCompile(`^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$`)
)

// Ref names a type, matcher or provider by its owner and the owner's name for it.
// Its wire form is "owner:name". Owners cannot contain the separator, so the
// wire form always splits back into the same owner and name.
type Ref struct {
	Owner string
	Name  string
}

func (r Ref) String() string {
	return r.Owner + refSeparator + r.Name
}

func (r Ref) valid() bool {
	return len(r.Owner) <= maxOwnerLen && ownerPattern.MatchString(r.Owner) &&
		len(r.Name) <= maxNameLen && namePattern.MatchString(r.Name)
}

// ParseRef reads a wire id such as "mm:time".
func ParseRef(id string) (Ref, bool) {
	owner, name, found := strings.Cut(id, refSeparator)
	r := Ref{Owner: owner, Name: name}
	return r, found && r.valid()
}

// ResolveRef reads ref as a wire id when it names an owner, and otherwise as
// one of owner's own names.
func ResolveRef(owner, ref string) (Ref, bool) {
	if strings.Contains(ref, refSeparator) {
		return ParseRef(ref)
	}
	r := Ref{Owner: owner, Name: ref}
	return r, r.valid()
}

// LocalRef writes id the way owner refers to it: a bare name for one of its
// own, and the wire id for anyone else's.
func LocalRef(owner, id string) string {
	if r, ok := ParseRef(id); ok && r.Owner == owner {
		return r.Name
	}
	return id
}
