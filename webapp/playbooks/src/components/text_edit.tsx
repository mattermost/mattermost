import React, {useState} from 'react';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';

import {useUpdateEffect} from 'react-use';

import {resolve, useUniqueId} from 'src/utils';

import {CancelSaveButtons, CancelSaveContainer} from './checklist_item/inputs';
import {ButtonIcon} from './assets/buttons';
import Tooltip from './widgets/tooltip';

interface TextEditProps {
    value: string;
    onSave: (value: string) => void;
    children: React.ReactNode | ((edit: () => void) => React.ReactNode);
    placeholder?: string;
    className?: string;
    noBorder?: boolean;
    disabled?: boolean;

    editStyles?: ReturnType<typeof css>;
}

const TextEdit = (props: TextEditProps) => {
    const {formatMessage} = useIntl();

    const id = useUniqueId('editabletext-markdown-textbox');
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(props.value);

    useUpdateEffect(() => {
        setValue(props.value);
    }, [props.value]);

    const save = () => {
        setIsEditing(false);
        props.onSave(value);
    };

    const cancel = () => {
        setIsEditing(false);
        setValue(props.value);
    };

    if (isEditing) {
        return (
            <Container className={props.className}>
                <EditableTextInput
                    data-testid={'rendered-editable-text'}
                    value={value}
                    placeholder={props.placeholder}
                    onChange={(e) => {
                        setValue(e.target.value);
                    }}
                    autoFocus={true}
                    disabled={props.disabled}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            save();
                        } else if (e.key === 'Escape') {
                            cancel();
                        }
                    }}
                />
                <CancelSaveButtons
                    onCancel={cancel}
                    onSave={save}
                />
            </Container>
        );
    }

    return (
        <Container className={props.className}>
            {!isEditing && !props.children && (
                <HoverMenuContainer>
                    <Tooltip
                        id={`${id}-tooltip`}
                        shouldUpdatePosition={true}
                        content={formatMessage({defaultMessage: 'Edit'})}
                    >
                        <ButtonIcon
                            data-testid='hover-menu-edit-button'
                            className={'icon-pencil-outline icon-16 btn-icon'}
                            onClick={() => setIsEditing(true)}
                        />
                    </Tooltip>
                </HoverMenuContainer>
            )}
            {resolve(props.children, () => setIsEditing(true)) ?? (
                <RenderedText data-testid='rendered-text'>
                    {value}
                </RenderedText>
            )}
        </Container>
    );
};

const HoverMenuContainer = styled.div`
    display: flex;
    align-items: center;
    padding: 0px 8px;
    position: absolute;
    height: 32px;
    right: 2px;
    top: 8px;
    z-index: 1;
`;

const commonTextStyle = css`
    display: block;
    align-items: center;
    border-radius: var(--markdown-textbox-radius, 4px);
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    padding: var(--markdown-textbox-padding, 12px 30px 12px 16px);

    :hover {
        cursor: text;
    }

    p {
        white-space: pre-wrap;
    }
`;

const Container = styled.div`
    position: relative;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    border-radius: var(--markdown-textbox-radius, 4px);

    ${CancelSaveContainer} {
        padding: 8px 0;
    }

    ${HoverMenuContainer} {
        opacity: 0
    }
    &:hover,
    &:focus-within {
        ${HoverMenuContainer} {
            opacity: 1;
        }
    }
`;

const EditableTextInput = styled.input`
    background-color: var(--center-channel-bg);
`;

export const RenderedText = styled.span`
    ${commonTextStyle}

    p:last-child {
        margin-bottom: 0;
    }
`;

export default styled(TextEdit)`
    ${({editStyles}) => editStyles};
`;
