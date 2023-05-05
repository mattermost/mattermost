// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useRef, useState} from 'react'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'
import octoClient from 'src/octoClient'

import './video.scss'

type FileInfo = {
    file: string|File
    filename: string
    width?: number
    align?: 'left'|'center'|'right'
}

const Video: ContentType<FileInfo> = {
    name: 'video',
    displayName: 'Video',
    slashCommand: '/video',
    prefix: '',
    runSlashCommand: (): void => {},
    editable: false,
    Display: (props: BlockInputProps<FileInfo>) => {
        const [videoDataUrl, setVideoDataUrl] = useState<string|null>(null)

        useEffect(() => {
            if (!videoDataUrl) {
                const loadVideo = async () => {
                    if (props.value && props.value.file && typeof props.value.file === 'string') {
                        const fileURL = await octoClient.getFileAsDataUrl(props.currentBoardId || '', props.value.file)
                        setVideoDataUrl(fileURL.url || '')
                    }
                }
                loadVideo()
            }
        }, [props.value, props.value.file, props.currentBoardId])

        if (videoDataUrl) {
            return (
                <video
                    width='320'
                    height='240'
                    controls={true}
                    className='VideoView'
                    data-testid='video'
                >
                    <source src={videoDataUrl}/>
                </video>
            )
        }

        return null
    },
    Input: (props: BlockInputProps<FileInfo>) => {
        const ref = useRef<HTMLInputElement|null>(null)
        useEffect(() => {
            ref.current?.click()
        }, [])

        return (
            <input
                ref={ref}
                className='Video'
                data-testid='video-input'
                type='file'
                accept='video/*'
                onChange={(e) => {
                    const file = (e.currentTarget?.files || [])[0]
                    props.onSave({file, filename: file.name})
                }}
            />
        )
    },
}

Video.runSlashCommand = (changeType: (contentType: ContentType<FileInfo>) => void, changeValue: (value: FileInfo) => void): void => {
    changeType(Video)
    changeValue({} as any)
}

export default Video
