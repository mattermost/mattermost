// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package shared

import (
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
)

type UserType string

const (
	User UserType = "user"
	Bot  UserType = "bot"
)

type PostExport struct {
	model.MessageExport          // the MessageExport that this PostExport is providing more information for
	UserType            UserType // the type of the person that sent the post: "user" or "bot"

	// Allows us to differentiate between:
	// - "EditedOriginalMsg": the newly created message (new Id), which holds the pre-edited message contents. The
	//    "EditedNewMsgId" field will point to the message (original Id) which has the post-edited message content.
	// - "EditedNewMsg": the post-edited message content. This is confusing, so be careful: in the db, this EditedNewMsg
	//    is actually the original messageId because we wanted an edited message to have the same messageId as the
	//    pre-edited message. But for the purposes of exporting and to keep the mental model clear for end-users, we are
	//    calling this the EditedNewMsg and EditedNewMsgId, because this will hold the NEW post-edited message contents,
	//    and that's what's important to the end-user viewing the export.
	//  - "UpdatedNoMsgChange": the message content hasn't changed, but the post was updated for some reason (reaction,
	//	  replied-to, a reply was edited, a reply was deleted (as of 10.2), perhaps other reasons)
	//  - "Deleted": the message was deleted.
	//  - "FileDeleted": this message is recording that a file was deleted.
	UpdatedType PostUpdatedType
	UpdateAt    int64 // if this is an updated post, this is the updated time (same as deleted time for deleted posts).

	// when a message is edited, the EditedOriginalMsg points to the message Id that now has the newly edited message.
	EditedNewMsgId    string
	Message           string                   // the text body of the post
	PreviewsPost      string                   // the post id of the post that is previewed by the permalink preview feature
	AttachmentCreates []*FileUploadStartExport // the post's attachments that were uploaded this export period
	AttachmentDeletes []PostExport             // the post's attachments that were deleted
	FileInfo          *model.FileInfo          // if this was a file PostExport, FileInfo will contain that info. Otherwise, nil.
}

type FileUploadStartExport struct {
	model.MessageExport        // the post that this upload was attached to
	UserEmail           string // the email of the person that sent the file
	UploadStartTime     int64  // utc timestamp (seconds), time at which the user started the upload. Example: 1366611728
	FileInfo            *model.FileInfo
}

type FileUploadStopExport struct {
	model.MessageExport        // the post that this upload was attached to
	UserEmail           string // the email of the person that sent the file
	UploadStopTime      int64  // utc timestamp (seconds), time at which the user finished the upload. Example: 1366611728
	Status              string // set to either "Completed" or "Failed" depending on the outcome of the upload operation
	FileInfo            *model.FileInfo
}

type ChannelExport struct {
	ChannelId    string
	ChannelType  model.ChannelType
	ChannelName  string
	DisplayName  string
	StartTime    int64 // utc timestamp (milliseconds), start of export period or create time of channel, whichever is greater.
	EndTime      int64 // utc timestamp (milliseconds), end of export period or delete time of channel, whichever is lesser.
	Posts        []PostExport
	Files        []*model.FileInfo
	DeletedFiles []PostExport
	UploadStarts []*FileUploadStartExport
	UploadStops  []*FileUploadStopExport
	JoinEvents   []JoinExport  // start with a list of all users who were present in the channel during the export period
	LeaveEvents  []LeaveExport // finish with a list of all users who were present in the channel during the export period

	// Used by csv, ignored by others
	TeamId          string
	TeamName        string
	TeamDisplayName string
}

type JoinExport struct {
	UserId    string
	Username  string
	UserEmail string   // the email of the person that joined the channel
	UserType  UserType // the type of the user that joined the channel
	JoinTime  int64    // utc timestamp (seconds), time at which the user joined. Example: 1366611728

	// when the user left (or batch endTime if they didn't leave). Only used by GlobalRelay
	LeaveTime int64
}

type LeaveExport struct {
	UserId    string
	Username  string
	UserEmail string   // the email of the person that left the channel
	UserType  UserType // the type of the user that left the channel
	LeaveTime int64    // utc timestamp (seconds), time at which the user left. Example: 1366611728

	// ClosedOut indicates this is a "leave" event created by closing out the channel at the end of an export period.
	// Actiance requires all users to be closed out at the end of an export period (each join has a matching leave).
	ClosedOut bool
}

