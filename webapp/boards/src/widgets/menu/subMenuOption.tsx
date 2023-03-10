// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {
    useEffect,
    useState,
    useContext,
    CSSProperties,
    useRef
} from 'react'

import CompassIcon from 'src/widgets/icons/compassIcon'

import MenuUtil from './menuUtil'

import Menu from '.'

import './subMenuOption.scss'

export const HoveringContext = React.createContext(false)

type SubMenuOptionProps = {
    id: string
    name: string
    position?: 'bottom' | 'top' | 'left' | 'left-bottom' | 'auto'
    icon?: React.ReactNode
    children: React.ReactNode
    className?: string
}

function SubMenuOption(props: SubMenuOptionProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false)
    const isHovering = useContext(HoveringContext)

    const openLeftClass = props.position === 'left' || props.position === 'left-bottom' ? ' open-left' : ''

    useEffect(() => {
        if (isHovering !== undefined) {
            setIsOpen(isHovering)
        }
    }, [isHovering])

    const ref = useRef<HTMLDivElement>(null)

    const styleRef = useRef<CSSProperties>({})

    useEffect(() => {
        const newStyle: CSSProperties = {}
        if (props.position === 'auto' && ref.current) {
            const openUp = MenuUtil.openUp(ref)
            if (openUp.openUp) {
                newStyle.bottom = 0
            } else {
                newStyle.top = 0
            }
        }

        styleRef.current = newStyle
    }, [ref.current])

    return (
        <div
            id={props.id}
            className={`MenuOption SubMenuOption menu-option${openLeftClass}${isOpen ? ' menu-option-active' : ''}${props.className ? ' ' + props.className : ''}`}
            onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                setIsOpen((open) => !open)
            }}
            ref={ref}
        >
            {props.icon ? <div className='menu-option__icon'>{props.icon}</div> : <div className='noicon'/>}
            <div className='menu-name'>{props.name}</div>
            <CompassIcon icon='chevron-right'/>
            {isOpen &&
                <div
                    className={'SubMenu Menu noselect ' + (props.position || 'bottom')}
                    style={styleRef.current}
                >
                    <div className='menu-contents'>
                        <div className='menu-options'>
                            {props.children}
                        </div>
                        <div className='menu-spacer hideOnWidescreen'/>

                        <div className='menu-options hideOnWidescreen'>
                            <Menu.Text
                                id='menu-cancel'
                                name={'Cancel'}
                                className='menu-cancel'
                                onClick={() => undefined}
                            />
                        </div>
                    </div>

                </div>
            }
        </div>
    )
}

export default React.memo(SubMenuOption)
