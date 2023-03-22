// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
export type BlockInputProps<ValueType = string> = {
    onChange: (value: ValueType) => void
    value: ValueType
    onCancel: () => void
    onSave: (val: ValueType) => void
    currentBoardId?: string
}

export type ContentType<ValueType = string> = {
    name: string
    displayName: string
    slashCommand: string
    prefix: string
    editable: boolean
    Input: React.FunctionComponent<BlockInputProps<ValueType>>
    Display: React.FunctionComponent<BlockInputProps<ValueType>>
    runSlashCommand: (changeType: (contentType: ContentType<ValueType>) => void, changeValue: (value: ValueType) => void, ...args: string[]) => void
    nextType?: string
}

export type BlockData<ValueType = string> = {
    id?: string
    value: ValueType
    contentType: string
}
