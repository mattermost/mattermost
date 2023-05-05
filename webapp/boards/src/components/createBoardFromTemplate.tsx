// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react'

import Select from 'react-select/async'
import {
    FormatOptionLabelMeta,
    GroupBase,
    PlaceholderProps,
    SingleValue,
    components,
} from 'react-select'

import {CSSObject} from '@emotion/serialize'

import {useIntl} from 'react-intl'

import CompassIcon from 'src/widgets/icons/compassIcon'
import {mutator} from 'src/mutator'
import {useGetAllTemplates} from 'src/hooks/useGetAllTemplates'

import './createBoardFromTemplate.scss'
import {Board} from 'src/blocks/board'

type Props = {
    setCanCreate: (canCreate: boolean) => void
    setAction: (fn: () => (channelId: string, teamId: string) => Promise<Board | undefined>) => void
    newBoardInfoIcon: React.ReactNode
}

type ReactSelectItem = {
    id: string
    title: string
    icon?: string
    description: string
}

const EMPTY_BOARD = 'empty_board'
const TEMPLATE_DESCRIPTION_LENGTH = 70

const {ValueContainer, Placeholder} = components
const CustomValueContainer = ({children, ...props}: any) => {
    return (
        <ValueContainer {...props}>
            <Placeholder {...props}>
                {props.selectProps.placeholder}
            </Placeholder>
            {React.Children.map(children, (child) =>
                (child && child.type !== Placeholder ? child : null)
            )}
        </ValueContainer>
    )
}

