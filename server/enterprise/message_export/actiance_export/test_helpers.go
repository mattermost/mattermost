// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package actiance_export

import (
	"encoding/xml"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
)

type ChannelExportWithSpecifics struct {
	XMLName     xml.Name                 `xml:"Conversation"`
	Perspective string                   `xml:"Perspective,attr"`
	ChannelId   string                   `xml:"-"`
	RoomId      string                   `xml:"RoomID"`
	StartTime   int64                    `xml:"StartTimeUTC"`
	JoinEvents  []*JoinExport            `xml:"ParticipantEntered"`
	Messages    []*PostExport            `xml:"Message"`
	FileStarts  []*FileUploadStartExport `xml:"FileTransferStarted"`
	FileStops   []*FileUploadStopExport  `xml:"FileTransferEnded"`
	LeaveEvents []*LeaveExport           `xml:"ParticipantLeft"`
	EndTime     int64                    `xml:"EndTimeUTC"`
}

func GetChannelExports(t *testing.T, r io.Reader) []*ChannelExportWithSpecifics {
	decoder := xml.NewDecoder(r)
	var exportedChannels []*ChannelExportWithSpecifics
	for {
		token, err := decoder.Token()
		if token == nil || err != nil {
			break
		}
		switch se := token.(type) {
		case xml.StartElement:
			if se.Name.Local == "Conversation" {
				var a *ChannelExportWithSpecifics
				err = decoder.DecodeElement(&a, &se)
				require.NoError(t, err)
				exportedChannels = append(exportedChannels, a)
			}
		default:
		}
	}

	return exportedChannels
}
