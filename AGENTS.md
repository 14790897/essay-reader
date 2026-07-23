
## TL;DR
Cross-platform (web + Android) article reading app with dual TTS: **system xpo-speech** and **Volcano Engine Doubao TTS v3 WebSocket**.

- **Stack**: Expo SDK 57.0.0, React Native 0.86, TypeScript 6.0.3
- **Web**: GitHub Pages at https://14790897.github.io/essay-reader/
- **Android**: GitHub Actions workflow_dispatch > APK artifact
- **CI**: .github/workflows/ci.yml (check + build-web + deploy-web) and .github/workflows/android-build.yml (APK)

## Key Files

| File | Purpose |
|------|---------|
| App.tsx | Root component, TTS provider switching |
| src/services/doubaoTTS.ts | Doubao TTS client — **V1 binary WebSocket protocol** |
| src/hooks/useDoubaoTTS.ts | React hook wrapping doubaoTTS.ts, handles audio via expo-av |
| src/hooks/useSpeech.ts | System TTS hook using expo-speech |
| src/components/Player.tsx | Playback controls (play/pause/stop) |
| src/components/Settings.tsx | TTS engine/voice/speed/display settings |
| .github/workflows/ci.yml | Web CI: TS check > Expo export > GitHub Pages deploy |
| .github/workflows/android-build.yml | Android CI: Expo prebuild > Gradle assembleRelease |## Doubao TTS V1 Binary Protocol (Critical)

The Doubao TTS service uses a BINARY WebSocket protocol, NOT plain text JSON.

### Protocol Source
- Official Python: protocols_.py from Volcano Docs download
- API docs: https://docs.volcengine.com/docs/6561/2532486
- Endpoint: wss://openspeech.bytedance.com/api/v3/tts/bidirection

### Binary Frame Format
Byte 0: [Ver(4b)][HdrSize(4b)]  -> 0x11 (v=1,h=1)
Byte 1: [MsgType(4b)][Flags(4b)] -> 0x14 (FullClientReq+WithEvent)
Byte 2: [Ser(4b)][Comp(4b)]     -> 0x10 (JSON+None)
After header: [event:int32BE][sid:u32BE+utf8][payload:u32BE+utf8]

### Constants
MsgType: FullClientReq=1 AudioOnlyServer=11 FullServerResp=9 Error=15
Flags: WithEvent=4 NoSeq=0 PositiveSeq=1 NegativeSeq=3
Events: StartSession=100 FinishSession=102 TaskReq=200 SessionStarted=150 SessionFinished=152

### JSON Payload Rules
1. event field MUST be INTEGER (100,200) NOT string
2. StartSession = {"event":100,"req_params":{"speaker":"...","audio_params":{...}}} (NO text)
3. TaskRequest = {"event":200,"req_params":{"speaker":"...","text":"...","audio_params":{...}}}
4. StartConnection/FinishSession = "{}"
5. session_id goes in binary header, NOT JSON

### Auth: X-Api-Key + X-Api-Resource-Id headers on WebSocket
Browser cannot send custom WS headers -> Doubao TTS only in React Native native.

### Response Parsing
AudioOnlyServer(11) = raw audio bytes. FullServerResponse(9) = JSON text.

## Build Commands
npx tsc --noEmit
npx expo export --platform web --output-dir dist

## Testing Doubao TTS
node test-run.js -> test-output.mp3
API key: 0348cc4e-6e60-4a0f-b1ce-142d00b98350

## Important
- NEVER replace binary protocol with plain JSON in doubaoTTS.ts
- Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/