type GenericExportData struct {
	Exports  []ChannelExport
	Metadata Metadata
	Results  RunExportResults
}

// GetGenericExportData assembles all the data in an exportType-agnostic way. Each exportType will process this data into
// the specific format they need to export.
func GetGenericExportData(p ExportParams) (GenericExportData, error) {
	// postAuthorsByChannel is a map so that we don't store duplicate authors
	postAuthorsByChannel := make(map[string]map[string]ChannelMember)
	metadata := Metadata{
		Channels:         p.ChannelMetadata,
		MessagesCount:    0,
		AttachmentsCount: 0,
		StartTime:        p.BatchStartTime,
		EndTime:          p.BatchEndTime,
	}

	var results RunExportResults
	channelsInThisBatch := make(map[string]bool)
	postsByChannel := make(map[string][]PostExport)
	filesByChannel := make(map[string][]*model.FileInfo)
	uploadStartsByChannel := make(map[string][]*FileUploadStartExport)
	uploadStopsByChannel := make(map[string][]*FileUploadStopExport)
	deletedFilesByChannel := make(map[string][]PostExport)

	processPostAttachments := func(post *model.MessageExport, postExport PostExport, originalPostThatWillBeDeletedLater bool) error {
		// originalPostThatWillBeDeletedLater means we are recording this message's original file starts and stops,
		// before it was deleted (we'll record that next call to this function)
		//
		// NOTE: there is an edge case here: the original post is not deleted but the attachment has been deleted.
		//       See the note in the postToAttachmentsEntries func.

		channelId := *post.ChannelId
		uploadedFiles, startUploads, stopUploads, deleteFileMessages, err :=
			postToAttachmentsEntries(post, p.Db, originalPostThatWillBeDeletedLater)
		if err != nil {
			return err
		}
		uploadStartsByChannel[channelId] = append(uploadStartsByChannel[channelId], startUploads...)
		uploadStopsByChannel[channelId] = append(uploadStopsByChannel[channelId], stopUploads...)
		deletedFilesByChannel[channelId] = append(deletedFilesByChannel[channelId], deleteFileMessages...)
		filesByChannel[channelId] = append(filesByChannel[channelId], uploadedFiles...)

		postExport.AttachmentCreates = startUploads
		postExport.AttachmentDeletes = deleteFileMessages
		postsByChannel[channelId] = append(postsByChannel[channelId], postExport)

		results.UploadedFiles += len(startUploads)
		results.DeletedFiles += len(deleteFileMessages)

		// only count uploaded files (not deleted files)
		if err := metadata.UpdateCounts(channelId, 1, len(startUploads)); err != nil {
			return err
		}

		return nil
	}

	for _, post := range p.Posts {
		channelId := *post.ChannelId
		channelsInThisBatch[channelId] = true

		// Was the post deleted (not an edited post), and originally posted during the current job window?
		// If so, we need to record it. It may actually belong in an earlier batch, but there's no way to know that
		// before now because of the way we export posts (by updateAt).
		if IsDeletedMsg(post) && !isEditedOriginalMsg(post) && *post.PostCreateAt >= p.JobStartTime {
			results.CreatedPosts++
			postExport := createdPostToExportEntry(post)
			if err := processPostAttachments(post, postExport, true); err != nil {
				return GenericExportData{}, err
			}
		}
		var postExport PostExport
		postExport, results = getPostExport(post, results)

		if err := processPostAttachments(post, postExport, false); err != nil {
			return GenericExportData{}, err
		}

		if _, ok := postAuthorsByChannel[channelId]; !ok {
			postAuthorsByChannel[channelId] = make(map[string]ChannelMember)
		}
		postAuthorsByChannel[channelId][*post.UserId] = ChannelMember{
			UserId:   *post.UserId,
			Email:    *post.UserEmail,
			Username: *post.Username,
			IsBot:    post.IsBot,
		}
	}

	// If the channel is not in channelsInThisBatch (i.e. if it didn't have a post), we need to check if it had
	// user activity between this batch's startTime-endTime. If so, add it to the channelsInThisBatch.
	for id := range p.ChannelMetadata {
		if !channelsInThisBatch[id] {
			if ChannelHasActivity(p.ChannelMemberHistories[id], p.BatchStartTime, p.BatchEndTime) {
				channelsInThisBatch[id] = true
			}
		}
	}

	// Build the channel exports for the channels that had post or user join/leave activity this batch.
	channelExports := make([]ChannelExport, 0, len(channelsInThisBatch))
	for id := range channelsInThisBatch {
		c := metadata.Channels[id]

		joinEvents, leaveEvents := getJoinsAndLeaves(p.BatchStartTime, p.BatchEndTime,
			p.ChannelMemberHistories[id], postAuthorsByChannel[id])

		// We don't have teamName and teamDisplayName from the channelMetaData, but we have it from MessageExport.
		// However, if we don't have posts for this channel (only joins and leaves), then we don't have it at all.
		var teamName, teamDisplayName string
		if posts, ok := postsByChannel[id]; ok {
			if len(posts) > 0 {
				teamName = model.SafeDereference(posts[0].TeamName)
				teamDisplayName = model.SafeDereference(posts[0].TeamDisplayName)
			}
		}

		channelExports = append(channelExports, ChannelExport{
			ChannelId:       c.ChannelId,
			ChannelType:     c.ChannelType,
			ChannelName:     c.ChannelName,
			DisplayName:     c.ChannelDisplayName,
			StartTime:       p.BatchStartTime,
			EndTime:         p.BatchEndTime,
			Posts:           postsByChannel[id],
			Files:           filesByChannel[id],
			DeletedFiles:    deletedFilesByChannel[id],
			UploadStarts:    uploadStartsByChannel[id],
			UploadStops:     uploadStopsByChannel[id],
			JoinEvents:      joinEvents,
			LeaveEvents:     leaveEvents,
			TeamId:          model.SafeDereference(c.TeamId),
			TeamName:        teamName,
			TeamDisplayName: teamDisplayName,
		})

		results.Joins += len(joinEvents)
		results.Leaves += len(leaveEvents)
	}

	return GenericExportData{channelExports, metadata, results}, nil
}

