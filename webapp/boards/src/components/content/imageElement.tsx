// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'
import {IntlShape} from 'react-intl'

import {ContentBlock} from 'src/blocks/contentBlock'
import {ImageBlock, createImageBlock} from 'src/blocks/imageBlock'
import octoClient from 'src/octoClient'
import {Utils} from 'src/utils'
import ImageIcon from 'src/widgets/icons/image'
import {sendFlashMessage} from 'src/components/flashMessages'

import {FileInfo} from 'src/blocks/block'

import {contentRegistry} from './contentRegistry'
import ArchivedFile from './archivedFile/archivedFile'

type Props = {
    block: ContentBlock
}

const ImageElement = (props: Props): JSX.Element|null => {
    const [imageDataUrl, setImageDataUrl] = useState<string|null>(null)
    const [fileInfo, setFileInfo] = useState<FileInfo>({})

    const {block} = props

    useEffect(() => {
        if (!imageDataUrl) {
            const loadImage = async () => {
                const fileURL = await octoClient.getFileAsDataUrl(block.boardId, props.block.fields.fileId)
                setImageDataUrl(fileURL.url || '')
                setFileInfo(fileURL)
            }
            loadImage()
        }
    }, [])

    if (fileInfo.archived) {
        return (
            <ArchivedFile fileInfo={fileInfo}/>
        )
    }

    if (!imageDataUrl) {
        return null
    }

    return (
        <img
            className='ImageElement'
            src={imageDataUrl}
            alt={block.title}
        />
    )
}

contentRegistry.registerContentType({
    type: 'image',
    getDisplayText: (intl: IntlShape) => intl.formatMessage({id: 'ContentBlock.image', defaultMessage: 'image'}),
    getIcon: () => <ImageIcon/>,
    createBlock: async (boardId: string, intl: IntlShape) => {
        return new Promise<ImageBlock>(
            (resolve) => {
                Utils.selectLocalFile(async (file) => {
                    const fileId = await octoClient.uploadFile(boardId, file)

                    if (fileId) {
                        const block = createImageBlock()
                        block.fields.fileId = fileId || ''
                        resolve(block)
                    } else {
                        sendFlashMessage({content: intl.formatMessage({id: 'createImageBlock.failed', defaultMessage: "This file couldn't be uploaded as the file size limit has been reached."}), severity: 'normal'})
                    }
                },
                '.jpg,.jpeg,.png,.gif')
            },
        )

        // return new ImageBlock()
    },
    createComponent: (block) => <ImageElement block={block}/>,
})

export default React.memo(ImageElement)
