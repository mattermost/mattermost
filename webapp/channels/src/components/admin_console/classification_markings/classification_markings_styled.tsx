// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import {SectionContent} from '../system_properties/controls';

export const InformationNoticeWrapper = styled.div`
    margin-bottom: 16px;

    h4 {
        margin: 0;
    }
`;

export const PresetDropdownWrapper = styled.div`
    max-width: 500px;

    > .DropdownInput.Input_container {
        margin-top: 0;
    }

    fieldset.Input_fieldset.classificationPresetDropdownFieldset {
        padding: 0;
        border: none;
        box-shadow: none;

        &:hover,
        &:focus-within {
            border: none;
            box-shadow: none;
        }
    }

    .Input_wrapper {
        padding: 0;
        margin: 0;
    }

    .DropdownInput__indicatorsContainer {
        margin-right: 0;
    }

    .DropdownInput__indicatorsContainer .icon-chevron-down {
        display: flex;
        width: 16px;
        height: 16px;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        line-height: 16px;

        &::before {
            font-size: 16px;
            line-height: 16px;
        }
    }
`;

export const ClassificationLevelsSectionContent = styled(SectionContent).attrs({
    $compact: true,
})`
    &&& {
        padding: 0;
        padding-bottom: 16px;
    }
`;

export const AddLevelButtonRow = styled.div`
    margin-top: 16px;
    margin-left: 16px;
`;

export const AddLevelButton = styled.button.attrs({
    type: 'button',
    className: 'btn btn-tertiary',
})`
    && {
        padding-inline: 16px;
    }
`;

export const TableWrapper = styled.div`
    table.adminConsoleListTable {
        td, th {
            &:after, &:before {
                display: none;
            }
        }

        thead {
            border-top: none;
            border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
            tr {
                th:first-child {
                    padding-inline-start: 36px;
                }

                th.pinned {
                    background: rgba(var(--center-channel-color-rgb), 0.04);
                    padding-block-end: 8px;
                    padding-block-start: 8px;
                }
            }
        }

        tbody {
            tr {
                border-top: none;
                border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
                border-bottom-color: rgba(var(--center-channel-color-rgb), 0.08) !important;

                &:focus-within {
                    position: relative;
                    z-index: 30;
                }

                td {
                    padding-block-end: 0;
                    padding-block-start: 0;
                    vertical-align: middle;

                    &:first-child {
                        padding-inline-start: 36px;

                        .form-control {
                            padding-inline-start: 0;
                        }
                    }

                    &:last-child {
                        padding-inline-end: 12px;
                    }
                    &.pinned {
                        background: none;
                    }

                    &.color {
                        overflow: visible;
                    }
                }
            }
        }

        .dragHandle {
            left: 12px;
        }

        tfoot {
            border-top: none;
        }
    }

    .adminConsoleListTableContainer {
        overflow: visible;
    }
`;

export const ColHeaderLeft = styled.div`
    display: inline-block;
`;

export const ColorCellWrapper = styled.div`
    .ClassificationColorInput {
        max-width: 200px;
    }
`;

export const ReadOnlyColor = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

export const ColorSwatch = styled.span`
    display: inline-block;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    flex-shrink: 0;
`;

export const RankCell = styled.div`
    padding: 8px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

export const ActionsCell = styled.div`
    text-align: right;
`;

export const DeleteButton = styled.button.attrs({className: 'btn btn-sm btn-transparent'})`
    &:hover {
        background: rgba(var(--error-text-color-rgb, 210, 75, 78), 0.08);
    }
`;
