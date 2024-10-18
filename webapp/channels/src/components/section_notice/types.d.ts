// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type SectionNoticeButton = {
    onClick: () => void;
    text: string;
    trailingIcon?: string;
    leadingIcon?: string;
    loading?: boolean;
}
