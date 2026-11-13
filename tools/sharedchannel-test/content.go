package main

import (
	"context"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// contentUser is a Server A user with its own logged-in client, so posts,
// reactions and acknowledgements come from several authors.
type contentUser struct {
	id       string
	username string
	client   *model.Client4
}

// contentRun drives the content of one channel on Server A and remembers a label
// for each post, so a difference names the post it is about.
type contentRun struct {
	tr      *TestRunner
	channel string
	users   []*contentUser
	labels  map[string]string
	base    []string // post IDs of the base posts, in order
	authors map[string]*contentUser
}

// createContentUsers creates n users on Server A, logs each one in, and adds
// them to channelA.
func (tr *TestRunner) createContentUsers(ctx context.Context, prefix string, n int, channelA string) ([]*contentUser, error) {
	users := make([]*contentUser, 0, n)
	for i := range n {
		username := fmt.Sprintf("%s%d-%s", prefix, i+1, tr.suffix)
		password := model.NewTestPassword()
		user, _, err := tr.clientA.CreateUser(ctx, &model.User{
			Username: username,
			Email:    username + "@test.local",
			Password: password,
		})
		if err != nil {
			return nil, fmt.Errorf("create user %s: %w", username, err)
		}
		if _, _, err = tr.clientA.AddTeamMember(ctx, tr.teamA.Id, user.Id); err != nil {
			return nil, fmt.Errorf("add user %s to team: %w", username, err)
		}
		if _, _, err = tr.clientA.AddChannelMember(ctx, channelA, user.Id); err != nil {
			return nil, fmt.Errorf("add user %s to channel: %w", username, err)
		}
		client := model.NewAPIv4Client(tr.cfg.ServerAURL)
		if _, _, err = client.Login(ctx, username, password); err != nil {
			return nil, fmt.Errorf("login %s: %w", username, err)
		}
		users = append(users, &contentUser{id: user.Id, username: username, client: client})
	}
	return users, nil
}

func newContentRun(tr *TestRunner, channelA string, users []*contentUser) *contentRun {
	return &contentRun{
		tr:      tr,
		channel: channelA,
		users:   users,
		labels:  map[string]string{},
		authors: map[string]*contentUser{},
	}
}

func (cr *contentRun) post(ctx context.Context, u *contentUser, label, message, rootID string) (string, error) {
	p, _, err := u.client.CreatePost(ctx, &model.Post{ChannelId: cr.channel, Message: message, RootId: rootID})
	if err != nil {
		return "", fmt.Errorf("create post %s: %w", label, err)
	}
	cr.labels[p.Id] = label
	cr.authors[p.Id] = u
	return p.Id, nil
}

func (cr *contentRun) edit(ctx context.Context, postID, message string) error {
	if _, _, err := cr.authors[postID].client.PatchPost(ctx, postID, &model.PostPatch{Message: &message}); err != nil {
		return fmt.Errorf("edit %s: %w", cr.labels[postID], err)
	}
	return nil
}

func (cr *contentRun) deletePost(ctx context.Context, postID string) error {
	if _, err := cr.authors[postID].client.DeletePost(ctx, postID); err != nil {
		return fmt.Errorf("delete %s: %w", cr.labels[postID], err)
	}
	return nil
}

func (cr *contentRun) react(ctx context.Context, u *contentUser, postID, emoji string) error {
	if _, _, err := u.client.SaveReaction(ctx, &model.Reaction{UserId: u.id, PostId: postID, EmojiName: emoji}); err != nil {
		return fmt.Errorf("react %s on %s: %w", emoji, cr.labels[postID], err)
	}
	return nil
}

func (cr *contentRun) unreact(ctx context.Context, u *contentUser, postID, emoji string) error {
	if _, err := u.client.DeleteReaction(ctx, &model.Reaction{UserId: u.id, PostId: postID, EmojiName: emoji}); err != nil {
		return fmt.Errorf("remove reaction %s on %s: %w", emoji, cr.labels[postID], err)
	}
	return nil
}

func (cr *contentRun) ack(ctx context.Context, u *contentUser, postID string) error {
	if _, _, err := u.client.AcknowledgePost(ctx, postID, u.id); err != nil {
		return fmt.Errorf("acknowledge %s: %w", cr.labels[postID], err)
	}
	return nil
}

// unack withdraws an acknowledgement. The server allows this only within five
// minutes of the acknowledgement, so callers withdraw early in a scenario.
func (cr *contentRun) unack(ctx context.Context, u *contentUser, postID string) error {
	if _, err := u.client.UnacknowledgePost(ctx, postID, u.id); err != nil {
		return fmt.Errorf("withdraw acknowledgement on %s: %w", cr.labels[postID], err)
	}
	return nil
}

// makeBase writes n root posts from rotating authors, with a reaction on every
// fifth post and an acknowledgement on every seventh.
func (cr *contentRun) makeBase(ctx context.Context, n int) error {
	for i := range n {
		id, err := cr.post(ctx, cr.users[i%len(cr.users)], fmt.Sprintf("base[%d]", i), fmt.Sprintf("base %d %s", i, cr.tr.suffix), "")
		if err != nil {
			return err
		}
		cr.base = append(cr.base, id)
	}
	for i, id := range cr.base {
		if i%5 == 0 {
			if err := cr.react(ctx, cr.users[0], id, "+1"); err != nil {
				return err
			}
		}
		if i%7 == 0 {
			if err := cr.ack(ctx, cr.users[1], id); err != nil {
				return err
			}
		}
	}
	return nil
}

// mutate changes older base posts, then writes enough filler to span several sync
// batches, then touches most of the changed posts again. It needs makeBase(30)
// first and three users.
func (cr *contentRun) mutate(ctx context.Context, filler int) error {
	u1, u2, u3 := cr.users[0], cr.users[1], cr.users[2]
	b := cr.base
	steps := []func() error{
		// Acknowledgement withdrawals come first: the server allows them only within
		// five minutes of the acknowledgement.
		func() error { return cr.unack(ctx, u2, b[7]) },
		func() error { return cr.unack(ctx, u2, b[14]) },
		func() error { return cr.ack(ctx, u3, b[6]) },
		func() error { return cr.ack(ctx, u1, b[8]) },
		func() error { return cr.unack(ctx, u1, b[8]) },
		func() error { return cr.ack(ctx, u1, b[8]) },
		func() error { return cr.edit(ctx, b[1], "base 1 edited, no later change") },
		func() error { return cr.edit(ctx, b[2], "base 2 edited, changed again later") },
		func() error { return cr.react(ctx, u2, b[3], "smile") },
		func() error { return cr.react(ctx, u2, b[4], "smile") },
		func() error { return cr.unreact(ctx, u1, b[5], "+1") },
		func() error { return cr.unreact(ctx, u1, b[10], "+1") },
		func() error {
			_, err := cr.post(ctx, u3, "reply-to-base[9]", "reply to base 9", b[9])
			return err
		},
		func() error { return cr.deletePost(ctx, b[11]) },
		func() error { return cr.edit(ctx, b[12], "base 12 edited") },
		func() error { return cr.react(ctx, u2, b[12], "heart") },
		func() error { return cr.unreact(ctx, u2, b[12], "heart") },
		func() error { return cr.react(ctx, u3, b[13], "heart") },
		func() error { return cr.unreact(ctx, u3, b[13], "heart") },
		func() error { return cr.react(ctx, u3, b[16], "tada") },
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return err
		}
	}

	fill := make([]string, 0, filler)
	for i := range filler {
		author := cr.users[i%len(cr.users)]
		id, err := cr.post(ctx, author, fmt.Sprintf("filler[%d]", i), fmt.Sprintf("filler %d %s", i, cr.tr.suffix), "")
		if err != nil {
			return err
		}
		fill = append(fill, id)
		if i%10 == 0 {
			if err := cr.react(ctx, cr.users[(i+1)%len(cr.users)], id, "rocket"); err != nil {
				return err
			}
		}
		if i%15 == 0 {
			if err := cr.edit(ctx, id, fmt.Sprintf("filler %d edited", i)); err != nil {
				return err
			}
		}
	}
	for i := 0; i < filler; i += 12 {
		if err := cr.edit(ctx, fill[i], fmt.Sprintf("filler %d edited again", i)); err != nil {
			return err
		}
	}

	for _, i := range []int{2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14} {
		if err := cr.react(ctx, u3, b[i], "eyes"); err != nil {
			return err
		}
	}
	return nil
}

// waitForMembersOnB waits until every user is a member of channelB on Server B.
func (tr *TestRunner) waitForMembersOnB(ctx context.Context, channelB string, users []*contentUser) error {
	return tr.waitFor(ctx, 60*time.Second, func() bool {
		for _, u := range users {
			if !tr.verifyMemberOnB(ctx, channelB, u.username) {
				return false
			}
		}
		return true
	})
}
