// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// FileInfo Conversions
// =============================================================================

// fileInfoToProto converts a model.FileInfo to a protobuf FileInfo.
func fileInfoToProto(fi *model.FileInfo) *pb.FileInfo {
	if fi == nil {
		return nil
	}

	pbFileInfo := &pb.FileInfo{
		Id:              fi.Id,
		CreatorId:       fi.CreatorId,
		PostId:          fi.PostId,
		ChannelId:       fi.ChannelId,
		CreateAt:        fi.CreateAt,
		UpdateAt:        fi.UpdateAt,
		DeleteAt:        fi.DeleteAt,
		Name:            fi.Name,
		Extension:       fi.Extension,
		Size:            fi.Size,
		MimeType:        fi.MimeType,
		Width:           int32(fi.Width),
		Height:          int32(fi.Height),
		HasPreviewImage: fi.HasPreviewImage,
		Archived:        fi.Archived,
	}

	// Handle optional MiniPreview
	if fi.MiniPreview != nil {
		pbFileInfo.MiniPreview = *fi.MiniPreview
	}

	// Handle optional RemoteId
	if fi.RemoteId != nil {
		pbFileInfo.RemoteId = fi.RemoteId
	}

	return pbFileInfo
}

// fileInfoFromProto converts a protobuf FileInfo to a model.FileInfo.
func fileInfoFromProto(pbFileInfo *pb.FileInfo) *model.FileInfo {
	if pbFileInfo == nil {
		return nil
	}

	fi := &model.FileInfo{
		Id:              pbFileInfo.Id,
		CreatorId:       pbFileInfo.CreatorId,
		PostId:          pbFileInfo.PostId,
		ChannelId:       pbFileInfo.ChannelId,
		CreateAt:        pbFileInfo.CreateAt,
		UpdateAt:        pbFileInfo.UpdateAt,
		DeleteAt:        pbFileInfo.DeleteAt,
		Name:            pbFileInfo.Name,
		Extension:       pbFileInfo.Extension,
		Size:            pbFileInfo.Size,
		MimeType:        pbFileInfo.MimeType,
		Width:           int(pbFileInfo.Width),
		Height:          int(pbFileInfo.Height),
		HasPreviewImage: pbFileInfo.HasPreviewImage,
		Archived:        pbFileInfo.Archived,
		RemoteId:        pbFileInfo.RemoteId,
	}

	// Handle optional MiniPreview
	if len(pbFileInfo.MiniPreview) > 0 {
		miniPreview := pbFileInfo.MiniPreview
		fi.MiniPreview = &miniPreview
	}

	return fi
}

// fileInfosToProto converts a slice of model.FileInfo to a slice of pb.FileInfo.
func fileInfosToProto(fileInfos []*model.FileInfo) []*pb.FileInfo {
	if fileInfos == nil {
		return nil
	}
	result := make([]*pb.FileInfo, len(fileInfos))
	for i, fi := range fileInfos {
		result[i] = fileInfoToProto(fi)
	}
	return result
}

// =============================================================================
// GetFileInfosOptions Conversions
// =============================================================================

// getFileInfosOptionsFromProto converts a pb.GetFileInfosOptions to model.GetFileInfosOptions.
func getFileInfosOptionsFromProto(opts *pb.GetFileInfosOptions) *model.GetFileInfosOptions {
	if opts == nil {
		return nil
	}

	return &model.GetFileInfosOptions{
		UserIds:        []string{opts.UserId},
		ChannelIds:     []string{opts.ChannelId},
		IncludeDeleted: opts.IncludeDeleted,
		SortBy:         opts.SortBy,
		SortDescending: opts.SortOrder == "desc",
	}
}
