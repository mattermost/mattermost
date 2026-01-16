// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// File API Handlers
// =============================================================================

// CopyFileInfos duplicates FileInfo objects for a user.
func (s *APIServer) CopyFileInfos(ctx context.Context, req *pb.CopyFileInfosRequest) (*pb.CopyFileInfosResponse, error) {
	fileIds, appErr := s.impl.CopyFileInfos(req.UserId, req.FileIds)
	return &pb.CopyFileInfosResponse{
		Error:   appErrorToProto(appErr),
		FileIds: fileIds,
	}, nil
}

// GetFileInfo gets file info for a specific file ID.
func (s *APIServer) GetFileInfo(ctx context.Context, req *pb.GetFileInfoRequest) (*pb.GetFileInfoResponse, error) {
	fileInfo, appErr := s.impl.GetFileInfo(req.FileId)
	return &pb.GetFileInfoResponse{
		Error:    appErrorToProto(appErr),
		FileInfo: fileInfoToProto(fileInfo),
	}, nil
}

// SetFileSearchableContent updates file info searchable content.
func (s *APIServer) SetFileSearchableContent(ctx context.Context, req *pb.SetFileSearchableContentRequest) (*pb.SetFileSearchableContentResponse, error) {
	appErr := s.impl.SetFileSearchableContent(req.FileId, req.Content)
	return &pb.SetFileSearchableContentResponse{
		Error: appErrorToProto(appErr),
	}, nil
}

// GetFileInfos gets file infos with pagination and options.
func (s *APIServer) GetFileInfos(ctx context.Context, req *pb.GetFileInfosRequest) (*pb.GetFileInfosResponse, error) {
	opts := fileInfosOptionsFromProto(req.Options)
	fileInfos, appErr := s.impl.GetFileInfos(int(req.Page), int(req.PerPage), opts)
	return &pb.GetFileInfosResponse{
		Error:     appErrorToProto(appErr),
		FileInfos: fileInfosToProto(fileInfos),
	}, nil
}

// GetFile gets the content of a file by its ID.
func (s *APIServer) GetFile(ctx context.Context, req *pb.GetFileRequest) (*pb.GetFileResponse, error) {
	data, appErr := s.impl.GetFile(req.FileId)
	return &pb.GetFileResponse{
		Error: appErrorToProto(appErr),
		Data:  data,
	}, nil
}

// GetFileLink gets the public link to a file.
func (s *APIServer) GetFileLink(ctx context.Context, req *pb.GetFileLinkRequest) (*pb.GetFileLinkResponse, error) {
	link, appErr := s.impl.GetFileLink(req.FileId)
	return &pb.GetFileLinkResponse{
		Error: appErrorToProto(appErr),
		Link:  link,
	}, nil
}

// ReadFile reads file content from the backend for a specific path.
func (s *APIServer) ReadFile(ctx context.Context, req *pb.ReadFileRequest) (*pb.ReadFileResponse, error) {
	data, appErr := s.impl.ReadFile(req.Path)
	return &pb.ReadFileResponse{
		Error: appErrorToProto(appErr),
		Data:  data,
	}, nil
}

// UploadFile uploads a file to a channel.
func (s *APIServer) UploadFile(ctx context.Context, req *pb.UploadFileRequest) (*pb.UploadFileResponse, error) {
	fileInfo, appErr := s.impl.UploadFile(req.Data, req.ChannelId, req.Filename)
	return &pb.UploadFileResponse{
		Error:    appErrorToProto(appErr),
		FileInfo: fileInfoToProto(fileInfo),
	}, nil
}

// fileInfosOptionsFromProto converts pb.GetFileInfosOptions to model.GetFileInfosOptions.
func fileInfosOptionsFromProto(opts *pb.GetFileInfosOptions) *model.GetFileInfosOptions {
	if opts == nil {
		return nil
	}

	modelOpts := &model.GetFileInfosOptions{
		IncludeDeleted: opts.IncludeDeleted,
		SortBy:         opts.SortBy,
		SortDescending: opts.SortOrder == "desc",
	}

	if opts.UserId != "" {
		modelOpts.UserIds = []string{opts.UserId}
	}
	if opts.ChannelId != "" {
		modelOpts.ChannelIds = []string{opts.ChannelId}
	}

	return modelOpts
}
