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
		userId, teamId       string
		client               model.NoticeClientType
		clientVersion        string
		locale               string
		postCount, userCount int64
		notice               *model.ProductNotice
	}
	messages := map[string]model.NoticeMessage{
		"enUS": {
			Description: "descr",
			Title:       "title",
		},
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
				userId:        "userA",
				teamId:        "teamA",
				client:        "mobile",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions:        model.Conditions{},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: false,
			wantOk:  true,
		},
		{
			name: "mobile notice",
			args: args{
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ClientType: model.NewNoticeClientType(model.NoticeClientType_Mobile),
					},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: false,
			wantOk:  false,
		},
		{
			name: "notice with config check",
			args: args{
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ClientType:   model.NewNoticeClientType(model.NoticeClientType_Desktop),
						ServerConfig: map[string]interface{}{"ServiceSettings.LetsEncryptCertificateCacheFile": "./config/letsencrypt.cache"},
					},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: false,
			wantOk:  true,
		},
		{
			name: "notice with failing config check",
			args: args{
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ClientType:   model.NewNoticeClientType(model.NoticeClientType_Desktop),
						ServerConfig: map[string]interface{}{"ServiceSettings.ZZ": "test"},
					},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: false,
			wantOk:  false,
		},
		{
			name: "notice with server version check",
			args: args{
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ServerVersion: []string{"> 4.0.0 < 99.0.0"},
					},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: false,
			wantOk:  true,
		},
		{
			name: "notice with server version check that doesn't match",
			args: args{
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ServerVersion: []string{"> 99.0.0"},
					},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: false,
			wantOk:  false,
		},
		{
			name: "notice with server version check that is invalid",
			args: args{
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ServerVersion: []string{"99.0.0 + 1.0.0"},
					},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: true,
			wantOk:  false,
		},
		{
			name: "notice with date check",
			args: args{
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ClientType:  model.NewNoticeClientType(model.NoticeClientType_Desktop),
						DisplayDate: model.NewString("> 2000-03-01T00:00:00Z <= 2999-04-01T00:00:00Z"),
					},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: false,
			wantOk:  true,
		},

		{
			name: "notice with date check that doesn't match",
			args: args{
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ClientType:  model.NewNoticeClientType(model.NoticeClientType_Desktop),
						DisplayDate: model.NewString("> 2999-03-01T00:00:00Z <= 3000-04-01T00:00:00Z"),
					},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: false,
			wantOk:  false,
		},
		{
			name: "notice with bad date check",
			args: args{
				userId:        "userA",
				teamId:        "teamA",
				client:        "desktop",
				clientVersion: "1.2.3",

				notice: &model.ProductNotice{
					Conditions: model.Conditions{
						ClientType:  model.NewNoticeClientType(model.NoticeClientType_Desktop),
						DisplayDate: model.NewString("> 2000 -03-01T00:00:00Z <= 2999-04-01T00:00:00Z"),
					},
					ID:                "123",
					LocalizedMessages: messages,
				},
			},
			wantErr: true,
			wantOk:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if ok, err := noticeMatchesConditions(th.App,
				tt.args.userId,
				tt.args.teamId,
				tt.args.client,
				tt.args.clientVersion,
				tt.args.locale,
				tt.args.postCount,
				tt.args.userCount,
				tt.args.notice,
			); (err != nil) != tt.wantErr {
				t.Errorf("noticeMatchesConditions() error = %v, wantErr %v", err, tt.wantErr)
			} else if ok != tt.wantOk {
				t.Errorf("noticeMatchesConditions() result = %v, wantOk %v", ok, tt.wantOk)
			}
		})
	}
}
