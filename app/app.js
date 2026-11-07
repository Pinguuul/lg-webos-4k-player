(function () {
  "use strict";
  var config = window.LG_PLAYER_CONFIG || {},
    base = localStorage.getItem("lgPlayerServer") || config.serverUrl || "",
    rootId = localStorage.getItem("lgPlayerRoot") || config.rootId || "64",
    subtitleBase =
      localStorage.getItem("lgPlayerSubtitles") || config.subtitleServer || "",
    stack = [{ id: rootId, title: "Media Library / Folders", selected: 0 }],
    items = [],
    selected = 0,
    playing = false,
    loading = false,
    settings = false,
    current = null,
    overlayTimer = null,
    saveAt = 0;
  var v = document.getElementById("video"),
    box = document.getElementById("items"),
    browser = document.getElementById("browser"),
    message = document.getElementById("message"),
    overlay = document.getElementById("overlay");
  function report(event, data) {
    console.log(event, JSON.stringify(data));
  }
  function localName(e) {
    return e.localName || e.nodeName.split(":").pop();
  }
  function descendants(e, name) {
    var all = e.getElementsByTagName("*"),
      a = [],
      i;
    for (i = 0; i < all.length; i++)
      if (localName(all[i]) === name) a.push(all[i]);
    return a;
  }
  function text(e, name) {
    var a = descendants(e, name);
    return a.length ? a[0].textContent : "";
  }
  function escapeXml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function request(id, start, success, failure) {
    var xhr = new XMLHttpRequest(),
      body =
        '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:Browse xmlns:u="urn:schemas-upnp-org:service:ContentDirectory:1"><ObjectID>' +
        escapeXml(id) +
        "</ObjectID><BrowseFlag>BrowseDirectChildren</BrowseFlag><Filter>*</Filter><StartingIndex>" +
        start +
        "</StartingIndex><RequestedCount>200</RequestedCount><SortCriteria></SortCriteria></u:Browse></s:Body></s:Envelope>";
    xhr.open("POST", base + "/ctl/ContentDir", true);
    xhr.timeout = 12000;
    xhr.setRequestHeader("Content-Type", 'text/xml; charset="utf-8"');
    xhr.setRequestHeader(
      "SOAPAction",
      '"urn:schemas-upnp-org:service:ContentDirectory:1#Browse"'
    );
    xhr.onload = function () {
      try {
        if (xhr.status !== 200) throw Error("HTTP " + xhr.status);
        var outer = new DOMParser().parseFromString(
            xhr.responseText,
            "text/xml"
          ),
          xml = text(outer, "Result"),
          total = parseInt(text(outer, "TotalMatches"), 10) || 0,
          d = new DOMParser().parseFromString(xml, "text/xml"),
          nodes = d.documentElement.childNodes,
          result = [],
          i,
          j;
        for (i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          if (n.nodeType !== 1) continue;
          var resource = null,
            folder = localName(n) === "container",
            url = "",
            res = descendants(n, "res");
          for (j = 0; j < res.length; j++)
            if (
              (res[j].getAttribute("protocolInfo") || "").indexOf(":video/") >=
              0
            ) {
              url = res[j].textContent;
              resource = res[j];
              break;
            }
          if (folder || url)
            result.push({
              id: n.getAttribute("id"),
              title: text(n, "title"),
              folder: folder,
              url: url,
              resolution: resource ? resource.getAttribute("resolution") : null,
              size: resource ? resource.getAttribute("size") : null,
              bitrate: resource ? resource.getAttribute("bitrate") : null,
            });
        }
        success(
          result,
          total,
          parseInt(text(outer, "NumberReturned"), 10) || 0
        );
      } catch (e) {
        failure(e.message);
      }
    };
    xhr.onerror = function () {
      failure("The server is not responding. Check the address in Settings.");
    };
    xhr.ontimeout = function () {
      failure("The connection to the media server timed out.");
    };
    xhr.send(body);
  }
  function render() {
    box.textContent = "";
    var first = Math.floor(selected / 8) * 8,
      end = Math.min(first + 8, items.length),
      i;
    for (i = first; i < end; i++) {
      var row = document.createElement("div");
      row.className =
        "row" +
        (i === selected ? " selected" : "") +
        (items[i].folder ? " folder" : "");
      row.textContent = (items[i].folder ? "▸  " : "▶  ") + items[i].title;
      (function (index) {
        row.onclick = function () {
          selected = index;
          openSelected();
        };
      })(i);
      box.appendChild(row);
    }
    document.getElementById("counter").textContent = items.length
      ? selected + 1 + " / " + items.length
      : "";
    document.getElementById("path").textContent = stack
      .map(function (x) {
        return x.title;
      })
      .join(" / ");
  }
  function browse() {
    if (!base) {
      loading = false;
      items = [];
      message.textContent =
        "Press Yellow to configure your media server in Settings.";
      render();
      return;
    }
    loading = true;
    items = [];
    selected = stack[stack.length - 1].selected || 0;
    message.textContent = "Loading…";
    render();
    var id = stack[stack.length - 1].id;
    function page(start) {
      request(
        id,
        start,
        function (a, total, count) {
          items = items.concat(a);
          if (start + count < total && count > 0) {
            page(start + count);
            return;
          }
          loading = false;
          selected = Math.max(0, Math.min(selected, items.length - 1));
          message.textContent = items.length
            ? ""
            : "This folder contains no videos or subfolders.";
          render();
          report("browse-ready", { id: id, count: items.length });
        },
        function (error) {
          loading = false;
          message.textContent =
            error + " Press 9 to retry or Yellow for Settings.";
          report("browse-error", error);
        }
      );
    }
    page(0);
  }
  function showOverlay(t) {
    window.playerTools.overlay(t);
  }
  function stop() {
    if (!playing) return;
    playing = false;
    window.playerTools.close();
    v.pause();
    v.removeAttribute("src");
    while (v.firstChild) v.removeChild(v.firstChild);
    v.load();
    playing = false;
    v.style.display = "none";
    overlay.style.display = "none";
    browser.style.display = "block";
    render();
  }
  function play(item) {
    window.playerTools.prepare(item, function (pos) {
      startPlayback(item, pos);
    });
  }
  function startPlayback(item, pos) {
    current = item;
    playing = true;
    saveAt = 0;
    browser.style.display = "none";
    v.style.display = "block";
    window.playerTools.open(item, pos);
    while (v.firstChild) v.removeChild(v.firstChild);
    var s = document.createElement("source");
    s.src = item.url;
    s.type =
      "video/mp4;mediaOption=" +
      encodeURI(
        JSON.stringify({
          mediaTransportType: "URI",
          option: {
            transmission: {
              playTime: { start: Math.round((pos || 0) * 1000) },
            },
          },
        })
      );
    v.appendChild(s);
    v.load();
    v.play();
    showOverlay();
    report("play-start", { id: item.id });
  }
  function openSelected() {
    if (loading || !items.length) return;
    var x = items[selected];
    stack[stack.length - 1].selected = selected;
    if (x.folder) {
      stack.push({ id: x.id, title: x.title, selected: 0 });
      browse();
    } else play(x);
  }
  var lastBack = 0;
  function back() {
    if (Date.now() - lastBack < 220) return;
    lastBack = Date.now();
    if (settings) {
      closeSettings();
      return;
    }
    if (playing) {
      stop();
      return;
    }
    if (stack.length > 1) {
      stack.pop();
      browse();
    } else
      message.textContent = "You are in the main folder. Press HOME to exit.";
  }
  function openSettings() {
    if (playing) stop();
    settings = true;
    browser.style.display = "none";
    document.getElementById("settings").style.display = "block";
    document.getElementById("serverInput").value = base;
    document.getElementById("rootInput").value = rootId;
    document.getElementById("subtitleInput").value = subtitleBase;
    document.getElementById("serverInput").focus();
  }
  function closeSettings() {
    settings = false;
    document.getElementById("settings").style.display = "none";
    browser.style.display = "block";
  }
  function saveSettings() {
    var value = document
        .getElementById("serverInput")
        .value.replace(/\s/g, "")
        .replace(/\/$/, ""),
      root = document.getElementById("rootInput").value.trim(),
      helper = document
        .getElementById("subtitleInput")
        .value.replace(/\s/g, "")
        .replace(/\/$/, "");
    if (!/^http:\/\/[^/]+$/.test(value)) {
      alert("Enter a server URL, for example http://192.168.1.10:8200");
      return;
    }
    if (!root) {
      alert(
        "Enter a catalogue root ID, usually 64 for MiniDLNA folders or 0 for the UPnP root."
      );
      return;
    }
    if (helper && !/^http:\/\/[^/]+$/.test(helper)) {
      alert("Enter an HTTP subtitle service URL or leave it blank.");
      return;
    }
    base = value;
    rootId = root;
    subtitleBase = helper;
    localStorage.setItem("lgPlayerServer", base);
    localStorage.setItem("lgPlayerRoot", rootId);
    localStorage.setItem("lgPlayerSubtitles", subtitleBase);
    closeSettings();
    stack = [{ id: rootId, title: "Media Library / Folders", selected: 0 }];
    browse();
  }
  document.getElementById("save").onclick = saveSettings;
  document.getElementById("cancel").onclick = closeSettings;
  document.addEventListener(
    "keydown",
    function (e) {
      var k = e.keyCode;
      if (k === 8 || k === 27) k = 461;
      if (window.playerTools.key(e)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (k === 461) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (settings) {
        if (k === 461) {
          e.preventDefault();
          back();
        } else if (k === 13) saveSettings();
        return;
      }
      if (
        [
          13, 32, 37, 38, 39, 40, 48, 57, 461, 405, 406, 457, 179, 415, 19, 413,
        ].indexOf(k) >= 0
      )
        e.preventDefault();
      if (k === 461) {
        back();
        return;
      }
      if (k === 405) {
        openSettings();
        return;
      }
      if (playing) {
        if (k === 13 || k === 179 || k === 32 || k === 415) {
          window.playerTools.toggle();
        } else if (k === 37 || k === 39) {
          try {
            v.currentTime = Math.max(
              0,
              Math.min(v.duration - 1, v.currentTime + (k === 39 ? 30 : -30))
            );
          } catch (err) {}
          showOverlay();
        } else if (k === 19) v.pause();
        else if (k === 413) stop();
        return;
      }
      if (k === 48) {
        stack = [{ id: rootId, title: "Media Library / Folders", selected: 0 }];
        browse();
      } else if (k === 57) browse();
      else if (k === 38 || k === 40) {
        selected = Math.max(
          0,
          Math.min(items.length - 1, selected + (k === 40 ? 1 : -1))
        );
        render();
      } else if (k === 37 || k === 39) {
        selected = Math.max(
          0,
          Math.min(items.length - 1, selected + (k === 39 ? 8 : -8))
        );
        render();
      } else if (k === 13) openSelected();
    },
    true
  );
  document.addEventListener("webOSPlatformBack", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (window.playerTools.key({ keyCode: 461 })) return;
    back();
  });
  v.addEventListener("playing", function () {
    report("playing", {
      id: current ? current.id : "",
      width: v.videoWidth,
      height: v.videoHeight,
    });
    showOverlay();
  });
  v.addEventListener("ended", function () {
    window.playerTools.end();
    if (current) localStorage.removeItem("position:" + current.url);
    stop();
  });
  v.addEventListener("error", function () {
    if (!playing) return;
    var code = v.error ? v.error.code : "?";
    report("play-error", { id: current ? current.id : "", code: code });
    stop();
    message.textContent = "Unable to play this file (code " + code + ").";
  });
  window.lgPlayer = {
    browse: browse,
    play: play,
    items: function () {
      return items;
    },
    stop: stop,
  };
  window.playerTools.init(v, {
    server: function () {
      return base;
    },
    subtitleServer: function () {
      return subtitleBase;
    },
  });
  report("boot", { version: "0.3.1" });
  browse();
})();
