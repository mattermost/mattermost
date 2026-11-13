// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	maxPatternBytes    = 1000
	maxOwnerMatchers   = 50
	maxTerms           = 500
	maxTermTitleRune   = 120
	maxTermURLBytes    = 2048
	maxDisplayNameRune = 64
)

// Remote is a registered provider that should describe a matched value.
type Remote struct {
	Provider Ref
	Cache    string
	CacheTTL time.Duration
}

type entityType struct {
	ref         Ref
	displayName string
}

type storedProvider struct {
	ref      Ref
	typeID   string
	hasCard  bool
	cache    string
	cacheTTL time.Duration
}

type storedTerm struct {
	owner       string
	typeID      string
	value       string
	title       string
	url         string
	displayName string
}

type registry struct {
	mu               sync.RWMutex
	types            map[string]entityType
	matchers         []matcher
	matcherIndex     map[string]int
	providers        []storedProvider
	terms            []storedTerm
	cachedGeneration string
	cachedTermEpoch  string
	cachedProviders  string
}

var reg = newRegistry()

func newRegistry() *registry {
	r := &registry{
		types: map[string]entityType{},
	}
	r.rememberGeneration()
	r.rememberTerms()
	r.rememberProviders()
	return r
}

func activeTerms() []storedTerm {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	out := make([]storedTerm, len(reg.terms))
	copy(out, reg.terms)
	return out
}

// ReplaceTerms replaces every exact term an owner has registered for one of its types.
// typeRef is one of the owner's type names or its wire id.
// The epoch is a hash of the dictionary. changed is false when the dictionary is the same.
func ReplaceTerms(owner, typeRef string, terms []model.EntityTerm) (string, bool, error) {
	typ, ok := ResolveRef(owner, typeRef)
	if !ok || typ.Owner != owner {
		return "", false, fmt.Errorf("type is not available to this owner")
	}
	typeID := typ.String()
	cleaned := make([]storedTerm, 0, len(terms))
	seen := map[string]struct{}{}
	for _, term := range terms {
		if !termValueOK(term.Value) {
			return "", false, fmt.Errorf("term is not allowed")
		}
		if _, ok := seen[term.Value]; ok {
			return "", false, fmt.Errorf("term is duplicated")
		}
		seen[term.Value] = struct{}{}
		title := strings.TrimSpace(term.Title)
		if title == "" || utf8.RuneCountInString(title) > maxTermTitleRune {
			return "", false, fmt.Errorf("term title is not allowed")
		}
		link, err := termURL(term.URL)
		if err != nil {
			return "", false, err
		}
		cleaned = append(cleaned, storedTerm{
			owner:  owner,
			typeID: typeID,
			value:  term.Value,
			title:  title,
			url:    link,
		})
	}
	reg.mu.Lock()
	defer reg.mu.Unlock()
	t, ok := reg.types[typeID]
	if !ok {
		return "", false, fmt.Errorf("type is not available to this owner")
	}
	kept := make([]storedTerm, 0, len(reg.terms))
	count := 0
	for _, existing := range reg.terms {
		if existing.owner == owner && existing.typeID == typeID {
			continue
		}
		if existing.owner == owner {
			count++
		}
		kept = append(kept, existing)
	}
	if count+len(cleaned) > maxTerms {
		return "", false, fmt.Errorf("term quota is exhausted")
	}
	for i := range cleaned {
		cleaned[i].displayName = t.displayName
	}
	next := append(kept, cleaned...)
	epoch := hashTerms(next)
	if epoch == reg.cachedTermEpoch {
		return epoch, false, nil
	}
	reg.terms = next
	reg.cachedTermEpoch = epoch
	return epoch, true, nil
}

