// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {IntlShape, useIntl} from 'react-intl'

import {CsvExporter} from 'src/csvExporter'
import {Archiver} from 'src/archiver'
import {Board} from 'src/blocks/board'
import {BoardView} from 'src/blocks/boardView'
import {Card} from 'src/blocks/card'
import IconButton from 'src/widgets/buttons/iconButton'
import OptionsIcon from 'src/widgets/icons/options'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import {Utils} from 'src/utils'

import ModalWrapper from 'src/components/modalWrapper'
import {sendFlashMessage} from 'src/components/flashMessages'

type Props = {
    board: Board
    activeView: BoardView
    cards: Card[]
}

// import {mutator} from '../../mutator'
// import {CardFilter} from '../../cardFilter'
// import {BlockIcons} from '../../blockIcons'
// async function testAddCards(board: Board, activeView: BoardView, startCount: number, count: number) {
//     let optionIndex = 0

//     mutator.performAsUndoGroup(async () => {
//         for (let i = 0; i < count; i++) {
//             const card = new Card()
//             card.parentId = board.id
//             card.boardId = board.boardId
//             card.fields.properties = CardFilter.propertiesThatMeetFilterGroup(activeView.fields.filter, board.cardProperties)
//             card.title = `Test Card ${startCount + i + 1}`
//             card.fields.icon = BlockIcons.shared.randomIcon()

//             const groupByProperty = board.cardProperties.find((o) => o.id === activeView.fields.groupById)
//             if (groupByProperty && groupByProperty.options.length > 0) {
//                 // Cycle through options
//                 const option = groupByProperty.options[optionIndex]
//                 optionIndex = (optionIndex + 1) % groupByProperty.options.length
//                 card.fields.properties[groupByProperty.id] = option.id
//             }
//             mutator.insertBlock(card, 'test add card')
//         }
//     })
// }

// async function testDistributeCards(boardTree: BoardTree) {
//     mutator.performAsUndoGroup(async () => {
//         let optionIndex = 0
//         for (const card of boardTree.cards) {
//             if (boardTree.groupByProperty && boardTree.groupByProperty.options.length > 0) {
//                 // Cycle through options
//                 const option = boardTree.groupByProperty.options[optionIndex]
//                 optionIndex = (optionIndex + 1) % boardTree.groupByProperty.options.length
//                 const newCard = new Card(card)
//                 if (newCard.properties[boardTree.groupByProperty.id] !== option.id) {
//                     newCard.properties[boardTree.groupByProperty.id] = option.id
//                     mutator.updateBlock(newCard, card, 'test distribute cards')
//                 }
//             }
//         }
//     })
// }

// async function testRandomizeIcons(boardTree: BoardTree) {
//     mutator.performAsUndoGroup(async () => {
//         for (const card of boardTree.cards) {
//             mutator.changeIcon(card.id, card.fields.icon, BlockIcons.shared.randomIcon(), 'randomize icon')
//         }
//     })
// }

function onExportCsvTrigger(board: Board, activeView: BoardView, cards: Card[], intl: IntlShape) {
    try {
        CsvExporter.exportTableCsv(board, activeView, cards, intl)
        const exportCompleteMessage = intl.formatMessage({
            id: 'ViewHeader.export-complete',
            defaultMessage: 'Export complete!',
        })
        sendFlashMessage({content: exportCompleteMessage, severity: 'normal'})
    } catch (e) {
        Utils.logError(`ExportCSV ERROR: ${e}`)
        const exportFailedMessage = intl.formatMessage({
            id: 'ViewHeader.export-failed',
            defaultMessage: 'Export failed!',
        })
        sendFlashMessage({content: exportFailedMessage, severity: 'high'})
    }
}

const ViewHeaderActionsMenu = (props: Props) => {
    const {board, activeView, cards} = props
    const intl = useIntl()

    return (
        <ModalWrapper>
            <MenuWrapper label={intl.formatMessage({id: 'ViewHeader.view-header-menu', defaultMessage: 'View header menu'})}>
                <IconButton icon={<OptionsIcon/>}/>
                <Menu position='left'>
                    <Menu.Text
                        id='exportCsv'
                        name={intl.formatMessage({id: 'ViewHeader.export-csv', defaultMessage: 'Export to CSV'})}
                        onClick={() => onExportCsvTrigger(board, activeView, cards, intl)}
                    />
                    <Menu.Text
                        id='exportBoardArchive'
                        name={intl.formatMessage({id: 'ViewHeader.export-board-archive', defaultMessage: 'Export board archive'})}
                        onClick={() => Archiver.exportBoardArchive(board)}
                    />
                    {/*
                    <Menu.Separator/>

                    <Menu.Text
                        id='testAdd100Cards'
                        name={intl.formatMessage({id: 'ViewHeader.test-add-100-cards', defaultMessage: 'TEST: Add 100 cards'})}
                        onClick={() => testAddCards(board, activeView, cards.length, 100)}
                    />
                    <Menu.Text
                        id='testAdd1000Cards'
                        name={intl.formatMessage({id: 'ViewHeader.test-add-1000-cards', defaultMessage: 'TEST: Add 1,000 cards'})}
                        onClick={() => testAddCards(board, activeView, cards.length, 1000)}
                    />
                    <Menu.Text
                        id='testDistributeCards'
                        name={intl.formatMessage({id: 'ViewHeader.test-distribute-cards', defaultMessage: 'TEST: Distribute cards'})}
                        onClick={() => testDistributeCards()}
                    />
                    <Menu.Text
                        id='testRandomizeIcons'
                        name={intl.formatMessage({id: 'ViewHeader.test-randomize-icons', defaultMessage: 'TEST: Randomize icons'})}
                        onClick={() => testRandomizeIcons()}
                    />
                    */}
                </Menu>
            </MenuWrapper>
        </ModalWrapper>
    )
}

export default React.memo(ViewHeaderActionsMenu)
