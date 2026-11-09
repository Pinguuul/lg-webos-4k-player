# Public release requirements

Publish a public, free-to-use project at Pinguuul/lg-webos-4k-player under MIT, with a review of redistributed assets and an installable IPK release.

Include English documentation, application menus and helper messages. Remove original installation addresses, filesystem paths, credentials, media and diagnostic logs. Let another user configure the server, catalogue root and optional subtitle helper without editing bundled JavaScript. Let the helper load its paths and client allowlist from an excluded local config file.

Retain the working URI playback and subtitle rendering implementation. Document the verified LG 49UF8507-ZB/webOS 2.2.3/MiniDLNA Linux setup and state only the scope of Synology compatibility actually verified. Avoid promising universal codec, hardware or firmware compatibility.

Provide dependency/build instructions, meaningful configuration/helper tests, a CI check workflow, issue templates, a changelog, a downloadable IPK with checksum, repository topics and Discussions. Publish no private local files.

## Compatibility evidence added after initial release

On 8 November 2026, player 0.3.0 was tested with MiniDLNA 1.2.1 on Synology DS218+/DSM 7.4.1. The TV owner confirmed picture and sound. This supersedes the initial unverified Synology status only for that MiniDLNA setup. The official Synology Media Server package and NAS subtitle helper remain untested.

## INFO-button details request

During playback, INFO must toggle an English details panel, prioritising the actual video dimensions reported by the TV over catalogue resolution. Show available position/duration, state, source, file type, file size, server-advertised bitrate and buffered time. Label a catalogue fallback honestly. BACK closes the panel before stopping playback; clear the panel when a film closes. Do not infer unsupported codec/HDR information from filenames. Verify on the current NAS file and publish an updated installable release.

## PGS subtitle repair

The user reported that every subtitle in the current UHD Blu-ray M2TS film was marked image-based/unavailable. Live helper metadata identified five PGS tracks; native TV selectTrack/setSubtitleEnable returned success but the owner confirmed no subtitles were visible. Support these tracks through transparent timed image overlays without converting the video or inventing language metadata. Preserve text subtitles and INFO behaviour. Verify decoded image timing/clear events on synthetic media and actual TV rendering; document the required helper upgrade.

PGS acceptance result, 9 November 2026: the owner confirmed that subtitles are visible with the new overlay. The source/helper can now be published as version 0.3.2. Do not expand this into a claim that every track, language or file has been tested.
