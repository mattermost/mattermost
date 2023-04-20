// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Disable console log
console.log = jest.fn()

import {Block} from './blocks/block'
import {createCard} from './blocks/card'
import octoClient from './octoClient'
import 'isomorphic-fetch'
import {FetchMock} from './test/fetchMock'

global.fetch = FetchMock.fn

beforeEach(() => {
    FetchMock.fn.mockReset()
})

test('OctoClient: get blocks', async () => {
    const blocks = createBlocks()

    FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify(blocks)))
    let boards = await octoClient.getBlocksWithType('card')
    expect(boards.length).toBe(blocks.length)

    FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify(blocks)))
    let response = await octoClient.exportBoardArchive('board')
    expect(response.status).toBe(200)

    FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify(blocks)))
    response = await octoClient.exportFullArchive('team')
    expect(response.status).toBe(200)

    FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify(blocks)))
    const parentId = 'id1'
    boards = await octoClient.getBlocksWithParent(parentId)
    expect(boards.length).toBe(blocks.length)

    FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify(blocks)))
    boards = await octoClient.getBlocksWithParent(parentId, 'card')
    expect(boards.length).toBe(blocks.length)
})

test('OctoClient: insert blocks', async () => {
    const blocks = createBlocks()

    await octoClient.insertBlocks('board-id', blocks)

    expect(FetchMock.fn).toBeCalledTimes(1)
    expect(FetchMock.fn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(blocks),
        }))
})

test('OctoClient: importFullArchive', async () => {
    const archive = new File([''], 'test')

    await octoClient.importFullArchive(archive)

    expect(FetchMock.fn).toBeCalledTimes(1)
    expect(FetchMock.fn).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
            method: 'POST',
        }))
})

function createBlocks(): Block[] {
    const blocks = []

    for (let i = 0; i < 5; i++) {
        const block = createCard()
        block.id = `block${i + 1}`
        blocks.push(block)
    }

    return blocks
}

test('OctoClient: GetFileInfo', async () => {
    FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify({
        name: 'test.txt',
        size: 2300,
        extension: '.txt',
    })))
    await octoClient.getFileInfo('board-id', 'file-id')
    expect(FetchMock.fn).toBeCalledTimes(1)
    expect(FetchMock.fn).toHaveBeenCalledWith(
        'http://localhost:8065/api/v2/files/teams/0/board-id/file-id/info',
        expect.objectContaining({
            headers: {
                Accept: 'application/json',
                Authorization: '',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            }}))
})
