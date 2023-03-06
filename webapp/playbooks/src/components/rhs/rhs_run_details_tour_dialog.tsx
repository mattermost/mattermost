// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import GenericModal, {DefaultFooterContainer} from 'src/components/widgets/generic_modal';

const ID = 'playbooks_rhs_run_details_tour';

export const makeRhsRunDetailsTourDialog = (props: Props) => ({
    modalId: ID,
    dialogType: RhsRunDetailsTourDialog,
    dialogProps: props,
});

type Props = {
    onDismiss: () => void;
    onConfirm: () => void;
} & Partial<ComponentProps<typeof GenericModal>>;

const RhsRunDetailsTourDialog = ({onDismiss, onConfirm, ...modalProps}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <DialogModal
            id={ID}
            confirmButtonText={formatMessage({defaultMessage: 'Take a quick tour'})}
            cancelButtonText={formatMessage({defaultMessage: 'Let me explore for myself'})}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
            handleConfirm={onConfirm}
            handleCancel={onDismiss}
            onHide={onDismiss}
            components={{FooterContainer: Footer}}
            {...modalProps}
        >
            <Graphic>
                <ChecklistIllustration/>
            </Graphic>
            <Title>
                {formatMessage({defaultMessage: 'We’ve auto-created your run'})}
            </Title>
            <Desc>
                {formatMessage({defaultMessage: 'This lets you experience a sample playbook first before investing time to create your own. '})}
            </Desc>
        </DialogModal>
    );
};

const DialogModal = styled(GenericModal)`
    width: 512px;
`;

const Graphic = styled.div`
    display: flex;
    justify-content: center;
    margin-top: 15px;
`;

const Title = styled.h1`
    font-family: Metropolis;
    font-size: 22px;
    line-height: 28px;

    text-align: center;
    color: var(--center-channel-color);
`;

const Desc = styled.div`
    font-size: 14px;
    text-align: center;

    padding: 0 16px;
    margin: 0;
    margin-top: 8px;
    margin-bottom: 12px;
`;