// postToAttachmentsEntries returns every fileInfo as uploadedFiles. It also adds each file into the lists:
//
//		startUploads, stopUploads, and deleteFileMessages (for ActianceExport).
//	 If onlyDeleted = true, only export the deleted entry (if it exists).
func postToAttachmentsEntries(post *model.MessageExport, db MessageExportStore, ignoreDeleted bool) (
	uploadedFiles []*model.FileInfo, startUploads []*FileUploadStartExport, stopUploads []*FileUploadStopExport, deleteFileMessages []PostExport, err error) {
	// if the post included any files, we need to add special elements to the export.
	//
	// NOTE: there is an edge case here: the original post is not deleted but the attachment has been deleted.
	//  1. If  the attachment is deleted sometime later in the future but the post has not been updated (updateAt == createAt)
	//     then we won't ever get here, there's nothing we can do.
	//  2. If the attachment is deleted within this export period, or the post is updated this export period and we
	//     now see that the attachment is deleted, then we have to output 2 files here:
	//      a) the original file attachment
	//      b) the deleted file attachment
	//     These have to be added the start/stop and deletedFileMessages

	if len(post.PostFileIds) == 0 {
		return
	}

	uploadedFiles, err = db.FileInfo().GetForPost(*post.PostId, true, true, false)
	if err != nil {
		return
	}

	for _, fileInfo := range uploadedFiles {
		if fileInfo.DeleteAt > 0 && !ignoreDeleted {
			deleteFileMessages = append(deleteFileMessages, deleteFileToExportEntry(post, fileInfo))

			// this was a deleted file, so do not record its start and stop. If the original message was sent in this
			// batch, the file transfer will have been exported earlier up when the original message was exported.
			//
			// However, because of the edge case above, we still need to record start and stop if the post is not deleted.
			if IsDeletedMsg(post) {
				continue
			} // not deleted, so need to add start and stop below.
		}

		// insert a record of the file upload into the export file
		// path to exported file is relative to the fileAttachmentFilestore root,
		// which could be different from the exportFilestore root
		startUploads = append(startUploads, &FileUploadStartExport{
			MessageExport:   *post,
			UserEmail:       *post.UserEmail,
			UploadStartTime: *post.PostCreateAt,
			FileInfo:        fileInfo,
		})

		stopUploads = append(stopUploads, &FileUploadStopExport{
			MessageExport:  *post,
			UserEmail:      *post.UserEmail,
			UploadStopTime: *post.PostCreateAt,
			Status:         "Completed",
			FileInfo:       fileInfo,
		})
	}
	return
}

