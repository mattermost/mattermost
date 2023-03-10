// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useEffect} from 'react'
import {IntlProvider, FormattedMessage, useIntl} from 'react-intl'

import WithWebSockets from 'src/components/withWebSockets'
import {useWebsockets} from 'src/hooks/websockets'

import {getLanguage} from 'src/store/language'
import {useAppSelector} from 'src/store/hooks'
import {getCurrentTeamId} from 'src/store/teams'

import {WSClient, MMWebSocketClient} from 'src/wsclient'
import manifest from 'src/manifest'

import {getMessages} from 'src/i18n'
import {Utils} from 'src/utils'
import {Block} from 'src/blocks/block'
import {Card} from 'src/blocks/card'
import {Board} from 'src/blocks/board'
import {ContentBlock} from 'src/blocks/contentBlock'

import octoClient from 'src/octoClient'

const noop = () => ''
const Avatar = (window as any).Components?.Avatar || noop
const imageURLForUser = (window as any).Components?.imageURLForUser || noop

import './boardsUnfurl.scss'
import 'src/styles/labels.scss'

type Props = {
    embed: {
        data: string
    }
    webSocketClient?: MMWebSocketClient
}

class FocalboardEmbeddedData {
    teamID: string
    cardID: string
    boardID: string
    readToken: string
    originalPath: string

    constructor(rawData: string) {
        const parsed = JSON.parse(rawData)
        this.teamID = parsed.teamID || parsed.workspaceID
        this.cardID = parsed.cardID
        this.boardID = parsed.boardID
        this.readToken = parsed.readToken
        this.originalPath = parsed.originalPath
    }
}

