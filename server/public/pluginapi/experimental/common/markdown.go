// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package common

import (
	"encoding/json"
	"fmt"
)

func JSON(ref interface{}) string {
	bb, _ := json.MarshalIndent(ref, "", "  ")
	return string(bb)
}

func CodeBlock(in string) string {
	return fmt.Sprintf("\n```\n%s\n```\n", in)
}

func JSONBlock(ref interface{}) string {
	return fmt.Sprintf("\n```json\n%s\n```\n", JSON(ref))
}
