// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var ChannelStore = require('../stores/channel_store.jsx')
var UserStore = require('../stores/user_store.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;
var AsyncClient = require('./async_client.jsx');
var client = require('./client.jsx');
var Autolinker = require('autolinker');

module.exports.isEmail = function(email) {
  var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  return regex.test(email);
};

module.exports.cleanUpUrlable = function(input) {
    var cleaned = input.trim().replace(/-/g, ' ').replace(/[^\w\s]/gi, '').toLowerCase().replace(/\s/g, '-');
    cleaned = cleaned.replace(/^\-+/, '');
    cleaned = cleaned.replace(/\-+$/, '');
    return cleaned;
};

module.exports.isTestDomain = function() {

    if ((/^localhost/).test(window.location.hostname))
        return true;

    if ((/^dockerhost/).test(window.location.hostname))
        return true;

    if ((/^test/).test(window.location.hostname))
        return true;

    if ((/^127.0./).test(window.location.hostname))
        return true;

    if ((/^192.168./).test(window.location.hostname))
        return true;

    if ((/^10./).test(window.location.hostname))
        return true;

    if ((/^176./).test(window.location.hostname))
        return true;

    return false;
};

var getSubDomain = function() {

  if (module.exports.isTestDomain())
    return "";

  if ((/^www/).test(window.location.hostname))
    return "";

  if ((/^beta/).test(window.location.hostname))
    return "";

  if ((/^ci/).test(window.location.hostname))
    return "";

  var parts = window.location.hostname.split(".");

  if (parts.length != 3)
    return "";

  return parts[0];
}

global.window.getSubDomain = getSubDomain;
module.exports.getSubDomain = getSubDomain;

module.exports.getDomainWithOutSub = function() {

  var parts = window.location.host.split(".");

  if (parts.length == 1) {
    if (parts[0].indexOf("dockerhost") > -1) {
        return "dockerhost:8065";
    }
    else {
        return "localhost:8065";
    }
  }

  return parts[1] + "." +  parts[2];
}

module.exports.getCookie = function(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}


module.exports.notifyMe = function(title, body, channel) {
  if ("Notification" in window && Notification.permission !== 'denied') {
    Notification.requestPermission(function (permission) {
      if (Notification.permission !== permission) {
          Notification.permission = permission;
      }

      if (permission === "granted") {
        var notification = new Notification(title,
            { body: body, tag: body, icon: '/static/images/icon50x50.gif' }
        );
        notification.onclick = function() {
          window.focus();
          if (channel) {
              module.exports.switchChannel(channel);
          } else {
              window.location.href = "/";
          }
        };
        setTimeout(function(){
          notification.close();
        }, 5000);
      }
    });
  }
}

module.exports.ding = function() {
  var audio = new Audio('/static/images/ding.mp3');
  audio.play();
}

module.exports.getUrlParameter = function(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++)
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam)
        {
            return sParameterName[1];
        }
    }
    return null;
}

module.exports.getDateForUnixTicks = function(ticks) {
  return new Date(ticks)
}

