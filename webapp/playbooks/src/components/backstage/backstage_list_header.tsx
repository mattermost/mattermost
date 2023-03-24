import styled, {css} from 'styled-components';

const BackstageListHeader = styled.div<{$edgeless?: boolean}>`
    font-weight: 600;
    padding: 0 1.6rem;
    font-size: 14px;
    line-height: 4rem;
    color: var(--center-channel-color);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-top-color: rgba(var(--center-channel-color-rgb), 0.16);
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;
    ${({$edgeless}) => $edgeless && css`
        border-width: 1px 0;
        border-radius: 0;
    `}
`;

export default BackstageListHeader;
