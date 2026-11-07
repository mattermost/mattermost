// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, cloneElement, useState} from 'react';
import styled, {css} from 'styled-components';

import {
    FloatingFocusManager,
    FloatingPortal,
    Placement,
    UseFloatingOptions,
    autoUpdate,
    flip,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
} from '@floating-ui/react';

const FloatingContainer = styled.div<{$styles?: ReturnType<typeof css>}>`
	z-index: 50;
    min-width: 16rem;

    ${({$styles}) => $styles};

	.PlaybookRunProfileButton {
		.Profile {
			background-color: var(--button-bg-08);
		}
	}

    .playbook-react-select__menu-list {
        padding: 0 0 12px;
        border: none;
    }

    .playbook-react-select {
        overflow: hidden;
        max-width: 340px;
        max-height: 100%;
        border: 1px solid var(--center-channel-color-16);
        border-radius: 4px;
        background-color: var(--center-channel-bg);
        box-shadow: 0 8px 24px rgba(0 0 0 / 0.12);
        -webkit-overflow-scrolling: touch;
    }
`;

type DropdownProps = {
    target: JSX.Element;
    children: React.ReactNode;
    placement?: Placement;
    offset?: Parameters<typeof offset>[0];
    flip?: Parameters<typeof flip>[0];
    shift?: Parameters<typeof shift>[0];
    focusManager?: boolean | Omit<ComponentProps<typeof FloatingFocusManager>, 'context' | 'children'>;
    portal?: boolean;
    containerStyles?: ReturnType<typeof css>;
} & ({
    isOpen: boolean;
    onOpenChange: undefined | UseFloatingOptions<HTMLElement>['onOpenChange'];
} | {
    isOpen?: never;
    onOpenChange?: UseFloatingOptions<HTMLElement>['onOpenChange'];
});

const Dropdown = (props: DropdownProps) => {
    const [isOpen, setIsOpen] = useState(props.isOpen);

    const open = props.isOpen ?? isOpen;

    const setOpen: UseFloatingOptions<HTMLElement>['onOpenChange'] = (updatedOpen, event, reason) => {
        setIsOpen(updatedOpen);
        props.onOpenChange?.(updatedOpen, event, reason);
    };

    const {strategy, x, y, refs: {setReference, setFloating}, context} = useFloating<HTMLElement>({
        open,
        onOpenChange: setOpen,
        placement: props.placement ?? 'bottom-start',
        middleware: [offset(props.offset ?? 2), flip(props.flip), shift(props.shift ?? {padding: 2})],
        whileElementsMounted: autoUpdate,
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useClick(context, {enabled: props.isOpen === undefined}),
        useRole(context),
        useDismiss(context),
    ]);

    const MaybePortal = (props.portal ?? true) ? FloatingPortal : React.Fragment; // 🤷

    let content = (
        <FloatingContainer
            {...getFloatingProps({
                ref: setFloating,
                style: {
                    position: strategy,
                    top: y ?? 0,
                    left: x ?? 0,
                },
            })}
            $styles={props.containerStyles}
        >
            {props.children}
        </FloatingContainer>
    );

    if (props.focusManager ?? true) {
        content = (
            <FloatingFocusManager
                {...typeof props.focusManager === 'boolean' ? false : props.focusManager}
                context={context}
            >
                {content}
            </FloatingFocusManager>
        );
    }

    return (
        <>
            {cloneElement(props.target, getReferenceProps({ref: setReference, ...props.target.props}))}
            <MaybePortal>
                {open && content}
            </MaybePortal>
        </>
    );
};

export default Dropdown;