func getPostExport(post *model.MessageExport, results RunExportResults) (PostExport, RunExportResults) {
	// We have three "kinds" of posts:
	// (using "1" and "2" for simplicity)
	// - created:                         Id = new,  CreateAt = 1,    UpdateAt = 1, DeleteAt = 0
	// - deleted:                         Id = orig, CreateAt = orig, UpdateAt = 2, DeleteAt = 2, props: deleteBy
	// - edited: old post gets "created": Id = new,  CreateAt = 1,    UpdateAt = 2, DeleteAt = 2, originalId: orig
	//           existing post modified:  Id = orig, CreateAt = 1,    UpdateAt = 2, DeleteAt = 0
	//
	// We also have other ways for a post to be updated:
	//  - a root post in a thread is replied to, when a reply is edited, or (as of 10.2) when a reply is deleted

	if isEditedOriginalMsg(post) {
		// Post has been edited. This is the original message.
		results.EditedOrigMsgPosts++
		return editedOriginalMsgToExportEntry(post), results
	} else if IsDeletedMsg(post) {
		// Post is deleted
		results.DeletedPosts++
		return deletedPostToExportEntry(post, "delete "+*post.PostMessage), results
	} else if *post.PostUpdateAt > *post.PostCreateAt {
		// Post has been updated. But what kind?
		if model.SafeDereference(post.PostEditAt) > 0 {
			// This is an edited post.
			results.EditedNewMsgPosts++
			return editedNewMsgToExportEntry(post), results
		}
		// This is just an updated post (e.g. reaction)
		results.UpdatedPosts++
		return updatedPostToExportEntry(post), results
	}
	// Post is newly created:
	// *post.PostCreateAt == *post.PostUpdateAt && (post.PostDeleteAt == nil || *post.PostDeleteAt == 0)
	// but also fallback to this in case there is missing data, which is better than not exporting anything.
	results.CreatedPosts++
	return createdPostToExportEntry(post), results
}

func getJoinsAndLeaves(startTime int64, endTime int64, channelMembersHistory []*model.ChannelMemberHistoryResult,
	postAuthors map[string]ChannelMember) ([]JoinExport, []LeaveExport) {
	var leaveEvents []LeaveExport

	joins, leaves := GetJoinsAndLeavesForChannel(startTime, endTime, channelMembersHistory, postAuthors)
	joinsById := make(map[string]JoinExport, len(joins))
	type StillMemberInfo struct {
		time     int64
		userType UserType
		userId   string
		username string
	}
	stillMember := map[string]StillMemberInfo{}
	for _, join := range joins {
		userType := User
		if join.IsBot {
			userType = Bot
		}
		joinsById[join.UserId] = JoinExport{
			UserId:    join.UserId,
			Username:  join.Username,
			UserEmail: join.Email,
			JoinTime:  join.Datetime,
			UserType:  userType,
			LeaveTime: endTime,
		}
		if value, ok := stillMember[join.Email]; !ok {
			stillMember[join.Email] = StillMemberInfo{time: join.Datetime, userType: userType, userId: join.UserId, username: join.Username}
		} else if join.Datetime > value.time {
			stillMember[join.Email] = StillMemberInfo{time: join.Datetime, userType: userType, userId: join.UserId, username: join.Username}
		}
	}
	for _, leave := range leaves {
		userType := User
		if leave.IsBot {
			userType = Bot
		}
		leaveEvents = append(leaveEvents, LeaveExport{
			UserId:    leave.UserId,
			Username:  leave.Username,
			UserEmail: leave.Email,
			LeaveTime: leave.Datetime,
			UserType:  userType,
		})
		if leave.Datetime > stillMember[leave.Email].time {
			delete(stillMember, leave.Email)
		}

		// record their leave in their initial join
		if join, ok := joinsById[leave.UserId]; ok {
			join.LeaveTime = leave.Datetime
			joinsById[leave.UserId] = join
		}
	}

	// Closing-out the channel for Actiance (each join must have a matching leave).
	for email := range stillMember {
		leaveEvents = append(leaveEvents, LeaveExport{
			UserId:    stillMember[email].userId,
			Username:  stillMember[email].username,
			LeaveTime: endTime,
			UserEmail: email,
			UserType:  stillMember[email].userType,
			ClosedOut: true,
		})
	}

	joinEvents := make([]JoinExport, 0, len(joinsById))
	for _, v := range joinsById {
		joinEvents = append(joinEvents, v)
	}

	sort.Slice(joinEvents, func(i, j int) bool {
		if joinEvents[i].JoinTime == joinEvents[j].JoinTime {
			return joinEvents[i].UserEmail < joinEvents[j].UserEmail
		}
		return joinEvents[i].JoinTime < joinEvents[j].JoinTime
	})

	sort.Slice(leaveEvents, func(i, j int) bool {
		if leaveEvents[i].LeaveTime == leaveEvents[j].LeaveTime {
			return leaveEvents[i].UserEmail < leaveEvents[j].UserEmail
		}
		return leaveEvents[i].LeaveTime < leaveEvents[j].LeaveTime
	})

	return joinEvents, leaveEvents
}

