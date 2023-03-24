
import React, {useRef, useState} from 'react';
import {useUpdateEffect} from 'react-use';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';
import {ClientError} from '@mattermost/client';

import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';

interface CheckBoxButtonProps {
    onChange: (item: ChecklistItemState) => undefined | Promise<void | {error: ClientError}>;
    item: ChecklistItem;
    readOnly: boolean;//when true, component can receive events, but can't be modified.
    disabled?: boolean;
    onReadOnlyInteract?: () => void;
}

export const CheckBoxButton = (props: CheckBoxButtonProps) => {
    const [isChecked, setIsChecked] = useState(props.item.state === ChecklistItemState.Closed);

    useUpdateEffect(() => {
        setIsChecked(props.item.state === ChecklistItemState.Closed);
    }, [props.item.state]);

    // handleOnChange optimistic update approach: first do UI change, then
    // call to server and finally revert UI state if there's error
    //
    // There are two main reasons why we do this:
    // 1 - Happy path: avoid waiting 300ms to see checkbox update in the UI
    // 2 - Websocket failure: we'll still mark the checkbox correctly
    //     Additionally, we prevent the user from clicking multiple times
    //     and leaving the item in an unknown state
    const handleOnChange = async () => {
        if (props.readOnly) {
            props.onReadOnlyInteract?.();
            return;
        }
        const newValue = isChecked ? ChecklistItemState.Open : ChecklistItemState.Closed;
        setIsChecked(!isChecked);
        const res = await props.onChange(newValue);
        if (res?.error) {
            setIsChecked(isChecked);
        }
    };

    return (
        <ChecklistItemInput
            className='checkbox'
            type='checkbox'
            checked={isChecked}
            onChange={handleOnChange}
            disabled={props.disabled}
            readOnly={props.readOnly}
        />);
};

const ChecklistItemInput = styled.input<{readOnly: boolean}>`
    :disabled:hover {
        cursor: default;
    }

    ${({readOnly}) => readOnly && css`
        opacity: 0.38;
        &&:hover {
            cursor: default;
        }
    `}
`;

export const CollapsibleChecklistItemDescription = (props: {expanded: boolean, children: React.ReactNode}) => {
    const ref = useRef<HTMLDivElement | null>(null);

    let computedHeight = 'auto';
    if (ref?.current) {
        computedHeight = ref.current.scrollHeight + 'px';
    }

    return (
        <ChecklistItemDescription
            ref={ref}
            height={props.expanded ? computedHeight : '0'}
        >
            {props.children}
        </ChecklistItemDescription>
    );
};

const ChecklistItemDescription = styled.div<{height: string}>`
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    margin-left: 36px;
    padding-right: 8px;

    // Fix default markdown styling in the paragraphs
    p {
        :last-child {
            margin-bottom: 0;
        }

        white-space: pre-wrap;
    }
    height: ${({height}) => height};

    transition: height 0.2s ease-in-out;
    overflow: hidden;
`;

export const CancelSaveButtons = (props: {onCancel: () => void, onSave: () => void}) => {
    const {formatMessage} = useIntl();

    return (
        <CancelSaveContainer>
            <CancelButton
                onClick={props.onCancel}
            >
                {formatMessage({defaultMessage: 'Cancel'})}
            </CancelButton>
            <SaveButton
                onClick={props.onSave}
                data-testid='checklist-item-save-button'
            >
                {formatMessage({defaultMessage: 'Save'})}
            </SaveButton>
        </CancelSaveContainer>
    );
};

export const CancelSaveContainer = styled.div`
    text-align: right;
    padding: 8px;
    z-index: 2;
    white-space: nowrap;
`;

const CancelButton = styled(TertiaryButton)`
    height: 32px;
    padding: 10px 16px;
    margin-left: 8px;
    border-radius: 4px;
    font-size: 12px;
`;

const SaveButton = styled(PrimaryButton)`
    height: 32px;
    padding: 10px 16px;
    margin-left: 8px;
    border-radius: 4px;
    font-size: 12px;
`;
