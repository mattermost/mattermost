'use client';

import type { LinkProps } from '@mui/material/Link';

import { mergeClasses } from 'minimal-shared/utils';

import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = true,
  ...other
}: LogoProps) {
  // const theme = useTheme();

  // const uniqueId = useId();
  const progressnetColor = '#001b4c';
  const progressnetBlack = '#0065f7';

  /*
    * OR using local (public folder)
    *
    const singleLogo = (
      <img
        alt="Single logo"
        src={`${CONFIG.assetsDir}/logo/logo-single.svg`}
        width="100%"
        height="100%"
      />
    );

    const fullLogo = (
      <img
        alt="Full logo"
        src={`${CONFIG.assetsDir}/logo/logo-full.svg`}
        width="100%"
        height="100%"
      />
    );
    *
    */

  const singleLogo = (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 112 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="a" transform="translate(-34.843 -50)" fill={progressnetColor}>
        <polygon
          id="b"
          points="131.61 126.4 131.68 126.36 131.69 73.588 90.862 50.011 90.843 50 90.843 61.406 121.81 79.289 121.8 120.65 90.843 138.52 90.843 149.93"
          fill={progressnetColor}
          data-name="logoMark &amp;lt;PathItem&amp;gt;"
        />

        <polygon
          points="59.883 132.06 59.878 90.692 90.843 72.81 90.843 61.403 90.824 61.414 50 84.992 50.006 137.76 50.075 137.8 90.843 161.33 90.843 149.92"
          fill={progressnetColor}
          data-name="logoMark &amp;lt;PathItem&amp;gt;"
        />
      </g>
    </svg>
  );

  const fullLogo = (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 360 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="logoMark">
        <polygon
          id="logoMark_PathItem_"
          data-name="logoMark &amp;lt;PathItem&amp;gt;"
          points="90.8619 50.0108 90.8432 50 90.8432 61.4062 121.8088 79.2892 121.8034 120.6519 90.8432 138.5209 90.8432 149.9262 131.6119 126.3956 131.6802 126.3563 131.6864 73.5883 90.8619 50.0108"
          style={{ fill: '#0065f7' }}
        />

        <polygon
          id="logoMark_PathItem_-2"
          data-name="logoMark &amp;lt;PathItem&amp;gt;"
          points="90.8432 61.4033 90.8245 61.414 50 84.9916 50.0063 137.7596 50.0746 137.7989 90.8432 161.3295 90.8432 149.9242 59.883 132.0551 59.8777 90.6925 90.8432 72.8095 90.8432 61.4033"
          style={{ fill: '#0065f7' }}
        />
      </g>
      <g id="type">
        <path
          id="type_CompoundPathItem_"
          data-name="type &amp;lt;CompoundPathItem&amp;gt;"
          d="m488.8748,67.5932h11.2249l23.0332,39.4078v-39.4078h9.9131v56.3899h-10.5696l-23.6884-40.5733v40.5733h-9.9131v-56.3899Z"
          style={{ fill: progressnetBlack }}
        />

        <polygon
          id="type_PathItem_"
          data-name="type &amp;lt;PathItem&amp;gt;"
          points="599.8835 88.3706 608.5554 79.5513 599.8835 79.5513 599.8835 67.5932 589.9691 74.3725 589.9691 79.5513 582.6808 79.5513 582.6808 88.3706 589.9691 88.3706 589.9691 114.1967 589.969 114.1967 589.969 123.9832 589.9691 123.9832 589.9691 123.9832 599.8835 123.9832 599.8835 123.9727 608.5554 123.9636 608.5554 114.1967 599.8835 114.1967 599.8835 88.3706 599.8835 88.3706"
          style={{ fill: progressnetBlack }}
        />

        <path
          id="type_CompoundPathItem_-2"
          data-name="type &amp;lt;CompoundPathItem&amp;gt;"
          d="m559.722,79.5954c-12.4648,0-22.1587,9.8387-22.1587,22.3035,0,12.3173,9.1117,22.0843,22.5215,22.0843,9.6221,0,16.1821-4.5917,19.8993-11.5159l-.0746-.043h-11.4657c-2.1904,1.8305-5.0364,2.8858-8.3589,2.8858-6.996,0-11.7339-4.0083-13.1201-10.058h34.6953v-3.7186c0-12.6084-9.2566-21.9381-21.9381-21.9381Zm-12.2456,17.4195c1.749-5.2483,6.3407-8.7463,12.2456-8.7463,6.1215,0,10.4952,2.9889,11.9532,8.7463h-24.1987Z"
          style={{ fill: progressnetBlack }}
        />
        <path
          id="type_CompoundPathItem_-3"
          data-name="type &amp;lt;CompoundPathItem&amp;gt;"
          d="m400.3563,113.6341l9.1104-4.3738c2.0414,4.0083,5.6124,6.1959,10.2773,6.1959,4.8841,0,7.2896-2.3324,7.2896-5.1752,0-3.1351-4.7379-3.7173-9.9862-4.8841-7.2883-1.531-14.9421-3.8634-14.9421-12.8277,0-6.8524,6.6331-13.0469,16.7642-13.0469,8.6745,0,14.1407,3.3518,17.4207,8.8193l-8.3821,4.2276c-1.749-2.9889-4.9559-4.8841-9.0386-4.8841-4.6648,0-6.8511,2.1862-6.8511,4.5918,0,2.8428,3.3531,3.5724,9.7669,4.9572,6.9973,1.3848,15.0152,3.8621,15.0152,12.8277,0,5.9766-5.3201,13.9214-17.4925,13.9214-9.549,0-15.5256-3.6442-18.9517-10.3491Z"
          style={{ fill: progressnetBlack }}
        />
        <path
          id="type_CompoundPathItem_-4"
          data-name="type &amp;lt;CompoundPathItem&amp;gt;"
          d="m438.8393,113.6341l9.1117-4.3738c2.0414,4.0083,5.6124,6.1959,10.2773,6.1959,4.8828,0,7.2896-2.3324,7.2896-5.1752,0-3.1351-4.7379-3.7173-9.9862-4.8841-7.2896-1.531-14.9421-3.8634-14.9421-12.8277,0-6.8524,6.6318-13.0469,16.7642-13.0469,8.6732,0,14.1394,3.3518,17.4207,8.8193l-8.3821,4.2276c-1.749-2.9889-4.9572-4.8841-9.0386-4.8841-4.6648,0-6.8511,2.1862-6.8511,4.5918,0,2.8428,3.3518,3.5724,9.7656,4.9572,6.9986,1.3848,15.0152,3.8621,15.0152,12.8277,0,5.9766-5.3201,13.9214-17.4925,13.9214-9.549,0-15.5242-3.6442-18.9517-10.3491Z"
          style={{ fill: progressnetBlack }}
        />

        <polygon
          id="type_PathItem_-2"
          data-name="type &amp;lt;PathItem&amp;gt;"
          points="216.4186 79.5513 206.6517 79.5513 206.6517 79.5513 206.6517 88.3914 206.6517 88.3914 206.6517 123.9832 216.4381 123.9832 216.4253 93.2523 211.5449 88.3719 228.8547 88.3719 228.8547 79.5513 216.4186 79.5513"
          style={{ fill: progressnetBlack }}
        />

        <polygon
          id="type_PathItem_-3"
          data-name="type &amp;lt;PathItem&amp;gt;"
          points="341.4129 79.5513 331.646 79.5513 331.6459 79.5513 331.6459 88.3914 331.646 88.3914 331.646 123.9832 341.4324 123.9832 341.4196 93.2523 336.5392 88.3719 353.8489 88.3719 353.8489 79.5513 341.4129 79.5513"
          style={{ fill: progressnetBlack }}
        />

        <path
          id="type_CompoundPathItem_-5"
          data-name="type &amp;lt;CompoundPathItem&amp;gt;"
          d="m376.9596,79.5954c-12.4642,0-22.158,9.8387-22.158,22.3035,0,12.3173,9.1111,22.0843,22.5222,22.0843,9.6214,0,16.1814-4.5917,19.8986-11.5159l-.0746-.043h-11.4661c-2.1897,1.8305-5.0349,2.8858-8.3579,2.8858-6.9973,0-11.7346-4.0083-13.1201-10.058h34.6959v-3.7186c0-12.6084-9.2579-21.9381-21.94-21.9381Zm-12.2456,17.4195c1.7497-5.2483,6.3414-8.7463,12.2456-8.7463,6.1221,0,10.4959,2.9889,11.9538,8.7463h-24.1994Z"
          style={{ fill: progressnetBlack }}
        />
        <path
          id="type_CompoundPathItem_-6"
          data-name="type &amp;lt;CompoundPathItem&amp;gt;"
          d="m181.9014,67.5932h-18.2221v56.3899h9.9125v-13.5405l-4.8745-4.8745h4.8804v.0003h8.2307c11.0793,0,19.2428-8.4552,19.2428-19.0235,0-10.4966-8.1635-18.9518-19.1697-18.9518Zm-.729,28.7918h-7.5807v-19.607h7.5807c5.8311,0,9.9125,4.2994,9.9125,9.7669s-4.0814,9.8401-9.9125,9.8401Z"
          style={{ fill: progressnetBlack }}
        />
        <path
          id="type_CompoundPathItem_-7"
          data-name="type &amp;lt;CompoundPathItem&amp;gt;"
          d="m314.9142,117.3791c-3.1345,4.0827-8.1635,6.56-13.9214,6.56-10.2773,0-20.9918-8.1628-20.9918-22.1574,0-14.1407,10.3497-22.2305,21.1373-22.2305,5.6124,0,10.569,2.4773,13.7028,6.3407v-6.3401h9.84v42.4202c0,11.9532-7.6531,21.7201-22.0118,21.7201-11.0793,0-18.0035-5.1752-21.8669-12.2455l8.7469-5.3201c3.1338,5.7573,6.4869,8.527,13.2656,8.527,7.4345,0,12.0994-5.8304,12.0994-12.3173v-4.9572Zm.4372-15.7435c0-7.2883-5.3938-13.12-12.7552-13.12-7.289,0-12.9014,5.7586-12.9014,13.12,0,7.4345,5.6124,13.2662,12.9014,13.2662,7.3614,0,12.7552-5.9048,12.7552-13.2662Z"
          style={{ fill: progressnetBlack }}
        />
        <path
          id="type_CompoundPathItem_-8"
          data-name="type &amp;lt;CompoundPathItem&amp;gt;"
          d="m253.5135,123.9463c-2.4039,0-4.8073-.6189-6.9518-1.8577l-7.1741-4.1424c-4.2871-2.4749-6.9509-7.088-6.9509-12.0386v-8.2848c0-4.9507,2.6638-9.5637,6.9509-12.0386l7.1746-4.1424c4.2875-2.4749,9.6142-2.4767,13.9017,0l7.175,4.1424c4.2871,2.4749,6.9509,7.088,6.9509,12.0386v8.2848c0,4.9507-2.6638,9.5637-6.9509,12.0386l-7.175,4.1424c-2.1431,1.2388-4.547,1.8577-6.9504,1.8577Zm-.0004-34.8539c-.7592,0-1.5179.1956-2.1953.5868l-7.1741,4.1415c-1.354.7824-2.1949,2.2391-2.1949,3.8021v8.2848c0,1.563.8409,3.0197,2.1949,3.8021l7.1746,4.1424c1.3536.7824,3.0353.7824,4.3889,0l7.1759-4.1424c1.354-.7824,2.1949-2.2391,2.1949-3.8021v-8.2848c0-1.563-.8409-3.0197-2.1949-3.8021l-7.175-4.1424c-.6766-.3903-1.4357-.5859-2.1949-.5859Z"
          style={{ fill: progressnetBlack }}
        />
      </g>
    </svg>
  );

  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="Logo"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: 40,
          height: 40,
          ...(!isSingle && { width: 102, height: 36 }),
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {isSingle ? singleLogo : fullLogo}
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
