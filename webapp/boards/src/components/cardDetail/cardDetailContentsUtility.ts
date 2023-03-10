// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Position} from './cardDetailContents'

type DragAndDropRearrangeData = {
    contentOrder: Array<string|string[]>
    srcBlockId: string
    srcBlockX: number
    srcBlockY: number
    dstBlockX: number
    dstBlockY: number
    dstBlockId: string
    moveTo: Position
}

export const dragAndDropRearrange =
    (data: DragAndDropRearrangeData): Array<string|string[]> => {
        const {contentOrder, srcBlockX, srcBlockY, dstBlockX, dstBlockY, moveTo, srcBlockId, dstBlockId} = data
        const newContentOrder: Array<string|string[]> = JSON.parse(JSON.stringify(contentOrder))

        const copySrcBlockX = srcBlockX
        const copySrcBlockY = srcBlockY

        let copyDstBlockX = dstBlockX
        let copyDstBlockY = dstBlockY

        // Delete the block we are moving first then move it to the correct place

        // Delete Src Block
        if (copySrcBlockY > -1) {
            (newContentOrder[copySrcBlockX] as string[]).splice(copySrcBlockY, 1)

            if (newContentOrder[copySrcBlockX].length === 1 && copySrcBlockX !== copyDstBlockX) {
                newContentOrder.splice(copySrcBlockX, 1, newContentOrder[copySrcBlockX][0])
            }
        } else {
            newContentOrder.splice(copySrcBlockX, 1)

            if (copyDstBlockX > copySrcBlockX) {
                copyDstBlockX -= 1
            }
        }

        if (moveTo === 'right') {
            if (copyDstBlockY > -1) {
                if (copyDstBlockX === copySrcBlockX && copyDstBlockY > copySrcBlockY && copySrcBlockY > -1) {
                    copyDstBlockY -= 1
                }

                (newContentOrder[copyDstBlockX] as string[]).splice(copyDstBlockY + 1, 0, srcBlockId)
            } else {
                newContentOrder.splice(copyDstBlockX, 1, [dstBlockId, srcBlockId])
            }
        } else if (moveTo === 'left') {
            if (copyDstBlockY > -1) {
                if (copyDstBlockX === copySrcBlockX && copyDstBlockY > copySrcBlockY && copySrcBlockY > -1) {
                    copyDstBlockY -= 1
                }

                (newContentOrder[copyDstBlockX] as string[]).splice(copyDstBlockY, 0, srcBlockId)
            } else {
                newContentOrder.splice(copyDstBlockX, 1, [srcBlockId, dstBlockId])
            }
        } else if (moveTo === 'aboveRow') {
            newContentOrder.splice(copyDstBlockX, 0, srcBlockId)
        } else if (moveTo === 'belowRow') {
            newContentOrder.splice(copyDstBlockX + 1, 0, srcBlockId)
        }

        return newContentOrder
    }
