// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useEffect,
    useRef,
    useState,
    useCallback
} from 'react'
import {useIntl} from 'react-intl'

import Editable, {Focusable} from 'src/widgets/editable'

import {Utils} from 'src/utils'
import mutator from 'src/mutator'
import EditIcon from 'src/widgets/icons/edit'
import IconButton from 'src/widgets/buttons/iconButton'
import DuplicateIcon from 'src/widgets/icons/duplicate'
import {sendFlashMessage} from 'src/components/flashMessages'

import {PropertyProps} from 'src/properties/types'

import './url.scss'

const URLProperty = (props: PropertyProps): JSX.Element => {
    if (!props.propertyTemplate) {
        return <></>
    }

    const [value, setValue] = useState(props.card.fields.properties[props.propertyTemplate.id || ''] || '')
    const [isEditing, setIsEditing] = useState(false)
    const isEmpty = !(props.propertyValue as string)?.trim()
    const showEditable = !props.readOnly && (isEditing || isEmpty)
    const editableRef = useRef<Focusable>(null)
    const intl = useIntl()

    const emptyDisplayValue = props.showEmptyPlaceholder ? intl.formatMessage({id: 'PropertyValueElement.empty', defaultMessage: 'Empty'}) : ''

    const saveTextProperty = useCallback(() => {
        if (value !== (props.card.fields.properties[props.propertyTemplate?.id || ''] || '')) {
            mutator.changePropertyValue(props.board.id, props.card, props.propertyTemplate?.id || '', value)
        }
    }, [props.board.id, props.card, props.propertyTemplate?.id, value])

    const saveTextPropertyRef = useRef<() => void>(saveTextProperty)
    if (props.readOnly) {
        saveTextPropertyRef.current = () => null
    } else {
        saveTextPropertyRef.current = saveTextProperty
    }
    useEffect(() => {
        return () => {
            saveTextPropertyRef.current && saveTextPropertyRef.current()
        }
    }, [])

    useEffect(() => {
        if (isEditing) {
            editableRef.current?.focus()
        }
    }, [isEditing])

    if (showEditable) {
        return (
            <div className='URLProperty'>
                <Editable
                    className={props.property.valueClassName(props.readOnly)}
                    ref={editableRef}
                    placeholderText={emptyDisplayValue}
                    value={value as string}
                    autoExpand={true}
                    readonly={props.readOnly}
                    onChange={setValue}
                    onSave={() => {
                        setIsEditing(false)
                        saveTextProperty()
                    }}
                    onCancel={() => {
                        setIsEditing(false)
                        setValue(props.propertyValue || '')
                    }}
                    onFocus={() => {
                        setIsEditing(true)
                    }}
                    validator={() => {
                        if (value === '') {
                            return true
                        }
                        const urlRegexp = /(((.+:(?:\/\/)?)?(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www\.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w\-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[.!/\\\w]*))?)/
                        return urlRegexp.test(value as string)
                    }}
                />
            </div>
        )
    }

    return (
        <div className={`URLProperty ${props.property.valueClassName(props.readOnly)}`}>
            <a
                className='link'
                href={Utils.ensureProtocol((props.propertyValue as string).trim())}
                target='_blank'
                rel='noreferrer'
                onClick={(event) => event.stopPropagation()}
            >
                {props.propertyValue}
            </a>
            {!props.readOnly &&
            <IconButton
                className='Button_Edit'
                title={intl.formatMessage({id: 'URLProperty.edit', defaultMessage: 'Edit'})}
                icon={<EditIcon/>}
                onClick={() => setIsEditing(true)}
            />}
            <IconButton
                className='Button_Copy'
                title={intl.formatMessage({id: 'URLProperty.copy', defaultMessage: 'Copy'})}
                icon={<DuplicateIcon/>}
                onClick={(e) => {
                    e.stopPropagation()
                    Utils.copyTextToClipboard(props.propertyValue as string)
                    sendFlashMessage({content: intl.formatMessage({id: 'URLProperty.copiedLink', defaultMessage: 'Copied!'}), severity: 'high'})
                }}
            />
        </div>
    )
}

export default URLProperty
