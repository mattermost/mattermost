// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useMemo, useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import debounce from 'lodash/debounce'

import {SuiteWindow} from 'src/types/index'

import {useWebsockets} from 'src/hooks/websockets'

import octoClient from 'src/octoClient'
import mutator from 'src/mutator'
import {Team, getAllTeams, getCurrentTeamId} from 'src/store/teams'
import {Board, createBoard} from 'src/blocks/board'
import {useAppDispatch, useAppSelector} from 'src/store/hooks'
import {EmptyResults, EmptySearch} from 'src/components/searchDialog/searchDialog'
import ConfirmationDialog from 'src/components/confirmationDialogBox'
import Dialog from 'src/components/dialog'
import SearchIcon from 'src/widgets/icons/search'
import Button from 'src/widgets/buttons/button'
import {getCurrentLinkToChannel, setLinkToChannel} from 'src/store/boards'
import {WSClient} from 'src/wsclient'

import BoardSelectorItem from './boardSelectorItem'

const windowAny = (window as SuiteWindow)

import './boardSelector.scss'

const BoardSelector = () => {
    const teamsById: Record<string, Team> = {}
    useAppSelector(getAllTeams).forEach((t) => {
        teamsById[t.id] = t
    })
    const intl = useIntl()
    const teamId = useAppSelector(getCurrentTeamId)
    const currentChannel = useAppSelector(getCurrentLinkToChannel)
    const dispatch = useAppDispatch()

    const [results, setResults] = useState<Board[]>([])
    const [isSearching, setIsSearching] = useState<boolean>(false)
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [showLinkBoardConfirmation, setShowLinkBoardConfirmation] = useState<Board|null>(null)

    const searchHandler = useCallback(async (query: string): Promise<void> => {
        setSearchQuery(query)

        if (query.trim().length === 0 || !teamId) {
            return
        }
        const items = await octoClient.searchLinkableBoards(teamId, query)

        setResults(items)
        setIsSearching(false)
    }, [teamId])

    const debouncedSearchHandler = useMemo(() => debounce(searchHandler, 200), [searchHandler])

    const emptyResult = results.length === 0 && !isSearching && searchQuery

    useWebsockets(teamId, (wsClient: WSClient) => {
        const onChangeBoardHandler = (_: WSClient, boards: Board[]): void => {
            const newResults = [...results]
            let updated = false
            results.forEach((board, idx) => {
                for (const newBoard of boards) {
                    if (newBoard.id === board.id) {
                        newResults[idx] = newBoard
                        updated = true
                    }
                }
            })
            if (updated) {
                setResults(newResults)
            }
        }

        wsClient.addOnChange(onChangeBoardHandler, 'board')

        return () => {
            wsClient.removeOnChange(onChangeBoardHandler, 'board')
        }
    }, [results])

    if (!teamId) {
        return null
    }
    if (!currentChannel) {
        return null
    }

    const linkBoard = async (board: Board, confirmed?: boolean): Promise<void> => {
        if (!confirmed) {
            setShowLinkBoardConfirmation(board)

            return
        }
        const newBoard = createBoard({...board, channelId: currentChannel})
        await mutator.updateBoard(newBoard, board, 'linked channel')
        setShowLinkBoardConfirmation(null)
        dispatch(setLinkToChannel(''))
        setResults([])
        setIsSearching(false)
        setSearchQuery('')
    }

    const unlinkBoard = async (board: Board): Promise<void> => {
        const newBoard = createBoard({...board, channelId: ''})
        await mutator.updateBoard(newBoard, board, 'unlinked channel')
    }

    const newLinkedBoard = async (): Promise<void> => {
        window.open(`${windowAny.frontendBaseURL}/team/${teamId}/new/${currentChannel}`, '_blank', 'noopener')
        dispatch(setLinkToChannel(''))
    }

    let confirmationSubText
    if (showLinkBoardConfirmation?.channelId) {
        confirmationSubText = intl.formatMessage({
            id: 'boardSelector.confirm-link-board-subtext-with-other-channel',
            defaultMessage: 'When you link "{boardName}" to the channel, all members of the channel (existing and new) will be able to edit it. This excludes members who are guests.{lineBreak} This board is currently linked to another channel. It will be unlinked if you choose to link it here.',
        }, {boardName: showLinkBoardConfirmation?.title, lineBreak: <p/>})
    } else {
        confirmationSubText = intl.formatMessage({
            id: 'boardSelector.confirm-link-board-subtext',
            defaultMessage: 'When you link "{boardName}" to the channel, all members of the channel (existing and new) will be able to edit it. This excludes members who are guests. You can unlink a board from a channel at any time.',
        }, {boardName: showLinkBoardConfirmation?.title})
    }

    const closeDialog = () => {
        dispatch(setLinkToChannel(''))
        setResults([])
        setIsSearching(false)
        setSearchQuery('')
        setShowLinkBoardConfirmation(null)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            closeDialog()
        }
    }

    return (
        <div
            className='focalboard-body'
            onKeyDown={handleKeyDown}
        >
            <Dialog
                className='BoardSelector'
                onClose={closeDialog}
                title={
                    <FormattedMessage
                        id='boardSelector.title'
                        defaultMessage='Link boards'
                    />
                }
                toolbar={
                    <Button
                        onClick={() => newLinkedBoard()}
                        emphasis='secondary'
                    >
                        <FormattedMessage
                            id='boardSelector.create-a-board'
                            defaultMessage='Create a board'
                        />
                    </Button>
                }
            >
                {showLinkBoardConfirmation &&
                    <ConfirmationDialog
                        dialogBox={{
                            heading: intl.formatMessage({id: 'boardSelector.confirm-link-board', defaultMessage: 'Link board to channel'}),
                            subText: confirmationSubText,
                            confirmButtonText: intl.formatMessage({id: 'boardSelector.confirm-link-board-button', defaultMessage: 'Yes, link board'}),
                            destructive: showLinkBoardConfirmation?.channelId !== '',
                            onConfirm: () => linkBoard(showLinkBoardConfirmation, true),
                            onClose: () => setShowLinkBoardConfirmation(null),
                        }}
                    />}
                <div className='BoardSelectorBody'>
                    <div className='head'>
                        <div className='queryWrapper'>
                            <SearchIcon/>
                            <input
                                className='searchQuery'
                                placeholder={intl.formatMessage({id: 'boardSelector.search-for-boards', defaultMessage: 'Search for boards'})}
                                type='text'
                                onChange={(e) => debouncedSearchHandler(e.target.value)}
                                autoFocus={true}
                                maxLength={100}
                            />
                        </div>
                    </div>
                    <div className='searchResults'>
                        {/*When there are results to show*/}
                        {searchQuery && results.length > 0 &&
                            results.map((result) => (
                                <BoardSelectorItem
                                    key={result.id}
                                    item={result}
                                    linkBoard={linkBoard}
                                    unlinkBoard={unlinkBoard}
                                    currentChannel={currentChannel}
                                />
                            ))}

                        {/*when user searched for something and there were no results*/}
                        {emptyResult && <EmptyResults query={searchQuery}/>}

                        {/*default state, when user didn't search for anything. This is the initial screen*/}
                        {!emptyResult && !searchQuery && <EmptySearch/>}
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default BoardSelector