module.exports.displayDate = function(ticks) {
  var d = new Date(ticks);
  var m_names = new Array("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December");

  return m_names[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}

module.exports.displayTime = function(ticks) {
  var d = new Date(ticks);
  var hours = d.getHours();
  var minutes = d.getMinutes();
  var ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : "12"
  minutes = minutes > 9 ? minutes : '0'+minutes
  return hours + ":" + minutes + " " + ampm
}

module.exports.displayDateTime = function(ticks) {
  var seconds = Math.floor((Date.now() - ticks) / 1000)

  interval = Math.floor(seconds / 3600);

  if (interval > 24) {
      return this.displayTime(ticks)
  }

  if (interval > 1) {
      return interval + " hours ago";
  }

  if (interval == 1) {
      return interval + " hour ago";
  }

  interval = Math.floor(seconds / 60);
  if (interval > 1) {
      return interval + " minutes ago";
  }

  return "1 minute ago";

}

// returns Unix timestamp in milliseconds
module.exports.getTimestamp = function() {
    return Date.now();
}

var testUrlMatch = function(text) {
    var urlMatcher = new Autolinker.matchParser.MatchParser({
      urls: true,
      emails: false,
      twitter: false,
      phone: false,
      hashtag: false,
    });
    var result = [];
    var replaceFn = function(match) {
      var linkData = {};
      var matchText = match.getMatchedText();

      linkData.text = matchText;
      linkData.link = matchText.trim().indexOf("http") !== 0 ? "http://" + matchText : matchText;

      result.push(linkData);
    }
    urlMatcher.replace(text,replaceFn,this);
    return result;
}

module.exports.extractLinks = function(text) {
    var repRegex = new RegExp("<br>", "g");
    var matches = testUrlMatch(text.replace(repRegex, "\n"));

    if (!matches.length) return { "links": null, "text": text };

    var links = [];
    for (var i = 0; i < matches.length; i++) {
        links.push(matches[i].link);
    }

    return { "links": links, "text": text };
}

module.exports.escapeRegExp = function(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

module.exports.getEmbed = function(link) {

    var ytRegex = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|watch\?(?:[a-zA-Z-_]+=[a-zA-Z0-9-_]+&)+v=)([^#\&\?]*).*/;

    var match = link.trim().match(ytRegex);
    if (match && match[1].length==11){
      return getYoutubeEmbed(link);
    }

    // Generl embed feature turned off for now
    return;

    var id = parseInt((Math.random() * 1000000) + 1);

    $.ajax({
        type: 'GET',
        url: "https://query.yahooapis.com/v1/public/yql",
        data: {
            q: "select * from html where url=\""+link+"\" and xpath='html/head'",
            format: "json"
        },
        async: true
    }).done(function(data) {
        if(!data.query.results) {
            return;
        }

        var headerData = data.query.results.head;

        var description = ""
        for(var i = 0; i < headerData.meta.length; i++) {
            if(headerData.meta[i].name && (headerData.meta[i].name === "description" || headerData.meta[i].name === "Description")){
                description = headerData.meta[i].content;
                break;
            }
        }

        $('.embed-title.'+id).html(headerData.title);
        $('.embed-description.'+id).html(description);
    })

    return (
        <div className="post-comment">
            <div className={"web-embed-data"}>
                <p className={"embed-title " + id} />
                <p className={"embed-description " + id} />
                <p className={"embed-link " + id}>{link}</p>
            </div>
        </div>
    );
}

var getYoutubeEmbed = function(link) {
    var regex = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|watch\?(?:[a-zA-Z-_]+=[a-zA-Z0-9-_]+&)+v=)([^#\&\?]*).*/;

    var youtubeId = link.trim().match(regex)[1];

    var onclick = function(e) {
        var div = $(e.target).closest('.video-thumbnail__container')[0];
        var iframe = document.createElement("iframe");
        iframe.setAttribute("src",
              "https://www.youtube.com/embed/" + div.id
            + "?autoplay=1&autohide=1&border=0&wmode=opaque&enablejsapi=1");
        iframe.setAttribute("width", "480px");
        iframe.setAttribute("height", "360px");
        iframe.setAttribute("type", "text/html");
        iframe.setAttribute("frameborder", "0");

        div.parentNode.replaceChild(iframe, div);
    };

    var success = function(data) {
        if(!data.items.length || !data.items[0].snippet) {
          return;
        }
        var metadata = data.items[0].snippet;
        $('.video-uploader.'+youtubeId).html(metadata.channelTitle);
        $('.video-title.'+youtubeId).find('a').html(metadata.title);
        // Scrolling Code Was Here
    };

    if(config.GoogleDeveloperKey) {
      $.ajax({
          async: true,
          url: "https://www.googleapis.com/youtube/v3/videos",
          type: 'GET',
          data: {part:"snippet", id:youtubeId, key:config.GoogleDeveloperKey},
          success: success
      });
    }

    return (
        <div className="post-comment">
            <h4 className="video-type">YouTube</h4>
            <h4 className={"video-uploader "+youtubeId}></h4>
            <h4 className={"video-title "+youtubeId}><a href={link}></a></h4>
            <div className="video-div embed-responsive-item" id={youtubeId} onClick={onclick}>
              <div className="embed-responsive embed-responsive-4by3 video-div__placeholder">
                <div id={youtubeId} className="video-thumbnail__container">
                  <img className="video-thumbnail" src={"https://i.ytimg.com/vi/" + youtubeId + "/hqdefault.jpg"}/>
                  <div className="block">
                      <span className="play-button"><span></span></span>
                  </div>
                </div>
              </div>
            </div>
        </div>
    );

}

module.exports.areStatesEqual = function(state1, state2) {
    return JSON.stringify(state1) === JSON.stringify(state2);
}

module.exports.replaceHtmlEntities = function(text) {
    var tagsToReplace = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>'
    };
    for (var tag in tagsToReplace) {
        var regex = new RegExp(tag, "g");
        text = text.replace(regex, tagsToReplace[tag]);
    }
    return text;
}

module.exports.insertHtmlEntities = function(text) {
    var tagsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    };
    for (var tag in tagsToReplace) {
        var regex = new RegExp(tag, "g");
        text = text.replace(regex, tagsToReplace[tag]);
    }
    return text;
}

module.exports.searchForTerm = function(term) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECIEVED_SEARCH_TERM,
        term: term,
        do_search: true
    });
}

