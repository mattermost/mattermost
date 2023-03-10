// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useRef,
    useState,
    useEffect,
    useCallback
} from 'react'

import './menuWrapper.scss'

type Props = {
    children?: React.ReactNode
    stopPropagationOnToggle?: boolean
    className?: string
    disabled?: boolean
    isOpen?: boolean
    onToggle?: (open: boolean) => void
    label?: string
}

const MenuWrapper = (props: Props) => {
    const node = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(Boolean(props.isOpen))

    if (!Array.isArray(props.children) || props.children.length !== 2) {
        throw new Error('MenuWrapper needs exactly 2 children')
    }

    const close = useCallback((): void => {
        if (open) {
            setOpen(false)
            props.onToggle && props.onToggle(false)
        }
    }, [props.onToggle, open])

    const closeOnBlur = useCallback((e: Event) => {
        if (e.target && node.current?.contains(e.target as Node)) {
            return
        }

        close()
    }, [close])

    const keyboardClose = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            close()
        }

        if (e.key === 'Tab') {
            closeOnBlur(e)
        }
    }, [close, closeOnBlur])

    const toggle = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
        if (props.disabled) {
            return
        }

        /**
         * This is only here so that we can toggle the menus in the sidebar, because the default behavior of the mobile
         * version (ie the one that uses a modal) needs propagation to close the modal after selecting something
         * We need to refactor this so that the modal is explicitly closed on toggle, but for now I am aiming to preserve the existing logic
         * so as to not break other things
        **/
        if (props.stopPropagationOnToggle) {
            e.preventDefault()
            e.stopPropagation()
        }
        setOpen(!open)
        props.onToggle && props.onToggle(!open)
    }, [props.onToggle, open, props.disabled])

    useEffect(() => {
        if (open) {
            document.addEventListener('menuItemClicked', close, true)
            document.addEventListener('click', closeOnBlur, true)
            document.addEventListener('keyup', keyboardClose, true)
        }
        return () => {
            if (open) {
                document.removeEventListener('menuItemClicked', close, true)
                document.removeEventListener('click', closeOnBlur, true)
                document.removeEventListener('keyup', keyboardClose, true)
            }
        }
    }, [open, close, closeOnBlur, keyboardClose])

    const {children} = props
    let className = 'MenuWrapper'
    if (props.disabled) {
        className += ' disabled'
    }
    if (open) {
        className += ' override menuOpened'
    }
    if (props.className) {
        className += ' ' + props.className
    }

    return (
        <div
            role='button'
            aria-label={props.label || 'menuwrapper'}
            className={className}
            onClick={toggle}
            ref={node}
        >
            {children ? Object.values(children)[0] : null}
            {children && !props.disabled && open ? Object.values(children)[1] : null}
        </div>
    )
}

export default React.memo(MenuWrapper)