const CreateBoardFromTemplate = (props: Props) => {
    const intl = useIntl()
    const {formatMessage} = intl

    const [addBoard, setAddBoard] = useState(false)
    const allTemplates = useGetAllTemplates()
    const [selectedBoardTemplateId, setSelectedBoardTemplateId] = useState<string>('')

    const addBoardRef = useRef(false)
    addBoardRef.current = addBoard
    const templateIdRef = useRef('')
    templateIdRef.current = selectedBoardTemplateId

    const showNewBoardTemplateSelector = async () => {
        setAddBoard((prev: boolean) => !prev)
    }

    // CreateBoardFromTemplate
    const addBoardToChannel = async (channelId: string, teamId: string) => {
        if (!addBoardRef.current || !templateIdRef.current) {
            return undefined
        }

        const ACTION_DESCRIPTION = 'board created from channel'
        const LINKED_CHANNEL = 'linked channel'
        const asTemplate = false

        let boardsAndBlocks

        if (templateIdRef.current === EMPTY_BOARD) {
            boardsAndBlocks = await mutator.addEmptyBoard(teamId, intl)
        } else {
            boardsAndBlocks = await mutator.duplicateBoard(templateIdRef.current as string, ACTION_DESCRIPTION, asTemplate, undefined, undefined, teamId)
        }

        const board = boardsAndBlocks.boards[0]
        await mutator.updateBoard({...board, channelId}, board, LINKED_CHANNEL)

        return board
    }

    useEffect(() => {
        props.setAction(() => addBoardToChannel)
    }, [])

    useEffect(() => {
        props.setCanCreate(!addBoard || (addBoard && selectedBoardTemplateId !== ''))
    }, [addBoard, selectedBoardTemplateId])

    const getSubstringWithCompleteWords = (str: string, len: number) => {
        if (str?.length <= len) {
            return str
        }

        // get the final part of the string in order to find the next whitespace if any
        const finalStringPart = str.substring(len)
        const wordBreakingIndex = finalStringPart.indexOf(' ')

        // if there is no whitespace is because the lenght in this case falls into an entire word and doesn't affect the display, so just return it
        if (wordBreakingIndex === -1) {
            return str
        }

        return `${str.substring(0, (len + wordBreakingIndex))}…`
    }

    const formatOptionLabel = ({id, title, icon, description}: ReactSelectItem, optionLabel: FormatOptionLabelMeta<ReactSelectItem>) => {
        const cssPrefix = 'CreateBoardFromTemplate--templates-selector__menu-portal__option'

        const descriptionLabel = description ? getSubstringWithCompleteWords(description, TEMPLATE_DESCRIPTION_LENGTH) : 'ㅤ'

        const templateDescription = (
            <span className={`${cssPrefix}__description`}>
                {descriptionLabel}
            </span>
        )

        // do not show the description for the selected option so the input only show the icon and title of the template
        const selectedOption = id === optionLabel.selectValue[0]?.id

        return (
            <div key={id}>
                <span className={`${cssPrefix}__icon`}>
                    {icon || <CompassIcon icon='product-boards'/>}
                </span>
                <span className={`${cssPrefix}__title`}>
                    {title}
                </span>
                {!selectedOption && templateDescription}
            </div>
        )
    }

    const loadOptions = useCallback(async (value = '') => {
        let templates = allTemplates.map((template) => {
            return {
                id: template.id,
                title: template.title,
                icon: template.icon,
                description: template.description,
            }
        })

        const emptyBoard = {
            id: EMPTY_BOARD,
            title: formatMessage({id: 'new_channel_modal.create_board.empty_board_title', defaultMessage: 'Empty board'}),
            icon: '',
            description: formatMessage({id: 'new_channel_modal.create_board.empty_board_description', defaultMessage: 'Create a new empty board'}),
        }

        templates.push(emptyBoard)

        if (value !== '') {
            templates = templates.filter((template) => template.title.toLowerCase().includes(value.toLowerCase()))
        }

        return templates
    }, [allTemplates])

    const onChange = useCallback((item: SingleValue<ReactSelectItem>) => {
        if (item) {
            setSelectedBoardTemplateId(item.id)
        }
    }, [setSelectedBoardTemplateId])

    const selectorStyles = {
        menu: (baseStyles: CSSObject): CSSObject => ({
            ...baseStyles,
            height: '164px',
        }),
        menuList: (baseStyles: CSSObject): CSSObject => ({
            ...baseStyles,
            height: '160px',
        }),
        menuPortal: (baseStyles: CSSObject): CSSObject => ({
            ...baseStyles,
            zIndex: 9999,
        }),
        valueContainer: (baseStyles: CSSObject): CSSObject => ({
            ...baseStyles,
            overflow: 'visible',
        }),
        placeholder: (baseStyles: CSSObject, state: PlaceholderProps<ReactSelectItem, false, GroupBase<ReactSelectItem>>): CSSObject => {
            const modifyPlaceholder = state.selectProps.menuIsOpen || (!state.selectProps.menuIsOpen && state.hasValue)

            return {
                ...baseStyles,
                position: 'absolute',
                backgroundColor: 'var(--sys-center-channel-bg)',
                padding: '0 3px',
                top: modifyPlaceholder ? -15 : '18%',
                transition: 'top 0.5s, font-size 0.5s, color 0.5s',
                fontSize: modifyPlaceholder ? 10 : 16,
                color: modifyPlaceholder ? 'var(--sidebar-text-active-border)' : 'rgba(var(--center-channel-color-rgb), 0.42)',
            }
        },
    }

    return (
        <div className='CreateBoardFromTemplate'>
            <div className='add-board-to-channel'>
                <label>
                    <input
                        type='checkbox'
                        onChange={showNewBoardTemplateSelector}
                        checked={addBoard}
                        id={'add-board-to-channel'}
                        data-testid='add-board-to-channel-check'
                    />
                    <span>
                        {formatMessage({id: 'new_channel_modal.create_board.title', defaultMessage: 'Create a board for this channel'})}
                    </span>
                    {props.newBoardInfoIcon}
                </label>
                {addBoard && <div className='templates-selector'>
                    <Select
                        classNamePrefix={'CreateBoardFromTemplate--templates-selector'}
                        placeholder={formatMessage({id: 'new_channel_modal.create_board.select_template_placeholder', defaultMessage: 'Select a template'})}
                        onChange={onChange}
                        components={{IndicatorSeparator: () => null, ValueContainer: CustomValueContainer}}
                        loadOptions={loadOptions}
                        getOptionValue={(v) => v.id}
                        getOptionLabel={(v) => v.title}
                        formatOptionLabel={formatOptionLabel}
                        styles={selectorStyles}
                        menuPortalTarget={document.body}
                        defaultOptions={true}
                    />
                </div>}
            </div>
        </div>
    )
}

export default CreateBoardFromTemplate
