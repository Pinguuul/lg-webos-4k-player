(function () {
  "use strict";
  var v,
    api,
    item = null,
    token = 0,
    tracks = [],
    cues = [],
    selectedTrack = "",
    menu = null,
    menuIndex = 0,
    hideTimer = null,
    lastSave = 0,
    requestedResume = 0,
    resumeApplied = false;
  var overlay,
    title,
    time,
    fill,
    notice,
    subs,
    panel,
    jump,
    input,
    pauseButton,
    lastToggle = 0,
    nativeOffId = "",
    nativePending = "",
    nativeResult = null,
    nativeBridge = null,
    subtitleStatus = "";
  function stored(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
      return null;
    }
  }
  function store(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }
  function clock(n) {
    if (!isFinite(n) || n < 0) return "--:--";
    n = Math.floor(n);
    var h = Math.floor(n / 3600),
      m = Math.floor((n % 3600) / 60),
      s = n % 60;
    return (
      (h ? h + ":" : "") +
      (h && m < 10 ? "0" : "") +
      m +
      ":" +
      (s < 10 ? "0" : "") +
      s
    );
  }
  function bookmark(x) {
    return (
      stored("bookmark:" + x.url) || {
        seconds: parseFloat(localStorage.getItem("position:" + x.url)) || 0,
      }
    );
  }
  function update() {
    if (!item) return;
    if (pauseButton) pauseButton.textContent = v.paused ? "▶ Play" : "Ⅱ Pause";
    time.textContent = clock(v.currentTime) + " / " + clock(v.duration);
    fill.style.width =
      (isFinite(v.duration) && v.duration > 0
        ? Math.max(0, Math.min(100, (v.currentTime / v.duration) * 100))
        : 0) + "%";
  }
  function show(text) {
    if (!item) return;
    title.textContent = item.title;
    notice.textContent =
      text ||
      subtitleStatus ||
      "OK Pause/Play · ←/→ 30 sec · Blue Go to minute · Yellow Subtitles · BACK Library";
    overlay.style.display = "block";
    update();
    clearTimeout(hideTimer);
    if (!v.paused)
      hideTimer = setTimeout(function () {
        if (!menu) overlay.style.display = "none";
      }, 6500);
  }
  function toggle() {
    if (!item || Date.now() - lastToggle < 280) return;
    lastToggle = Date.now();
    if (v.paused) v.play();
    else v.pause();
    show();
  }
  function save() {
    if (item && isFinite(v.currentTime) && v.currentTime > 0)
      store("bookmark:" + item.url, {
        seconds: v.currentTime,
        duration: isFinite(v.duration) ? v.duration : 0,
        title: item.title,
      });
  }
  function hideMenu() {
    menu = null;
    panel.style.display = "none";
    jump.style.display = "none";
  }
  function renderMenu() {
    panel.textContent = "";
    var h = document.createElement("h2");
    h.textContent = menu.title;
    panel.appendChild(h);
    var first = Math.floor(menuIndex / 8) * 8,
      i;
    for (i = first; i < Math.min(first + 8, menu.rows.length); i++) {
      var row = document.createElement("div");
      row.className = "menuRow" + (i === menuIndex ? " selected" : "");
      row.textContent = menu.rows[i].label;
      (function (j) {
        row.onclick = function () {
          var action = menu.rows[j].action;
          hideMenu();
          action();
        };
      })(i);
      panel.appendChild(row);
    }
    var f = document.createElement("p");
    f.textContent = "↑↓ Select · OK Confirm · BACK Close";
    panel.appendChild(f);
    panel.style.display = "block";
  }
  function openMenu(name, rows, index) {
    menu = { title: name, rows: rows };
    menuIndex = index || 0;
    renderMenu();
  }
  function seek(seconds) {
    if (!item || !isFinite(seconds)) return;
    var max = isFinite(v.duration) ? Math.max(0, v.duration - 1) : seconds;
    try {
      v.currentTime = Math.max(0, Math.min(max, seconds));
      save();
      show();
    } catch (e) {
      show("Seeking is not available yet. Wait for the video to load.");
    }
  }
  function supportUrl(path) {
    if (api.subtitleServer && api.subtitleServer())
      return api.subtitleServer() + path;
    var a = document.createElement("a");
    a.href = api.server();
    return "http://" + a.hostname + ":18201" + path;
  }
  function get(path, ok, fail) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", supportUrl(path), true);
    xhr.timeout = 45000;
    xhr.onload = function () {
      if (xhr.status === 200 || xhr.status === 202)
        ok(xhr.responseText, xhr.status);
      else {
        var error = "The subtitle service is not responding";
        try {
          error = JSON.parse(xhr.responseText).error || error;
        } catch (e) {}
        fail(error);
      }
    };
    xhr.onerror = xhr.ontimeout = function () {
      fail("The subtitle service cannot be reached on the media server.");
    };
    xhr.send();
  }
  function mediaId() {
    var m = item && /\/MediaItems\/(\d+)\./.exec(item.url);
    return m ? m[1] : null;
  }
  function language(code) {
    var m = {
      eng: "English",
      en: "English",
      rum: "Romanian",
      ron: "Romanian",
      ro: "Romanian",
      spa: "Spanish",
      es: "Spanish",
      fre: "French",
      fra: "French",
      fr: "French",
      ger: "German",
      deu: "German",
      de: "German",
      ita: "Italian",
      it: "Italian",
      por: "Portuguese",
      pol: "Polish",
      hun: "Hungarian",
      bul: "Bulgarian",
      ukr: "Ukrainian",
      rus: "Russian",
      und: "Unspecified language",
    };
    return m[code] || code;
  }
  function timestamp(s) {
    var a = s.replace(",", ".").split(":"),
      n = 0;
    for (var i = 0; i < a.length; i++) n = n * 60 + parseFloat(a[i]);
    return n;
  }
  function parseVtt(data) {
    var blocks = data.replace(/\r/g, "").split(/\n\s*\n/),
      result = [];
    for (var i = 0; i < blocks.length; i++) {
      var lines = blocks[i].split("\n"),
        j;
      for (j = 0; j < lines.length; j++)
        if (lines[j].indexOf("-->") >= 0) break;
      if (j === lines.length) continue;
      var times = lines[j].split("-->"),
        start = timestamp(times[0].trim()),
        end = timestamp(times[1].trim().split(/\s/)[0]),
        body = lines
          .slice(j + 1)
          .join("\n")
          .replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&nbsp;/g, " ");
      if (isFinite(start) && isFinite(end))
        result.push({ start: start, end: end, text: body });
    }
    return result.sort(function (a, b) {
      return a.start - b.start;
    });
  }
  function renderSubtitle() {
    if (!item || !cues.length) {
      subs.textContent = "";
      return;
    }
    var t = v.currentTime,
      lo = 0,
      hi = cues.length;
    while (lo < hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (cues[mid].start <= t) lo = mid + 1;
      else hi = mid;
    }
    var active = [];
    for (var i = Math.max(0, lo - 8); i < lo; i++)
      if (cues[i].end > t) active.push(cues[i].text);
    subs.textContent = active.join("\n");
  }
  function disableNativeSubtitle() {
    var id = v.mediaId;
    if (!item || !id || nativeOffId === id || nativePending === id) return;
    for (var i = 0; i < (v.textTracks || []).length; i++)
      v.textTracks[i].mode = "disabled";
    if (typeof PalmServiceBridge === "undefined") return;
    nativePending = id;
    nativeBridge = new PalmServiceBridge();
    nativeBridge.onservicecallback = function (data) {
      if (nativePending !== id) return;
      nativePending = "";
      try {
        nativeResult = JSON.parse(data);
        if (nativeResult.returnValue) nativeOffId = id;
      } catch (e) {
        nativeResult = { errorText: String(e) };
      }
    };
    nativeBridge.call(
      "luna://com.webos.media/setSubtitleEnable",
      JSON.stringify({ mediaId: id, enable: false })
    );
  }
  function selectSubtitle(key) {
    disableNativeSubtitle();
    selectedTrack = key;
    cues = [];
    subs.textContent = "";
    if (item) store("subtitle:" + item.url, key);
    if (!key) {
      subtitleStatus = "Subtitles off";
      show();
      return;
    }
    var id = mediaId(),
      tag = token,
      track = tracks.filter(function (t) {
        return t.key === key;
      })[0],
      label = track
        ? language(track.language) + (track.label ? " · " + track.label : "")
        : key;
    subtitleStatus = "Preparing subtitle: " + label + "…";
    show();
    function poll() {
      get(
        "/subtitle?id=" + id + "&track=" + encodeURIComponent(key),
        function (data, status) {
          if (tag !== token || key !== selectedTrack) return;
          if (status === 202) {
            setTimeout(poll, 1500);
            return;
          }
          cues = parseVtt(data);
          renderSubtitle();
          subtitleStatus = "Subtitle: " + label;
          show();
        },
        function (error) {
          if (tag === token && key === selectedTrack) {
            subtitleStatus = error;
            show();
          }
        }
      );
    }
    poll();
  }
  function subtitleMenu() {
    if (!item) return;
    if (!tracks.length) {
      show("No subtitles are available, or the track list is still loading.");
      return;
    }
    var rows = [
        {
          label: "Off",
          action: function () {
            selectSubtitle("");
          },
        },
      ],
      index = 0;
    tracks.forEach(function (t, i) {
      if (t.key === selectedTrack) index = i + 1;
      rows.push({
        label:
          (t.key === selectedTrack ? "✓ " : "") +
          language(t.language) +
          (t.label ? " · " + t.label : "") +
          (t.supported ? "" : " · image-based format, unavailable"),
        action: function () {
          if (t.supported) selectSubtitle(t.key);
          else
            show(
              "This track contains images and requires OCR. Choose a text subtitle."
            );
        },
      });
    });
    openMenu("Subtitles (" + tracks.length + ")", rows, index);
  }
  function metadata() {
    var id = mediaId(),
      tag = token;
    if (!id) return;
    get(
      "/metadata?id=" + id,
      function (data) {
        if (tag !== token) return;
        try {
          tracks = JSON.parse(data).tracks || [];
          var saved = stored("subtitle:" + item.url);
          if (
            saved &&
            tracks.some(function (t) {
              return t.key === saved && t.supported;
            })
          )
            selectSubtitle(saved);
        } catch (e) {
          show("Unable to read the subtitle track list.");
        }
      },
      function (error) {
        if (tag === token) show(error);
      }
    );
  }
  function applyResume() {
    if (!item || resumeApplied) return;
    if (
      requestedResume > 0 &&
      isFinite(v.duration) &&
      requestedResume < v.duration - 5
    ) {
      try {
        if (Math.abs(v.currentTime - requestedResume) > 3)
          v.currentTime = requestedResume;
        resumeApplied = true;
        show("Resuming from " + clock(requestedResume));
      } catch (e) {}
    } else resumeApplied = true;
  }
  function key(e) {
    var k = e.keyCode,
      back = k === 461 || k === 8 || k === 27;
    if (menu) {
      if (back) {
        hideMenu();
        return true;
      }
      if (k === 38 || k === 40) {
        menuIndex = Math.max(
          0,
          Math.min(menu.rows.length - 1, menuIndex + (k === 40 ? 1 : -1))
        );
        renderMenu();
      } else if (k === 13) {
        var action = menu.rows[menuIndex].action;
        hideMenu();
        action();
      }
      return true;
    }
    if (jump.style.display === "block") {
      if (back) {
        hideMenu();
        return true;
      }
      if (k === 13) {
        var value = parseFloat(input.value.replace(",", "."));
        hideMenu();
        seek(value * 60);
        return true;
      }
      return false;
    }
    if (!item) return false;
    if (k === 457) {
      show();
      return true;
    }
    if (k === 405) {
      subtitleMenu();
      return true;
    }
    if (k === 406) {
      jump.style.display = "block";
      input.value = String(Math.floor(v.currentTime / 60));
      input.focus();
      return true;
    }
    if (k === 38 || k === 40) {
      show();
      return true;
    }
    if (k === 37 || k === 39) {
      seek(v.currentTime + (k === 39 ? 30 : -30));
      return true;
    }
    return false;
  }
  window.playerTools = {
    init: function (video, callbacks) {
      v = video;
      api = callbacks;
      overlay = document.getElementById("overlay");
      overlay.textContent = "";
      title = document.createElement("div");
      time = document.createElement("div");
      var bar = document.createElement("div");
      bar.id = "progress";
      fill = document.createElement("div");
      fill.id = "progressFill";
      bar.appendChild(fill);
      notice = document.createElement("div");
      notice.className = "playerHint";
      overlay.appendChild(title);
      overlay.appendChild(time);
      overlay.appendChild(bar);
      overlay.appendChild(notice);
      pauseButton = document.createElement("button");
      pauseButton.textContent = "Ⅱ Pause";
      pauseButton.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      };
      overlay.appendChild(pauseButton);
      v.addEventListener("click", toggle);
      v.addEventListener("mousemove", function () {
        if (item) show();
      });
      overlay.addEventListener("mousemove", function () {
        if (item) show();
      });
      bar.onclick = function (e) {
        var r = bar.getBoundingClientRect();
        seek(((e.clientX - r.left) / r.width) * v.duration);
      };
      subs = document.createElement("div");
      subs.id = "subtitles";
      document.body.appendChild(subs);
      panel = document.createElement("div");
      panel.id = "menuPanel";
      document.body.appendChild(panel);
      jump = document.createElement("div");
      jump.id = "jumpPanel";
      var heading = document.createElement("h2");
      heading.textContent = "Go to minute:";
      input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      var hint = document.createElement("p");
      hint.textContent = "Example: 65 · OK Confirm · BACK Cancel";
      jump.appendChild(heading);
      jump.appendChild(input);
      jump.appendChild(hint);
      document.body.appendChild(jump);
      v.addEventListener("timeupdate", function () {
        update();
        renderSubtitle();
        if (Date.now() - lastSave > 5000) {
          lastSave = Date.now();
          save();
        }
      });
      v.addEventListener("pause", function () {
        if (item) {
          save();
          show();
        }
      });
      v.addEventListener("playing", function () {
        disableNativeSubtitle();
        applyResume();
        show();
      });
      v.addEventListener("loadedmetadata", disableNativeSubtitle);
      v.addEventListener("canplay", disableNativeSubtitle);
      v.addEventListener("loadedmetadata", applyResume);
      v.addEventListener("canplay", applyResume);
      window.addEventListener("beforeunload", save);
      window.addEventListener("pagehide", save);
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) save();
      });
      setInterval(renderSubtitle, 150);
    },
    prepare: function (x, callback) {
      var b = bookmark(x);
      if (b.seconds > 15 && (!b.duration || b.seconds < b.duration - 15))
        openMenu("Resume playback", [
          {
            label: "Continue from " + clock(b.seconds),
            action: function () {
              callback(b.seconds);
            },
          },
          {
            label: "Start from the beginning",
            action: function () {
              store("bookmark:" + x.url, null);
              localStorage.removeItem("position:" + x.url);
              callback(0);
            },
          },
        ]);
      else callback(0);
    },
    open: function (x, pos) {
      token++;
      item = x;
      requestedResume = pos || 0;
      resumeApplied = false;
      tracks = [];
      cues = [];
      selectedTrack = "";
      subtitleStatus = "";
      nativeOffId = "";
      nativePending = "";
      nativeResult = null;
      lastSave = Date.now();
      metadata();
    },
    close: function () {
      save();
      token++;
      item = null;
      cues = [];
      subs.textContent = "";
      clearTimeout(hideTimer);
      hideMenu();
    },
    end: function () {
      if (item) {
        store("bookmark:" + item.url, null);
        localStorage.removeItem("position:" + item.url);
      }
      item = null;
    },
    overlay: show,
    save: save,
    key: key,
    seek: seek,
    toggle: toggle,
    clock: clock,
    parseVtt: parseVtt,
    subtitleMenu: subtitleMenu,
    debug: function () {
      return {
        item: item,
        tracks: tracks,
        cues: cues.length,
        selectedTrack: selectedTrack,
        nativeOffId: nativeOffId,
        nativeResult: nativeResult,
        subtitleStatus: subtitleStatus,
        time: v.currentTime,
        duration: v.duration,
        menu: menu ? menu.title : null,
        bookmark: item ? bookmark(item) : null,
      };
    },
  };
})();
