// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {render, screen} from '@testing-library/react'

import {mocked} from 'jest-mock'

import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'

import {wrapIntl} from 'src/testUtils'
import {TestBlockFactory} from 'src/test/testBlockFactory'
import {Utils} from 'src/utils'
import {sendFlashMessage} from 'src/components/flashMessages'
import mutator from 'src/mutator'

import UrlProperty from './property'
import Url from './url'

jest.mock('src/components/flashMessages')
jest.mock('src/mutator')

const mockedCopy = jest.spyOn(Utils, 'copyTextToClipboard').mockImplementation(() => true)
const mockedSendFlashMessage = mocked(sendFlashMessage, true)
const mockedMutator = mocked(mutator, true)

describe('properties/link', () => {
    beforeEach(jest.clearAllMocks)

    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard()
    const propertyTemplate = board.cardProperties[0]
    const baseData = {
        property: new UrlProperty(),
        card,
        board,
        propertyTemplate,
        readOnly: false,
        showEmptyPlaceholder: false,
    }

    it('should match snapshot for link with empty url', () => {
        const {container} = render(wrapIntl((
            <Url
                {...baseData}
                propertyValue=''
            />
        )))
        expect(container).toMatchSnapshot()
    })

    it('should match snapshot for link with non-empty url', () => {
        const {container} = render(wrapIntl((
            <Url
                {...baseData}
                propertyValue='https://github.com/mattermost/focalboard'
            />
        )))
        expect(container).toMatchSnapshot()
    })

    it('should match snapshot for readonly link with non-empty url', () => {
        const {container} = render(wrapIntl((
            <Url
                {...baseData}
                propertyValue='https://github.com/mattermost/focalboard'
                readOnly={true}
            />
        )))
        expect(container).toMatchSnapshot()
    })

    it('should change to link after entering url', () => {
        render(
            wrapIntl(
                <Url
                    {...baseData}
                    propertyValue=''
                />,
            ),
        )

        const url = 'https://mattermost.com'
        const input = screen.getByRole('textbox')
        userEvent.type(input, `${url}{enter}`)

        expect(mockedMutator.changePropertyValue).toHaveBeenCalledWith(board.id, card, propertyTemplate.id, url)
    })

    it('should allow to edit link url', () => {
        render(
            wrapIntl(
                <Url
                    {...baseData}
                    propertyValue='https://mattermost.com'
                />,
            ),
        )

        screen.getByRole('button', {name: 'Edit'}).click()
        const newURL = 'https://github.com/mattermost'
        const input = screen.getByRole('textbox')
        userEvent.clear(input)
        userEvent.type(input, `${newURL}{enter}`)
        expect(mockedMutator.changePropertyValue).toHaveBeenCalledWith(board.id, card, propertyTemplate.id, newURL)
    })

    it('should allow to copy url', () => {
        const url = 'https://mattermost.com'
        render(
            wrapIntl(
                <Url
                    {...baseData}
                    propertyValue={url}
                />,
            ),
        )
        screen.getByRole('button', {name: 'Copy'}).click()
        expect(mockedCopy).toHaveBeenCalledWith(url)
        expect(mockedSendFlashMessage).toHaveBeenCalledWith({content: 'Copied!', severity: 'high'})
    })
})
