// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import LibAccordion from 'components/common/accordion/accordion';

import Chip from './chip';

const Accordion = styled(LibAccordion)`
    &.Accordion  {
        .accordion-card {
            margin-bottom: 8px;
            border-radius: 4px;
            color: var(--center-channel-color);

            .accordion-card-header {
                padding: 14.5px 0px 14.5px 16px;
                font-weight: 600;
                font-size: 14px;
                line-height: 20px;
                color: var(--center-channel-color);
                align-items: center;
                border-radius: 4px 4px 0 0;

                &__extraContent {
                    margin-left: 2px;
                }

                &__chevron {
                    max-width: initial;
                    font-size: 18px;
                    line-height: 20px;
                    font-weight: 600;
                }
            }

            .accordion-card-container__content {
                padding: 4px 16px 16px 16px;
                font-size: 12px;
                line-height: 16px;

                ul {
                    list-style: disc;
                }
            }

            &.active {
                border: 1px solid var(--denim-button-bg);

                .accordion-card-header {
                    color: var(--denim-button-bg);
                    padding-bottom: 4px;
                }

                ${Chip} {
                    background: rgba(var(--denim-button-bg-rgb), 0.08);
                    color: var(--denim-button-bg);
                }
            }
        }
    }
`;

export default Accordion;
