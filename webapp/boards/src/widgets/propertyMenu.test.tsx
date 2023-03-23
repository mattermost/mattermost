// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {fireEvent, render} from '@testing-library/react'
import '@testing-library/jest-dom'

import {wrapIntl} from 'src/testUtils'
import propsRegistry from 'src/properties'

import PropertyMenu from './propertyMenu'

describe('widgets/PropertyMenu', () => {
    beforeEach(() => {
        // Quick fix to disregard console error when unmounting a component
        console.error = jest.fn()
        document.execCommand = jest.fn()
    })

    test('should display the type of property', () => {
        const callback = jest.fn()
        const component = wrapIntl(
            <PropertyMenu
                propertyId={'id'}
                propertyName={'email of a person'}
                propertyType={propsRegistry.get('email')}
                onTypeAndNameChanged={callback}
                onDelete={callback}
            />,
        )
        const {getByText} = render(component)
        expect(getByText('Type: Email')).toBeVisible()
    })

    test('handles delete event', () => {
        const callback = jest.fn()
        const component = wrapIntl(
            <PropertyMenu
                propertyId={'id'}
                propertyName={'email of a person'}
                propertyType={propsRegistry.get('email')}
                onTypeAndNameChanged={callback}
                onDelete={callback}
            />,
        )
        const {getByText} = render(component)
        fireEvent.click(getByText(/delete/i))
        expect(callback).toHaveBeenCalledWith('id')
    })

    test('handles name change event', () => {
        const callback = jest.fn()
        const component = wrapIntl(
            <PropertyMenu
                propertyId={'id'}
                propertyName={'test-property'}
                propertyType={propsRegistry.get('text')}
                onTypeAndNameChanged={callback}
                onDelete={callback}
            />,
        )
        const {getByDisplayValue} = render(component)
        const input = getByDisplayValue(/test-property/i)
        fireEvent.change(input, {target: {value: 'changed name'}})
        fireEvent.blur(input)
        expect(callback).toHaveBeenCalledWith(propsRegistry.get('text'), 'changed name')
    })

    test('handles type change event', async () => {
        const callback = jest.fn()
        const component = wrapIntl(
            <PropertyMenu
                propertyId={'id'}
                propertyName={'test-property'}
                propertyType={propsRegistry.get('text')}
                onTypeAndNameChanged={callback}
                onDelete={callback}
            />,
        )
        const {getByText} = render(component)
        const menuOpen = getByText(/Type: Text/i)
        fireEvent.click(menuOpen)
        fireEvent.click(getByText('Select'))
        setTimeout(() => expect(callback).toHaveBeenCalledWith('select', 'test-property'), 2000)
    })

    test('handles name and type change event', () => {
        const callback = jest.fn()
        const component = wrapIntl(
            <PropertyMenu
                propertyId={'id'}
                propertyName={'test-property'}
                propertyType={propsRegistry.get('text')}
                onTypeAndNameChanged={callback}
                onDelete={callback}
            />,
        )
        const {getByDisplayValue, getByText} = render(component)
        const input = getByDisplayValue(/test-property/i)
        fireEvent.change(input, {target: {value: 'changed name'}})

        const menuOpen = getByText(/Type: Text/i)
        fireEvent.click(menuOpen)
        fireEvent.click(getByText('Select'))
        setTimeout(() => expect(callback).toHaveBeenCalledWith('select', 'changed name'), 2000)
    })

    test('should match snapshot', () => {
        const callback = jest.fn()
        const component = wrapIntl(
            <PropertyMenu
                propertyId={'id'}
                propertyName={'test-property'}
                propertyType={propsRegistry.get('text')}
                onTypeAndNameChanged={callback}
                onDelete={callback}
            />,
        )
        const {container, getByText} = render(component)
        const menuOpen = getByText(/Type: Text/i)
        fireEvent.click(menuOpen)
        expect(container).toMatchSnapshot()
    })
})
