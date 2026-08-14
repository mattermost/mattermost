// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/require"
)

type rejectingValueWriteHook struct {
	BasePropertyHook
	err error
}

func (h *rejectingValueWriteHook) PreCreatePropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	return value, h.err
}

func (h *rejectingValueWriteHook) PreCreatePropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return values, h.err
}

func (h *rejectingValueWriteHook) PreUpdatePropertyValue(_ request.CTX, _ string, value *model.PropertyValue) (*model.PropertyValue, error) {
	return value, h.err
}

func (h *rejectingValueWriteHook) PreUpdatePropertyValues(_ request.CTX, _ string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return values, h.err
}

func (h *rejectingValueWriteHook) PreUpsertPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	return value, h.err
}

func (h *rejectingValueWriteHook) PreUpsertPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return values, h.err
}

func (h *rejectingValueWriteHook) PreDeletePropertyValue(_ request.CTX, _, _ string) error {
	return h.err
}

func (h *rejectingValueWriteHook) PreDeletePropertyValuesForTarget(_ request.CTX, _, _, _ string) error {
	return h.err
}

func (h *rejectingValueWriteHook) PreDeletePropertyValuesForField(_ request.CTX, _, _ string) error {
	return h.err
}

type recordingValueWriteHook struct {
	BasePropertyHook
	operation string
}

func (h *recordingValueWriteHook) record(operation string) error {
	h.operation = operation
	return nil
}

func (h *recordingValueWriteHook) PostCreatePropertyValue(_ request.CTX, _ *model.PropertyValue) error {
	return h.record("create")
}

func (h *recordingValueWriteHook) PostCreatePropertyValues(_ request.CTX, _ []*model.PropertyValue) error {
	return h.record("create_batch")
}

func (h *recordingValueWriteHook) PostUpdatePropertyValue(_ request.CTX, _ *model.PropertyValue) error {
	return h.record("update")
}

func (h *recordingValueWriteHook) PostUpdatePropertyValues(_ request.CTX, _ []*model.PropertyValue) error {
	return h.record("update_batch")
}

func (h *recordingValueWriteHook) PostUpsertPropertyValue(_ request.CTX, _ *model.PropertyValue) error {
	return h.record("upsert")
}

func (h *recordingValueWriteHook) PostUpsertPropertyValues(_ request.CTX, _ []*model.PropertyValue) error {
	return h.record("upsert_batch")
}

func (h *recordingValueWriteHook) PostDeletePropertyValue(_ request.CTX, _, _ string, _ *model.PropertyValue) error {
	return h.record("delete")
}

func (h *recordingValueWriteHook) PostDeletePropertyValuesForTarget(_ request.CTX, _, _, _ string) error {
	return h.record("delete_target")
}

func (h *recordingValueWriteHook) PostDeletePropertyValuesForField(_ request.CTX, _, _ string) error {
	return h.record("delete_field")
}

func TestValueWritePostHooksDoNotRunAfterPreHookErrors(t *testing.T) {
	th := Setup(t)
	rejectedErr := errors.New("write rejected")
	recorder := &recordingValueWriteHook{}
	th.service.AddHook(&rejectingValueWriteHook{err: rejectedErr})
	th.service.AddHook(recorder)

	groupID := model.NewId()
	valueID := model.NewId()
	value := &model.PropertyValue{GroupID: groupID}

	tests := []struct {
		name string
		run  func() error
	}{
		{
			name: "create",
			run: func() error {
				_, err := th.service.CreatePropertyValue(th.Context, value)
				return err
			},
		},
		{
			name: "create batch",
			run: func() error {
				_, err := th.service.CreatePropertyValues(th.Context, []*model.PropertyValue{value})
				return err
			},
		},
		{
			name: "update",
			run: func() error {
				_, err := th.service.UpdatePropertyValue(th.Context, groupID, value)
				return err
			},
		},
		{
			name: "update batch",
			run: func() error {
				_, err := th.service.UpdatePropertyValues(th.Context, groupID, []*model.PropertyValue{value})
				return err
			},
		},
		{
			name: "upsert",
			run: func() error {
				_, err := th.service.UpsertPropertyValue(th.Context, value)
				return err
			},
		},
		{
			name: "upsert batch",
			run: func() error {
				_, err := th.service.UpsertPropertyValues(th.Context, []*model.PropertyValue{value})
				return err
			},
		},
		{
			name: "delete",
			run: func() error {
				return th.service.DeletePropertyValue(th.Context, groupID, valueID)
			},
		},
		{
			name: "delete target",
			run: func() error {
				return th.service.DeletePropertyValuesForTarget(th.Context, groupID, "user", model.NewId())
			},
		},
		{
			name: "delete field",
			run: func() error {
				return th.service.DeletePropertyValuesForField(th.Context, groupID, model.NewId())
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder.operation = ""

			err := tt.run()
			require.ErrorIs(t, err, rejectedErr)
			require.Empty(t, recorder.operation)
		})
	}
}