export const BoardsUnfurl = (props: Props): JSX.Element => {
    if (!props.embed || !props.embed.data) {
        return <></>
    }

    const intl = useIntl()

    const {embed, webSocketClient} = props
    const focalboardInformation: FocalboardEmbeddedData = new FocalboardEmbeddedData(embed.data)
    const currentTeamId = useAppSelector(getCurrentTeamId)
    const {teamID, cardID, boardID, readToken, originalPath} = focalboardInformation
    const baseURL = window.location.origin

    if (!teamID || !cardID || !boardID) {
        return <></>
    }

    const [card, setCard] = useState<Card>()
    const [content, setContent] = useState<ContentBlock>()
    const [board, setBoard] = useState<Board>()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            const [cards, fetchedBoard] = await Promise.all(
                [
                    octoClient.getBlocksWithBlockID(cardID, boardID, readToken),
                    octoClient.getBoard(boardID),
                ],
            )
            const [firstCard] = cards as Card[]
            if (!firstCard || !fetchedBoard) {
                setLoading(false)
                return null
            }
            setCard(firstCard)
            setBoard(fetchedBoard)

            if (firstCard.fields.contentOrder.length) {
                let [firstContentBlockID] = firstCard.fields?.contentOrder

                if (Array.isArray(firstContentBlockID)) {
                    [firstContentBlockID] = firstContentBlockID
                }

                const contentBlock = await octoClient.getBlocksWithBlockID(firstContentBlockID, boardID, readToken) as ContentBlock[]
                const [firstContentBlock] = contentBlock
                if (!firstContentBlock) {
                    setLoading(false)
                    return null
                }
                setContent(firstContentBlock)
            }

            setLoading(false)
            return null
        }
        fetchData()
    }, [originalPath])

    useWebsockets(currentTeamId, (wsClient: WSClient) => {
        const onChangeHandler = (_: WSClient, blocks: Block[]): void => {
            const cardBlock: Block|undefined = blocks.find((b) => b.id === cardID)
            if (cardBlock && !cardBlock.deleteAt) {
                setCard(cardBlock as Card)
            }

            const contentBlock: Block|undefined = blocks.find((b) => b.id === content?.id)
            if (contentBlock && !contentBlock.deleteAt) {
                setContent(contentBlock)
            }
        }

        wsClient.addOnChange(onChangeHandler, 'block')

        return () => {
            wsClient.removeOnChange(onChangeHandler, 'block')
        }
    }, [cardID, content?.id])

    let remainder = 0
    let html = ''
    const propertiesToDisplay: Array<Record<string, string>> = []
    if (card && board) {
        // Checkboxes need to be accounted for if they are off or on, if they are on they show up in the card properties so we don't want to count it twice
        // Therefore we keep track how many checkboxes there are and subtract it at the end
        let totalNumberOfCheckBoxes = 0

        // We will just display the first 3 or less select/multi-select properties and do a +n for remainder if any remainder
        for (let i = 0; i < board.cardProperties.length; i++) {
            const optionInBoard = board.cardProperties[i]
            let valueToLookUp = card.fields.properties[optionInBoard.id]

            // Since these are always set and not included in the card properties
            if (['createdTime', 'createdBy', 'updatedTime', 'updatedBy', 'checkbox'].includes(optionInBoard.type)) {
                if (valueToLookUp && optionInBoard.type === 'checkbox') {
                    totalNumberOfCheckBoxes += 1
                }

                remainder += 1
                continue
            }

            // Check to see if this property is set in the Card or if we have max properties to display
            if (propertiesToDisplay.length === 3 || !valueToLookUp) {
                continue
            }

            if (Array.isArray(valueToLookUp)) {
                valueToLookUp = valueToLookUp[0]
            }

            const optionSelected = optionInBoard.options.find((option) => option.id === valueToLookUp)

            if (!optionSelected) {
                continue
            }

            propertiesToDisplay.push({
                optionName: optionInBoard.name,
                optionValue: optionSelected.value,
                optionValueColour: optionSelected.color,
            })
        }
        remainder += (Object.keys(card.fields.properties).length - propertiesToDisplay.length - totalNumberOfCheckBoxes)
        html = Utils.htmlFromMarkdown(content?.title || '')
    }

    return (
        <WithWebSockets
            manifest={manifest}
            webSocketClient={webSocketClient}
        >
            {!loading && (!card || !board) && <></>}
            {!loading && card && board &&
                <a
                    className='FocalboardUnfurl'
                    href={`${baseURL}${originalPath}`}
                    rel='noopener noreferrer'
                    target='_blank'
                >

                    {/* Header of the Card*/}
                    <div className='header'>
                        <span className='icon'>{card.fields?.icon}</span>
                        <div className='information'>
                            <span className='card_title'>{card.title}</span>
                            <span className='board_title'>{board.title}</span>
                        </div>
                    </div>

                    {/* Body of the Card*/}
                    {!card.limited && html !== '' &&
                        <div className='body'>
                            <div
                                dangerouslySetInnerHTML={{__html: html}}
                            />
                        </div>
                    }

                    {card.limited &&
                        <p className='limited'>
                            <FormattedMessage
                                id='BoardsUnfurl.Limited'
                                defaultMessage={'Additional details are hidden due to the card being archived'}
                            />
                        </p>}

                    {/* Footer of the Card*/}
                    {!card.limited &&
                        <div className='footer'>
                            <div className='avatar'>
                                <Avatar
                                    size={'md'}
                                    url={imageURLForUser(card.createdBy)}
                                    className={'avatar-post-preview'}
                                />
                            </div>
                            <div className='timestamp_properties'>
                                <div className='properties'>
                                    {propertiesToDisplay.map((property) => (
                                        <div
                                            key={property.optionValue}
                                            className={`property ${property.optionValueColour}`}
                                            title={`${property.optionName}`}
                                            style={{maxWidth: `${(1 / propertiesToDisplay.length) * 100}%`}}
                                        >
                                            {property.optionValue}
                                        </div>
                                    ))}
                                    {remainder > 0 &&
                                        <span className='remainder'>
                                            <FormattedMessage
                                                id='BoardsUnfurl.Remainder'
                                                defaultMessage='+{remainder} more'
                                                values={{
                                                    remainder,
                                                }}
                                            />
                                        </span>
                                    }
                                </div>
                                <span className='post-preview__time'>
                                    <FormattedMessage
                                        id='BoardsUnfurl.Updated'
                                        defaultMessage='Updated {time}'
                                        values={{
                                            time: Utils.displayDateTime(new Date(card.updateAt), intl),
                                        }}
                                    />
                                </span>
                            </div>
                        </div>}
                </a>
            }
            {loading &&
                <div style={{height: '302px'}}/>
            }
        </WithWebSockets>
    )
}

const IntlBoardsUnfurl = (props: Props) => {
    const language = useAppSelector<string>(getLanguage)

    return (
        <IntlProvider
            locale={language.split(/[_]/)[0]}
            messages={getMessages(language)}
        >
            <BoardsUnfurl {...props}/>
        </IntlProvider>
    )
}

export default IntlBoardsUnfurl
