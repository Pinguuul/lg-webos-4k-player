# LG HTTP Player: playing 4K HEVC over the network on an older LG webOS TV

A working, experimental workaround for a 2015 LG TV that rejected 4K files in SmartShare but could play compatible files through a custom webOS application.

**Current version: 0.3.2.** The application interface and helper messages are in English. This is an experimental community project, not an LG product or an app in the LG Content Store.

**[Download the installable IPK from Releases](https://github.com/Pinguuul/lg-webos-4k-player/releases/latest)** · **[Ask a question](https://github.com/Pinguuul/lg-webos-4k-player/discussions)** · **[Report a bug](https://github.com/Pinguuul/lg-webos-4k-player/issues)**

Free to download, use, modify and redistribute under the [MIT licence](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for separately installed dependencies.

## What worked

On an **LG 49UF8507-ZB**, running **webOS TV 2.2.3-2155 (beehive-biscayne)** and **firmware 04.06.25**, compatible **2160p HEVC/H.265 files played over the local network with picture and sound** using this custom player.

Verified servers are **MiniDLNA/ReadyMedia 1.3.3 on Linux** and **MiniDLNA 1.2.1 on a Synology DS218+ running DSM 7.4.1**. The reference TV uses wired Ethernet. The original video was delivered to the TV without video transcoding. No root access, modified firmware, external streaming box, or HDMI-connected computer was needed.

This demonstrates network playback of the tested files on this particular TV. It does not establish compatibility with every 4K file or every model in the UF850/UF860 family.

| Component | Verification status |
| --- | --- |
| LG 49UF8507-ZB, webOS 2.2.3, firmware 04.06.25 | Tested on the actual TV |
| MiniDLNA 1.3.3 on Linux | Tested |
| 2160p HEVC playback through the custom application | Picture and sound confirmed by the owner |
| Switching text subtitles and turning them off | Tested through the actual TV application |
| Other UF850V/UF860V regional variants | Not tested |
| Synology DS218+, DSM 7.4.1, MiniDLNA 1.2.1 | Playback tested with player 0.3.0; picture and sound confirmed |
| Official Synology Media Server package | Not tested |
| Subtitle companion running on Synology | Not tested |
| Samsung Tizen TVs | Not supported by this webOS application |

## The original problem

SmartShare displayed:

> Unable to Play — This file cannot be recognised.

Controlled tests showed that a 2160p HEVC sample could play from USB, while the same sample failed through SmartShare over DLNA. A 1080p HEVC control sample played through DLNA. Testing a second complete DLNA server reproduced the 4K failure.

Changing container or advertised resolution did not fix the tested SmartShare cases. These results pointed to a difference in the playback route rather than proving that the TV lacked a suitable video decoder.

The workaround does **not** repair SmartShare or enable a hidden SmartShare setting. It supplies another application on the TV.

## How it works

```text
MiniDLNA on Linux or a Synology NAS
  ├── DLNA catalogue ──> Custom TV app: folders and film list
  └── Original file over HTTP ──> TV's built-in media player

Optional Linux subtitle helper
  └── Selected text subtitle converted to WebVTT ──> App's subtitle overlay
```

DLNA provides the catalogue and media addresses. The app opens the selected address with the TV's built-in video player using the **URI** media transport setting. Inspection of the original SmartShare application showed a separate **DLNA** transport path for network media.

Both routes can involve HTTP delivery. The important change is the player and the transport setting supplied to it, not merely the presence of an HTTP URL.

The TV still decodes the original video and audio. The workaround adds no new codec and does not turn an unsupported audio format, HDR mode, or video profile into a supported one.

## What you need

- A compatible LG webOS TV. The only verified model is listed above.
- LG's Developer Mode application and an [LG developer account](https://webostv.developer.lge.com/login).
- A computer with Node.js, npm, and LG's webOS CLI for installing the TV application. CI uses Node.js 22, Python 3.11 and webOS CLI 3.2.6.
- The application source directory, `app/`, or a package built from that source.
- A media server running MiniDLNA and sharing readable media files. Tested hosts include Linux and a Synology DS218+ NAS.
- The TV and media server on the same reachable local network. Wired Ethernet was used in the tests.
- For the optional subtitle helper: Python 3.9 or newer, FFmpeg, ffprobe, and read access to the MiniDLNA database and media files.

The installation computer does not have to remain running after installation. The media server must remain available during playback; the subtitle helper must also remain available when using its subtitle features.

## Repository contents

```text
app/                            # HTML/CSS/ES5 JavaScript TV application
  appinfo.json
  config.js                     # Generic build defaults, no private addresses
  index.html
  app.js
  features.js
  icon.png
  largeIcon.png
support.py                      # Optional MiniDLNA subtitle companion
support.example.json            # Copy to the excluded support.local.json
package.json / package-lock.json
scripts/                        # Build/source validation
tests/                         # Generated-media integration tests
.github/                        # CI and issue templates
README.md / LICENSE / CHANGELOG.md
```

The application ID is `org.local.lghttptest`; the displayed title is **LG HTTP Player**. The 0.3.2 package is `org.local.lghttptest_0.3.2_all.ipk`.

To obtain the source:

```sh
git clone https://github.com/Pinguuul/lg-webos-4k-player.git
cd lg-webos-4k-player
npm ci
```

## 1. Set up the media server

If MiniDLNA already serves your library successfully, keep that setup and note its IP address and HTTP port.

For a new Debian/Ubuntu installation, an example is:

```sh
sudo apt install minidlna
```

Example entries in `/etc/minidlna.conf`:

```ini
media_dir=V,/srv/media/Movies
friendly_name=My Media Library
port=8200
inotify=yes
```

Create or choose the media directory, ensure the service account can read its contents and traverse its parent directories, then restart the service:

```sh
sudo systemctl restart minidlna
sudo systemctl status minidlna
```

Allow the TV to reach the server's HTTP port. DLNA discovery uses UDP 1900; the current custom player browses a configured server directly, so automatic discovery is not how it selects its server.

The media URLs advertised in the catalogue must point to an address reachable from the TV. This matters on computers with Ethernet, Wi-Fi, VPNs, containers, or several network interfaces.

## 2. Enable Developer Mode on the TV

1. On a computer or phone, open the official [LG webOS TV Developer account page](https://webostv.developer.lge.com/login). Select **Sign In**, then the **Create Account / Sign Up** option in the LG account flow if you do not already have an account. Complete registration and any email verification requested. If you already have an LG account, sign in to the developer website with it and complete any developer registration prompts.
2. Install LG's **Developer Mode** application from the TV's app store.
3. Open it and sign in using the **same email address and password** as your LG developer website account.
4. Enable **Dev Mode Status** and accept the requested restart.
5. Reopen Developer Mode and enable **Key Server**.
6. Note the TV's local IP address and the case-sensitive passphrase displayed by the app.

The account login and the Key Server passphrase serve different purposes. Use the passphrase displayed on your own TV when retrieving its development key. Keep the passphrase and private key out of GitHub.

Follow [LG's Developer Mode guide](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app) for the official setup procedure. Store availability and behaviour on other devices may differ.

## 3. Install the webOS development tools and register the TV

Install the CLI in a suitable Node.js environment:

```sh
npm install -g @webos-tools/cli
ares -V
ares-config --profile tv
ares-setup-device
```

In the interactive device setup, add a device named `my-tv`, using your TV's IP address, port `9922`, and SSH user `prisoner`. Leave the SSH password empty for the Developer Mode workflow.

With Key Server enabled, retrieve the key:

```sh
ares-novacom --device my-tv --getkey
```

Enter the passphrase shown on your TV when prompted.

LG documents the tooling in its [CLI installation instructions](https://webostv.developer.lge.com/develop/tools/cli-installation) and [CLI developer guide](https://webostv.developer.lge.com/develop/tools/cli-dev-guide). This project used the official CLI package. Legacy TV/key compatibility may require additional troubleshooting; do not replace your development credentials with someone else's files.

## 4. Configure the player for your server

Use your own addresses. The following documentation examples use:

| Setting | Example |
| --- | --- |
| Media server | `192.168.1.10` |
| TV | `192.168.1.20` |
| MiniDLNA HTTP port | `8200` |
| Subtitle helper port | `18201` |
| Media directory | `/srv/media/Movies` |

### Application settings

Install the release IPK or build the source, open **LG HTTP Player**, and press **Yellow** for Settings. A fresh installation starts with no media server configured.

Set:

- **Media server address:** for example `http://192.168.1.10:8200`, with no media path or `/ctl/ContentDir` suffix.
- **Catalogue root ID:** `64` for the tested MiniDLNA Folders view, or `0` for the UPnP root. Use the appropriate object ID for your catalogue.
- **Subtitle service URL:** optional; leave blank to use the media server's hostname on port `18201`, or enter a separate helper URL such as `http://192.168.1.11:18201`.

Select **Save**. Settings persist in the TV app's local storage. Build-time defaults can also be supplied in `app/config.js`.

The SOAP endpoint remains `/ctl/ContentDir`, matching the tested MiniDLNA server. This release does not implement generic server discovery or automatic discovery of different ContentDirectory endpoints.

### Optional subtitle helper settings

Copy the example and edit your private configuration:

```sh
cp support.example.json support.local.json
```

`support.local.json` is excluded by `.gitignore`. Its fields are:

| Setting | Meaning |
| --- | --- |
| `media_root` | Existing media directory indexed by MiniDLNA |
| `database` | Actual MiniDLNA `files.db` location; opened read-only |
| `cache` | Writable directory for generated WebVTT, outside the media root |
| `host` | Bind address; `0.0.0.0` listens on IPv4 interfaces, `127.0.0.1` is local-only |
| `port` | Helper HTTP port, normally `18201` |
| `allowed_clients` | Explicit allowed IP addresses, including your TV and any diagnostic client |

Use absolute paths. The example media directory and TV address must be changed to match your installation. The helper must be able to read the same MiniDLNA database and film files served by your media server.

## 5. Build, install, and launch the player

If using a release download, skip packaging and install that `.ipk`. To build from source, first run `npm ci`, then use the commands below from the project directory:

```sh
mkdir -p dist
npm run build
ares-install --device my-tv dist/org.local.lghttptest_0.3.2_all.ipk
ares-launch --device my-tv org.local.lghttptest
```

Match the filename to the version in `app/appinfo.json` if you change it.

To update an existing installation, close the app first, then package and install the new build:

```sh
ares-launch --device my-tv --close org.local.lghttptest
```

After installation, open **LG HTTP Player** from the TV's app launcher. Browse the server's folders and select a compatible film.

The application declares a 1920×1080 interface layout. This describes the UI coordinate space; it is not a request to transcode a 2160p film to 1080p.

## 6. Optional: enable subtitle selection

The helper reads the selected file's subtitle tracks with ffprobe and converts a requested **text subtitle** to WebVTT or renders a requested **PGS image subtitle** as timed PNG images with FFmpeg. It does not re-encode the film's video or audio.

Install the tools on the Linux media server, then run the configured helper as an ordinary user:

```sh
sudo apt install python3 ffmpeg
python3 support.py --config support.local.json
```

The helper account needs read access to the database, the film, and any external subtitle, plus write access to its cache directory. Parent directories must allow traversal. Use appropriate ownership, groups, or targeted ACLs; a blanket `chmod 777` is unnecessary.

From an allowed client on the server, check:

```sh
curl http://127.0.0.1:18201/health
```

Expected response:

```json
{"ok": true}
```

For regular use, run the helper under your operating system's service manager, using its absolute script path, `--config /absolute/path/to/support.local.json`, a suitable working directory, and a non-root account with the permissions above. Start it after the media disk is mounted. The original installation used a systemd service.

### Subtitle behaviour

- Embedded text formats such as SubRip, ASS/SSA, and WebVTT are converted to plain WebVTT captions. Rich ASS styling is not preserved by the custom renderer.
- External `.srt`, `.vtt`, `.ass`, and `.ssa` files are discovered when their names begin with the film's basename.
- A filename such as `My Film.ro.srt` can identify an external Romanian subtitle.
- A generic external filename may appear as “Unspecified language · External file”.
- PGS image subtitles are supported starting with **player and helper 0.3.2**. The helper renders short, overlapping segments to transparent PNG images with timing; the TV app overlays them without OCR or video transcoding. Update both components. Other image subtitle codecs remain unsupported.
- Image segments are prepared around the current playback position and cached. A short preparation gap can occur after selecting a new track or seeking to an uncached position. This requires FFmpeg with PGS decoding, PNG encoding and `-fps_mode` support (FFmpeg 5 or newer).
- Tracks with missing language metadata appear as numbered tracks with “Unspecified language”; no language is guessed from a filename.
- The cache now includes image subtitle segments as well as text subtitles. Place it on a disk with adequate free space; remove obsolete cache data only when the helper is stopped.
- First-time extraction from a large film can take several minutes. The helper currently has a 240-second extraction timeout; a very slow or large source can fail.
- Converted subtitles are cached. Later selections of the same cached track are faster.
- Subtitle selection is remembered for the film URL.
- This is selection of existing subtitle tracks, not automatic translation.

### Why version 0.2.2 matters

The initial custom overlay did not disable the TV's native subtitle renderer. This allowed the original subtitle to remain visible when another track was chosen.

Version 0.2.2 sends `setSubtitleEnable` with `enable: false` to `luna://com.webos.media/`, using the current HTML video's `mediaId`, then displays the selected captions itself. The actual tested TV returned `returnValue: true`.

This platform-specific service call is an observed capability on the tested firmware, not a promise of a portable public API across all webOS releases. A successful conversion alone does not prove the TV disabled its native captions.

## Remote-control guide

| Screen | Button | Action |
| --- | --- | --- |
| Library | Up / Down | Select an item |
| Library | Left / Right | Move by a page |
| Library | OK | Open a folder or play a film |
| Library | BACK | Return to the parent folder |
| Library | 0 | Return to the configured starting folder |
| Library | 9 | Reload the catalogue |
| Library | Yellow | Open server settings |
| Film | OK | Toggle pause/play |
| Film | Left / Right | Seek approximately 30 seconds |
| Film | Blue | Enter a position in minutes, then press OK |
| Film | Yellow | Open subtitle selection |
| Subtitle menu | Up / Down, then OK | Choose a track or “Off” |
| Film | INFO | Toggle file details and actual playback resolution |
| Film | Up / Down | Show the playback controls |
| Film | BACK | Stop playback and return to the library |
| Menu | BACK | Close the menu |

Press **INFO** during a film to show the actual decoded resolution reported by the TV, playback position and duration, playback state, source host and file type. File size and server-advertised bitrate are shown when the catalogue provides them; buffered time ahead appears when the TV exposes it. Catalogue resolution is only used as a labelled fallback while decoded dimensions are unavailable. This panel does not infer codecs, HDR or bit depth from a filename. Press INFO again or BACK to close it; a subsequent BACK returns to the library.

A visible pause/play button and clickable progress bar are also available for pointer input.

The app saves playback position locally and offers “Continue from…” or “Start from the beginning”. Bookmarks are tied to the film URL and this app's local storage, not to a NAS user account. Clearing app data or changing URLs can lose that association.

These controls are implemented, but validation was not exhaustive for every media file and remote. Some broader seek/pause checks were interrupted by simultaneous remote input; they should not be reported as comprehensive passing tests.

The app uses `disableBackHistoryAPI: true` and handles webOS Back events to return to its library instead of leaving the player immediately.

## Synology NAS: verified with MiniDLNA

**Network playback was verified on a Synology DS218+ running DSM 7.4.1 and MiniDLNA 1.2.1, using LG HTTP Player 0.3.0 on the reference LG TV.** The owner confirmed both picture and sound on 8 November 2026.

The player browsed the NAS catalogue, selected the copied film from it, and opened the original file directly from the NAS. The TV reported 3840×1600 video, an advancing playback position and no media error. No application-code change or video transcoding was needed.

Test media characteristics:

| Property | Tested file |
| --- | --- |
| Container | Matroska / MKV |
| Video | HEVC Main, 8-bit, 3840×1600, 24 fps |
| Audio | E-AC-3, 6 channels |
| File size | Approximately 13.86 GB |
| Average total bitrate | Approximately 15.5 Mb/s |
| Duration | Approximately 1 hour 59 minutes |

The file is a cropped, 4K-width encode commonly labelled 2160p; its actual stored frame height is 1600 pixels. This test does not establish support for every full-frame 3840×2160 file, HDR format, bitrate, or codec combination on the NAS.

### Configure the player for a NAS running MiniDLNA

In the TV app, press **Yellow**, then set:

- **Media server address:** `http://YOUR_NAS_IP:8200` (use your MiniDLNA port if different).
- **Catalogue root ID:** `64` for the tested Folders view; use `0` or another appropriate object ID for your catalogue.
- **Subtitle service URL:** optional; a working companion service must be configured separately for that server's database and media files.

Save, open the media folder, and select the film. Wait until copying is complete and MiniDLNA has indexed it before judging compatibility.

This result applies to **MiniDLNA running on Synology hardware**, not to the official **Synology Media Server** package, which remains untested. A different server can require discovery of its actual ContentDirectory control URL, catalogue object IDs, and reachable media addresses.

The subtitle companion was not installed or validated on the NAS in this test. It requires Python, FFmpeg, read access to the relevant MiniDLNA database and library, and its own configuration. The Linux helper cannot safely be reused just by changing the server URL: media IDs refer to a particular server's catalogue and can point to different files on another server.

## Troubleshooting

### The app cannot list the library

Verify the configured server IP and port, service status, firewall, SOAP endpoint, and starting object ID. A working SmartShare discovery result does not prove this app's MiniDLNA endpoint matches your server.

Check for an advertised address from an unreachable VPN or container interface. Do not assume the IP used to browse the catalogue is also the IP returned in the film's URL.

### The library works but a film does not play

Try a small known-compatible file first, followed by a short sample of the problem file. Test the same sample through USB and the custom player to separate file compatibility from the network route.

Inspect its streams:

```sh
ffprobe -v error -show_streams -show_format -of json "/path/to/film.mkv"
```

Resolution alone is insufficient. Consider codec, profile, bit depth, frame rate, bitrate, audio format, and container. A file labelled 2160p is not automatically compatible, and successful SDR playback does not establish HDR support.

### There is picture but no sound

Inspect the audio codec and track. The current UI does not provide an audio-track selector or automatic audio conversion. Working audio for tested files does not establish support for every DTS, Dolby, or other audio variant.

### Subtitle selection appears to do nothing

Use version 0.2.2 or later. Check whether the app is still preparing the subtitle, whether the helper is reachable, and whether the selected track is supported by your helper version. PGS requires both the app and helper from version 0.3.2 or newer.

At a point in the film where the selected track has no dialogue, an empty overlay can be correct. Test at a known subtitle timestamp. Also verify that the native subtitle-disable request succeeds on your particular TV.

### The helper returns HTTP 403

Check its client-IP allowlist. A changed DHCP address can cause this; reserving the TV's address can help. Also check whether the request travels through a different interface than expected.

### The helper cannot read the film or database

Check the configured paths, the actual MiniDLNA database location, read permissions, and directory traversal permissions. The database lookup is by MiniDLNA detail ID; the server and helper must refer to the same catalogue and library.

### The app disappears after Developer Mode expires

LG documents that Developer Mode has a limited session and that development apps are uninstalled when it is disabled. Extend the session while it remains active, following [LG's session-management instructions](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app). This project does not provide a permanent installation mechanism or automatic renewal.

### The TV does not show a newly created file

Allow the media server to index it. Confirm it appears in the server's catalogue, then refresh the player with **9**. SmartShare's list, this app's list, and a USB directory view are different views; do not assume that seeing a file in one proves it is present in another.

## Implementation note: the playback setting

The central playback idea is to create an HTML video source with a webOS media option similar to this:

```js
var source = document.createElement('source');
source.src = mediaUrl;
source.type = 'video/mp4;mediaOption=' + encodeURI(JSON.stringify({
  mediaTransportType: 'URI'
}));
video.appendChild(source);
video.load();
video.play();
```

This is an explanatory excerpt, not the complete app. The shipped source also implements catalogue browsing, settings, resume handling, remote buttons, and subtitles. The tested full implementation is the reference for reproduction.

## Verification record

The owner confirmed picture and sound from the custom player's tested 4K files on the real TV.

The version 0.2.2 subtitle regression also ran inside the real TV application and passed these checks:

1. Select the external Romanian text track.
2. At 103 seconds in the test source, display the expected Romanian caption.
3. Confirm the native subtitle-disable service returned success.
4. Switch to the English track and confirm the previous Romanian caption is removed at that timestamp.
5. Select Off and confirm the custom captions clear.

JavaScript syntax checks and packaging/installing the application also passed. The original actual-TV harness used private library references and is not distributed. The public tests generate their own small media and subtitle fixtures.

Version 0.2.3 translates the application UI and helper responses into English. JavaScript syntax checks, Python compilation, packaging, installation, and an inspection of the actual TV interface passed. The running helper returned English track labels and error messages. This language update does not change the playback implementation.

Version 0.3.0 was installed on the same TV. Its clean first-run prompt, settings fields, saving the server/root settings and browsing the MiniDLNA library were checked on the real device. The new helper configuration and conversion flow passed the public integration tests.

The Synology/MiniDLNA playback test above is an additional actual-device verification. Player 0.3.1 was also checked on the same NAS file: INFO displayed the TV-reported 3840×1600 resolution, file size, server bitrate and buffer information while playback continued. BACK closed the panel without stopping the film.

No exhaustive codec certification, official Synology Media Server test, all-model compatibility test, or firmware patch is claimed.

## Development and releases

```sh
npm ci
npm run check
npm test
npm run build
```

The checks validate JavaScript/Python syntax, app metadata, packaged assets and generic defaults. Integration tests run the real helper against a temporary MiniDLNA-style SQLite catalogue and generated FFmpeg media, including subtitle conversion, path confinement and client access checks. They do not replace testing on an actual TV.

The repository CI runs these checks and builds an IPK artifact. Published releases attach the installable IPK and `SHA256SUMS.txt`; GitHub also provides tagged source archives. See [CHANGELOG.md](CHANGELOG.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

Private credentials, local helper configuration, subtitle caches, media, logs, firmware and `node_modules` must stay out of the repository. The application ships only original project artwork and does not bundle the LG SDK. Keep the compatibility table accurate as other owners test their devices.

## Background and references

- The [AVForums UF850V/UF860V owners' discussion](https://www.avforums.com/threads/2015-lg-uf850v-uf860v-4k-ultra-hd-tv-discussion-help-experiences.1973880/) includes an early report of the same SmartShare 4K network-playback symptom.
- [LG Developer Mode setup](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app) covers connecting a development computer and TV.
- [LG CLI installation](https://webostv.developer.lge.com/develop/tools/cli-installation) and [CLI command reference](https://webostv.developer.lge.com/develop/tools/cli-dev-guide) cover packaging and deployment.

The specific playback and subtitle results above come from this project's actual-TV testing, not from an official LG guarantee.
