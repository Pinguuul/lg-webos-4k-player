# Changelog

## 0.3.2

- Render PGS image subtitles as timed transparent PNG overlays, prepared in short overlapping segments without OCR or video transcoding. Requires the updated subtitle helper as well as the TV app.
- Number subtitle tracks when language metadata is absent. Preserve text subtitle conversion and the INFO panel.
- Add generated PGS integration coverage and UI tests for selecting image subtitles and turning them off.

## 0.3.1

- Add an INFO-button playback details panel showing actual TV video resolution, position/duration, state, source and available file/buffering metadata. INFO or BACK closes the panel.
- Include automated tests for the details panel and preserve ES5 compatibility.

## Documentation update — 8 November 2026

- Verify player 0.3.0 playback from MiniDLNA 1.2.1 on a Synology DS218+ running DSM 7.4.1, with picture and sound confirmed by the owner.
- Document NAS settings and tested media characteristics; distinguish this result from the untested official Synology Media Server package and NAS subtitle companion.
- No application-code or IPK change.

## 0.3.0 — first public release

- Publish the English TV application and optional MiniDLNA subtitle companion under MIT.
- Add first-run server settings, configurable catalogue root and an optional separate subtitle service address.
- Move helper paths, listen address, port and allowed clients to a private JSON configuration file.
- Replace template artwork with original project icons; omit the unused LG SDK.
- Include installation instructions, automated checks, release package and compatibility limitations.

## Local prototype history

- 0.2.3: English UI and subtitle service messages.
- 0.2.2: disable native subtitles before rendering the selected text track; verified subtitle switching on the actual LG TV.
- Earlier local prototypes established working 4K HEVC playback through the URI media transport on the LG 49UF8507-ZB.
