// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type SectionNoticeButtonProp = {
    onClick: () => void;
    text: string;
    trailingIcon?: string;
    leadingIcon?: string;
    loading?: boolean;
    disabled?: boolean;
}
