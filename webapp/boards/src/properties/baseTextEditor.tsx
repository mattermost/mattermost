// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useState,
    useRef,
    useEffect
} from 'react'

import {useIntl} from 'react-intl'

import mutator from 'src/mutator'
import Editable from 'src/widgets/editable'

import {PropertyProps} from './types'

const BaseTextEditor = (props: PropertyProps & {validator: () => boolean, spellCheck?: boolean}): JSX.Element => {
    const [value, setValue] = useState(props.card.fields.properties[props.propertyTemplate.id || ''] || '')
    const onCancel = useCallback(() => setValue(props.propertyValue || ''), [props.propertyValue])

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

    const intl = useIntl()
    const emptyDisplayValue = props.showEmptyPlaceholder ? intl.formatMessage({id: 'PropertyValueElement.empty', defaultMessage: 'Empty'}) : ''

    useEffect(() => {
        return () => {
            saveTextPropertyRef.current && saveTextPropertyRef.current()
        }
    }, [])

    if (!props.readOnly) {
        return (
            <Editable
                className={props.property.valueClassName(props.readOnly)}
                placeholderText={emptyDisplayValue}
                value={value.toString()}
                autoExpand={true}
                onChange={setValue}
                onSave={saveTextProperty}
                onCancel={onCancel}
                validator={props.validator}
                spellCheck={props.spellCheck}
            />
        )
    }
    return <div className={props.property.valueClassName(true)}>{props.propertyValue}</div>
}

export default BaseTextEditor
