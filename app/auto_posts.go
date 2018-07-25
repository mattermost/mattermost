// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"io"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
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

func (cfg *AutoPostCreator) UploadTestFile() ([]string, bool) {
	filename := cfg.ImageFilenames[utils.RandIntFromRange(utils.Range{Begin: 0, End: len(cfg.ImageFilenames) - 1})]

	path, _ := utils.FindDir("web/static/images")
	file, err := os.Open(filepath.Join(path, filename))
	if err != nil {
		return nil, false
	}
	defer file.Close()

	data := &bytes.Buffer{}
	_, err = io.Copy(data, file)
	if err != nil {
		return nil, false
	}

	resp, appErr := cfg.client.UploadFile(data.Bytes(), cfg.channelid, filename)
	if appErr != nil {
		return nil, false
	}

	return []string{resp.FileInfos[0].Id}, true
}

func (cfg *AutoPostCreator) CreateRandomPost() (*model.Post, bool) {
	var fileIds []string
	if cfg.HasImage {
		var err1 bool
		fileIds, err1 = cfg.UploadTestFile()
		if !err1 {
			return nil, false
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
		Message:   postText,
		FileIds:   fileIds}
	rpost, err2 := cfg.client.CreatePost(post)
	if err2 != nil {
		return nil, false
	}
	return rpost, true
}