var oldExplicitMentionRegex = /(?:<mention>)([\s\S]*?)(?:<\/mention>)/g;
var puncStartRegex = /^((?![@#])\W)+/g;
var puncEndRegex = /(\W)+$/g;

module.exports.textToJsx = function(text, options) {

    if (options && options['singleline']) {
        var repRegex = new RegExp("\n", "g");
        text = text.replace(repRegex, " ");
    }

    var searchTerm = ""
    if (options && options['searchTerm']) {
        searchTerm = options['searchTerm'].toLowerCase()
    }

    var mentionClass = "mention-highlight";
    if (options && options['noMentionHighlight']) {
        mentionClass = "";
    }

    var inner = [];

    // Function specific regex
    var hashRegex = /^href="#[^"]+"|(#[A-Za-z]+[A-Za-z0-9_\-]*[A-Za-z0-9])$/g;

    var implicitKeywords = UserStore.getCurrentMentionKeys();

    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var words = line.split(" ");
        var highlightSearchClass = "";
        for (var z = 0; z < words.length; z++) {
            var word = words[z];
            var trimWord = word.replace(puncStartRegex, '').replace(puncEndRegex, '').trim();
            var mentionRegex = /^(?:@)([a-z0-9_]+)$/gi; // looks loop invariant but a weird JS bug needs it to be redefined here
            var explicitMention = mentionRegex.exec(trimWord);

            if ((trimWord.toLowerCase().indexOf(searchTerm) > -1 || word.toLowerCase().indexOf(searchTerm) > -1) && searchTerm != "") {

                highlightSearchClass = " search-highlight";
            }

            if (explicitMention &&
                (UserStore.getProfileByUsername(explicitMention[1]) ||
                Constants.SPECIAL_MENTIONS.indexOf(explicitMention[1]) !== -1))
            {
                var name = explicitMention[1];
                // do both a non-case sensitive and case senstive check
                var mClass = implicitKeywords.indexOf('@'+name.toLowerCase()) !== -1 || implicitKeywords.indexOf('@'+name) !== -1 ? mentionClass : "";

                var suffix = word.match(puncEndRegex);
                var prefix = word.match(puncStartRegex);

                if (searchTerm === name) {
                    highlightSearchClass = " search-highlight";
                }

                inner.push(<span key={name+i+z+"_span"}>{prefix}<a className={mClass + highlightSearchClass + " mention-link"} key={name+i+z+"_link"} href="#" onClick={function(value) { return function() { module.exports.searchForTerm(value); } }(name)}>@{name}</a>{suffix} </span>);
            } else if (testUrlMatch(word).length) {
                var match = testUrlMatch(word)[0];
                var link = match.link;

                var prefix = word.substring(0,word.indexOf(match.text));
                var suffix = word.substring(word.indexOf(match.text)+match.text.length);

                inner.push(<span key={word+i+z+"_span"}>{prefix}<a key={word+i+z+"_link"} className={"theme" + highlightSearchClass} target="_blank" href={link}>{match.text}</a>{suffix} </span>);

            } else if (trimWord.match(hashRegex)) {
                var suffix = word.match(puncEndRegex);
                var prefix = word.match(puncStartRegex);
                var mClass = implicitKeywords.indexOf(trimWord) !== -1 || implicitKeywords.indexOf(trimWord.toLowerCase()) !== -1 ? mentionClass : "";

                if (searchTerm === trimWord.substring(1).toLowerCase() || searchTerm === trimWord.toLowerCase()) {
                    highlightSearchClass = " search-highlight";
                }

                inner.push(<span key={word+i+z+"_span"}>{prefix}<a key={word+i+z+"_hash"} className={"theme " + mClass + highlightSearchClass} href="#" onClick={function(value) { return function() { module.exports.searchForTerm(value); } }(trimWord)}>{trimWord}</a>{suffix} </span>);

            } else if (implicitKeywords.indexOf(trimWord) !== -1 || implicitKeywords.indexOf(trimWord.toLowerCase()) !== -1) {
                var suffix = word.match(puncEndRegex);
                var prefix = word.match(puncStartRegex);

                if (trimWord.charAt(0) === '@') {
                    if (searchTerm === trimWord.substring(1).toLowerCase()) {
                        highlightSearchClass = " search-highlight";
                    }
                    inner.push(<span key={word+i+z+"_span"} key={name+i+z+"_span"}>{prefix}<a className={mentionClass + highlightSearchClass} key={name+i+z+"_link"} href="#">{trimWord}</a>{suffix} </span>);
                } else {
                    inner.push(<span key={word+i+z+"_span"}>{prefix}<span className={mentionClass + highlightSearchClass}>{module.exports.replaceHtmlEntities(trimWord)}</span>{suffix} </span>);
                }

            } else if (word === "") {
                // if word is empty dont include a span
            } else {
                inner.push(<span key={word+i+z+"_span"}><span className={highlightSearchClass}>{module.exports.replaceHtmlEntities(word)}</span> </span>);
            }
            highlightSearchClass = "";
        }
        if (i != lines.length-1)
            inner.push(<br key={"br_"+i+z}/>);
    }

    return inner;
}

module.exports.getFileType = function(ext) {
    ext = ext.toLowerCase();
    if (Constants.IMAGE_TYPES.indexOf(ext) > -1) {
        return "image";
    }

    if (Constants.AUDIO_TYPES.indexOf(ext) > -1) {
        return "audio";
    }

    if (Constants.VIDEO_TYPES.indexOf(ext) > -1) {
        return "video";
    }

    if (Constants.SPREADSHEET_TYPES.indexOf(ext) > -1) {
        return "spreadsheet";
    }

    if (Constants.CODE_TYPES.indexOf(ext) > -1) {
        return "code";
    }

    if (Constants.WORD_TYPES.indexOf(ext) > -1) {
        return "word";
    }

    if (Constants.EXCEL_TYPES.indexOf(ext) > -1) {
        return "excel";
    }

    if (Constants.PDF_TYPES.indexOf(ext) > -1) {
        return "pdf";
    }

    if (Constants.PATCH_TYPES.indexOf(ext) > -1) {
        return "patch";
    }

    return "other";
};

module.exports.getPreviewImagePathForFileType = function(fileType) {
    fileType = fileType.toLowerCase();

    var icon;
    if (fileType in Constants.ICON_FROM_TYPE) {
        icon = Constants.ICON_FROM_TYPE[fileType];
    } else {
        icon = Constants.ICON_FROM_TYPE["other"];
    }

    return "/static/images/icons/" + icon + ".png";
};

module.exports.getIconClassName = function(fileType) {
    fileType = fileType.toLowerCase();

    if (fileType in Constants.ICON_FROM_TYPE)
        return Constants.ICON_FROM_TYPE[fileType];

    return "glyphicon-file";
}

module.exports.splitFileLocation = function(fileLocation) {
    var fileSplit = fileLocation.split('.');

    var ext = "";
    if (fileSplit.length > 1) {
        ext = fileSplit[fileSplit.length - 1];
        fileSplit.splice(fileSplit.length - 1, 1);
    }

    var filePath = fileSplit.join('.');
    var filename = filePath.split('/')[filePath.split('/').length-1];

    return {'ext': ext, 'name': filename, 'path': filePath};
}

// Asynchronously gets the size of a file by requesting its headers. If successful, it calls the
// provided callback with the file size in bytes as the argument.
module.exports.getFileSize = function(url, callback) {
    var request = new XMLHttpRequest();

    request.open('HEAD', url, true);
    request.onreadystatechange = function() {
        if (request.readyState == 4 && request.status == 200) {
            if (callback) {
                callback(parseInt(request.getResponseHeader("content-length")));
            }
        }
    };

    request.send();
};

module.exports.toTitleCase = function(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

module.exports.changeCss = function(className, classValue) {
    // we need invisible container to store additional css definitions
    var cssMainContainer = $('#css-modifier-container');
    if (cssMainContainer.length == 0) {
        var cssMainContainer = $('<div id="css-modifier-container"></div>');
        cssMainContainer.hide();
        cssMainContainer.appendTo($('body'));
    }

    // and we need one div for each class
    classContainer = cssMainContainer.find('div[data-class="' + className + '"]');
    if (classContainer.length == 0) {
        classContainer = $('<div data-class="' + className + '"></div>');
        classContainer.appendTo(cssMainContainer);
    }

    // append additional style
    classContainer.html('<style>' + className + ' {' + classValue + '}</style>');
}

module.exports.rgb2hex = function(rgb) {
    if (/^#[0-9A-F]{6}$/i.test(rgb)) return rgb;

    rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    function hex(x) {
        return ("0" + parseInt(x).toString(16)).slice(-2);
    }
    return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
}

module.exports.placeCaretAtEnd = function(el) {
    el.focus();
    if (typeof window.getSelection != "undefined"
            && typeof document.createRange != "undefined") {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } else if (typeof document.body.createTextRange != "undefined") {
        var textRange = document.body.createTextRange();
        textRange.moveToElementText(el);
        textRange.collapse(false);
        textRange.select();
    }
}

module.exports.getCaretPosition = function(el) {
    if (el.selectionStart) {
      return el.selectionStart;
    } else if (document.selection) {
      el.focus();

      var r = document.selection.createRange();
      if (r == null) {
        return 0;
      }

      var re = el.createTextRange(),
          rc = re.duplicate();
      re.moveToBookmark(r.getBookmark());
      rc.setEndPoint('EndToStart', re);

      return rc.text.length;
    }
    return 0;
}

module.exports.setSelectionRange = function(input, selectionStart, selectionEnd) {
  if (input.setSelectionRange) {
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
  }
  else if (input.createTextRange) {
    var range = input.createTextRange();
    range.collapse(true);
    range.moveEnd('character', selectionEnd);
    range.moveStart('character', selectionStart);
    range.select();
  }
}

module.exports.setCaretPosition = function (input, pos) {
  module.exports.setSelectionRange(input, pos, pos);
}

module.exports.getSelectedText = function(input) {
  var selectedText;
  if (document.selection != undefined) {
    input.focus();
    var sel = document.selection.createRange();
    selectedText = sel.text;
  } else if (input.selectionStart != undefined) {
    var startPos = input.selectionStart;
    var endPos = input.selectionEnd;
    selectedText = input.value.substring(startPos, endPos)
  }

  return selectedText;
}

module.exports.isValidUsername = function (name) {

    var error = ""
    if (!name) {
        error = "This field is required";
    }

    else if (name.length < 3 || name.length > 15)
    {
        error = "Must be between 3 and 15 characters";
    }

    else if (!/^[a-z0-9\.\-\_]+$/.test(name))
    {
        error = "Must contain only lowercase letters, numbers, and the symbols '.', '-', and '_'.";
    }

    else if (!/[a-z]/.test(name.charAt(0)))
    {
        error = "First character must be a letter.";
    }

    else
    {
        var lowerName = name.toLowerCase().trim();

        for (var i = 0; i < Constants.RESERVED_USERNAMES.length; i++)
        {
            if (lowerName === Constants.RESERVED_USERNAMES[i])
            {
                error = "Cannot use a reserved word as a username.";
                break;
            }
        }
    }

    return error;
}

module.exports.switchChannel = function(channel, teammate_name) {
    AppDispatcher.handleViewAction({
      type: ActionTypes.CLICK_CHANNEL,
      name: channel.name,
      id: channel.id
    });

    var teamURL = window.location.href.split('/channels')[0];
    history.replaceState('data', '', teamURL + '/channels/' + channel.name);

    if (channel.type === 'D' && teammate_name) {
        document.title = teammate_name + " " + document.title.substring(document.title.lastIndexOf("-"));
    } else {
        document.title = channel.display_name + " " + document.title.substring(document.title.lastIndexOf("-"));
    }

    AsyncClient.getChannels(true, true, true);
    AsyncClient.getChannelExtraInfo(true);
    AsyncClient.getPosts(true, channel.id, Constants.POST_CHUNK_SIZE);

    $('.inner__wrap').removeClass('move--right');
    $('.sidebar--left').removeClass('move--right');

    client.trackPage();

    return false;
}

module.exports.isMobile = function() {
  return screen.width <= 768;
}

module.exports.isComment = function(post) {
    if ('root_id' in post) {
        return post.root_id != "";
    }
    return false;
}

module.exports.getDirectTeammate = function(channel_id) {
    var userIds = ChannelStore.get(channel_id).name.split('__');
    var curUserId = UserStore.getCurrentId();
    var teammate = {};

    if(userIds.length != 2 || userIds.indexOf(curUserId) === -1) {
        return teammate;
    }

    for (var idx in userIds) {
        if(userIds[idx] !== curUserId) {
            teammate = UserStore.getProfile(userIds[idx]);
            break;
        }
    }

    return teammate;
}

Image.prototype.load = function(url, progressCallback) {
    var thisImg = this;
    var xmlHTTP = new XMLHttpRequest();
    xmlHTTP.open('GET', url, true);
    xmlHTTP.responseType = 'arraybuffer';
    xmlHTTP.onload = function(e) {
        var h = xmlHTTP.getAllResponseHeaders(),
            m = h.match( /^Content-Type\:\s*(.*?)$/mi ),
            mimeType = m[ 1 ] || 'image/png';

        var blob = new Blob([this.response], { type: mimeType });
        thisImg.src = window.URL.createObjectURL(blob);
    };
    xmlHTTP.onprogress = function(e) {
        parseInt(thisImg.completedPercentage = (e.loaded / e.total) * 100);
        if (progressCallback) progressCallback();
    };
    xmlHTTP.onloadstart = function() {
        thisImg.completedPercentage = 0;
    };
    xmlHTTP.send();
};

Image.prototype.completedPercentage = 0;

module.exports.changeColor =function(col, amt) {

    var usePound = false;

    if (col[0] == "#") {
        col = col.slice(1);
        usePound = true;
    }

    var num = parseInt(col,16);

    var r = (num >> 16) + amt;

    if (r > 255) r = 255;
    else if  (r < 0) r = 0;

    var b = ((num >> 8) & 0x00FF) + amt;

    if (b > 255) b = 255;
    else if  (b < 0) b = 0;

    var g = (num & 0x0000FF) + amt;

    if (g > 255) g = 255;
    else if (g < 0) g = 0;

    return (usePound?"#":"") + String("000000" + (g | (b << 8) | (r << 16)).toString(16)).slice(-6);
};

module.exports.getFullName = function(user) {
    if (user.first_name && user.last_name) {
        return user.first_name + " " + user.last_name;
    } else if (user.first_name) {
        return user.first_name;
    } else if (user.last_name) {
        return user.last_name;
    } else {
        return "";
    }
};

module.exports.getDisplayName = function(user) {
    if (user.nickname && user.nickname.trim().length > 0) {
        return user.nickname;
    } else {
        var fullName = module.exports.getFullName(user);

        if (fullName) {
            return fullName;
        } else {
            return user.username;
        }
    }
};

//IE10 does not set window.location.origin automatically so this must be called instead when using it
module.exports.getWindowLocationOrigin = function() {
    var windowLocationOrigin = window.location.origin;
    if (!windowLocationOrigin) {
        windowLocationOrigin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
    }
    return windowLocationOrigin;
}

// Converts a file size in bytes into a human-readable string of the form "123MB".
module.exports.fileSizeToString = function(bytes) {
    // it's unlikely that we'll have files bigger than this
    if (bytes > 1024 * 1024 * 1024 * 1024) {
        return Math.floor(bytes / (1024 * 1024 * 1024 * 1024)) + "TB";
    } else if (bytes > 1024 * 1024 * 1024) {
        return Math.floor(bytes / (1024 * 1024 * 1024)) + "GB";
    } else if (bytes > 1024 * 1024) {
        return Math.floor(bytes / (1024 * 1024)) + "MB";
    } else if (bytes > 1024) {
        return Math.floor(bytes / 1024) + "KB";
    } else {
        return bytes + "B";
    }
};

// Converts a filename (like those attached to Post objects) to a url that can be used to retrieve attachments from the server.
module.exports.getFileUrl = function(filename) {
    var url = filename;

    // This is a temporary patch to fix issue with old files using absolute paths
    if (url.indexOf("/api/v1/files/get") != -1) {
        url = filename.split("/api/v1/files/get")[1];
    }
    url = module.exports.getWindowLocationOrigin() + "/api/v1/files/get" + url;

    return url;
};

// Gets the name of a file (including extension) from a given url or file path.
module.exports.getFileName = function(path) {
    var split = path.split('/');
    return split[split.length - 1];
};

// Generates a RFC-4122 version 4 compliant globally unique identifier.
module.exports.generateId = function() {
    // implementation taken from http://stackoverflow.com/a/2117523
    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

    id = id.replace(/[xy]/g, function(c) {
        var r = Math.floor(Math.random() * 16);

        var v;
        if (c === 'x') {
            v = r;
        } else {
            v = r & 0x3 | 0x8;
        }

        return v.toString(16);
    });

    return id;
};