func isEditedOriginalMsg(post *model.MessageExport) bool {
	return model.SafeDereference(post.PostDeleteAt) > 0 && model.SafeDereference(post.PostOriginalId) != ""
}

func createdPostToExportEntry(post *model.MessageExport) PostExport {
	userType := User
	if post.IsBot {
		userType = Bot
	}
	return PostExport{
		MessageExport: *post,
		Message:       *post.PostMessage,
		UserType:      userType,
		PreviewsPost:  post.PreviewID(),
	}
}

func deletedPostToExportEntry(post *model.MessageExport, newMsg string) PostExport {
	userType := User
	if post.IsBot {
		userType = Bot
	}
	return PostExport{
		MessageExport: *post,
		UpdateAt:      *post.PostDeleteAt,
		UpdatedType:   Deleted,
		Message:       newMsg,
		UserType:      userType,
		PreviewsPost:  post.PreviewID(),
	}
}

func editedOriginalMsgToExportEntry(post *model.MessageExport) PostExport {
	userType := User
	if post.IsBot {
		userType = Bot
	}
	return PostExport{
		MessageExport:  *post,
		UpdateAt:       *post.PostUpdateAt,
		UpdatedType:    EditedOriginalMsg,
		Message:        *post.PostMessage,
		UserType:       userType,
		PreviewsPost:   post.PreviewID(),
		EditedNewMsgId: *post.PostOriginalId,
	}
}

func editedNewMsgToExportEntry(post *model.MessageExport) PostExport {
	userType := User
	if post.IsBot {
		userType = Bot
	}
	return PostExport{
		MessageExport: *post,
		UpdateAt:      *post.PostUpdateAt,
		UpdatedType:   EditedNewMsg,
		Message:       *post.PostMessage,
		UserType:      userType,
		PreviewsPost:  post.PreviewID(),
	}
}

func updatedPostToExportEntry(post *model.MessageExport) PostExport {
	userType := User
	if post.IsBot {
		userType = Bot
	}
	return PostExport{
		MessageExport: *post,
		UpdateAt:      *post.PostUpdateAt,
		UpdatedType:   UpdatedNoMsgChange,
		Message:       *post.PostMessage,
		UserType:      userType,
		PreviewsPost:  post.PreviewID(),
	}
}

func deleteFileToExportEntry(post *model.MessageExport, fileInfo *model.FileInfo) PostExport {
	userType := User
	if post.IsBot {
		userType = Bot
	}
	return PostExport{
		MessageExport: *post,
		UpdateAt:      fileInfo.DeleteAt,
		UpdatedType:   FileDeleted,
		Message:       "delete " + fileInfo.Path,
		UserType:      userType,
		PreviewsPost:  post.PreviewID(),
		FileInfo:      fileInfo,
	}
}

func UploadStartToExportEntry(u *FileUploadStartExport) PostExport {
	userType := User
	if u.IsBot {
		userType = Bot
	}
	return PostExport{
		MessageExport: u.MessageExport,
		UpdateAt:      u.FileInfo.UpdateAt,
		UserType:      userType,
		FileInfo:      u.FileInfo,
	}
}
