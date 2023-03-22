import {Link} from 'react-router-dom';
import styled from 'styled-components';

export const RHSTitleContainer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    overflow: visible;
    flex: 1;
    justify-content: flex-start;
`;

export const RHSTitleText = styled.div`
    font-family: Metropolis;
    font-weight: 600;
    font-size: 16px;
    line-height: 32px;
    flex-shrink: 0;


    padding: 0 4px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
`;

export const RHSTitleLink = styled(Link)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;

    &&& {
        color: var(--center-channel-color);
    }

    overflow: hidden;
    text-overflow: ellipsis;

    border-radius: 4px;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        text-decoration: none;
    }

    &:active,
    &--active,
    &--active:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }
`;

export const RHSTitleButton = styled.button`
    display: flex;
    border: none;
    background: none;
    padding: 0px 11px 0 0;
    align-items: center;
`;

export const RHSTitleStyledButtonIcon = styled.i`
    display: flex;
    align-items: center;
    justify-content: center;

    margin-left: 4px;

    width: 18px;
    height: 18px;

    color: rgba(var(--center-channel-color-rgb), 0.48);

    ${RHSTitleText}:hover &,
    ${RHSTitleLink}:hover & {
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;
