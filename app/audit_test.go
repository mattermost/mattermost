// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"reflect"
	"testing"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/imageproxy"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetAudits(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	s := th.Server

	ch := &Channels{
		srv:           s,
		imageProxy:    imageproxy.MakeImageProxy(s.platform, s.httpService, s.Log()),
		uploadLockMap: map[string]bool{},
	}

	a := &App{
		ch: ch,
	}
	mockAuditStore := mocks.AuditStore{}

	mockAuditStore.On("Get", mock.Anything).Return(mockAuditStore.TestData(), nil)
	t.Run("GetAudits", func(t *testing.T) {
		got, err := a.GetAudits(th.Context, th.BasicUser.Id, 0)
		require.Nil(t, err)
		require.Nil(t, got)
	})

}

func TestMakeAuditRecord(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	s := th.Server
	type fields struct {
		ch *Channels
	}
	type args struct {
		c             request.CTX
		event         string
		initialStatus string
	}
	tests := []struct {
		name     string
		fields   fields
		args     args
		Expected *audit.Record
	}{
		{
			"create audit record",
			fields{ch: &Channels{
				srv:           s,
				imageProxy:    imageproxy.MakeImageProxy(s.platform, s.httpService, s.Log()),
				uploadLockMap: map[string]bool{},
			}},
			args{th.Context, "testImport", audit.Success},
			&audit.Record{
				EventName: "testImport",
				Status:    "",
				EventData: audit.EventData{},
				Actor:     audit.EventActor{},
				Meta:      map[string]interface{}{},
				Error:     audit.EventError{},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &App{
				ch: tt.fields.ch,
			}

			if got := a.MakeAuditRecord(tt.args.c, tt.args.event, tt.args.initialStatus); !reflect.DeepEqual(got.EventName, tt.Expected.EventName) {
				t.Errorf("App.MakeAuditRecord() = %v, want %v", got, tt.Expected)
			}
		})
	}
}

func TestGetAuditsPage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	s := th.Server
	type fields struct {
		ch *Channels
	}
	type args struct {
		c       request.CTX
		userID  string
		page    int
		perPage int
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		want   model.Audits
		want1  *model.AppError
	}{
		{
			"get audits page",
			fields{ch: &Channels{
				srv:           s,
				imageProxy:    imageproxy.MakeImageProxy(s.platform, s.httpService, s.Log()),
				uploadLockMap: map[string]bool{},
			}},
			args{th.Context, "testUserId", 0, 1},
			nil,
			&model.AppError{
				Id:            "",
				Message:       "",
				DetailedError: "",
				RequestId:     "",
				StatusCode:    0,
				Where:         "",
				IsOAuth:       false,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &App{
				ch: tt.fields.ch,
			}
			mockStore := mocks.Store{}
			mockStore.On("Audit").Return(th.App.Srv().Store().Audit())

			mockAuditStore := mocks.AuditStore{}
			mockAuditStore.On("Get", mock.Anything).Return(mockAuditStore.TestData(), nil)

			got, got1 := a.GetAuditsPage(tt.args.c, tt.args.userID, tt.args.page, tt.args.perPage)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("App.GetAuditsPage() got = %v, want %v", got, tt.want)
			}
			require.Nil(t, got1)
		})
	}
}

func TestLogAuditRec(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	s := th.Server

	type fields struct {
		ch *Channels
	}
	type args struct {
		c   request.CTX
		rec *audit.Record
		err error
	}
	tests := []struct {
		name   string
		fields fields
		args   args
	}{
		{
			"log audit rec",
			fields{ch: &Channels{
				srv:           s,
				imageProxy:    imageproxy.MakeImageProxy(s.platform, s.httpService, s.Log()),
				uploadLockMap: map[string]bool{},
			}},
			args{th.Context, &audit.Record{
				EventName: "testImport",
				Status:    "",
				EventData: audit.EventData{},
				Actor:     audit.EventActor{},
				Meta:      map[string]interface{}{},
				Error:     audit.EventError{},
			}, nil},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &App{
				ch: tt.fields.ch,
			}

			a.LogAuditRec(tt.args.c, tt.args.rec, tt.args.err)

		})
	}
}
