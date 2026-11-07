# Contributing

Please use English in issues, documentation and user interface text.

Report your exact TV model, webOS version, firmware version, media server and a sanitised ffprobe summary. Distinguish confirmed results from guesses. Do not attach private keys, account details, personal addresses, copyrighted films or subtitle files.

Keep the TV application compatible with the old JavaScript engine in webOS 2: use ES5 syntax and avoid unsupported browser APIs. No Node.js APIs run inside the TV app. Keep network configuration out of committed private configuration files. Preserve the URI playback route unless testing proves a change is safe.

For local checks, install the dependencies with `npm ci`, then run `npm run check`, `npm test`, and `npm run build`. The integration tests require Python 3.9+ and FFmpeg/ffprobe. Automated tests do not certify playback on a real television. Include actual-TV evidence for playback changes and mark untested hardware clearly.

The repository uses GitHub Issues for bugs and feature requests, and GitHub Discussions for questions and compatibility reports. Pull requests should explain the problem, the resulting behaviour, and the checks performed. Keep changes focused.
