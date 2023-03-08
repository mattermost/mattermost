// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"bytes"
	"io"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/app"
	"github.com/mattermost/mattermost-server/v6/server/channels/app/request"
	"github.com/mattermost/mattermost-server/v6/server/channels/utils"
	"github.com/mattermost/mattermost-server/v6/server/channels/utils/fileutils"
)

type AutoPostCreator struct {
	a               *app.App
	channelid       string
	userid          string
	Fuzzy           bool
	TextLength      utils.Range
	HasImage        bool
	ImageFilenames  []string
	Users           []string
	UsersToPostFrom []string
	Mentions        utils.Range
	Tags            utils.Range
	CreateTime      int64
	postsCreated    int
}

// Automatic poster used for testing
func NewAutoPostCreator(a *app.App, channelid, userid string) *AutoPostCreator {
	return &AutoPostCreator{
		a:               a,
		channelid:       channelid,
		userid:          userid,
		Fuzzy:           false,
		TextLength:      utils.Range{Begin: 100, End: 200},
		HasImage:        false,
		ImageFilenames:  TestImageFileNames,
		Users:           []string{},
		UsersToPostFrom: []string{},
		Mentions:        utils.Range{Begin: 0, End: 5},
		Tags:            utils.Range{Begin: 0, End: 7},
		CreateTime:      0,
		postsCreated:    0,
	}
}

func (cfg *AutoPostCreator) UploadTestFile(c request.CTX) ([]string, error) {
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

	fileResp, err2 := cfg.a.UploadFile(c, data.Bytes(), cfg.channelid, filename)
	if err2 != nil {
		return nil, err2
	}

	return []string{fileResp.Id}, nil
}

func (cfg *AutoPostCreator) CreateRandomPost(c request.CTX) (*model.Post, error) {
	return cfg.CreateRandomPostNested(c, "")
}

func (cfg *AutoPostCreator) CreateRandomPostNested(c request.CTX, rootId string) (*model.Post, error) {
	var fileIDs []string
	if cfg.HasImage {
		var err error
		fileIDs, err = cfg.UploadTestFile(c)
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
		RootId:    rootId,
		Message:   postText,
		FileIds:   fileIDs,
	}
	if cfg.CreateTime != 0 {
		// Creating posts with the exact same timestamp results in some posts being skipped
		// when they are retrieved by the API based on timestamp.
		post.CreateAt = cfg.CreateTime + int64(cfg.postsCreated)
	}
	if len(cfg.UsersToPostFrom) != 0 {
		i := utils.RandIntFromRange(utils.Range{Begin: 0, End: len(cfg.UsersToPostFrom)})
		if i < len(cfg.UsersToPostFrom) {
			post.UserId = cfg.UsersToPostFrom[i]
		}
	}
	rpost, err := cfg.a.CreatePostMissingChannel(c, post, true, true)
	if err != nil {
		return nil, err
	}

	cfg.postsCreated += 1

	return rpost, nil
}
