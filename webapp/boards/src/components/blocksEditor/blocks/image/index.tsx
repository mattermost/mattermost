// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useRef, useState} from 'react'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'
import octoClient from 'src/octoClient'

import './image.scss'

type FileInfo = {
    file: string|File
    width?: number
    align?: 'left'|'center'|'right'
}

const Image: ContentType<FileInfo> = {
    name: 'image',
    displayName: 'Image',
    slashCommand: '/image',
    prefix: '',
    runSlashCommand: (): void => {},
    editable: false,
    Display: (props: BlockInputProps<FileInfo>) => {
        const [imageDataUrl, setImageDataUrl] = useState<string|null>(null)

        useEffect(() => {
            if (!imageDataUrl) {
                const loadImage = async () => {
                    if (props.value && props.value.file && typeof props.value.file === 'string') {
                        const fileURL = await octoClient.getFileAsDataUrl(props.currentBoardId || '', props.value.file)
                        setImageDataUrl(fileURL.url || '')
                    }
                }
                loadImage()
            }
        }, [props.value, props.value.file, props.currentBoardId])

        if (imageDataUrl) {
            return (
                <img
                    data-testid='image'
                    className='ImageView'
                    src={imageDataUrl}
                />
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
            <div>
                {props.value.file && (typeof props.value.file === 'string') && (
                    <img
                        className='ImageView'
                        src={props.value.file}
                        onClick={() => ref.current?.click()}
                    />
                )}
                <input
                    ref={ref}
                    className='Image'
                    data-testid='image-input'
                    type='file'
                    accept='image/*'
                    onChange={(e) => {
                        const file = (e.currentTarget?.files || [])[0]
                        props.onSave({file})
                    }}
                />
            </div>
        )
    },
}

Image.runSlashCommand = (changeType: (contentType: ContentType<FileInfo>) => void, changeValue: (value: FileInfo) => void): void => {
    changeType(Image)
    changeValue({file: ''})
}

export default Image
