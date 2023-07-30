// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import classNames from 'classnames';
import {
    FloatingFocusManager,
    FloatingPortal,
    autoUpdate,
    offset,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
    flip,
    shift,
} from '@floating-ui/react-dom-interactions';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';
import useTooltip from 'components/common/hooks/useTooltip';

import {PostPriorityMetadata} from '@mattermost/types/posts';

import PostPriorityPicker from './post_priority_picker';

type Props = {
    disabled: boolean;
    settings?: PostPriorityMetadata;
    onApply: (props: PostPriorityMetadata) => void;
    onClose: () => void;
};

function PostPriorityPickerOverlay({
    disabled,
    settings,
    onApply,
    onClose,
}: Props) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const {formatMessage} = useIntl();

    const messagePriority = formatMessage({id: 'shortcuts.msgs.formatting_bar.post_priority', defaultMessage: 'Message priority'});
    const {
        reference: tooltipRef,
        getReferenceProps: getTooltipReferenceProps,
        tooltip,
    } = useTooltip({
        placement: 'top',
        message: messagePriority,
    });

    const handleClose = useCallback(() => {
        setPickerOpen(false);
        onClose();
    }, [onClose]);

    const {
        x: pickerX,
        y: pickerY,
        reference: pickerRef,
        floating: pickerFloating,
        strategy: pickerStrategy,
        context: pickerContext,
    } = useFloating({
        open: pickerOpen,
        onOpenChange: setPickerOpen,
        placement: 'top-start',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset({mainAxis: 4}),
            flip({
                fallbackPlacements: ['top'],
            }),
            shift({
                padding: 16,
            }),
        ],
    });

    const {
        getFloatingProps: getPickerFloatingProps,
        getReferenceProps: getPickerReferenceProps,
    } = useInteractions([
        useClick(pickerContext),
        useDismiss(pickerContext),
        useRole(pickerContext),
    ]);

    return (
        <>
            <div
                ref={tooltipRef}
                {...getTooltipReferenceProps()}
            >
                <IconContainer
                    ref={pickerRef}
                    className={classNames({control: true, active: pickerOpen})}
                    disabled={disabled}
                    type='button'
                    aria-label={messagePriority}
                    {...getPickerReferenceProps()}
                >
                    <AlertCircleOutlineIcon
                        size={18}
                        color='currentColor'
                    />
                </IconContainer>
            </div>
            <FloatingPortal id='root-portal'>
                {pickerOpen && (
                    <FloatingFocusManager
                        context={pickerContext}
                        modal={true}
                        returnFocus={false}
                        initialFocus={-1}
                    >
                        <div
                            ref={pickerFloating}
                            style={{
                                width: 'max-content',
                                position: pickerStrategy,
                                top: pickerY ?? 0,
                                left: pickerX ?? 0,
                                zIndex: 3,
                            }}
                            {...getPickerFloatingProps()}
                        >
                            <PostPriorityPicker
                                settings={settings}
                                onApply={onApply}
                                onClose={handleClose}
                            />
                        </div>
                    </FloatingFocusManager>
                )}
            </FloatingPortal>
            {!pickerOpen && tooltip}
        </>
    );
}

export default memo(PostPriorityPickerOverlay);
