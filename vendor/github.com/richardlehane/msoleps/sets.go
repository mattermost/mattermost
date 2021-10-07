// Copyright 2014 Richard Lehane. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package msoleps

import "github.com/richardlehane/msoleps/types"

func addDefaults(m map[uint32]string) map[uint32]string {
	m[0x00000000] = "Dictionary"
	m[0x00000001] = "CodePage"
	m[0x80000000] = "Locale"
	m[0x80000003] = "Behaviour"
	return m

}

var propertySets map[types.Guid]map[uint32]string = map[types.Guid]map[uint32]string{
	types.MustGuidFromString("{D5CDD502-2E9C-101B-9397-08002B2CF9AE}"): map[uint32]string{
		0x00000002: "Category",
		0x00000003: "Presentation Format",
		0x00000004: "Byte count",
		0x00000005: "Line count",
		0x00000006: "Paragraph count",
		0x00000007: "Slide count",
		0x00000008: "Note count",
		0x00000009: "Hidden slides content",
		0x0000000A: "Multimedia clips count",
		0x0000000B: "Scale",
		0x0000000C: "Heading pair",
		0x0000000D: "Document parts",
		0x0000000E: "Manager",
		0x0000000F: "Company",
		0x00000010: "Dirty links",
		0x00000011: "Character count",
		0x00000013: "Shared document",
		0x00000014: "Link base",
		0x00000015: "Hyperlinks",
		0x00000016: "Hyperlinks changed",
		0x00000017: "Version",
		0x00000018: "Digital Signature",
		0x0000001A: "Content type",
		0x0000001B: "Content status",
		0x0000001C: "Language",
		0x0000001D: "Document Version",
	},
	types.MustGuidFromString("{F29F85E0-4FF9-1068-AB91-08002B27B3D9}"): map[uint32]string{
		0x00000002: "Title",
		0x00000003: "Subject",
		0x00000004: "Author",
		0x00000005: "Keywords",
		0x00000006: "Comments",
		0x00000007: "Template",
		0x00000008: "LastAuthor",
		0x00000009: "RevNumber",
		0x0000000A: "EditTime",
		0x0000000B: "LastPrinted",
		0x0000000C: "CreateTime",
		0x0000000D: "LastSaveTime",
		0x0000000E: "PageCount",
		0x0000000F: "WordCount",
		0x00000010: "CharCount",
		0x00000011: "Thumbnail",
		0x00000012: "AppName",
		0x00000013: "DocSecurity",
	},
}
