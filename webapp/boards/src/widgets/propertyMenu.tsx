// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {IntlShape, useIntl} from 'react-intl'

import Menu from 'src/widgets/menu'
import propsRegistry from 'src/properties'
import {PropertyType} from 'src/properties/types'
import './propertyMenu.scss'

type Props = {
    propertyId: string
    propertyName: string
    propertyType: PropertyType
    onTypeAndNameChanged: (newType: PropertyType, newName: string) => void
    onDelete: (id: string) => void
}

function typeMenuTitle(intl: IntlShape, type: PropertyType): string {
    return `${intl.formatMessage({id: 'PropertyMenu.typeTitle', defaultMessage: 'Type'})}: ${type.displayName(intl)}`
}

type TypesProps = {
    label: string
    onTypeSelected: (type: PropertyType) => void
}

export const PropertyTypes = (props: TypesProps): JSX.Element => {
    const intl = useIntl()

    return (
        <>
            <Menu.Label>
                <b>{props.label}</b>
            </Menu.Label>

            <Menu.Separator/>

            {
                propsRegistry.list().map((p) => (
                    <Menu.Text
                        key={p.type}
                        id={p.type}
                        name={p.displayName(intl)}
                        onClick={() => props.onTypeSelected(p)}
                    />
                ))
            }
        </>
    )
}

const PropertyMenu = (props: Props) => {
    const intl = useIntl()
    let currentPropertyName = props.propertyName

    const deleteText = intl.formatMessage({
        id: 'PropertyMenu.Delete',
        defaultMessage: 'Delete',
    })

    return (
        <Menu>
            <Menu.TextInput
                initialValue={props.propertyName}
                onConfirmValue={(n) => {
                    props.onTypeAndNameChanged(props.propertyType, n)
                    currentPropertyName = n
                }}
                onValueChanged={(n) => {
                    currentPropertyName = n
                }}
            />
            <Menu.SubMenu
                id='type'
                name={typeMenuTitle(intl, props.propertyType)}
            >
                <PropertyTypes
                    label={intl.formatMessage({id: 'PropertyMenu.changeType', defaultMessage: 'Change property type'})}
                    onTypeSelected={(type: PropertyType) => props.onTypeAndNameChanged(type, currentPropertyName)}
                />
            </Menu.SubMenu>
            <Menu.Text
                id='delete'
                name={deleteText}
                onClick={() => props.onDelete(props.propertyId)}
            />
        </Menu>
    )
}

export default React.memo(PropertyMenu)