const Footer = styled(DefaultFooterContainer)`
    align-items: center;
    margin-bottom: 24px;
`;
const ChecklistIllustration = () => {
    return (
        <svg
            width='156'
            height='156'
            viewBox='0 0 156 156'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
        >
            <path
                d='M84.0067 129.324C81.7007 132.853 76.4935 133.362 72.4446 130.504L26.7266 98.3063C25.2347 97.2997 24.1891 95.7559 23.8079 93.9969C23.4267 92.238 23.7393 90.3998 24.6805 88.8657L64.8989 27.4258C66.0084 25.915 67.6 24.8278 69.4107 24.3436C71.2215 23.8594 73.1433 24.0072 74.8587 24.7625L126.758 47.5954C131.349 49.62 133.254 54.0913 130.97 57.6748L84.0067 129.324Z'
                fill='#FFBC1F'
            />
            <path
                d='M76.7318 125.145L29.6064 92.9257L71.059 29.6128L123.576 53.5933L76.7318 125.145Z'
                fill='white'
            />
            <path
                d='M106.568 49.1003C106.164 49.6073 105.598 49.9596 104.965 50.0977C104.332 50.2357 103.67 50.1511 103.092 49.858L83.2701 40.5474C83.0135 40.4538 82.781 40.3039 82.5899 40.1087C82.3987 39.9136 82.2537 39.6781 82.1655 39.4195C82.0772 39.161 82.048 38.886 82.0799 38.6146C82.1118 38.3433 82.2041 38.0826 82.3499 37.8516L85.4569 33.0988C85.824 32.6126 86.3472 32.2675 86.9386 32.1216C87.5301 31.9757 88.1537 32.0379 88.7047 32.2976L108.787 41.2186C109.066 41.3079 109.32 41.4589 109.533 41.6603C109.745 41.8616 109.909 42.1082 110.013 42.3817C110.117 42.6552 110.158 42.9486 110.134 43.2402C110.109 43.5318 110.018 43.814 109.869 44.0659L106.568 49.1003Z'
                fill='#8D93A5'
            />
            <path
                d='M102.779 42.9291L90.0039 37.1261L93.1543 32.3084C93.5285 31.8314 94.0508 31.4926 94.639 31.3456C95.2271 31.1986 95.8475 31.2517 96.4021 31.4964L104.9 35.1774C105.176 35.2617 105.429 35.4075 105.641 35.6039C105.852 35.8003 106.016 36.042 106.12 36.311C106.224 36.58 106.266 36.8691 106.243 37.1566C106.219 37.4441 106.13 37.7224 105.983 37.9706L102.779 42.9291Z'
                fill='#2D3039'
            />
            <path
                d='M103.71 69.0316L77.1973 55.4228L78.583 53.3008L105.193 66.7688L103.71 69.0316Z'
                fill='#3DB887'
            />
            <path
                d='M68.8396 54.0369C68.7776 54.0771 68.7073 54.1027 68.6339 54.1117C68.5606 54.1207 68.4861 54.1129 68.4163 54.0889C68.3464 54.0649 68.2829 54.0254 68.2305 53.9732C68.1782 53.921 68.1385 53.8576 68.1142 53.7878L66.4903 48.9809C66.4694 48.9089 66.4643 48.8331 66.4755 48.7589C66.4866 48.6847 66.5136 48.6138 66.5548 48.551C66.5959 48.4883 66.6502 48.4352 66.7138 48.3954C66.7774 48.3556 66.8489 48.3301 66.9233 48.3205L67.5404 48.1906C67.7009 48.1568 67.8681 48.1793 68.014 48.2542C68.1599 48.3291 68.2755 48.4519 68.3415 48.602L69.2077 51.1138C69.2305 51.1833 69.2691 51.2466 69.3204 51.2988C69.3717 51.351 69.4342 51.3907 69.5034 51.4147C69.5725 51.4388 69.6462 51.4467 69.7188 51.4377C69.7915 51.4287 69.861 51.403 69.9221 51.3627L74.8371 48.5912C74.9898 48.5138 75.1637 48.4889 75.3319 48.5202C75.5002 48.5515 75.6535 48.6374 75.7682 48.7644L76.1579 49.23C76.2096 49.2865 76.2476 49.3542 76.2688 49.4279C76.2901 49.5015 76.2941 49.5791 76.2805 49.6545C76.2668 49.73 76.236 49.8013 76.1903 49.8628C76.1447 49.9244 76.0854 49.9745 76.0171 50.0094L68.8396 54.0369Z'
                fill='#3DB887'
            />
            <path
                d='M95.038 82.2727L69.0449 67.8735L70.4415 65.7407L96.5211 80.0099L95.038 82.2727Z'
                fill='#BABEC9'
            />
            <path
                d='M64.0652 68.3713L56.4004 64.0624L60.8174 57.2959L68.5796 61.4749L64.0652 68.3713Z'
                fill='#BABEC9'
            />
            <path
                d='M86.3669 95.5241L60.9043 80.313L62.29 78.1802L87.8501 93.2614L86.3669 95.5241Z'
                fill='#BABEC9'
            />
            <path
                d='M55.9898 80.7136L48.4766 76.1557L52.9044 69.3892L60.515 73.8172L55.9898 80.7136Z'
                fill='#BABEC9'
            />
            <path
                d='M77.6948 108.765L52.7627 92.7523L54.1484 90.6304L79.178 106.502L77.6948 108.765Z'
                fill='#BABEC9'
            />
            <path
                d='M47.9134 93.0445L40.5518 88.2484L44.9904 81.4927L52.4386 86.148L47.9134 93.0445Z'
                fill='#BABEC9'
            />
        </svg>
    );
};

export default RhsRunDetailsTourDialog;
