package store

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"oktel-bot/internal/model"
)

type AttendanceStore struct {
	attendance *mongo.Collection
	leave      *mongo.Collection
}

func NewAttendanceStore(ctx context.Context, db *MongoDB) (*AttendanceStore, error) {
	attendance := db.Collection("attendance")
	leave := db.Collection("leave_requests")

	if _, err := attendance.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "user_id", Value: 1}, {Key: "date", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{Keys: bson.D{{Key: "date", Value: 1}}},
		{Keys: bson.D{{Key: "team_id", Value: 1}, {Key: "date", Value: 1}}},
	}); err != nil {
		return nil, fmt.Errorf("create attendance indexes: %w", err)
	}

	if _, err := leave.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "dates", Value: 1}}},
		{Keys: bson.D{{Key: "dates", Value: 1}}},
		{Keys: bson.D{{Key: "team_id", Value: 1}, {Key: "dates", Value: 1}}},
	}); err != nil {
		return nil, fmt.Errorf("create leave_requests indexes: %w", err)
	}

	return &AttendanceStore{attendance: attendance, leave: leave}, nil
}

// GetTodayRecord returns today's attendance record for a user, or nil if not found.
func (s *AttendanceStore) GetTodayRecord(ctx context.Context, userID, date string) (*model.AttendanceRecord, error) {
	var record model.AttendanceRecord
	err := s.attendance.FindOne(ctx, bson.M{
		"user_id": userID,
		"date":    date,
	}).Decode(&record)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find attendance: %w", err)
	}
	return &record, nil
}

// CreateRecord inserts a new attendance record and sets the ID on the struct.
func (s *AttendanceStore) CreateRecord(ctx context.Context, record *model.AttendanceRecord) error {
	record.CreatedAt = time.Now()
	record.UpdatedAt = time.Now()
	res, err := s.attendance.InsertOne(ctx, record)
	if err != nil {
		return err
	}
	record.ID = res.InsertedID.(bson.ObjectID)
	return nil
}

// UpdateRecord updates an existing attendance record.
func (s *AttendanceStore) UpdateRecord(ctx context.Context, record *model.AttendanceRecord) error {
	record.UpdatedAt = time.Now()
	_, err := s.attendance.ReplaceOne(ctx, bson.M{"_id": record.ID}, record)
	return err
}

// CreateLeaveRequest inserts a new leave request and sets the ID on the struct.
func (s *AttendanceStore) CreateLeaveRequest(ctx context.Context, req *model.LeaveRequest) error {
	req.CreatedAt = time.Now()
	req.UpdatedAt = time.Now()
	res, err := s.leave.InsertOne(ctx, req)
	if err != nil {
		return err
	}
	req.ID = res.InsertedID.(bson.ObjectID)
	return nil
}

// GetLeaveRequestByID retrieves a leave request by its ObjectID.
func (s *AttendanceStore) GetLeaveRequestByID(ctx context.Context, id bson.ObjectID) (*model.LeaveRequest, error) {
	var req model.LeaveRequest
	err := s.leave.FindOne(ctx, bson.M{"_id": id}).Decode(&req)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find leave request: %w", err)
	}
	return &req, nil
}

// FindLeaveRequestsByUserAndDates returns leave requests for a user that contain any of the given dates.
func (s *AttendanceStore) FindLeaveRequestsByUserAndDates(ctx context.Context, userID string, dates []string) ([]model.LeaveRequest, error) {
	cursor, err := s.leave.Find(ctx, bson.M{
		"user_id": userID,
		"dates":   bson.M{"$elemMatch": bson.M{"$in": dates}},
	})
	if err != nil {
		return nil, fmt.Errorf("find leave requests: %w", err)
	}
	var results []model.LeaveRequest
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode leave requests: %w", err)
	}
	return results, nil
}

// UpdateLeaveRequest updates an existing leave request.
func (s *AttendanceStore) UpdateLeaveRequest(ctx context.Context, req *model.LeaveRequest) error {
	req.UpdatedAt = time.Now()
	_, err := s.leave.ReplaceOne(ctx, bson.M{"_id": req.ID}, req)
	return err
}

// GetLeaveRequestsByDate returns all leave requests that include the given date (YYYY-MM-DD).
func (s *AttendanceStore) GetLeaveRequestsByDate(ctx context.Context, date string) ([]*model.LeaveRequest, error) {
	cursor, err := s.leave.Find(ctx, bson.M{"dates": date})
	if err != nil {
		return nil, fmt.Errorf("find leave requests: %w", err)
	}
	var results []*model.LeaveRequest
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode leave requests: %w", err)
	}
	return results, nil
}

// GetAttendanceByDate returns all attendance records for the given date (YYYY-MM-DD).
func (s *AttendanceStore) GetAttendanceByDate(ctx context.Context, date string) ([]*model.AttendanceRecord, error) {
	cursor, err := s.attendance.Find(ctx, bson.M{"date": date})
	if err != nil {
		return nil, fmt.Errorf("find attendance: %w", err)
	}
	var results []*model.AttendanceRecord
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode attendance: %w", err)
	}
	return results, nil
}

// GetAttendanceByDateRange returns attendance records within a date range, optionally filtered by user and/or team.
func (s *AttendanceStore) GetAttendanceByDateRange(ctx context.Context, from, to, userID, teamID string) ([]*model.AttendanceRecord, error) {
	filter := bson.M{"date": bson.M{"$gte": from, "$lte": to}}
	if userID != "" {
		filter["user_id"] = userID
	}
	if teamID != "" {
		filter["team_id"] = teamID
	}
	cursor, err := s.attendance.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("find attendance: %w", err)
	}
	var results []*model.AttendanceRecord
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode attendance: %w", err)
	}
	return results, nil
}

// GetLeaveRequestsByDateRange returns leave requests that overlap with a date range, optionally filtered by user and/or team.
func (s *AttendanceStore) GetLeaveRequestsByDateRange(ctx context.Context, from, to, userID, teamID string) ([]*model.LeaveRequest, error) {
	filter := bson.M{"dates": bson.M{"$elemMatch": bson.M{"$gte": from, "$lte": to}}}
	if userID != "" {
		filter["user_id"] = userID
	}
	if teamID != "" {
		filter["team_id"] = teamID
	}
	cursor, err := s.leave.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("find leave requests: %w", err)
	}
	var results []*model.LeaveRequest
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("decode leave requests: %w", err)
	}
	return results, nil
}
