// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {dragAndDropRearrange} from './cardDetailContentsUtility'
import {Position} from './cardDetailContents'

describe('components/cardDetail/cardDetailContentsUtility', () => {
    test('Testing moving first item in the row to the end', () => {
        const data = {
            contentOrder: [
                ['1', '2', '3'],
            ],
            srcBlockId: '1',
            srcBlockX: 0,
            srcBlockY: 0,
            dstBlockX: 0,
            dstBlockY: 2,
            dstBlockId: '3',
            moveTo: 'right' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            ['2', '3', '1'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing moving last item in the row to the beginning', () => {
        const data = {
            contentOrder: [
                ['1', '2', '3'],
            ],
            srcBlockId: '3',
            srcBlockX: 0,
            srcBlockY: 2,
            dstBlockX: 0,
            dstBlockY: 0,
            dstBlockId: '1',
            moveTo: 'left' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            ['3', '1', '2'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing moving item from beginning of row to the middle of row', () => {
        const data = {
            contentOrder: [
                ['1', '2', '3'],
            ],
            srcBlockId: '1',
            srcBlockX: 0,
            srcBlockY: 0,
            dstBlockX: 0,
            dstBlockY: 2,
            dstBlockId: '3',
            moveTo: 'left' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            ['2', '1', '3'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing swapping two items in the same row by moving second item to the left of the first item', () => {
        const data = {
            contentOrder: [
                ['1', '2'],
            ],
            srcBlockId: '2',
            srcBlockX: 0,
            srcBlockY: 1,
            dstBlockX: 0,
            dstBlockY: 0,
            dstBlockId: '1',
            moveTo: 'left' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            ['2', '1'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing swapping two items in the same row by moving the first item to the right of the second item', () => {
        const data = {
            contentOrder: [
                ['1', '2'],
            ],
            srcBlockId: '1',
            srcBlockX: 0,
            srcBlockY: 0,
            dstBlockX: 0,
            dstBlockY: 1,
            dstBlockId: '2',
            moveTo: 'right' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            ['2', '1'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing moving a single item in the first row into the middle of second row using left operation', () => {
        const data = {
            contentOrder: [
                '4',
                ['1', '3'],
            ],
            srcBlockId: '4',
            srcBlockX: 0,
            srcBlockY: -1,
            dstBlockX: 1,
            dstBlockY: 1,
            dstBlockId: '3',
            moveTo: 'left' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            ['1', '4', '3'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing moving a single item in the first row into the middle of second row using right operation', () => {
        const data = {
            contentOrder: [
                '4',
                ['1', '3'],
            ],
            srcBlockId: '4',
            srcBlockX: 0,
            srcBlockY: -1,
            dstBlockX: 1,
            dstBlockY: 0,
            dstBlockId: '1',
            moveTo: 'right' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            ['1', '4', '3'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing moving a single item in the last row into the middle of first row', () => {
        const data = {
            contentOrder: [
                ['1', '3'],
                '4',
            ],
            srcBlockId: '4',
            srcBlockX: 1,
            srcBlockY: -1,
            dstBlockX: 0,
            dstBlockY: 0,
            dstBlockId: '1',
            moveTo: 'right' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            ['1', '4', '3'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing moving a single item in the last row above the first row', () => {
        const data = {
            contentOrder: [
                ['1', '3'],
                '4',
            ],
            srcBlockId: '4',
            srcBlockX: 1,
            srcBlockY: -1,
            dstBlockX: 0,
            dstBlockY: 0,
            dstBlockId: '1',
            moveTo: 'aboveRow' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            '4',
            ['1', '3'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing moving an item out of a row', () => {
        const data = {
            contentOrder: [
                ['1', '3'],
                '4',
            ],
            srcBlockId: '3',
            srcBlockX: 0,
            srcBlockY: 1,
            dstBlockX: 1,
            dstBlockY: -1,
            dstBlockId: '4',
            moveTo: 'belowRow' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            '1',
            '4',
            '3',
        ]
        expect(result).toEqual(expected)
    })

    test('Testing moving an item out of a row and creating a new row with a single item at the end', () => {
        const data = {
            contentOrder: [
                ['1', '3'],
                '4',
            ],
            srcBlockId: '3',
            srcBlockX: 0,
            srcBlockY: 1,
            dstBlockX: 1,
            dstBlockY: -1,
            dstBlockId: '4',
            moveTo: 'right' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            '1',
            ['4', '3'],
        ]
        expect(result).toEqual(expected)
    })

    test('Testing moving an item out of a row and creating a new row with a single item at the beginning', () => {
        const data = {
            contentOrder: [
                ['1', '3'],
                '4',
            ],
            srcBlockId: '3',
            srcBlockX: 0,
            srcBlockY: 1,
            dstBlockX: 1,
            dstBlockY: -1,
            dstBlockId: '4',
            moveTo: 'left' as Position,
        }

        const result = dragAndDropRearrange(data)
        const expected = [
            '1',
            ['3', '4'],
        ]
        expect(result).toEqual(expected)
    })
})
