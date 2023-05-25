// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {
    forwardRef,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
} from 'react'

import './editable.scss'

export type EditableProps = {
    onChange: (value: string) => void
    value?: string
    placeholderText?: string
    className?: string
    saveOnEsc?: boolean
    readonly?: boolean
    spellCheck?: boolean
    autoExpand?: boolean

    validator?: (value: string) => boolean
    onCancel?: () => void
    onSave?: (saveType: 'onEnter'|'onEsc'|'onBlur') => void
    onFocus?: () => void
}

export type Focusable = {
    focus: (selectAll?: boolean) => void
}

export type ElementType = HTMLInputElement | HTMLTextAreaElement

export type ElementProps = {
    className: string
    placeholder?: string
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement|HTMLInputElement>) => void
    value?: string
    title?: string
    onBlur: () => void
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement|HTMLInputElement>) => void
    readOnly?: boolean
    spellCheck?: boolean
    onFocus?: () => void
}

export function useEditable(
    props: EditableProps,
    focusableRef: React.Ref<Focusable>,
    elementRef: React.RefObject<ElementType>): ElementProps {
    const saveOnBlur = useRef<boolean>(true)

    const save = (saveType: 'onEnter'|'onEsc'|'onBlur'): void => {
        if (props.validator && !props.validator(props.value || '')) {
            return
        }
        if (!props.onSave) {
            return
        }
        if (saveType === 'onBlur' && !saveOnBlur.current) {
            return
        }
        if (saveType === 'onEsc' && !props.saveOnEsc) {
            return
        }
        props.onSave(saveType)
    }

    useImperativeHandle(focusableRef, () => ({
        focus: (selectAll = false): void => {
            if (elementRef.current) {
                const valueLength = elementRef.current.value.length
                elementRef.current.focus()
                if (selectAll) {
                    elementRef.current.setSelectionRange(0, valueLength)
                } else {
                    elementRef.current.setSelectionRange(valueLength, valueLength)
                }
            }
        },
    }))

    const blur = (): void => {
        saveOnBlur.current = false
        elementRef.current?.blur()
        saveOnBlur.current = true
    }

    const {value, onChange, className, placeholderText, readonly} = props
    let error = false
    if (props.validator) {
        error = !props.validator(value || '')
    }

    return {
        className: 'Editable ' + (error ? 'error ' : '') + (readonly ? 'readonly ' : '') + (className || ''),
        placeholder: placeholderText,
        onChange: (e: React.ChangeEvent<ElementType>) => {
            onChange(e.target.value)
        },
        value: value ?? '',
        title: value,
        onBlur: () => save('onBlur'),
        onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement|HTMLInputElement>): void => {
            if (e.key === 'Escape' && !(e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) { // ESC
                e.preventDefault()
                if (props.saveOnEsc) {
                    save('onEsc')
                } else {
                    props.onCancel?.()
                }
                blur()
            } else if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) { // Return
                e.preventDefault()
                save('onEnter')
                blur()
            }
        },
        readOnly: readonly,
        spellCheck: props.spellCheck,
        onFocus: props.onFocus,
    }
}

const Editable = (props: EditableProps, ref: React.Ref<Focusable>): JSX.Element => {
    const elementRef = useRef<HTMLInputElement>(null)
    const elementProps = useEditable(props, ref, elementRef)

    useLayoutEffect(() => {
        if (props.autoExpand && elementRef.current) {
            const input = elementRef.current
            input.style.width = '100%'
        }
    })

    return (
        <input
            {...elementProps}
            ref={elementRef}
        />
    )
}

export default forwardRef(Editable)