func hashTerms(terms []storedTerm) string {
	sorted := append([]storedTerm(nil), terms...)
	slices.SortFunc(sorted, func(a, b storedTerm) int {
		if c := cmp.Compare(a.typeID, b.typeID); c != 0 {
			return c
		}
		return cmp.Compare(a.value, b.value)
	})
	h := sha256.New()
	for _, term := range sorted {
		fmt.Fprintf(h, "%s\n%s\n%s\n%s\n%s\n", term.typeID, term.value, term.title, term.url, term.displayName)
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func termValueOK(value string) bool {
	runes := utf8.RuneCountInString(value)
	if runes < 2 || runes > 32 {
		return false
	}
	for i, r := range value {
		if i == 0 && !unicode.IsLetter(r) {
			return false
		}
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}

func termURL(raw string) (string, error) {
	if raw == "" {
		return "", fmt.Errorf("url is required")
	}
	if len(raw) > maxTermURLBytes {
		return "", fmt.Errorf("url is not allowed")
	}
	if strings.ContainsAny(raw, " \t\r\n\\") {
		return "", fmt.Errorf("url is not allowed")
	}
	if strings.HasPrefix(raw, "https://") {
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Host == "" {
			return "", fmt.Errorf("url is not allowed")
		}
		return raw, nil
	}
	if strings.HasPrefix(raw, "/") && !strings.HasPrefix(raw, "//") && !strings.Contains(raw, "..") {
		return raw, nil
	}
	return "", fmt.Errorf("url is not allowed")
}

func activeMatchers() []matcher {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	out := make([]matcher, len(reg.matchers))
	for i, stored := range reg.matchers {
		out[i] = stored
		if t, ok := reg.types[stored.typeID]; ok {
			out[i].displayName = t.displayName
		}
	}
	return out
}

// PatternGeneration is a hash of every enabled pattern. It changes when a
// matcher is added or edited, which is how stored rows know they are stale.
func PatternGeneration() string {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	return reg.cachedGeneration
}

// TermEpoch is a hash of the dictionary. The same terms produce the same epoch on every node.
func TermEpoch() string {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	return reg.cachedTermEpoch
}

// ProviderGeneration is a hash of every registered card provider. It changes when
// a provider is added, replaced, or removed, so clients and card caches refresh.
func ProviderGeneration() string {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	return reg.cachedProviders
}

func (r *registry) rememberTerms() {
	r.cachedTermEpoch = hashTerms(r.terms)
}

func (r *registry) rememberProviders() {
	h := sha256.New()
	ids := append([]storedProvider(nil), r.providers...)
	slices.SortFunc(ids, func(a, b storedProvider) int {
		if c := cmp.Compare(a.ref.String(), b.ref.String()); c != 0 {
			return c
		}
		return cmp.Compare(a.typeID, b.typeID)
	})
	for _, provider := range ids {
		fmt.Fprintf(h, "%s\n%s\n%t\n%s\n%d\n", provider.ref, provider.typeID, provider.hasCard, provider.cache, int64(provider.cacheTTL/time.Second))
	}
	r.cachedProviders = hex.EncodeToString(h.Sum(nil))[:16]
}

func (r *registry) rememberGeneration() {
	r.cachedGeneration = r.generation()
	index := make(map[string]int, len(r.matchers))
	for i := range r.matchers {
		index[r.matchers[i].id] = i
	}
	r.matcherIndex = index
}

func (r *registry) generation() string {
	h := sha256.New()
	ids := append([]matcher(nil), r.matchers...)
	sortMatchers(ids)
	for _, stored := range ids {
		name := ""
		if t, ok := r.types[stored.typeID]; ok {
			name = t.displayName
		}
		fmt.Fprintf(h, "%s\n%s\n%s\n%d\n%d\n%s\n%t\n%s\n%s\n", stored.id, stored.typeID, stored.pattern.String(), stored.valueGroup, stored.spanGroup, stored.boundary, stored.skipBots, stored.urlTemplate, name)
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func sortMatchers(list []matcher) {
	for i := 1; i < len(list); i++ {
		for j := i; j > 0 && list[j].id < list[j-1].id; j-- {
			list[j], list[j-1] = list[j-1], list[j]
		}
	}
}

// Prepare reports who can describe value. A non-nil Remote means the provider
// is asked first. The card is the core description when no provider describes it.
func Prepare(ctx context.Context, typeID, value string) (*model.EntityCard, *Remote, error) {
	reg.mu.RLock()
	known := reg.valueMatches(typeID, value)
	remote, core := reg.lookupPlan(typeID)
	reg.mu.RUnlock()
	if !known {
		return nil, nil, fmt.Errorf("unsupported entity")
	}
	if remote != nil {
		return nil, remote, nil
	}
	if card, ok := TermCard(typeID, value); ok {
		return card, nil, nil
	}
	if core {
		card, err := CoreLookup(ctx, typeID, value)
		if err != nil {
			return nil, nil, err
		}
		model.NormalizeEntityCard(card)
		return card, nil, nil
	}
	return &model.EntityCard{TypeID: typeID, Value: value, Title: value}, nil, nil
}

func (r *registry) lookupPlan(typeID string) (*Remote, bool) {
	var remote *Remote
	for _, provider := range r.providers {
		if provider.typeID == typeID && provider.hasCard {
			remote = &Remote{
				Provider: provider.ref,
				Cache:    provider.cache,
				CacheTTL: provider.cacheTTL,
			}
			break
		}
	}
	t, ok := r.types[typeID]
	return remote, ok && t.ref.Owner == CoreOwner
}

func (r *registry) valueMatches(typeID, value string) bool {
	for _, stored := range r.matchers {
		if stored.typeID != typeID {
			continue
		}
		if matcherCovers(stored, value) {
			return true
		}
	}
	for _, term := range r.terms {
		if term.typeID == typeID && term.value == value {
			return true
		}
	}
	return false
}

func matcherCovers(m matcher, value string) bool {
	if loc := m.pattern.FindStringSubmatchIndex(value); loc != nil {
		start, end := loc[0], loc[1]
		if m.valueGroup > 0 {
			if m.valueGroup*2+1 >= len(loc) {
				return false
			}
			start, end = loc[m.valueGroup*2], loc[m.valueGroup*2+1]
		}
		if start == 0 && end == len(value) {
			return true
		}
	}
	return m.valueGroup > 0 && m.valuePattern != nil && m.valuePattern.MatchString(value)
}

func compileValuePattern(pattern string, group int) (*regexp.Regexp, error) {
	if group <= 0 {
		return nil, nil
	}
	source, ok := capturingGroup(pattern, group)
	if !ok {
		return nil, fmt.Errorf("value group is outside the pattern")
	}
	compiled, err := regexp.Compile("^(?:" + source + ")$")
	if err != nil || compiled.MatchString("") {
		return nil, fmt.Errorf("value group is outside the pattern")
	}
	return compiled, nil
}

func capturingGroup(pattern string, want int) (string, bool) {
	seen := 0
	for i := 0; i < len(pattern); i++ {
		if pattern[i] == '\\' {
			i++
			continue
		}
		if pattern[i] == '[' {
			i = endOfBracketClass(pattern, i)
			continue
		}
		if pattern[i] != '(' {
			continue
		}
		if !capturingOpen(pattern, i) {
			continue
		}
		seen++
		if seen != want {
			continue
		}
		return groupBody(pattern, i)
	}
	return "", false
}

func capturingOpen(pattern string, i int) bool {
	if i+1 >= len(pattern) || pattern[i+1] != '?' {
		return true
	}
	return i+3 < len(pattern) && pattern[i+2] == 'P' && pattern[i+3] == '<'
}

func endOfBracketClass(pattern string, open int) int {
	for i := open + 1; i < len(pattern); i++ {
		if pattern[i] == '\\' {
			i++
			continue
		}
		if pattern[i] == ']' {
			return i
		}
	}
	return len(pattern) - 1
}

func groupBody(pattern string, open int) (string, bool) {
	start := open + 1
	if capturingOpen(pattern, open) && open+1 < len(pattern) && pattern[open+1] == '?' {
		rel := strings.IndexByte(pattern[open:], '>')
		if rel < 0 {
			return "", false
		}
		start = open + rel + 1
	}
	depth := 0
	for i := open; i < len(pattern); i++ {
		if pattern[i] == '\\' {
			i++
			continue
		}
		if pattern[i] == '[' {
			i = endOfBracketClass(pattern, i)
			continue
		}
		switch pattern[i] {
		case '(':
			depth++
		case ')':
			depth--
			if depth == 0 {
				if start > i {
					return "", false
				}
				return pattern[start:i], true
			}
		}
	}
	return "", false
}

// TermCard is the autolink stored for an exact term: its expansion and its link.
func TermCard(typeID, value string) (*model.EntityCard, bool) {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	for _, term := range reg.terms {
		if term.typeID == typeID && term.value == value {
			return &model.EntityCard{
				TypeID:  typeID,
				Value:   value,
				Title:   term.title,
				Summary: term.title,
				URL:     term.url,
			}, true
		}
	}
	return nil, false
}

// AddType registers a type for owner. The same owner may replace the display name.
func AddType(owner string, t *model.EntityType) error {
	if t == nil {
		return fmt.Errorf("type is required")
	}
	ref := Ref{Owner: owner, Name: t.Name}
	if !ref.valid() {
		return fmt.Errorf("type name is not allowed")
	}
	id := ref.String()
	name := strings.TrimSpace(t.DisplayName)
	if name == "" || utf8.RuneCountInString(name) > maxDisplayNameRune {
		return fmt.Errorf("display name is not allowed")
	}
	reg.mu.Lock()
	defer reg.mu.Unlock()
	reg.types[id] = entityType{ref: ref, displayName: name}
	renamed := false
	for i := range reg.terms {
		if reg.terms[i].typeID == id && reg.terms[i].displayName != name {
			reg.terms[i].displayName = name
			renamed = true
		}
	}
	if renamed {
		reg.rememberTerms()
	}
	reg.rememberGeneration()
	return nil
}

// AddMatcher registers a pattern for a core type or one of the owner's types.
func AddMatcher(owner string, spec *model.EntityMatcher) error {
	if spec == nil {
		return fmt.Errorf("matcher is required")
	}
	ref := Ref{Owner: owner, Name: spec.Name}
	if !ref.valid() {
		return fmt.Errorf("matcher name is not allowed")
	}
	typ, ok := ResolveRef(owner, spec.Type)
	if !ok {
		return fmt.Errorf("type is not available to this owner")
	}
	if spec.Pattern == "" || len(spec.Pattern) > maxPatternBytes {
		return fmt.Errorf("pattern length is not allowed")
	}
	compiled, err := regexp.Compile(spec.Pattern)
	if err != nil {
		return fmt.Errorf("pattern is not valid RE2")
	}
	if compiled.MatchString("") {
		return fmt.Errorf("pattern must not match empty text")
	}
	if spec.ValueGroup < 0 || spec.ValueGroup > compiled.NumSubexp() {
		return fmt.Errorf("value group is outside the pattern")
	}
	valuePattern, err := compileValuePattern(spec.Pattern, spec.ValueGroup)
	if err != nil {
		return err
	}
	if spec.SpanGroup < 0 || spec.SpanGroup > compiled.NumSubexp() {
		return fmt.Errorf("span group is outside the pattern")
	}
	if !boundaryKnown(spec.Boundary) {
		return fmt.Errorf("boundary is not allowed")
	}
	urlFor, err := compileURL(spec.URL)
	if err != nil {
		return err
	}
	reg.mu.Lock()
	defer reg.mu.Unlock()
	t, ok := reg.types[typ.String()]
	if !ok || !mayUse(owner, t) {
		return fmt.Errorf("type is not available to this owner")
	}
	id := ref.String()
	_, exists := reg.matcher(id)
	if !exists && reg.countMatchers(owner) >= maxOwnerMatchers {
		return fmt.Errorf("matcher quota is exhausted")
	}
	next := matcher{
		ref:          ref,
		id:           id,
		typeID:       typ.String(),
		pattern:      compiled,
		valuePattern: valuePattern,
		urlTemplate:  spec.URL,
		url:          urlFor,
		valueGroup:   spec.ValueGroup,
		spanGroup:    spec.SpanGroup,
		boundary:     spec.Boundary,
		scope:        append([]string(nil), spec.Scope...),
		skipBots:     spec.SkipBots,
		displayName:  t.displayName,
	}
	for i, stored := range reg.matchers {
		if stored.id == id {
			reg.matchers[i] = next
			reg.rememberGeneration()
			return nil
		}
	}
	reg.matchers = append(reg.matchers, next)
	reg.rememberGeneration()
	return nil
}

// UnregisterMatcher removes one of the owner's matchers, given by name or wire id.
func UnregisterMatcher(owner, matcherRef string) error {
	ref, ok := ResolveRef(owner, matcherRef)
	if !ok || ref.Owner != owner {
		return fmt.Errorf("matcher is not available to this owner")
	}
	id := ref.String()
	reg.mu.Lock()
	defer reg.mu.Unlock()
	if _, ok := reg.matcher(id); !ok {
		return fmt.Errorf("matcher is not registered")
	}
	kept := make([]matcher, 0, len(reg.matchers)-1)
	for _, stored := range reg.matchers {
		if stored.id == id {
			continue
		}
		kept = append(kept, stored)
	}
	reg.matchers = kept
	reg.rememberGeneration()
	return nil
}

// ReadContext is the channel and author a stored span is being shown to.
type ReadContext struct {
	TeamName      string
	ChannelName   string
	DirectOrGroup bool
	AuthorIsBot   bool
}

// Present stamps whether each span can open a panel, and drops spans whose
// matcher does not apply in this channel or on this author. Scope is applied
// here so a scope edit does not rescan every post.
func Present(entities []*model.PostEntity, ctx ReadContext) []*model.PostEntity {
	if len(entities) == 0 {
		return entities
	}
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	out := make([]*model.PostEntity, 0, len(entities))
	for _, entity := range entities {
		if entity == nil {
			continue
		}
		if !reg.allows(entity.MatcherID, ctx) {
			continue
		}
		next := *entity
		next.HasCard = slices.ContainsFunc(entity.TypeIDs, reg.typeHasCard)
		out = append(out, &next)
	}
	return out
}

// ReadFlags reports whether presenting these spans needs the channel or the author.
func ReadFlags(entities []*model.PostEntity) (scoped bool, bots bool) {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	for _, entity := range entities {
		if entity == nil || entity.MatcherID == "" {
			continue
		}
		stored, ok := reg.matcher(entity.MatcherID)
		if !ok {
			continue
		}
		if len(stored.scope) > 0 {
			scoped = true
		}
		if stored.skipBots {
			bots = true
		}
	}
	return scoped, bots
}

func (r *registry) matcher(id string) (matcher, bool) {
	i, ok := r.matcherIndex[id]
	if !ok || i < 0 || i >= len(r.matchers) || r.matchers[i].id != id {
		return matcher{}, false
	}
	return r.matchers[i], true
}

func (r *registry) allows(matcherID string, ctx ReadContext) bool {
	if matcherID == "" {
		return true
	}
	stored, ok := r.matcher(matcherID)
	if !ok {
		return false
	}
	if stored.skipBots && ctx.AuthorIsBot {
		return false
	}
	return scopeAllows(stored.scope, ctx)
}

func (r *registry) typeHasCard(typeID string) bool {
	for _, provider := range r.providers {
		if provider.typeID == typeID && provider.hasCard {
			return true
		}
	}
	t, ok := r.types[typeID]
	return ok && t.ref.Owner == CoreOwner && coreTypeHasCard(typeID)
}

func coreTypeHasCard(typeID string) bool {
	return typeID == CoreTimeTypeID
}

func scopeAllows(scope []string, ctx ReadContext) bool {
	if len(scope) == 0 {
		return true
	}
	if ctx.DirectOrGroup || ctx.TeamName == "" {
		return false
	}
	for _, item := range scope {
		parts := strings.Split(item, "/")
		if len(parts) == 1 && strings.EqualFold(parts[0], ctx.TeamName) {
			return true
		}
		if len(parts) == 2 && strings.EqualFold(parts[0], ctx.TeamName) && strings.EqualFold(parts[1], ctx.ChannelName) {
			return true
		}
	}
	return false
}

func boundaryKnown(preset string) bool {
	switch preset {
	case "", "token", "strict", "field", "word", "autolink", "autolink_prefix_off", "autolink_suffix_off", "autolink_guards_off", "none":
		return true
	default:
		return false
	}
}

// AddProvider registers a card source for types the owner may provide.
// Each entry in Types is one of the owner's type names or a wire id.
func AddProvider(owner string, spec *model.EntityProvider) error {
	if spec == nil || len(spec.Types) == 0 {
		return fmt.Errorf("provider is required")
	}
	ref := Ref{Owner: owner, Name: spec.Name}
	if !ref.valid() {
		return fmt.Errorf("provider name is not allowed")
	}
	typeIDs := make([]string, 0, len(spec.Types))
	for _, typeRef := range spec.Types {
		typ, ok := ResolveRef(owner, typeRef)
		if !ok {
			return fmt.Errorf("type is not available to this owner")
		}
		typeIDs = append(typeIDs, typ.String())
	}
	cacheMode, cacheTTL, err := normalizeCache(spec.Cache, spec.CacheTTLSeconds)
	if err != nil {
		return err
	}
	reg.mu.Lock()
	defer reg.mu.Unlock()
	for _, typeID := range typeIDs {
		t, ok := reg.types[typeID]
		if !ok || !mayUse(owner, t) {
			return fmt.Errorf("type is not available to this owner")
		}
	}
	reg.providers = slices.DeleteFunc(reg.providers, func(provider storedProvider) bool {
		return provider.ref == ref
	})
	for _, typeID := range typeIDs {
		reg.providers = append(reg.providers, storedProvider{
			ref:      ref,
			typeID:   typeID,
			hasCard:  spec.HasCard,
			cache:    cacheMode,
			cacheTTL: cacheTTL,
		})
	}
	reg.rememberProviders()
	return nil
}

// RemoveOwner drops every type, matcher, provider and term the owner registered.
func RemoveOwner(owner string) {
	reg.mu.Lock()
	defer reg.mu.Unlock()
	for id, t := range reg.types {
		if t.ref.Owner == owner {
			delete(reg.types, id)
		}
	}
	reg.matchers = slices.DeleteFunc(reg.matchers, func(stored matcher) bool {
		return stored.ref.Owner == owner
	})
	reg.rememberGeneration()
	reg.providers = slices.DeleteFunc(reg.providers, func(provider storedProvider) bool {
		return provider.ref.Owner == owner
	})
	reg.rememberProviders()
	reg.terms = slices.DeleteFunc(reg.terms, func(term storedTerm) bool {
		return term.owner == owner
	})
	reg.rememberTerms()
}

// mayUse reports whether owner may attach matchers and providers to t.
func mayUse(owner string, t entityType) bool {
	return t.ref.Owner == owner || t.ref.Owner == CoreOwner
}

func (r *registry) countMatchers(owner string) int {
	n := 0
	for _, stored := range r.matchers {
		if stored.ref.Owner == owner {
			n++
		}
	}
	return n
}

func compileURL(template string) (func(string, map[string]string) string, error) {
	if template == "" {
		return nil, nil
	}
	if strings.ContainsAny(template, " \t\r\n\\") {
		return nil, fmt.Errorf("url template must be https")
	}
	if strings.HasPrefix(template, "/") {
		if strings.HasPrefix(template, "//") || strings.Contains(template, "..") {
			return nil, fmt.Errorf("url template must be https")
		}
	} else {
		sample := renderURL(template, "x", map[string]string{"value": "x"})
		parsed, err := url.Parse(sample)
		if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
			return nil, fmt.Errorf("url template must be https")
		}
	}
	return func(value string, groups map[string]string) string {
		return renderURL(template, value, groups)
	}, nil
}

func renderURL(template, value string, groups map[string]string) string {
	queryAt := strings.Index(template, "?")
	var b strings.Builder
	for i := 0; i < len(template); {
		if template[i] != '{' {
			b.WriteByte(template[i])
			i++
			continue
		}
		end := strings.IndexByte(template[i:], '}')
		if end < 2 {
			b.WriteByte(template[i])
			i++
			continue
		}
		key := template[i+1 : i+end]
		raw := value
		if key != "value" {
			raw = groups[key]
		}
		if queryAt >= 0 && i > queryAt {
			raw = url.QueryEscape(raw)
		} else {
			raw = url.PathEscape(raw)
		}
		b.WriteString(raw)
		i += end + 1
	}
	return b.String()
}
