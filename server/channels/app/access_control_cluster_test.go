// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

// handlerRecordingClusterMock keeps every handler registered per cluster event, so a test can
// deliver a message the way a peer node's broadcast would arrive at this node.
type handlerRecordingClusterMock struct {
	captureClusterMock
	handlersMut sync.Mutex
	handlers    map[model.ClusterEvent][]einterfaces.ClusterMessageHandler
}

func (c *handlerRecordingClusterMock) RegisterClusterMessageHandler(event model.ClusterEvent, crm einterfaces.ClusterMessageHandler) {
	c.handlersMut.Lock()
	defer c.handlersMut.Unlock()
	if c.handlers == nil {
		c.handlers = make(map[model.ClusterEvent][]einterfaces.ClusterMessageHandler)
	}
	c.handlers[event] = append(c.handlers[event], crm)
}

func (c *handlerRecordingClusterMock) deliver(t *testing.T, msg *model.ClusterMessage) {
	t.Helper()
	c.handlersMut.Lock()
	handlers := append([]einterfaces.ClusterMessageHandler(nil), c.handlers[msg.Event]...)
	c.handlersMut.Unlock()
	require.NotEmpty(t, handlers, "no handler registered for cluster event %q", msg.Event)
	for _, h := range handlers {
		h(msg)
	}
}

type userAttributeClusterFixture struct {
	th      *TestHelper
	cluster *handlerRecordingClusterMock
	field   *model.PropertyField
}

func setupUserAttributeClusterFixture(t *testing.T) *userAttributeClusterFixture {
	cluster := &handlerRecordingClusterMock{}
	th := SetupWithClusterMock(t, cluster).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	})
	require.True(t, th.App.attributeBasedAccessControlEnabled())

	cpaGroup, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)
	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)

	return &userAttributeClusterFixture{th: th, cluster: cluster, field: field}
}

func (f *userAttributeClusterFixture) value(t *testing.T, userID, v string) *model.PropertyValue {
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	return &model.PropertyValue{
		TargetID:   userID,
		TargetType: model.PropertyFieldObjectTypeUser,
		GroupID:    f.field.GroupID,
		FieldID:    f.field.ID,
		Value:      raw,
	}
}

// setValueViaApp writes through the app layer, as the node that takes the write does.
func (f *userAttributeClusterFixture) setValueViaApp(t *testing.T, userID, v string) {
	_, appErr := f.th.App.UpsertPropertyValue(f.th.Context, f.value(t, userID, v))
	require.Nil(t, appErr)
}

// setValueOnPeerNode writes straight to the shared database, leaving this node's view marker and
// caches untouched, as a write taken by another cluster node would.
func (f *userAttributeClusterFixture) setValueOnPeerNode(t *testing.T, userID, v string) {
	_, err := f.th.App.Srv().Store().PropertyValue().Upsert([]*model.PropertyValue{f.value(t, userID, v)})
	require.NoError(t, err)
}

func (f *userAttributeClusterFixture) subjectValue(t *testing.T, user *model.User) any {
	t.Helper()
	subject, appErr := f.th.App.BuildAccessControlSubject(f.th.Context, user.Id, user.Roles, "")
	require.Nil(t, appErr)
	require.NotNil(t, subject)
	return subject.Attributes[f.field.Name]
}

// markViewFresh makes this node's view look recently refreshed, as it would be on a busy node.
func (f *userAttributeClusterFixture) markViewFresh() {
	ch := f.th.App.Srv().Channels()
	ch.attributeViewRefreshMut.Lock()
	ch.attributeViewRefreshLast = time.Now()
	ch.attributeViewRefreshMut.Unlock()
	ch.attributeViewNeedsRefresh.Store(false)
}

func (f *userAttributeClusterFixture) viewMarkedForRefresh() bool {
	ch := f.th.App.Srv().Channels()
	ch.attributeViewRefreshMut.Lock()
	defer ch.attributeViewRefreshMut.Unlock()
	return ch.attributeViewRefreshLast.IsZero() || ch.attributeViewNeedsRefresh.Load()
}

