// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifysubscriptions

import (
	"bytes"
	"fmt"
	"io"
	"strings"
	"sync"
	"text/template"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"

	mm_model "github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

const (
	// card change notifications.
	defAddCardNotify    = "{{.Authors | printAuthors \"unknown_user\" }} has added the card {{. | makeLink}}\n"
	defModifyCardNotify = "###### {{.Authors | printAuthors \"unknown_user\" }} has modified the card {{. | makeLink}} on the board {{. | makeBoardLink}}\n"
	defDeleteCardNotify = "{{.Authors | printAuthors \"unknown_user\" }} has deleted the card {{. | makeLink}}\n"
)

var (
	// templateCache is a map of text templateCache keyed by languange code.
	templateCache    = make(map[string]*template.Template)
	templateCacheMux sync.Mutex
)

// DiffConvOpts provides options when converting diffs to slack attachments.
type DiffConvOpts struct {
	Language      string
	MakeCardLink  func(block *model.Block, board *model.Board, card *model.Block) string
	MakeBoardLink func(board *model.Board) string
	Logger        mlog.LoggerIFace
}

// getTemplate returns a new or cached named template based on the language specified.
func getTemplate(name string, opts DiffConvOpts, def string) (*template.Template, error) {
	templateCacheMux.Lock()
	defer templateCacheMux.Unlock()

	key := name + "&" + opts.Language
	t, ok := templateCache[key]
	if !ok {
		t = template.New(key)

		if opts.MakeCardLink == nil {
			opts.MakeCardLink = func(block *model.Block, _ *model.Board, _ *model.Block) string {
				return fmt.Sprintf("`%s`", block.Title)
			}
		}

		if opts.MakeBoardLink == nil {
			opts.MakeBoardLink = func(board *model.Board) string {
				return fmt.Sprintf("`%s`", board.Title)
			}
		}
		myFuncs := template.FuncMap{
			"getBoardDescription": getBoardDescription,
			"makeLink": func(diff *Diff) string {
				return opts.MakeCardLink(diff.NewBlock, diff.Board, diff.Card)
			},
			"makeBoardLink": func(diff *Diff) string {
				return opts.MakeBoardLink(diff.Board)
			},
			"stripNewlines": func(s string) string {
				return strings.TrimSpace(strings.ReplaceAll(s, "\n", "¶ "))
			},
			"printAuthors": func(empty string, authors StringMap) string {
				return makeAuthorsList(authors, empty)
			},
		}
		t.Funcs(myFuncs)

		s := def // TODO: lookup i18n string when supported on server
		t2, err := t.Parse(s)
		if err != nil {
			return nil, fmt.Errorf("cannot parse markdown template '%s' for notifications: %w", key, err)
		}
		templateCache[key] = t2
	}
	return t, nil
}

func makeAuthorsList(authors StringMap, empty string) string {
	if len(authors) == 0 {
		return empty
	}
	prefix := ""
	sb := &strings.Builder{}
	for _, name := range authors.Values() {
		sb.WriteString(prefix)
		sb.WriteString("@")
		sb.WriteString(strings.TrimSpace(name))
		prefix = ", "
	}
	return sb.String()
}

// execTemplate executes the named template corresponding to the template name and language specified.
func execTemplate(w io.Writer, name string, opts DiffConvOpts, def string, data interface{}) error {
	t, err := getTemplate(name, opts, def)
	if err != nil {
		return err
	}
	return t.Execute(w, data)
}

// Diffs2SlackAttachments converts a slice of `Diff` to slack attachments to be used in a post.
func Diffs2SlackAttachments(diffs []*Diff, opts DiffConvOpts) ([]*mm_model.SlackAttachment, error) {
	var attachments []*mm_model.SlackAttachment
	merr := merror.New()

	for _, d := range diffs {
		// only handle cards for now.
		if d.BlockType == model.TypeCard {
			a, err := cardDiff2SlackAttachment(d, opts)
			if err != nil {
				merr.Append(err)
				continue
			}
			if a == nil {
				continue
			}
			attachments = append(attachments, a)
		}
	}
	return attachments, merr.ErrorOrNil()
}

func cardDiff2SlackAttachment(cardDiff *Diff, opts DiffConvOpts) (*mm_model.SlackAttachment, error) {
	// sanity check
	if cardDiff.NewBlock == nil && cardDiff.OldBlock == nil {
		return nil, nil
	}

	attachment := &mm_model.SlackAttachment{}
	buf := &bytes.Buffer{}

	// card added
	if cardDiff.NewBlock != nil && cardDiff.OldBlock == nil {
		if err := execTemplate(buf, "AddCardNotify", opts, defAddCardNotify, cardDiff); err != nil {
			return nil, err
		}
		attachment.Pretext = buf.String()
		attachment.Fallback = attachment.Pretext
		return attachment, nil
	}

	// card deleted
	if (cardDiff.NewBlock == nil || cardDiff.NewBlock.DeleteAt != 0) && cardDiff.OldBlock != nil {
		buf.Reset()
		if err := execTemplate(buf, "DeleteCardNotify", opts, defDeleteCardNotify, cardDiff); err != nil {
			return nil, err
		}
		attachment.Pretext = buf.String()
		attachment.Fallback = attachment.Pretext
		return attachment, nil
	}

	// at this point new and old block are non-nil

	opts.Logger.Debug("cardDiff2SlackAttachment",
		mlog.String("board_id", cardDiff.Board.ID),
		mlog.String("card_id", cardDiff.Card.ID),
		mlog.String("new_block_id", cardDiff.NewBlock.ID),
		mlog.String("old_block_id", cardDiff.OldBlock.ID),
		mlog.Int("childDiffs", len(cardDiff.Diffs)),
	)

	buf.Reset()
	if err := execTemplate(buf, "ModifyCardNotify", opts, defModifyCardNotify, cardDiff); err != nil {
		return nil, fmt.Errorf("cannot write notification for card %s: %w", cardDiff.NewBlock.ID, err)
	}
	attachment.Pretext = buf.String()
	attachment.Fallback = attachment.Pretext

	// title changes
	attachment.Fields = appendTitleChanges(attachment.Fields, cardDiff)

	// property changes
	attachment.Fields = appendPropertyChanges(attachment.Fields, cardDiff)

	// comment add/delete
	attachment.Fields = appendCommentChanges(attachment.Fields, cardDiff)

	// File Attachment add/delete
	attachment.Fields = appendAttachmentChanges(attachment.Fields, cardDiff)

	// content/description changes
	attachment.Fields = appendContentChanges(attachment.Fields, cardDiff, opts.Logger)

	if len(attachment.Fields) == 0 {
		return nil, nil
	}
	return attachment, nil
}

func appendTitleChanges(fields []*mm_model.SlackAttachmentField, cardDiff *Diff) []*mm_model.SlackAttachmentField {
	if cardDiff.NewBlock.Title != cardDiff.OldBlock.Title {
		fields = append(fields, &mm_model.SlackAttachmentField{
			Short: false,
			Title: "Title",
			Value: fmt.Sprintf("%s  ~~`%s`~~", stripNewlines(cardDiff.NewBlock.Title), stripNewlines(cardDiff.OldBlock.Title)),
		})
	}
	return fields
}

func appendPropertyChanges(fields []*mm_model.SlackAttachmentField, cardDiff *Diff) []*mm_model.SlackAttachmentField {
	if len(cardDiff.PropDiffs) == 0 {
		return fields
	}

	for _, propDiff := range cardDiff.PropDiffs {
		if propDiff.NewValue == propDiff.OldValue {
			continue
		}

		var val string
		if propDiff.OldValue != "" {
			val = fmt.Sprintf("%s  ~~`%s`~~", stripNewlines(propDiff.NewValue), stripNewlines(propDiff.OldValue))
		} else {
			val = propDiff.NewValue
		}

		fields = append(fields, &mm_model.SlackAttachmentField{
			Short: false,
			Title: propDiff.Name,
			Value: val,
		})
	}
	return fields
}

func appendCommentChanges(fields []*mm_model.SlackAttachmentField, cardDiff *Diff) []*mm_model.SlackAttachmentField {
	for _, child := range cardDiff.Diffs {
		if child.BlockType == model.TypeComment {
			var format string
			var msg string
			if child.NewBlock != nil && child.OldBlock == nil {
				// added comment
				format = "%s"
				msg = child.NewBlock.Title
			}

			if (child.NewBlock == nil || child.NewBlock.DeleteAt != 0) && child.OldBlock != nil {
				// deleted comment
				format = "~~`%s`~~"
				msg = stripNewlines(child.OldBlock.Title)
			}

			if format != "" {
				fields = append(fields, &mm_model.SlackAttachmentField{
					Short: false,
					Title: "Comment by " + makeAuthorsList(child.Authors, "unknown_user"), // todo:  localize this when server has i18n
					Value: fmt.Sprintf(format, msg),
				})
			}
		}
	}
	return fields
}

func appendAttachmentChanges(fields []*mm_model.SlackAttachmentField, cardDiff *Diff) []*mm_model.SlackAttachmentField {
	for _, child := range cardDiff.Diffs {
		if child.BlockType == model.TypeAttachment {
			var format string
			var msg string
			if child.NewBlock != nil && child.OldBlock == nil {
				format = "Added an attachment: **`%s`**"
				msg = child.NewBlock.Title
			} else {
				format = "Removed ~~`%s`~~ attachment"
				msg = stripNewlines(child.OldBlock.Title)
			}

			if format != "" {
				fields = append(fields, &mm_model.SlackAttachmentField{
					Short: false,
					Title: "Changed by " + makeAuthorsList(child.Authors, "unknown_user"), // TODO:  localize this when server has i18n
					Value: fmt.Sprintf(format, msg),
				})
			}
		}
	}
	return fields
}

func appendContentChanges(fields []*mm_model.SlackAttachmentField, cardDiff *Diff, logger mlog.LoggerIFace) []*mm_model.SlackAttachmentField {
	for _, child := range cardDiff.Diffs {
		var opAdd, opDelete bool
		var opString string

		switch {
		case child.OldBlock == nil && child.NewBlock != nil:
			opAdd = true
			opString = "added" // TODO: localize when i18n added to server
		case child.NewBlock == nil || child.NewBlock.DeleteAt != 0:
			opDelete = true
			opString = "deleted"
		default:
			opString = "modified"
		}

		var newTitle, oldTitle string
		if child.OldBlock != nil {
			oldTitle = child.OldBlock.Title
		}
		if child.NewBlock != nil {
			newTitle = child.NewBlock.Title
		}

		switch child.BlockType {
		case model.TypeDivider, model.TypeComment:
			// do nothing
			continue
		case model.TypeImage:
			if newTitle == "" {
				newTitle = "An image was " + opString + "." // TODO: localize when i18n added to server
			}
			oldTitle = ""
		case model.TypeAttachment:
			if newTitle == "" {
				newTitle = "A file attachment was " + opString + "." // TODO: localize when i18n added to server
			}
			oldTitle = ""
		default:
			if !opAdd {
				if opDelete {
					newTitle = ""
				}
				// only strip newlines when modifying or deleting
				oldTitle = stripNewlines(oldTitle)
				newTitle = stripNewlines(newTitle)
			}
			if newTitle == oldTitle {
				continue
			}
		}

		logger.Trace("appendContentChanges",
			mlog.String("type", string(child.BlockType)),
			mlog.String("opString", opString),
			mlog.String("oldTitle", oldTitle),
			mlog.String("newTitle", newTitle),
		)

		markdown := generateMarkdownDiff(oldTitle, newTitle, logger)
		if markdown == "" {
			continue
		}

		fields = append(fields, &mm_model.SlackAttachmentField{
			Short: false,
			Title: "Description",
			Value: markdown,
		})
	}
	return fields
}
