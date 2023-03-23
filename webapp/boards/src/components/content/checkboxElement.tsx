// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useRef, useState} from 'react'
import {useIntl} from 'react-intl'

import {createCheckboxBlock} from 'src/blocks/checkboxBlock'
import {ContentBlock} from 'src/blocks/contentBlock'
import CheckIcon from 'src/widgets/icons/check'
import mutator from 'src/mutator'
import Editable, {Focusable} from 'src/widgets/editable'
import {useCardDetailContext} from 'src/components/cardDetail/cardDetailContext'

import './checkboxElement.scss'

import {contentRegistry} from './contentRegistry'

type Props = {
    block: ContentBlock
    readonly: boolean
    onAddElement?: () => void
    onDeleteElement?: () => void
}

const CheckboxElement = (props: Props) => {
    const {block, readonly} = props
    const intl = useIntl()
    const titleRef = useRef<Focusable>(null)
    const cardDetail = useCardDetailContext()
    const [addedBlockId, setAddedBlockId] = useState(cardDetail.lastAddedBlock.id)
    const [active, setActive] = useState(Boolean(block.fields.value))
    const [title, setTitle] = useState(block.title)

    useEffect(() => {
        if (block.id === addedBlockId) {
            titleRef.current?.focus()
            setAddedBlockId('')
        }
    }, [block, addedBlockId, titleRef])

    useEffect(() => {
        setActive(Boolean(block.fields.value))
    }, [Boolean(block.fields.value)])

    return (
        <div className='CheckboxElement'>
            <input
                type='checkbox'
                id={`checkbox-${block.id}`}
                disabled={readonly}
                checked={active}
                value={active ? 'on' : 'off'}
                onChange={(e) => {
                    e.preventDefault()
                    const newBlock = createCheckboxBlock(block)
                    newBlock.fields.value = !active
                    newBlock.title = title
                    setActive(newBlock.fields.value)
                    mutator.updateBlock(block.boardId, newBlock, block, intl.formatMessage({id: 'ContentBlock.editCardCheckbox', defaultMessage: 'toggled-checkbox'}))
                }}
            />
            <Editable
                ref={titleRef}
                value={title}
                placeholderText={intl.formatMessage({id: 'ContentBlock.editText', defaultMessage: 'Edit text...'})}
                onChange={setTitle}
                saveOnEsc={true}
                onSave={async (saveType) => {
                    const {lastAddedBlock} = cardDetail
                    if (title === '' && block.id === lastAddedBlock.id && lastAddedBlock.autoAdded && props.onDeleteElement) {
                        props.onDeleteElement()
                        return
                    }

                    if (block.title !== title) {
                        await mutator.changeBlockTitle(block.boardId, block.id, block.title, title, intl.formatMessage({id: 'ContentBlock.editCardCheckboxText', defaultMessage: 'edit card text'}))
                        if (saveType === 'onEnter' && title !== '' && props.onAddElement) {
                            // Wait for the change to happen
                            setTimeout(props.onAddElement, 100)
                        }
                        return
                    }

                    if (saveType === 'onEnter' && title !== '' && props.onAddElement) {
                        props.onAddElement()
                    }
                }}
                readonly={readonly}
                spellCheck={true}
            />
        </div>
    )
}

contentRegistry.registerContentType({
    type: 'checkbox',
    getDisplayText: (intl) => intl.formatMessage({id: 'ContentBlock.checkbox', defaultMessage: 'checkbox'}),
    getIcon: () => <CheckIcon/>,
    createBlock: async () => {
        return createCheckboxBlock()
    },
    createComponent: (block, readonly, onAddElement, onDeleteElement) => {
        return (
            <CheckboxElement
                block={block}
                readonly={readonly}
                onAddElement={onAddElement}
                onDeleteElement={onDeleteElement}
            />
        )
    },
})

export default React.memo(CheckboxElement)
