package app

import (
	"testing"
	"time"
)

func TestShouldSendWeeklyDigestMessage(t *testing.T) {
	now, ok := time.Parse("2006-01-02", "2022-10-08")
	if ok != nil {
		t.Error("Could not parse current time")
	}

	type args struct {
		userInfo    UserInfo
		timezone    *time.Location
		currentTime time.Time
	}
	tests := []struct {
		name string
		args args
		want bool
	}{
		{
			name: "Should not send a weekly digest if the user has configured it so",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.AddDate(0, 0, -6).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableWeeklyDigest: true,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: false,
		},
		{
			name: "Should not send a weekly digest if we have already sent a digest this week",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.AddDate(0, 0, -1).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: false,
		},
		{
			name: "Should send a weekly digest if we have not sent a digest this week",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.AddDate(0, 0, -6).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: true,
		},
		{
			name: "Should send a weekly digest if we have not sent a digest ever",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: 0,
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest:  false,
						DisableWeeklyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ShouldSendWeeklyDigestMessage(tt.args.userInfo, tt.args.timezone, tt.args.currentTime); got != tt.want {
				t.Errorf("ShouldSendWeeklyDigestMessage() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestShouldSendDailyDigestMessage(t *testing.T) {
	now, ok := time.Parse("Jan 2, 2006 at 3:04pm", "Oct 8, 2022 at 3:04pm")
	lateNow, lateOk := time.Parse("Jan 2, 2006 at 3:04pm", "Oct 8, 2022 at 12:10am")
	if ok != nil || lateOk != nil {
		t.Error("Could not parse current time")
	}

	type args struct {
		userInfo    UserInfo
		timezone    *time.Location
		currentTime time.Time
	}
	tests := []struct {
		name string
		args args
		want bool
	}{
		{
			name: "Should not send a daily digest if we have already sent a digest today",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.Add(-((time.Hour * 1) + (time.Minute * 2))).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: false,
		},
		{
			name: "Should send a daily digest if we have not sent a digest today",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.Add(-(time.Hour * 25)).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: true,
		},
		{
			name: "Should not send a daily digest if we have sent one within the last hour",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: lateNow.Add(-(time.Minute * 40)).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: lateNow,
			},
			want: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ShouldSendDailyDigestMessage(tt.args.userInfo, tt.args.timezone, tt.args.currentTime); got != tt.want {
				t.Errorf("ShouldSendDailyDigestMessage() = %v, want %v", got, tt.want)
			}
		})
	}
}
