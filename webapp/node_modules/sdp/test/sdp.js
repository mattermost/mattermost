 /* jshint node: true */
'use strict';

// tests for the Edge SDP parser. Tests plain JS so can be run in node.
var test = require('tape');
var SDPUtils = require('../sdp.js');

var videoSDP =
  'v=0\r\no=- 1376706046264470145 3 IN IP4 127.0.0.1\r\ns=-\r\n' +
  't=0 0\r\na=group:BUNDLE video\r\n' +
  'a=msid-semantic: WMS EZVtYL50wdbfttMdmVFITVoKc4XgA0KBZXzd\r\n' +
  'm=video 9 UDP/TLS/RTP/SAVPF 100 101 107 116 117 96 97 99 98\r\n' +
  'c=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\n' +
  'a=ice-ufrag:npaLWmWDg3Yp6vJt\r\na=ice-pwd:pdfQZAiFbcsFmUKWw55g4TD5\r\n' +
  'a=fingerprint:sha-256 3D:05:43:01:66:AC:57:DC:17:55:08:5C:D4:25:D7:CA:FD' +
  ':E1:0E:C1:F4:F8:43:3E:10:CE:3E:E7:6E:20:B9:90\r\n' +
  'a=setup:actpass\r\na=mid:video\r\n' +
  'a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r\n' +
  'a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n' +
  'a=extmap:4 urn:3gpp:video-orientation\r\na=sendrecv\r\na=rtcp-mux\r\n' +
  'a=rtcp-rsize\r\na=rtpmap:100 VP8/90000\r\n' +
  'a=rtcp-fb:100 ccm fir\r\na=rtcp-fb:100 nack\r\na=rtcp-fb:100 nack pli\r\n' +
  'a=rtcp-fb:100 goog-remb\r\na=rtcp-fb:100 transport-cc\r\n' +
  'a=rtpmap:101 VP9/90000\r\na=rtcp-fb:101 ccm fir\r\na=rtcp-fb:101 nack\r\n' +
  'a=rtcp-fb:101 nack pli\r\na=rtcp-fb:101 goog-remb\r\n' +
  'a=rtcp-fb:101 transport-cc\r\na=rtpmap:107 H264/90000\r\n' +
  'a=rtcp-fb:107 ccm fir\r\na=rtcp-fb:107 nack\r\na=rtcp-fb:107 nack pli\r\n' +
  'a=rtcp-fb:107 goog-remb\r\na=rtcp-fb:107 transport-cc\r\n' +
  'a=rtpmap:116 red/90000\r\na=rtpmap:117 ulpfec/90000\r\n' +
  'a=rtpmap:96 rtx/90000\r\na=fmtp:96 apt=100\r\na=rtpmap:97 rtx/90000\r\n' +
  'a=fmtp:97 apt=101\r\na=rtpmap:99 rtx/90000\r\na=fmtp:99 apt=107\r\n' +
  'a=rtpmap:98 rtx/90000\r\na=fmtp:98 apt=116\r\n' +
  'a=ssrc-group:FID 1734522595 2715962409\r\n' +
  'a=ssrc:1734522595 cname:VrveQctHgkwqDKj6\r\n' +
  'a=ssrc:1734522595 msid:EZVtYL50wdbfttMdmVFITVoKc4XgA0KBZXzd ' +
  '63238d63-9a20-4afc-832c-48678926afce\r\na=ssrc:1734522595 ' +
  'mslabel:EZVtYL50wdbfttMdmVFITVoKc4XgA0KBZXzd\r\n' +
  'a=ssrc:1734522595 label:63238d63-9a20-4afc-832c-48678926afce\r\n' +
  'a=ssrc:2715962409 cname:VrveQctHgkwqDKj6\r\n' +
  'a=ssrc:2715962409 msid:EZVtYL50wdbfttMdmVFITVoKc4XgA0KBZXzd ' +
  '63238d63-9a20-4afc-832c-48678926afce\r\n' +
  'a=ssrc:2715962409 mslabel:EZVtYL50wdbfttMdmVFITVoKc4XgA0KBZXzd\r\n' +
  'a=ssrc:2715962409 label:63238d63-9a20-4afc-832c-48678926afce\r\n';

// Firefox offer
var videoSDP2 =
  'v=0\r\n' +
  'o=mozilla...THIS_IS_SDPARTA-45.0 5508396880163053452 0 IN IP4 0.0.0.0\r\n' +
  's=-\r\nt=0 0\r\n' +
  'a=fingerprint:sha-256 CC:0D:FB:A8:9F:59:36:57:69:F6:2C:0E:A3:EA:19:5A:E0' +
  ':D4:37:82:D4:7B:FB:94:3D:F6:0E:F8:29:A7:9E:9C\r\n' +
  'a=ice-options:trickle\r\na=msid-semantic:WMS *\r\n' +
  'm=video 9 UDP/TLS/RTP/SAVPF 120 126 97\r\n' +
  'c=IN IP4 0.0.0.0\r\na=sendrecv\r\n' +
  'a=fmtp:126 profile-level-id=42e01f;level-asymmetry-allowed=1;' +
  'packetization-mode=1\r\n' +
  'a=fmtp:97 profile-level-id=42e01f;level-asymmetry-allowed=1\r\n' +
  'a=fmtp:120 max-fs=12288;max-fr=60\r\n' +
  'a=ice-pwd:e81aeca45422c37aeb669274d8959200\r\n' +
  'a=ice-ufrag:30607a5c\r\na=mid:sdparta_0\r\n' +
  'a=msid:{782ddf65-d10e-4dad-80b9-27e9f3928d82} ' +
  '{37802bbd-01e2-481e-a2e8-acb5423b7a55}\r\n' +
  'a=rtcp-fb:120 nack\r\na=rtcp-fb:120 nack pli\r\na=rtcp-fb:120 ccm fir\r\n' +
  'a=rtcp-fb:126 nack\r\na=rtcp-fb:126 nack pli\r\na=rtcp-fb:126 ccm fir\r\n' +
  'a=rtcp-fb:97 nack\r\na=rtcp-fb:97 nack pli\r\na=rtcp-fb:97 ccm fir\r\n' +
  'a=rtcp-mux\r\na=rtpmap:120 VP8/90000\r\na=rtpmap:126 H264/90000\r\n' +
  'a=rtpmap:97 H264/90000\r\na=setup:actpass\r\n' +
  'a=ssrc:98927270 cname:{0817e909-53be-4a3f-ac45-b5a0e5edc3a7}\r\n';