func userAttributesInvalidation(userID string) *model.ClusterMessage {
	return &model.ClusterMessage{
		Event:    model.ClusterEventInvalidateCacheForUserAttributes,
		SendType: model.ClusterSendBestEffort,
		Data:     []byte(userID),
	}
}

func userAttributesPurge() *model.ClusterMessage {
	return &model.ClusterMessage{
		Event:    model.ClusterEventInvalidateCacheForUserAttributes,
		SendType: model.ClusterSendBestEffort,
		Data:     []byte(""),
	}
}

func TestUserAttributeChangeSameNodeVisibleOnNextSubjectBuild(t *testing.T) {
	f := setupUserAttributeClusterFixture(t)
	user := f.th.BasicUser

	f.setValueViaApp(t, user.Id, "before")
	require.Equal(t, "before", f.subjectValue(t, user))

	f.markViewFresh()
	f.setValueViaApp(t, user.Id, "after")
	assert.Equal(t, "after", f.subjectValue(t, user), "a write on this node must reach its next subject build")
}

func TestUserAttributeChangeFromPeerNodeVisibleOnNextSubjectBuild(t *testing.T) {
	t.Run("single user invalidation", func(t *testing.T) {
		f := setupUserAttributeClusterFixture(t)
		user := f.th.BasicUser

		f.setValueViaApp(t, user.Id, "before")
		require.Equal(t, "before", f.subjectValue(t, user), "the subject should now be cached with the first value")

		// The peer node takes the write and broadcasts the invalidation; this node reads before
		// the peer's next request would refresh the shared view.
		f.setValueOnPeerNode(t, user.Id, "after")
		f.markViewFresh()
		f.cluster.deliver(t, userAttributesInvalidation(user.Id))

		assert.True(t, f.viewMarkedForRefresh(), "a user attribute invalidation from the cluster should mark this node's attribute view for refresh")
		assert.Equal(t, "after", f.subjectValue(t, user), "the next subject build after a cluster invalidation must see the new value")
		assert.Equal(t, "after", f.subjectValue(t, user), "the new value must stay visible on later builds rather than a re-cached older one")
	})

	t.Run("full purge after a field-level change", func(t *testing.T) {
		f := setupUserAttributeClusterFixture(t)
		user1 := f.th.BasicUser
		user2 := f.th.BasicUser2

		f.setValueViaApp(t, user1.Id, "before-1")
		f.setValueViaApp(t, user2.Id, "before-2")
		require.Equal(t, "before-1", f.subjectValue(t, user1))
		require.Equal(t, "before-2", f.subjectValue(t, user2))

		f.setValueOnPeerNode(t, user1.Id, "after-1")
		f.setValueOnPeerNode(t, user2.Id, "after-2")
		f.markViewFresh()
		f.cluster.deliver(t, userAttributesPurge())

		assert.True(t, f.viewMarkedForRefresh(), "a user attribute cache purge from the cluster should mark this node's attribute view for refresh")
		assert.Equal(t, "after-1", f.subjectValue(t, user1), "the next subject build after a cluster purge must see the new value")
		assert.Equal(t, "after-2", f.subjectValue(t, user2), "the purge covers every user, not only the first one read")
	})

	t.Run("invalidation arriving while a refresh is in flight", func(t *testing.T) {
		f := setupUserAttributeClusterFixture(t)
		user := f.th.BasicUser

		f.setValueViaApp(t, user.Id, "before")
		require.Equal(t, "before", f.subjectValue(t, user))

		f.setValueOnPeerNode(t, user.Id, "after")
		f.markViewFresh()

		// Hold the refresh lock as an in-flight refresh would: the refresh may already have read
		// the database, so the message must leave a follow-up flag for the next caller.
		ch := f.th.App.Srv().Channels()
		ch.attributeViewRefreshMut.Lock()
		f.cluster.deliver(t, userAttributesInvalidation(user.Id))
		ch.attributeViewRefreshLast = time.Now()
		ch.attributeViewRefreshMut.Unlock()

		assert.True(t, ch.attributeViewNeedsRefresh.Load(), "an invalidation during an in-flight refresh should flag a follow-up refresh")
		assert.Equal(t, "after", f.subjectValue(t, user), "the follow-up refresh must surface the new value")
	})
}
