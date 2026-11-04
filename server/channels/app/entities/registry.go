// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	maxPatternBytes    = 1000
	maxPluginMatchers  = 50
	maxTerms           = 500
	maxTermTitleRune   = 120
	maxTermURLBytes    = 2048
	maxDisplayNameRune = 64
	coreOwner          = "core"
)

// Remote is a plugin provider that should describe a matched value.
type Remote struct {
	PluginID   string
	ProviderID string
	Cache      string
	CacheTTL   time.Duration
}

type entityType struct {
	id          string
	displayName string
	owner       string
}

type storedMatcher struct {
	matcher
	owner string
}

type storedProvider struct {
	id       string
	typeID   string
	pluginID string
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
	matchers         []storedMatcher
	matcherIndex     map[string]int
	providers        []storedProvider
	terms            []storedTerm
	generations      map[string]int64
	cachedGeneration string
	termEpoch        int64
}

var reg = newRegistry()

func newRegistry() *registry {
	r := &registry{
		types:       map[string]entityType{},
		generations: map[string]int64{},
	}
	r.rememberGeneration()
	return r
}

func activeTerms() []storedTerm {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	out := make([]storedTerm, len(reg.terms))
	copy(out, reg.terms)
	return out
}

// ReplaceTerms replaces every exact term a plugin has registered for one of its types.
// The returned generation is that type's dictionary generation after the change.
func ReplaceTerms(pluginID, typeID string, terms []model.EntityTerm) (int64, error) {
	cleaned := make([]storedTerm, 0, len(terms))
	seen := map[string]struct{}{}
	for _, term := range terms {
		if !termValueOK(term.Value) {
			return 0, fmt.Errorf("term is not allowed")
		}
		if _, ok := seen[term.Value]; ok {
			return 0, fmt.Errorf("term is duplicated")
		}
		seen[term.Value] = struct{}{}
		title := strings.TrimSpace(term.Title)
		if title == "" || utf8.RuneCountInString(title) > maxTermTitleRune {
			return 0, fmt.Errorf("term title is not allowed")
		}
		link, err := termURL(term.URL)
		if err != nil {
			return 0, err
		}
		cleaned = append(cleaned, storedTerm{
			owner:  pluginID,
			typeID: typeID,
			value:  term.Value,
			title:  title,
			url:    link,
		})
	}
	reg.mu.Lock()
	defer reg.mu.Unlock()
	t, ok := reg.types[typeID]
	if !ok || t.owner != pluginID {
		return 0, fmt.Errorf("type is not available to this plugin")
	}
	kept := make([]storedTerm, 0, len(reg.terms))
	count := 0
	for _, existing := range reg.terms {
		if existing.owner == pluginID && existing.typeID == typeID {
			continue
		}
		if existing.owner == pluginID {
			count++
		}
		kept = append(kept, existing)
	}
	if count+len(cleaned) > maxTerms {
		return 0, fmt.Errorf("term quota is exhausted")
	}
	for i := range cleaned {
		cleaned[i].displayName = t.displayName
	}
	reg.terms = append(kept, cleaned...)
	if reg.generations == nil {
		reg.generations = map[string]int64{}
	}
	reg.generations[typeID]++
	reg.termEpoch++
	return reg.generations[typeID], nil
}

// TermSnapshot is the in-memory dictionary, taken before a write so a failed store call can put it back.
type TermSnapshot struct {
	terms       []storedTerm
	generations map[string]int64
	epoch       int64
}

func SnapshotTerms() TermSnapshot {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	generations := make(map[string]int64, len(reg.generations))
	for id, generation := range reg.generations {
		generations[id] = generation
	}
	return TermSnapshot{
		terms:       append([]storedTerm(nil), reg.terms...),
		generations: generations,
		epoch:       reg.termEpoch,
	}
}

func RestoreTerms(snap TermSnapshot) {
	reg.mu.Lock()
	defer reg.mu.Unlock()
	reg.terms = append([]storedTerm(nil), snap.terms...)
	reg.generations = snap.generations
	if reg.generations == nil {
		reg.generations = map[string]int64{}
	}
	reg.termEpoch = snap.epoch
}

// LoadTerms installs dictionary rows read from storage. It runs before plugins
// activate, so a restart keeps recognizing terms until each plugin registers again.
func LoadTerms(rows []model.EntityTermRow) {
	reg.mu.Lock()
	defer reg.mu.Unlock()
	if reg.generations == nil {
		reg.generations = map[string]int64{}
	}
	reg.terms = nil
	for _, row := range rows {
		if row.Generation > reg.generations[row.TypeID] {
			reg.generations[row.TypeID] = row.Generation
		}
		if row.Value == "" {
			continue
		}
		display := ""
		if t, ok := reg.types[row.TypeID]; ok {
			display = t.displayName
		}
		reg.terms = append(reg.terms, storedTerm{
			owner:       row.PluginID,
			typeID:      row.TypeID,
			value:       row.Value,
			title:       row.Title,
			url:         row.URL,
			displayName: display,
		})
	}
	reg.termEpoch++
}

