package main

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// postState is the part of a post that must match on both servers after a sync.
type postState struct {
	Message   string   `json:"message"`
	RootID    string   `json:"root_id"`
	Reactions []string `json:"reactions"` // "userID:emoji", sorted
	Acks      []string `json:"acks"`      // userIDs with a current acknowledgement, sorted
}

// channelState maps post ID to its state. System posts are left out, since each
// server writes its own.
type channelState map[string]postState

// fetchChannelState reads every live post of a channel, with its reactions and
// acknowledgements, from one server.
func fetchChannelState(ctx context.Context, client *model.Client4, channelID string) (channelState, error) {
	const perPage = 200
	state := channelState{}
	for page := 0; ; page++ {
		list, _, err := client.GetPostsForChannel(ctx, channelID, page, perPage, "", false, false)
		if err != nil {
			return nil, fmt.Errorf("get posts for channel %s page %d: %w", channelID, page, err)
		}
		for _, id := range list.Order {
			p := list.Posts[id]
			if p == nil || strings.HasPrefix(p.Type, model.PostSystemMessagePrefix) {
				continue
			}
			st := postState{Message: p.Message, RootID: p.RootId, Reactions: []string{}, Acks: []string{}}
			if p.Metadata != nil {
				for _, r := range p.Metadata.Reactions {
					if r.DeleteAt == 0 {
						st.Reactions = append(st.Reactions, r.UserId+":"+r.EmojiName)
					}
				}
				for _, a := range p.Metadata.Acknowledgements {
					if a.AcknowledgedAt > 0 {
						st.Acks = append(st.Acks, a.UserId)
					}
				}
			}
			slices.Sort(st.Reactions)
			slices.Sort(st.Acks)
			state[id] = st
		}
		if len(list.Order) < perPage {
			return state, nil
		}
	}
}

// diffChannelStates lists every way B differs from A. labels names posts in the
// output (for example "base[5]"); unlabelled posts show their ID.
func diffChannelStates(a, b channelState, labels map[string]string) []string {
	name := func(id string) string {
		if l, ok := labels[id]; ok {
			return l
		}
		return id
	}
	var diffs []string
	for id, pa := range a {
		pb, ok := b[id]
		if !ok {
			diffs = append(diffs, fmt.Sprintf("%s: post missing on B", name(id)))
			continue
		}
		if pa.Message != pb.Message {
			diffs = append(diffs, fmt.Sprintf("%s: message differs (A=%q B=%q)", name(id), pa.Message, pb.Message))
		}
		if pa.RootID != pb.RootID {
			diffs = append(diffs, fmt.Sprintf("%s: root differs", name(id)))
		}
		for _, r := range setDiff(pa.Reactions, pb.Reactions) {
			diffs = append(diffs, fmt.Sprintf("%s: reaction %s missing on B", name(id), r))
		}
		for _, r := range setDiff(pb.Reactions, pa.Reactions) {
			diffs = append(diffs, fmt.Sprintf("%s: reaction %s extra on B", name(id), r))
		}
		for _, u := range setDiff(pa.Acks, pb.Acks) {
			diffs = append(diffs, fmt.Sprintf("%s: acknowledgement by %s missing on B", name(id), u))
		}
		for _, u := range setDiff(pb.Acks, pa.Acks) {
			diffs = append(diffs, fmt.Sprintf("%s: acknowledgement by %s extra on B", name(id), u))
		}
	}
	for id := range b {
		if _, ok := a[id]; !ok {
			diffs = append(diffs, fmt.Sprintf("%s: post on B that is deleted or absent on A", name(id)))
		}
	}
	slices.Sort(diffs)
	return diffs
}

// setDiff returns the items of x that are not in y. Both are sorted.
func setDiff(x, y []string) []string {
	var out []string
	for _, v := range x {
		if _, found := slices.BinarySearch(y, v); !found {
			out = append(out, v)
		}
	}
	return out
}

// waitForChannelsToMatch polls both servers until channel B matches channel A or
// the timeout passes, and then returns the remaining differences. A failed read
// is retried until the timeout, since a server can briefly fail a request while
// it is busy syncing.
func (tr *TestRunner) waitForChannelsToMatch(ctx context.Context, channelA, channelB string, labels map[string]string,
	timeout time.Duration) ([]string, error) {
	deadline := time.Now().Add(timeout)
	var diffs []string
	var fetchErr error
	for {
		// Bound each attempt, since the API clients have no request timeout.
		attemptCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		a, errA := fetchChannelState(attemptCtx, tr.clientA, channelA)
		b, errB := fetchChannelState(attemptCtx, tr.clientB, channelB)
		cancel()
		fetchErr = errors.Join(errA, errB)
		if fetchErr == nil {
			diffs = diffChannelStates(a, b, labels)
			if len(diffs) == 0 {
				return nil, nil
			}
		}
		if time.Now().After(deadline) {
			if fetchErr != nil {
				return nil, fetchErr
			}
			return diffs, nil
		}
		if err := interruptibleSleep(ctx, 5*time.Second); err != nil {
			return nil, err
		}
	}
}

// checkChannelsMatch records one PASS or FAIL for testName from the result of
// waitForChannelsToMatch, listing up to 20 differences on failure.
func (tr *TestRunner) checkChannelsMatch(ctx context.Context, testName, channelA, channelB string,
	labels map[string]string, timeout time.Duration) bool {
	diffs, err := tr.waitForChannelsToMatch(ctx, channelA, channelB, labels, timeout)
	if err != nil {
		tr.fail(testName, err.Error())
		return false
	}
	if len(diffs) == 0 {
		tr.pass(testName)
		return true
	}
	for _, d := range diffs {
		tr.logger.Warn("Channel difference", mlog.String("test", testName), mlog.String("diff", d))
	}
	shown := diffs
	if len(shown) > 20 {
		shown = shown[:20]
	}
	tr.fail(testName, fmt.Sprintf("%d difference(s) between A and B: %s", len(diffs), strings.Join(shown, "; ")))
	return false
}
