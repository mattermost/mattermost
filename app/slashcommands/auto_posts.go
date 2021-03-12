// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"bytes"
	"io"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

type AutoPostCreator struct {
	a              *app.App
	channelid      string
	userid         string
	Fuzzy          bool
	TextLength     utils.Range
	HasImage       bool
	ImageFilenames []string
	Users          []string
	Mentions       utils.Range
	Tags           utils.Range
}

// Automatic poster used for testing
func NewAutoPostCreator(a *app.App, channelid, userid string) *AutoPostCreator {
	return &AutoPostCreator{
		a:              a,
		channelid:      channelid,
		userid:         userid,
		Fuzzy:          false,
		TextLength:     utils.Range{Begin: 100, End: 200},
		HasImage:       false,
		ImageFilenames: TestImageFileNames,
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

	fileResp, err2 := cfg.a.UploadFile(data.Bytes(), cfg.channelid, filename)
	if err2 != nil {
		return nil, err2
	}

	return []string{fileResp.Id}, nil
}

func (cfg *AutoPostCreator) CreateRandomPost() (*model.Post, error) {
	return cfg.CreateRandomPostNested("", "")
}

func (cfg *AutoPostCreator) CreateRandomPostNested(parentId, rootId string) (*model.Post, error) {
	var fileIDs []string
	if cfg.HasImage {
		var err error
		fileIDs, err = cfg.UploadTestFile()
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
		UserId:    cfg.userid,
		ParentId:  parentId,
		RootId:    rootId,
		Message:   postText,
		FileIds:   fileIDs,
	}
	rpost, err := cfg.a.CreatePostMissingChannel(post, true)
	if err != nil {
		return nil, err
	}
	return rpost, nil
}