test('splitSections', function(t) {
  var parsed = SDPUtils.splitSections(videoSDP.replace(/\r\n/g, '\n'));
  t.ok(parsed.length === 2,
      'split video-only SDP with only LF into two sections');

  parsed = SDPUtils.splitSections(videoSDP);
  t.ok(parsed.length === 2, 'split video-only SDP into two sections');

  t.ok(parsed.every(function(section) {
    return section.substr(-2) === '\r\n';
  }), 'every section ends with CRLF');

  t.ok(parsed.join('') === videoSDP,
      'joining sections without separator recreates SDP');
  t.end();
});

test('parseRtpParameters', function(t) {
  var sections = SDPUtils.splitSections(videoSDP);
  var parsed = SDPUtils.parseRtpParameters(sections[1]);
  t.ok(parsed.codecs.length === 9, 'parsed 9 codecs');
  t.ok(parsed.fecMechanisms.length === 2, 'parsed FEC mechanisms');
  t.ok(parsed.fecMechanisms.indexOf('RED') !== -1,
      'parsed RED as FEC mechanism');
  t.ok(parsed.fecMechanisms.indexOf('ULPFEC') !== -1,
      'parsed ULPFEC as FEC mechanism');
  t.ok(parsed.headerExtensions.length === 3, 'parsed 3 header extensions');
  t.end();
});

test('fmtp parsing and serialization', function(t) {
  var line = 'a=fmtp:111 minptime=10; useinbandfec=1';
  var parsed = SDPUtils.parseFmtp(line);
  t.ok(Object.keys(parsed).length === 2, 'parsed 2 parameters');
  t.ok(parsed.minptime === '10', 'parsed minptime');
  t.ok(parsed.useinbandfec === '1', 'parsed useinbandfec');

  // TODO: is this safe or can the order change?
  // serialization strings the extra whitespace after ';'
  t.ok(SDPUtils.writeFmtp({payloadType: 111, parameters: parsed})
      === line.replace('; ', ';') + '\r\n',
      'serialization does not add extra spaces between parameters');
  t.end();
});

test('rtpmap parsing and serialization', function(t) {
  var line = 'a=rtpmap:111 opus/48000/2';
  var parsed = SDPUtils.parseRtpMap(line);
  t.ok(parsed.name === 'opus', 'parsed codec name');
  t.ok(parsed.payloadType === 111, 'parsed payloadType as integer');
  t.ok(parsed.clockRate === 48000, 'parsed clockRate as integer');
  t.ok(parsed.numChannels === 2, 'parsed numChannels');

  parsed = SDPUtils.parseRtpMap('a=rtpmap:0 PCMU/8000');
  t.ok(parsed.numChannels === 1, 'numChannels defaults to 1 if not present');

  t.ok(SDPUtils.writeRtpMap({
    payloadType: 111,
    name: 'opus',
    clockRate: 48000,
    numChannels: 2
  }).trim() === line, 'serialized rtpmap');

  t.end();
});

test('parseRtpEncodingParameters', function(t) {
  var sections = SDPUtils.splitSections(videoSDP);
  var data = SDPUtils.parseRtpEncodingParameters(sections[1]);
  t.ok(data.length === 8, 'parsed encoding parameters for four codecs');

  t.ok(data[0].ssrc === 1734522595, 'parsed primary SSRC');
  t.ok(data[0].rtx, 'has RTX encoding');
  t.ok(data[0].rtx.payloadType === 96, 'parsed rtx payloadType');
  t.ok(data[0].rtx.ssrc === 2715962409, 'parsed secondary SSRC for RTX');
  t.end();
});

test('parseRtpEncodingParameters fallback', function(t) {
  var sections = SDPUtils.splitSections(videoSDP2);
  var data = SDPUtils.parseRtpEncodingParameters(sections[1]);

  t.ok(data.length === 1 && data[0].ssrc === 98927270, 'parsed single SSRC');
  t.end();
});

test('parseRtpEncodingParameters with b=AS', function(t) {
  var sections = SDPUtils.splitSections(
      videoSDP.replace('c=IN IP4 0.0.0.0\r\n',
                       'c=IN IP4 0.0.0.0\r\nb=AS:512\r\n')
  );
  var data = SDPUtils.parseRtpEncodingParameters(sections[1]);

  t.ok(data[0].maxBitrate === 512, 'parsed b=AS:512');
  t.end();
});

test('parseRtpEncodingParameters with b=TIAS', function(t) {
  var sections = SDPUtils.splitSections(
      videoSDP.replace('c=IN IP4 0.0.0.0\r\n',
                       'c=IN IP4 0.0.0.0\r\nb=TIAS:512\r\n')
  );
  var data = SDPUtils.parseRtpEncodingParameters(sections[1]);

  t.ok(data[1].maxBitrate === 512, 'parsed b=AS:512');
  t.end();
});
