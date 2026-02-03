// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {keyframes} from 'styled-components';

const skeletonFade = keyframes`
    0% {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
    50% {
        background-color: rgba(var(--center-channel-color-rgb), 0.16);
    }
    100% {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const BaseLoader = styled.div`
    animation-duration: 1500ms;
    animation-iteration-count: infinite;
    animation-name: ${skeletonFade};
    animation-timing-function: ease-in-out;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
`;

export interface CircleSkeletonLoaderProps {
    size: string | number;
}

/**
 * CircleSkeletonLoader is a component that renders a filled circle with a loading animation.
 * It is used to indicate that the content is loading.
 * @param props.size - The size of the circle. When in number, it is treated as pixels.
 * @example
 * <CircleSkeletonLoader size={20}/>
 * <CircleSkeletonLoader size="50%"/>
 */
export const CircleSkeletonLoader = styled(BaseLoader)<CircleSkeletonLoaderProps>`
    display: block;
    border-radius: 50%;
    height: ${(props) => getCorrectSizeDimension(props.size)};
    width: ${(props) => getCorrectSizeDimension(props.size)};
`;

export interface RectangleSkeletonLoaderProps {
    height: string | number;
    width?: string | number;
    borderRadius?: number;
    margin?: string;
    flex?: string;
}

/**
 * RectangleSkeletonLoader is a component that renders a filled rectangle with a loading animation.
 * It is used to indicate that the content is loading.
 * @param props.height - The height of the rectangle eg. 20, "20em", "20%". When in number, it is treated as pixels.
 * @param props.width - The width of the rectangle eg. 30, '100%'. When in number, it is treated as pixels.
 * @param props.borderRadius - The border radius of the rectangle eg. 4
 * @param props.margin - The margin of the rectangle eg. '0 10px', '10px 0 0 10px'
 * @param props.flex - The flex short hand of flex grow, shrink, basis of the rectangle, under flex parent css eg. '1 1 auto'
 * @default
 * width: 100% , borderRadius: 8px
 * @example
 * <RectangleSkeletonLoader height='100px' />
 * <RectangleSkeletonLoader height={40} width={100} borderRadius={4} margin='0 10px 0 0' flex='1' />
 */
export const RectangleSkeletonLoader = styled(BaseLoader)<RectangleSkeletonLoaderProps>`
    height: ${(props) => getCorrectSizeDimension(props.height)};
    width: ${(props) => getCorrectSizeDimension(props.width, '100%')};
    border-radius: ${(props) => props?.borderRadius ?? 8}px;
    margin: ${(props) => props?.margin ?? null};
    flex: ${(props) => props?.flex ?? null};
`;

function getCorrectSizeDimension(size: number | string | undefined, fallback: string | null = null) {
    if (size) {
        return (typeof size === 'string') ? size : `${size}px`;
    }

    return fallback;
}
