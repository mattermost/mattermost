package main

import (
	"context"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// runHATests checks the paths that only exist when Server A is a cluster: changes made
// on a follower node, inbound sync visible on every node, and leader failover.
func (tr *TestRunner) runHATests(ctx context.Context) error {
	tr.logger.Info("=== HA Tests ===")

	if !tr.ha() {
		tr.logger.Info("Skipping HA tests (requires --nodes > 1)")
		return nil
	}

	leader, err := tr.waitForCluster(ctx, tr.nodesA)
	if err != nil {
		tr.fail("ha/cluster", err.Error())
		return err
	}
	followers := otherNodes(tr.nodesA, leader)
	if len(followers) == len(tr.nodesA) {
		err := fmt.Errorf("cluster leader %q is not one of the started nodes", leader)
		tr.fail("ha/cluster", err.Error())
		return err
	}
	follower := followers[0]
	tr.logger.Info("Server A roles", mlog.String("leader", leader), mlog.String("follower", follower.name))

	channelA, channelB, err := tr.setupSharedChannel(ctx, "ha-test")
	if err != nil {
		tr.fail("ha/setup", err.Error())
		return err
	}

	tr.runFollowerTests(ctx, follower, channelA, channelB)
	tr.runInboundTests(ctx, channelA, channelB)
	return tr.runLeaderCrashTest(ctx, leader, channelA, channelB)
}

func (tr *TestRunner) runFollowerTests(ctx context.Context, follower nodeClient, channelA, channelB string) {
	fc := follower.client

	userID, err := tr.createTestUser(ctx, "hauser1")
	if err != nil {
		tr.fail("ha/follower-create-user", err.Error())
		return
	}
	if _, _, err := fc.AddChannelMember(ctx, channelA, userID); err != nil {
		tr.fail("ha/follower-membership", err.Error())
	} else {
		tr.expect(ctx, 30*time.Second, "ha/follower-membership", "member added on a follower did not sync to Server B", func() bool {
			return tr.verifyMemberOnB(ctx, channelB, "hauser1")
		})
	}

	msg := "Follower post " + model.NewId()[:8]
	post, _, err := fc.CreatePost(ctx, &model.Post{ChannelId: channelA, Message: msg})
	if err != nil {
		tr.fail("ha/follower-post", err.Error())
		return
	}
	var postBID string
	if !tr.expect(ctx, 30*time.Second, "ha/follower-post", "post created on a follower did not sync to Server B", func() bool {
		postBID = tr.findPostOnB(ctx, channelB, msg)
		return postBID != ""
	}) {
		return
	}

	me, _, err := fc.GetMe(ctx, "")
	if err != nil {
		tr.fail("ha/follower-reaction", err.Error())
		return
	}
	if _, _, err := fc.SaveReaction(ctx, &model.Reaction{UserId: me.Id, PostId: post.Id, EmojiName: "rocket"}); err != nil {
		tr.fail("ha/follower-reaction", err.Error())
	} else {
		tr.expect(ctx, 30*time.Second, "ha/follower-reaction", "reaction added on a follower did not sync to Server B", func() bool {
			return tr.hasReactionOnB(ctx, postBID, "rocket")
		})
	}

	if _, err := fc.DeletePost(ctx, post.Id); err != nil {
		tr.fail("ha/follower-delete", err.Error())
	} else {
		tr.expect(ctx, 30*time.Second, "ha/follower-delete", "post deleted on a follower is still on Server B", func() bool {
			return tr.findPostOnB(ctx, channelB, msg) == ""
		})
	}
}

// runInboundTests sends posts from Server B and checks that every Server A node
// serves them, whichever node the proxy handed each inbound sync to.
func (tr *TestRunner) runInboundTests(ctx context.Context, channelA, channelB string) {
	testName := "ha/inbound-visible-on-every-node"

	meB, _, err := tr.clientB.GetMe(ctx, "")
	if err != nil {
		tr.fail(testName, err.Error())
		return
	}
	if _, _, err := tr.clientB.AddChannelMember(ctx, channelB, meB.Id); err != nil {
		tr.fail(testName, "join channel on Server B: "+err.Error())
		return
	}

	// One post at a time, so each arrives in its own sync request.
	msgs := make([]string, 2*len(tr.nodesA))
	for i := range msgs {
		msgs[i] = fmt.Sprintf("From Server B %d %s", i+1, model.NewId()[:8])
		if _, _, err := tr.clientB.CreatePost(ctx, &model.Post{ChannelId: channelB, Message: msgs[i]}); err != nil {
			tr.fail(testName, "create post on Server B: "+err.Error())
			return
		}
		if err := tr.waitFor(ctx, 30*time.Second, func() bool {
			return findPost(ctx, tr.clientA, channelA, msgs[i]) != ""
		}); err != nil {
			tr.fail(testName, fmt.Sprintf("post %d from Server B did not sync to Server A", i+1))
			return
		}
	}

	tr.expect(ctx, 30*time.Second, testName, "a post from Server B is missing on at least one Server A node", func() bool {
		for _, n := range tr.nodesA {
			for _, m := range msgs {
				if findPost(ctx, n.client, channelA, m) == "" {
					return false
				}
			}
		}
		return true
	})
}

// runLeaderCrashTest kills Server A's leader and checks that posts made on a surviving
// node still reach Server B, both before and after the survivors elect a new leader.
func (tr *TestRunner) runLeaderCrashTest(ctx context.Context, leader, channelA, channelB string) error {
	survivors := otherNodes(tr.nodesA, leader)

	if err := tr.mgr.CrashNode(leader); err != nil {
		tr.fail("ha/leader-crash", err.Error())
		return err
	}

	// Posted before the survivors notice the leader is gone.
	during := "During failover " + model.NewId()[:8]
	if _, _, err := survivors[0].client.CreatePost(ctx, &model.Post{ChannelId: channelA, Message: during}); err != nil {
		tr.fail("ha/post-during-failover", err.Error())
		during = ""
	}

	newLeader, err := tr.waitForCluster(ctx, survivors)
	if err != nil {
		tr.fail("ha/leader-failover", err.Error())
	} else {
		tr.pass("ha/leader-failover")
		tr.logger.Info("New Server A leader", mlog.String("leader", newLeader))
	}

	after := "After failover " + model.NewId()[:8]
	if _, _, err := survivors[0].client.CreatePost(ctx, &model.Post{ChannelId: channelA, Message: after}); err != nil {
		tr.fail("ha/post-after-failover", err.Error())
		after = ""
	}

	if during != "" {
		tr.expect(ctx, 120*time.Second, "ha/post-during-failover", "post made while the leader was down did not sync to Server B", func() bool {
			return tr.findPostOnB(ctx, channelB, during) != ""
		})
	}
	if after != "" {
		tr.expect(ctx, 60*time.Second, "ha/post-after-failover", "post made after failover did not sync to Server B", func() bool {
			return tr.findPostOnB(ctx, channelB, after) != ""
		})
	}

	// Bring the node back so later suites see the full cluster.
	if err := tr.mgr.RestartNode(ctx, leader); err != nil {
		tr.fail("ha/leader-restart", err.Error())
		return fmt.Errorf("restart %s: %w", leader, err)
	}
	if _, err := tr.waitForCluster(ctx, tr.nodesA); err != nil {
		tr.fail("ha/leader-rejoin", err.Error())
		return fmt.Errorf("rejoin %s: %w", leader, err)
	}
	return nil
}

func (tr *TestRunner) expect(ctx context.Context, timeout time.Duration, testName, detail string, condition func() bool) bool {
	if err := tr.waitFor(ctx, timeout, condition); err != nil {
		tr.fail(testName, detail)
		return false
	}
	tr.pass(testName)
	return true
}

func otherNodes(nodes []nodeClient, exclude string) []nodeClient {
	var others []nodeClient
	for _, n := range nodes {
		if n.name != exclude {
			others = append(others, n)
		}
	}
	return others
}
