// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IAppWindow} from './types'
import {Block} from './blocks/block'
import {Board} from './blocks/board'
import mutator from './mutator'
import {Utils} from './utils'

declare let window: IAppWindow

class Archiver {
    static async exportBoardArchive(board: Board): Promise<void> {
        this.exportArchive(mutator.exportBoardArchive(board.id))
    }

    static async exportFullArchive(teamID: string): Promise<void> {
        this.exportArchive(mutator.exportFullArchive(teamID))
    }

    private static exportArchive(prom: Promise<Response>): void {
        // TODO:  don't download whole archive before presenting SaveAs dialog.
        prom.then((response) => {
            response.blob().
                then((blob) => {
                    const link = document.createElement('a')
                    link.style.display = 'none'

                    const date = new Date()
                    const filename = `archive-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}.boardarchive`

                    const file = new Blob([blob], {type: 'application/octet-stream'})
                    link.href = URL.createObjectURL(file)
                    link.download = filename
                    document.body.appendChild(link)		// FireFox support

                    link.click()

                    // TODO: Review if this is needed in the future, this is to fix the problem with linux webview links
                    if (window.openInNewBrowser) {
                        window.openInNewBrowser(link.href)
                    }

                    // TODO: Remove or reuse link and revolkObjectURL to avoid memory leak
                })
        })
    }

    private static async importArchiveFromFile(file: File): Promise<void> {
        const response = await mutator.importFullArchive(file)
        if (response.status !== 200) {
            Utils.log('ERROR importing archive: ' + response.text())
        }
    }

    static isValidBlock(block: Block): boolean {
        if (!block.id || !block.boardId) {
            return false
        }

        return true
    }

    static importFullArchive(onComplete?: () => void): void {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.boardarchive'
        input.onchange = async () => {
            const file = input.files && input.files[0]
            if (file) {
                await Archiver.importArchiveFromFile(file)
            }

            onComplete?.()
        }

        input.style.display = 'none'
        document.body.appendChild(input)
        input.click()

        // TODO: Remove or reuse input
    }
}

export {Archiver}
