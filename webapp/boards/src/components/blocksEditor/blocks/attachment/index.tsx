// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useRef, useState} from 'react'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'
import octoClient from 'src/octoClient'

import './attachment.scss'

type FileInfo = {
    file: string|File
    filename: string
}

const Attachment: ContentType<FileInfo> = {
    name: 'attachment',
    displayName: 'Attachment',
    slashCommand: '/attachment',
    prefix: '',
    runSlashCommand: (): void => {},
    editable: false,
    Display: (props: BlockInputProps<FileInfo>) => {
        const [fileDataUrl, setFileDataUrl] = useState<string|null>(null)

        useEffect(() => {
            if (!fileDataUrl) {
                const loadFile = async () => {
                    if (props.value && props.value.file && typeof props.value.file === 'string') {
                        const fileURL = await octoClient.getFileAsDataUrl(props.currentBoardId || '', props.value.file)
                        setFileDataUrl(fileURL.url || '')
                    }
                }
                loadFile()
            }
        }, [props.value, props.value.file, props.currentBoardId])

        return (
            <div
                className='AttachmentView'
                data-testid='attachment'
            >
                <a
                    href={fileDataUrl || '#'}
                    onClick={(e) => e.stopPropagation()}
                    download={props.value.filename}
                >
                    {'📎'} {props.value.filename}
                </a>
            </div>
        )
    },
    Input: (props: BlockInputProps<FileInfo>) => {
        const ref = useRef<HTMLInputElement|null>(null)
        useEffect(() => {
            ref.current?.click()
        }, [])

        return (
            <input
                ref={ref}
                className='Attachment'
                data-testid='attachment-input'
                type='file'
                onChange={(e) => {
                    const files = e.currentTarget?.files
                    if (files) {
                        for (let i = 0; i < files.length; i++) {
                            const file = files.item(i)
                            if (file) {
                                props.onSave({file, filename: file.name})
                            }
                        }
                    }
                }}
            />
        )
    },
}

Attachment.runSlashCommand = (changeType: (contentType: ContentType<FileInfo>) => void, changeValue: (value: FileInfo) => void): void => {
    changeType(Attachment)
    changeValue({} as any)
}

export default Attachment