func termValueOK(value string) bool {
	if len(value) < 2 || len(value) > 32 {
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
		out[i] = stored.matcher
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

// TermEpoch changes when a dictionary is replaced. Stored pattern rows stay valid.
func TermEpoch() int64 {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	return reg.termEpoch
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
	ids := append([]storedMatcher(nil), r.matchers...)
	sortMatchers(ids)
	for _, stored := range ids {
		name := ""
		if t, ok := r.types[stored.typeID]; ok {
			name = t.displayName
		}
		fmt.Fprintf(h, "%s\n%s\n%s\n%d\n%d\n%s\n%t\n%t\n%s\n%s\n", stored.id, stored.typeID, stored.pattern.String(), stored.valueGroup, stored.spanGroup, stored.boundary, stored.skipBots, stored.validate, stored.urlTemplate, name)
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func sortMatchers(list []storedMatcher) {
	for i := 1; i < len(list); i++ {
		for j := i; j > 0 && list[j].id < list[j-1].id; j-- {
			list[j], list[j-1] = list[j-1], list[j]
		}
	}
}

// Prepare reports who can describe value. A non-nil Remote means the plugin
// is asked first. The card is the core description when no plugin provides it.
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
		return card, nil, err
	}
	return &model.EntityCard{TypeID: typeID, Value: value, Title: value}, nil, nil
}

func ProviderFor(typeID string) *Remote {
	reg.mu.RLock()
	defer reg.mu.RUnlock()
	remote, _ := reg.lookupPlan(typeID)
	return remote
}

func (r *registry) lookupPlan(typeID string) (*Remote, bool) {
	var remote *Remote
	for _, provider := range r.providers {
		if provider.typeID == typeID && provider.hasCard {
			remote = &Remote{
				PluginID:   provider.pluginID,
				ProviderID: provider.id,
				Cache:      provider.cache,
				CacheTTL:   provider.cacheTTL,
			}
			break
		}
	}
	t, ok := r.types[typeID]
	return remote, ok && t.owner == coreOwner
}

func (r *registry) valueMatches(typeID, value string) bool {
	for _, stored := range r.matchers {
		if stored.typeID != typeID {
			continue
		}
		if matcherCovers(stored.matcher, value) {
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

// CoreLookup describes a value using a built-in type. Plugins own every type.
func CoreLookup(context.Context, string, string) (*model.EntityCard, error) {
	return nil, fmt.Errorf("unsupported entity")
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

// AddType registers a plugin-owned type. The same plugin may replace the display name.
func AddType(pluginID string, t *model.EntityType) error {
	if t == nil {
		return fmt.Errorf("type is required")
	}
	id := t.ID
	name := strings.TrimSpace(t.DisplayName)
	local, prefixed := strings.CutPrefix(id, pluginID+".")
	if !prefixed || local == "" || strings.Contains(local, ".") {
		return fmt.Errorf("type id must start with the plugin id")
	}
	if !typeNameOK(id) || !typeNameOK(pluginID) {
		return fmt.Errorf("type id is not allowed")
	}
	if name == "" || utf8.RuneCountInString(name) > maxDisplayNameRune {
		return fmt.Errorf("display name is not allowed")
	}
	reg.mu.Lock()
	defer reg.mu.Unlock()
	if existing, ok := reg.types[id]; ok && existing.owner != pluginID {
		return fmt.Errorf("type is owned by someone else")
	}
	reg.types[id] = entityType{id: id, displayName: name, owner: pluginID}
	renamed := false
	for i := range reg.terms {
		if reg.terms[i].typeID == id && reg.terms[i].displayName != name {
			reg.terms[i].displayName = name
			renamed = true
		}
	}
	if renamed {
		reg.termEpoch++
	}
	reg.rememberGeneration()
	return nil
}

// AddMatcher registers a plugin pattern for a core type or a type that plugin owns.
func AddMatcher(pluginID string, spec *model.EntityMatcher) error {
	if spec == nil {
		return fmt.Errorf("matcher is required")
	}
	if !strings.HasPrefix(spec.ID, pluginID+".") || spec.ID == pluginID+"." {
		return fmt.Errorf("matcher id must start with the plugin id")
	}
	if len(spec.Pattern) == 0 || len(spec.Pattern) > maxPatternBytes {
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
	t, ok := reg.types[spec.TypeID]
	if !ok || (t.owner != coreOwner && t.owner != pluginID) {
		return fmt.Errorf("type is not available to this plugin")
	}
	if reg.matcherOwner(spec.ID) != "" && reg.matcherOwner(spec.ID) != pluginID {
		return fmt.Errorf("matcher id is owned by someone else")
	}
	if reg.matcherOwner(spec.ID) == "" && reg.countMatchers(pluginID) >= maxPluginMatchers {
		return fmt.Errorf("matcher quota is exhausted")
	}
	next := storedMatcher{owner: pluginID, matcher: matcher{
		id:           spec.ID,
		typeID:       spec.TypeID,
		pattern:      compiled,
		valuePattern: valuePattern,
		urlTemplate:  spec.URL,
		url:          urlFor,
		valueGroup:   spec.ValueGroup,
		spanGroup:    spec.SpanGroup,
		boundary:     spec.Boundary,
		scope:        append([]string(nil), spec.Scope...),
		skipBots:     spec.SkipBots,
		validate:     spec.Validate,
		pluginID:     pluginID,
		displayName:  t.displayName,
	}}
	for i, stored := range reg.matchers {
		if stored.id == spec.ID {
			reg.matchers[i] = next
			reg.rememberGeneration()
			return nil
		}
	}
	reg.matchers = append(reg.matchers, next)
	reg.rememberGeneration()
	return nil
}

// UnregisterMatcher removes one matcher owned by the plugin.
func UnregisterMatcher(pluginID, id string) error {
	reg.mu.Lock()
	defer reg.mu.Unlock()
	if reg.matcherOwner(id) != pluginID {
		return fmt.Errorf("matcher is not available to this plugin")
	}
	kept := make([]storedMatcher, 0, len(reg.matchers)-1)
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
		next.HasCard = false
		for _, typeID := range entity.TypeIDs {
			if reg.typeHasCard(typeID) {
				next.HasCard = true
				break
			}
		}
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

func (r *registry) matcher(id string) (storedMatcher, bool) {
	i, ok := r.matcherIndex[id]
	if !ok || i < 0 || i >= len(r.matchers) || r.matchers[i].id != id {
		return storedMatcher{}, false
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
	return false
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

// AddProvider registers a plugin as the card source for types it may provide.
func AddProvider(pluginID string, spec *model.EntityProvider) error {
	if spec == nil || spec.ID == "" || len(spec.TypeIDs) == 0 {
		return fmt.Errorf("provider is required")
	}
	if !strings.HasPrefix(spec.ID, pluginID+".") {
		return fmt.Errorf("provider id must start with the plugin id")
	}
	cacheMode, cacheTTL, err := normalizeCache(spec.Cache, spec.CacheTTLSeconds)
	if err != nil {
		return err
	}
	reg.mu.Lock()
	defer reg.mu.Unlock()
	if reg.providerOwner(spec.ID) != "" && reg.providerOwner(spec.ID) != pluginID {
		return fmt.Errorf("provider id is owned by someone else")
	}
	for _, typeID := range spec.TypeIDs {
		t, ok := reg.types[typeID]
		if !ok || (t.owner != coreOwner && t.owner != pluginID) {
			return fmt.Errorf("type is not available to this plugin")
		}
	}
	reg.providers = dropProvider(reg.providers, spec.ID)
	for _, typeID := range spec.TypeIDs {
		reg.providers = append(reg.providers, storedProvider{
			id:       spec.ID,
			typeID:   typeID,
			pluginID: pluginID,
			hasCard:  spec.HasCard,
			cache:    cacheMode,
			cacheTTL: cacheTTL,
		})
	}
	return nil
}

// RemovePlugin drops every type, matcher and provider that plugin registered.
func RemovePlugin(pluginID string) {
	reg.mu.Lock()
	defer reg.mu.Unlock()
	for id, t := range reg.types {
		if t.owner == pluginID {
			delete(reg.types, id)
		}
	}
	kept := make([]storedMatcher, 0, len(reg.matchers))
	for _, stored := range reg.matchers {
		if stored.owner != pluginID {
			kept = append(kept, stored)
		}
	}
	reg.matchers = kept
	reg.rememberGeneration()
	providers := make([]storedProvider, 0, len(reg.providers))
	for _, provider := range reg.providers {
		if provider.pluginID != pluginID {
			providers = append(providers, provider)
		}
	}
	reg.providers = providers
	terms := make([]storedTerm, 0, len(reg.terms))
	for _, term := range reg.terms {
		if term.owner != pluginID {
			terms = append(terms, term)
		}
	}
	reg.terms = terms
	reg.termEpoch++
}

func (r *registry) matcherOwner(id string) string {
	for _, stored := range r.matchers {
		if stored.id == id {
			return stored.owner
		}
	}
	return ""
}

func (r *registry) providerOwner(id string) string {
	for _, provider := range r.providers {
		if provider.id == id {
			return provider.pluginID
		}
	}
	return ""
}

func (r *registry) countMatchers(owner string) int {
	n := 0
	for _, stored := range r.matchers {
		if stored.owner == owner {
			n++
		}
	}
	return n
}

func dropProvider(list []storedProvider, id string) []storedProvider {
	kept := make([]storedProvider, 0, len(list))
	for _, provider := range list {
		if provider.id != id {
			kept = append(kept, provider)
		}
	}
	return kept
}

func typeNameOK(id string) bool {
	if id == "" || len(id) > 80 {
		return false
	}
	for _, r := range id {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '.', r == '-':
		default:
			return false
		}
	}
	return true
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
