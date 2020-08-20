// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"testing"
)

func TestNoticeValidation(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	type args struct {
		lastViewed     int64
		userId, teamId string
		client         model.NoticeClientType
		clientVersion  string
		locale         string
		notice         *model.ProductNotice
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
		wantOk  bool
	}{
		{
			name: "general notice",
			args: args{
				lastViewed:    0,
				userId:        "userA",
				teamId:        "teamA",
				client:        "mobile",
				clientVersion: "1.2.3",
				locale:        "enUS",
				notice: &model.ProductNotice{
					Conditions: model.Conditions{},
					ID:         "123",
					LocalizedMessages: map[string]model.NoticeMessage{
						"enUS": {
							Description: "descr",
							Title:       "title",
						},
					},
				},
			},
			wantErr: false,
			wantOk:  true,
		},
		{
			name: "mobile notice",
			args: args{
				lastViewed:    0,
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",
				locale:        "enUS",
				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ClientType: model.NewNoticeClientType(model.NoticeClientType_Mobile),
					},
					ID: "123",
					LocalizedMessages: map[string]model.NoticeMessage{
						"enUS": {
							Description: "descr",
							Title:       "title",
						},
					},
				},
			},
			wantErr: false,
			wantOk:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if ok, err := noticeMatchesConditions(th.App, tt.args.lastViewed, tt.args.userId, tt.args.teamId, tt.args.client, tt.args.clientVersion, tt.args.locale, tt.args.notice); (err != nil) != tt.wantErr {
				t.Errorf("noticeMatchesConditions() error = %v, wantErr %v", err, tt.wantErr)
			} else if ok != tt.wantOk {
				t.Errorf("noticeMatchesConditions() result = %v, wantOk %v", ok, tt.wantOk)
			}
		})
	}
}
