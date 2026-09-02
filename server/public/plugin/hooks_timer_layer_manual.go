// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Hand-written timer-layer wrappers for the three hooks excluded from the code generator.
// The auto-generated hooks_timer_layer_generated.go ranges over HooksMethodsRPCErr which
// omits excluded hooks; these three fill that gap so hooksTimerLayer satisfies HooksWithRPCErr.

package plugin

import (
	timePkg "time"

	"github.com/mattermost/mattermost/server/public/model"
)

// MessageWillBePostedWithRPCErr wraps the underlying implementation's MessageWillBePostedWithRPCErr
// and records timing metrics.
func (hooks *hooksTimerLayer) MessageWillBePostedWithRPCErr(c *Context, post *model.Post) (*model.Post, string, error) {
	startTime := timePkg.Now()
	_returnsA, _returnsB, _returnsRPCErr := hooks.hooksWithRPCErrImpl.MessageWillBePostedWithRPCErr(c, post)
	hooks.recordTime(startTime, "MessageWillBePostedWithRPCErr", _returnsRPCErr == nil)
	return _returnsA, _returnsB, _returnsRPCErr
}

// MessageWillBeUpdatedWithRPCErr wraps the underlying implementation's MessageWillBeUpdatedWithRPCErr
// and records timing metrics.
func (hooks *hooksTimerLayer) MessageWillBeUpdatedWithRPCErr(c *Context, newPost, oldPost *model.Post) (*model.Post, string, error) {
	startTime := timePkg.Now()
	_returnsA, _returnsB, _returnsRPCErr := hooks.hooksWithRPCErrImpl.MessageWillBeUpdatedWithRPCErr(c, newPost, oldPost)
	hooks.recordTime(startTime, "MessageWillBeUpdatedWithRPCErr", _returnsRPCErr == nil)
	return _returnsA, _returnsB, _returnsRPCErr
}

// ChannelMemberWillBeAddedWithRPCErr wraps the underlying implementation's ChannelMemberWillBeAddedWithRPCErr
// and records timing metrics.
func (hooks *hooksTimerLayer) ChannelMemberWillBeAddedWithRPCErr(c *Context, channelMember *model.ChannelMember) (*model.ChannelMember, string, error) {
	startTime := timePkg.Now()
	_returnsA, _returnsB, _returnsRPCErr := hooks.hooksWithRPCErrImpl.ChannelMemberWillBeAddedWithRPCErr(c, channelMember)
	hooks.recordTime(startTime, "ChannelMemberWillBeAddedWithRPCErr", _returnsRPCErr == nil)
	return _returnsA, _returnsB, _returnsRPCErr
}
