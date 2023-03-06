import styled from 'styled-components';

export const CustomPostContainer = styled.div`
    max-width: 640px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    display: flex;
    flex-direction: row;
`;

export const CustomPostContent = styled.div`
    display: flex;
    flex-grow: 1;
    flex-direction: column;
    padding: 12px;
    padding-left: 16px;
`;

export const CustomPostHeader = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
`;

export const CustomPostButtonRow = styled.div`
    display: flex;
    flex-direction: row;
    padding-top: 12px;
`;
