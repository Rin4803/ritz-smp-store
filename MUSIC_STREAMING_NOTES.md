# RitzSMP music streaming implementation notes

## Verified external requirements

- yt-dlp's official EJS guide states that current YouTube extraction needs an external JavaScript runtime and the `yt-dlp-ejs` challenge-solver scripts. Deno is the recommended runtime; Node 22+ is supported when enabled with `--js-runtimes node`. Source: https://github.com/yt-dlp/yt-dlp/wiki/EJS
- The same guide documents `--remote-components ejs:github` and `--remote-components ejs:npm` as ways to obtain the EJS scripts. The implementation should surface extraction failures rather than silently continue when these components are unavailable. Source: https://github.com/yt-dlp/yt-dlp/wiki/EJS
- The Discord.js voice guide documents that `createAudioResource` can use `StreamType.Raw` for raw PCM and that FFmpeg is needed to convert unknown audio formats to an Opus-compatible stream. It also recommends handling errors from the AudioPlayer and notes that `inlineVolume` has a performance cost. Source: https://discordjs.guide/voice/audio-resources

## Design decision

The production path is `yt-dlp -> FFmpeg (48 kHz, stereo, signed 16-bit little-endian PCM) -> createAudioResource(inputType: StreamType.Raw) -> Discord voice connection`. A failed extractor or transcoder must emit an error and skip/stop the track. An infinite zero-filled fallback is prohibited because it makes the player appear to be playing while producing silence.
