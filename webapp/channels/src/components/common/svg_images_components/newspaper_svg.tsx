// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {SVGProps} from 'react';

const NewspaperSvg = (props: SVGProps<SVGSVGElement>) => (
    <svg
        width={props.width || 20}
        height={props.height || 20}
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        {...props}
    >
        <path
            d='M15.638 6.163v9.086a.643.643 0 0 1-.206.489.81.81 0 0 1-.5.22h-9.81a.81.81 0 0 0 .5-.22.643.643 0 0 0 .208-.489V3.99h7.662a.228.228 0 0 1 .22.22v.537l.342 1.198h.122v-1.05l1.22 1.05h.024a.229.229 0 0 1 .22.22h-.002Z'
            fill='#fff'
        />
        <path
            d='M15.638 6.163v9.086a.643.643 0 0 1-.206.489.81.81 0 0 1-.5.22h-9.81a.81.81 0 0 0 .5-.22.643.643 0 0 0 .208-.489V3.99h7.662a.228.228 0 0 1 .22.22v.537l.342 1.198h.122v-1.05l1.22 1.05h.024a.229.229 0 0 1 .22.22h-.002Z'
            fill='#E8E9ED'
        />
        <path
            d='M8.148 5.236H7.1V5.04h1.048v.196Zm6.223 3.174H7.1v.22h7.27v-.22Zm0 6.717H7.1v-.22h7.27v.22ZM10.906 11H7.1v-.44h3.806V11Zm.024.635H7.1v.415h3.83v-.415Zm0 1.05H7.1v.44h3.83v-.44Zm0 1.075H7.1v.415h3.83v-.415Zm3.44 0h-2.806v.415h2.806v-.415Z'
            fill='#BABEC9'
        />
        <path
            d='M12.809 5.748a.228.228 0 0 1 .22.22v.855a.252.252 0 0 1-.22.196H7.294a.209.209 0 0 1-.195-.196v-.855a.2.2 0 0 1 .195-.22h5.515ZM7.097 9.73a.172.172 0 0 0 .194.195h3.417a.198.198 0 0 0 .22-.195v-.44a.198.198 0 0 0-.22-.196H7.291a.172.172 0 0 0-.194.196v.44Zm7.271-.44a.201.201 0 0 0-.22-.196h-2.386a.174.174 0 0 0-.195.196v3.615a.198.198 0 0 0 .195.22h2.391a.229.229 0 0 0 .22-.22l-.005-3.615Z'
            fill='#1E325C'
        />
        <path
            d='M15.614 6.066h-1.976v-1.98l1.927 1.907.05.073Z'
            fill='#AFB3C0'
        />
    </svg>
);

export default NewspaperSvg;
