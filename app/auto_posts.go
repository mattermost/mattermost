// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

type AutoPostCreator struct {
	client         *model.Client4
	channelid      string
	Fuzzy          bool
	TextLength     utils.Range
	HasImage       bool
	ImageFilenames []string
	Users          []string
	Mentions       utils.Range
	Tags           utils.Range
}

// Automatic poster used for testing
func NewAutoPostCreator(client *model.Client4, channelid string) *AutoPostCreator {
	return &AutoPostCreator{
		client:         client,
		channelid:      channelid,
		Fuzzy:          false,
		TextLength:     utils.Range{Begin: 100, End: 200},
		HasImage:       false,
		ImageFilenames: TEST_IMAGE_FILENAMES,
		Users:          []string{},
		Mentions:       utils.Range{Begin: 0, End: 5},
		Tags:           utils.Range{Begin: 0, End: 7},
	}
}

func (cfg *AutoPostCreator) UploadTestFile() ([]string, error) {
	filename := cfg.ImageFilenames[utils.RandIntFromRange(utils.Range{Begin: 0, End: len(cfg.ImageFilenames) - 1})]

	path, _ := fileutils.FindDir("tests")
	file, err := os.Open(filepath.Join(path, filename))
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data := &bytes.Buffer{}
	_, err = io.Copy(data, file)
	if err != nil {
		return nil, err
	}

	fileResp, resp := cfg.client.UploadFile(data.Bytes(), cfg.channelid, filename)
	if resp.Error != nil {
		return nil, resp.Error
	}

	return []string{fileResp.FileInfos[0].Id}, nil
}

func (cfg *AutoPostCreator) CreateRandomPost() (*model.Post, error) {
	return cfg.CreateRandomPostNested("", "")
}

func (cfg *AutoPostCreator) CreateRandomPostNested(parentId, rootId string) (*model.Post, error) {
	var fileIds []string
	if cfg.HasImage {
		var err error
		fileIds, err = cfg.UploadTestFile()
		if err != nil {
			return nil, err
		}
	}

	var postText string
	if cfg.Fuzzy {
		postText = utils.FuzzPost()
	} else {
		postText = utils.RandomText(cfg.TextLength, cfg.Tags, cfg.Mentions, cfg.Users)
	}

	post := &model.Post{
		ChannelId: cfg.channelid,
		ParentId:  parentId,
		RootId:    rootId,
		Message:   postText,
		FileIds:   fileIds}
	rpost, resp := cfg.client.CreatePost(post)
	if resp.Error != nil {
		return nil, resp.Error
	}
	return rpost, nil
}
