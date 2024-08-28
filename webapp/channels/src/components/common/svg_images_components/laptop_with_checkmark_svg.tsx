// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width?: number;
    height?: number;
}

const Svg = (props: SvgProps) => (
    <svg
        width={props.width?.toString() || '246'}
        height={props.height?.toString() || '182'}
        viewBox='0 0 246 182'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <g>
            <path
                d='M22.286 148.7H223.712C225.194 148.679 226.608 148.06 227.643 146.979C228.679 145.897 229.252 144.442 229.237 142.931V5.73556C229.252 4.22454 228.679 2.76913 227.643 1.68789C226.608 0.606646 225.194 -0.0123308 223.712 -0.0335388H22.286C20.8045 -0.0102258 19.3921 0.609391 18.3571 1.69017C17.322 2.77095 16.7483 4.22517 16.7609 5.73556V142.939C16.7504 144.448 17.325 145.9 18.3599 146.979C19.3947 148.058 20.8058 148.677 22.286 148.7Z'
                fill='#3F4350'
            />
            <path
                d='M0.0664062 168.43C0.0664062 175.26 5.61659 182.089 12.3482 182.089H233.658C240.001 182.089 245.932 175.276 245.932 168.43H0.0664062Z'
                fill='#767D93'
            />
            <path
                d='M225.444 148.7H20.5546L0.0664062 168.43H245.932L225.444 148.7Z'
                fill='#D1D4DB'
            />
            <path
                d='M219.316 150.218H26.6732L19.7959 158.565H226.202L219.316 150.218Z'
                fill='#AFB3C0'
            />
            <path
                d='M144.12 161.6H101.886L98.7158 166.153H147.282L144.12 161.6Z'
                fill='#24262E'
            />
            <rect
                width='188.194'
                height='121.415'
                transform='translate(28.9023 12.8669)'
                fill='white'
            />
            <rect
                x='28.9023'
                y='12.8669'
                width='188'
                height='121'
                fill='#3F4350'
                fillOpacity='0.16'
            />
            <path
                d='M122.999 3.76068C123.6 3.76068 124.186 3.93871 124.686 4.27224C125.185 4.60577 125.574 5.07983 125.804 5.63447C126.033 6.18911 126.093 6.79943 125.976 7.38823C125.859 7.97704 125.57 8.51789 125.146 8.9424C124.721 9.3669 124.18 9.656 123.591 9.77312C123.003 9.89024 122.392 9.8301 121.838 9.60036C121.283 9.37062 120.809 8.98159 120.475 8.48243C120.142 7.98326 119.964 7.3964 119.964 6.79606C119.964 5.99103 120.284 5.21896 120.853 4.64972C121.422 4.08048 122.194 3.76068 122.999 3.76068Z'
                fill='#989DAE'
            />
            <path
                d='M140.487 177.536H104.73C103.496 177.536 100.234 177.536 100.234 172.983H145.006C145.006 177.536 141.649 177.536 140.487 177.536Z'
                fill='#3F4350'
            />
            <path
                d='M156.357 37.0397L111.56 86.3035L98.5584 76.4489H91.3301L111.56 109.295L163.585 37.0397H156.357Z'
                fill='#3DB887'
            />
        </g>
    </svg>
);

export default Svg;