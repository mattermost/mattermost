// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type UserPostDeliveryContentReview struct {
	ReviewPostID string `json:"review_post_id" db:"review_post_id"`
	PostID       string `json:"post_id" db:"post_id"`
	TargetID     string `json:"target_id" db:"target_id"`
	TargetType   string `json:"target_type" db:"target_type"`
	Mechanism    int16  `json:"mechanism" db:"mechanism"`
	CreatedAt    int64  `json:"created_at" db:"created_at"`
	CopiedAt     int64  `json:"copied_at" db:"copied_at"`
	JobID        string `json:"job_id" db:"job_id"`
}

type UserPostDeliveryReviewCursor struct {
	TargetID   string
	TargetType string
	PostID     string
	Mechanism  int16
}

func (c UserPostDeliveryReviewCursor) IsFirstPage() bool {
	return c.TargetID == ""
}
