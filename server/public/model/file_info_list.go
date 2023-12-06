// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"sort"
)

type FileInfoList struct {
	Order          []string             `json:"order"`
	FileInfos      map[string]*FileInfo `json:"file_infos"`
	NextFileInfoId string               `json:"next_file_info_id"`
	PrevFileInfoId string               `json:"prev_file_info_id"`
	// If there are inaccessible files, FirstInaccessibleFileTime is the time of the latest inaccessible file
	FirstInaccessibleFileTime int64 `json:"first_inaccessible_file_time"`
}

func NewFileInfoList() *FileInfoList {
	return &FileInfoList{
		Order:          make([]string, 0),
		FileInfos:      make(map[string]*FileInfo),
		NextFileInfoId: "",
		PrevFileInfoId: "",
	}
}

func (o *FileInfoList) ToSlice() []*FileInfo {
	var fileInfos []*FileInfo
	for _, id := range o.Order {
		fileInfos = append(fileInfos, o.FileInfos[id])
	}
	return fileInfos
}

func (o *FileInfoList) MakeNonNil() {
	if o.Order == nil {
		o.Order = make([]string, 0)
	}

	if o.FileInfos == nil {
		o.FileInfos = make(map[string]*FileInfo)
	}
}

func (o *FileInfoList) AddOrder(id string) {
	if o.Order == nil {
		o.Order = make([]string, 0, 128)
	}

	o.Order = append(o.Order, id)
}

func (o *FileInfoList) AddFileInfo(fileInfo *FileInfo) {
	if o.FileInfos == nil {
		o.FileInfos = make(map[string]*FileInfo)
	}

	o.FileInfos[fileInfo.Id] = fileInfo
}

func (o *FileInfoList) UniqueOrder() {
	keys := make(map[string]bool)
	order := []string{}
	for _, fileInfoId := range o.Order {
		if _, value := keys[fileInfoId]; !value {
			keys[fileInfoId] = true
			order = append(order, fileInfoId)
		}
	}

	o.Order = order
}

func (o *FileInfoList) Extend(other *FileInfoList) {
	for fileInfoId := range other.FileInfos {
		o.AddFileInfo(other.FileInfos[fileInfoId])
	}

	for _, fileInfoId := range other.Order {
		o.AddOrder(fileInfoId)
	}

	o.UniqueOrder()
}

func (o *FileInfoList) SortByCreateAt() {
	sort.Slice(o.Order, func(i, j int) bool {
		return o.FileInfos[o.Order[i]].CreateAt > o.FileInfos[o.Order[j]].CreateAt
	})
}

func (o *FileInfoList) Etag() string {
	id := "0"
	var t int64

	for _, v := range o.FileInfos {
		if v.UpdateAt > t {
			t = v.UpdateAt
			id = v.Id
		} else if v.UpdateAt == t && v.Id > id {
			t = v.UpdateAt
			id = v.Id
		}
	}

	orderId := ""
	if len(o.Order) > 0 {
		orderId = o.Order[0]
	}

	return Etag(orderId, id, t)
}
