// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'

import {FormattedMessage, useIntl} from 'react-intl'

import MenuWrapper from 'src/widgets/menuWrapper'
import CompassIcon from 'src/widgets/icons/compassIcon'
import Menu from 'src/widgets/menu'
import Search from 'src/widgets/icons/search'
import CreateCategory from 'src/components/createCategory/createCategory'
import {useAppSelector} from 'src/store/hooks'

import {getOnboardingTourCategory, getOnboardingTourStep} from 'src/store/users'
import {getCurrentCard} from 'src/store/cards'

import './boardsSwitcher.scss'
import AddIcon from 'src/widgets/icons/add'
import BoardSwitcherDialog from 'src/components/boardsSwitcherDialog/boardSwitcherDialog'
import {Utils} from 'src/utils'
import {Constants} from 'src/constants'
import {TOUR_SIDEBAR, SidebarTourSteps} from 'src/components/onboardingTour'

import IconButton from 'src/widgets/buttons/iconButton'
import SearchForBoardsTourStep from 'src/components/onboardingTour/searchForBoards/searchForBoards'

type Props = {
    onBoardTemplateSelectorOpen: () => void
    userIsGuest?: boolean
}

const BoardsSwitcher = (props: Props): JSX.Element => {
    const intl = useIntl()

    const [showSwitcher, setShowSwitcher] = useState<boolean>(false)
    const onboardingTourCategory = useAppSelector(getOnboardingTourCategory)
    const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false)
    const onboardingTourStep = useAppSelector(getOnboardingTourStep)
    const currentCard = useAppSelector(getCurrentCard)
    const noCardOpen = !currentCard

    const shouldViewSearchForBoardsTour = noCardOpen &&
                                       onboardingTourCategory === TOUR_SIDEBAR &&
                                       onboardingTourStep === SidebarTourSteps.SEARCH_FOR_BOARDS.toString()

    // We need this keyboard handling (copied from Mattermost webapp) instead of
    // using react-hotkeys-hook as react-hotkeys-hook is unable to handle keyboard shortcuts that
    // the browser uses when the user is focused in an input field.
    //
    // For example, you press Cmd + k, then type something in the search input field. Pressing Cmd + k again
    // is expected to close the board switcher, however, with react-hotkeys-hook it doesn't.
    // This is because Cmd + k is a Firefox shortcut and react-hotkeys-hook is
    // unable to override it if the user is focused on any input field.
    const handleQuickSwitchKeyPress = (e: KeyboardEvent) => {
        if (Utils.cmdOrCtrlPressed(e) && !e.shiftKey && Utils.isKeyPressed(e, Constants.keyCodes.K)) {
            if (!e.altKey) {
                e.preventDefault()
                setShowSwitcher((show) => !show)
            }
        }
    }

    const handleEscKeyPress = (e: KeyboardEvent) => {
        if (Utils.isKeyPressed(e, Constants.keyCodes.ESC)) {
            e.preventDefault()
            setShowSwitcher(false)
        }
    }

    const handleCreateNewCategory = () => {
        setShowCreateCategoryModal(true)
    }

    useEffect(() => {
        document.addEventListener('keydown', handleQuickSwitchKeyPress)
        document.addEventListener('keydown', handleEscKeyPress)

        // cleanup function
        return () => {
            document.removeEventListener('keydown', handleQuickSwitchKeyPress)
            document.removeEventListener('keydown', handleEscKeyPress)
        }
    }, [])

    return (
        <div className='BoardsSwitcherWrapper'>
            <div
                className='BoardsSwitcher'
                onClick={() => setShowSwitcher(true)}
            >
                <Search/>
                <div>
                    <span>
                        {intl.formatMessage({id: 'BoardsSwitcher.Title', defaultMessage: 'Find Boards'})}
                    </span>
                </div>
            </div>
            {shouldViewSearchForBoardsTour && <div><SearchForBoardsTourStep/></div>}
            {
                !props.userIsGuest &&
                <MenuWrapper>
                    <IconButton
                        size='small'
                        inverted={true}
                        className='add-board-icon'
                        icon={<AddIcon/>}
                        title={'Add Board Dropdown'}
                    />
                    <Menu>
                        <Menu.Text
                            id='create-new-board-option'
                            icon={<CompassIcon icon='plus'/>}
                            onClick={props.onBoardTemplateSelectorOpen}
                            name='Create new board'
                        />
                        <Menu.Text
                            id='createNewCategory'
                            name={intl.formatMessage({id: 'SidebarCategories.CategoryMenu.CreateNew', defaultMessage: 'Create New Category'})}
                            icon={
                                <CompassIcon
                                    icon='folder-plus-outline'
                                    className='CreateNewFolderIcon'
                                />
                            }
                            onClick={handleCreateNewCategory}
                        />
                    </Menu>
                </MenuWrapper>
            }

            {
                showSwitcher &&
                <BoardSwitcherDialog onClose={() => setShowSwitcher(false)}/>
            }

            {
                showCreateCategoryModal && (
                    <CreateCategory
                        onClose={() => setShowCreateCategoryModal(false)}
                        title={(
                            <FormattedMessage
                                id='SidebarCategories.CategoryMenu.CreateNew'
                                defaultMessage='Create New Category'
                            />
                        )}
                    />
                )
            }
        </div>
    )
}

export default BoardsSwitcher
