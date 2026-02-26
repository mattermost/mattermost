package model

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type AttendanceStatus string

const (
	AttendanceStatusWorking   AttendanceStatus = "working"
	AttendanceStatusBreak     AttendanceStatus = "break"
	AttendanceStatusCompleted AttendanceStatus = "completed"
)

const (
	AttendanceChannel         = "attendance"
	AttendanceApprovalChannel = "attendance-approval"
)

// BreakRecord represents a single break period with a reason.
type BreakRecord struct {
	Start  time.Time  `bson:"start" json:"start"`
	End    *time.Time `bson:"end,omitempty" json:"end,omitempty"`
	Reason string     `bson:"reason" json:"reason"`
}

type AttendanceRecord struct {
	ID             bson.ObjectID    `bson:"_id,omitempty" json:"id"`
	UserID         string           `bson:"user_id" json:"user_id"`
	Username       string           `bson:"username" json:"username"`
	TeamID         string           `bson:"team_id" json:"team_id"`
	ChannelID      string           `bson:"channel_id" json:"channel_id"`
	PostID         string           `bson:"post_id" json:"post_id"` // checkin post ID for threading
	Date           string           `bson:"date" json:"date"`       // YYYY-MM-DD
	CheckIn        *time.Time       `bson:"check_in,omitempty" json:"check_in"`
	CheckInImageID  string           `bson:"checkin_image_id,omitempty" json:"checkin_image_id,omitempty"`
	Breaks          []BreakRecord    `bson:"breaks" json:"breaks"`
	CheckOut        *time.Time       `bson:"check_out,omitempty" json:"check_out"`
	CheckOutImageID string           `bson:"checkout_image_id,omitempty" json:"checkout_image_id,omitempty"`
	Status         AttendanceStatus `bson:"status" json:"status"`
	CreatedAt      time.Time        `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time        `bson:"updated_at" json:"updated_at"`
}
