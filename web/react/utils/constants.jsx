// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var keyMirror = require('keymirror');

module.exports = {
  ActionTypes: keyMirror({
    RECIEVED_ERROR: null,

    CLICK_CHANNEL: null,
    CREATE_CHANNEL: null,
    RECIEVED_CHANNELS: null,
    RECIEVED_MORE_CHANNELS: null,
    RECIEVED_CHANNEL_EXTRA_INFO: null,

    RECIEVED_POSTS: null,
    RECIEVED_SEARCH: null,
    RECIEVED_POST_SELECTED: null,
    RECIEVED_MENTION_DATA: null,
    RECIEVED_ADD_MENTION: null,

    RECIEVED_PROFILES: null,
    RECIEVED_ME: null,
    RECIEVED_SESSIONS: null,
    RECIEVED_AUDITS: null,
    RECIEVED_TEAMS: null,
    RECIEVED_STATUSES: null,

    RECIEVED_MSG: null,

    CLICK_TEAM: null,
    RECIEVED_TEAM: null,
  }),

  PayloadSources: keyMirror({
    SERVER_ACTION: null,
    VIEW_ACTION: null
  }),
  CHARACTER_LIMIT: 4000,
  IMAGE_TYPES: ['jpg', 'gif', 'bmp', 'png'],
  AUDIO_TYPES: ['mp3', 'wav', 'wma', 'm4a', 'flac', 'aac'],
  VIDEO_TYPES: ['mp4', 'avi', 'webm', 'mkv', 'wmv', 'mpg', 'mov', 'flv'],
  SPREADSHEET_TYPES: ['ppt', 'pptx', 'csv'],
  EXCEL_TYPES: ['xlsx'],
  WORD_TYPES: ['doc', 'docx'],
  CODE_TYPES: ['css', 'html', 'js', 'php', 'rb'],
  PDF_TYPES: ['pdf'],
  PATCH_TYPES: ['patch'],
  ICON_FROM_TYPE: {'audio': 'audio', 'video': 'video', 'spreadsheet': 'ppt', 'pdf': 'pdf', 'code': 'code' , 'word': 'word' , 'excel': 'excel' , 'patch': 'patch', 'other': 'generic'},
  MAX_DISPLAY_FILES: 5,
  MAX_UPLOAD_FILES: 5,
  MAX_FILE_SIZE: 50000000, // 50 MB
  DEFAULT_CHANNEL: 'town-square',
  POST_CHUNK_SIZE: 60,
  RESERVED_DOMAINS: [
    "www",
    "web",
    "admin",
    "support",
    "notify",
    "test",
    "demo",
    "mail",
    "team",
    "channel",
    "internal",
    "localhost",
    "dockerhost",
    "stag",
    "post",
    "cluster",
    "api",
  ],
  RESERVED_USERNAMES: [
    "valet",
    "all",
    "channel",
  ],
  MONTHS: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  MAX_DMS: 10,
  ONLINE_ICON_SVG: "<svg version='1.1' id='Layer_1' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:cc='http://creativecommons.org/ns#' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:svg='http://www.w3.org/2000/svg' xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd' xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape' sodipodi:docname='TRASH_1_4.svg' inkscape:version='0.48.4 r9939' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='12px' height='12px' viewBox='0 0 12 12' enable-background='new 0 0 12 12' xml:space='preserve'><sodipodi:namedview  inkscape:cy='139.7898' inkscape:cx='26.358185' inkscape:zoom='1.18' showguides='true' showgrid='false' id='namedview6' guidetolerance='10' gridtolerance='10' objecttolerance='10' borderopacity='1' bordercolor='#666666' pagecolor='#ffffff' inkscape:current-layer='Layer_1' inkscape:window-maximized='1' inkscape:window-y='-8' inkscape:window-x='-8' inkscape:window-height='705' inkscape:window-width='1366' inkscape:guide-bbox='true' inkscape:pageshadow='2' inkscape:pageopacity='0'><sodipodi:guide  position='50.036793,85.991376' orientation='1,0' id='guide2986'></sodipodi:guide><sodipodi:guide  position='58.426196,66.216355' orientation='0,1' id='guide3047'></sodipodi:guide></sodipodi:namedview><g><g><path class='online--icon' d='M6,5.487c1.371,0,2.482-1.116,2.482-2.493c0-1.378-1.111-2.495-2.482-2.495S3.518,1.616,3.518,2.994C3.518,4.371,4.629,5.487,6,5.487z M10.452,8.545c-0.101-0.829-0.36-1.968-0.726-2.541C9.475,5.606,8.5,5.5,8.5,5.5S8.43,7.521,6,7.521C3.507,7.521,3.5,5.5,3.5,5.5S2.527,5.606,2.273,6.004C1.908,6.577,1.648,7.716,1.547,8.545C1.521,8.688,1.49,9.082,1.498,9.142c0.161,1.295,2.238,2.322,4.375,2.358C5.916,11.501,5.958,11.501,6,11.501c0.043,0,0.084,0,0.127-0.001c2.076-0.026,4.214-1.063,4.375-2.358C10.509,9.082,10.471,8.696,10.452,8.545z'/></g></g></svg>",
  OFFLINE_ICON_SVG: "<svg version='1.1' id='Layer_1' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:cc='http://creativecommons.org/ns#' xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#' xmlns:svg='http://www.w3.org/2000/svg' xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd' xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape' sodipodi:docname='TRASH_1_4.svg' inkscape:version='0.48.4 r9939' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='12px' height='12px' viewBox='0 0 12 12' enable-background='new 0 0 12 12' xml:space='preserve'><sodipodi:namedview  inkscape:cy='139.7898' inkscape:cx='26.358185' inkscape:zoom='1.18' showguides='true' showgrid='false' id='namedview6' guidetolerance='10' gridtolerance='10' objecttolerance='10' borderopacity='1' bordercolor='#666666' pagecolor='#ffffff' inkscape:current-layer='Layer_1' inkscape:window-maximized='1' inkscape:window-y='-8' inkscape:window-x='-8' inkscape:window-height='705' inkscape:window-width='1366' inkscape:guide-bbox='true' inkscape:pageshadow='2' inkscape:pageopacity='0'><sodipodi:guide  position='50.036793,85.991376' orientation='1,0' id='guide2986'></sodipodi:guide><sodipodi:guide  position='58.426196,66.216355' orientation='0,1' id='guide3047'></sodipodi:guide></sodipodi:namedview><g><g><path fill='#cccccc' d='M6.002,7.143C5.645,7.363,5.167,7.52,4.502,7.52c-2.493,0-2.5-2.02-2.5-2.02S1.029,5.607,0.775,6.004C0.41,6.577,0.15,7.716,0.049,8.545c-0.025,0.145-0.057,0.537-0.05,0.598c0.162,1.295,2.237,2.321,4.375,2.357c0.043,0.001,0.085,0.001,0.127,0.001c0.043,0,0.084,0,0.127-0.001c1.879-0.023,3.793-0.879,4.263-2h-2.89L6.002,7.143L6.002,7.143z M4.501,5.488c1.372,0,2.483-1.117,2.483-2.494c0-1.378-1.111-2.495-2.483-2.495c-1.371,0-2.481,1.117-2.481,2.495C2.02,4.371,3.13,5.488,4.501,5.488z M7.002,6.5v2h5v-2H7.002z'/></g></g></svg>"
};
