# Moon Voice Room Service

This service issues short-lived LiveKit access tokens. The API key and secret stay on the server; they must never be added to the launcher or committed to Git.

## Configure

1. Create a LiveKit Cloud project or deploy a reachable LiveKit server. For friends joining over the internet, the LiveKit service needs a public address and working UDP/TURN connectivity.
2. Copy `.env.example` to `.env` and set `LIVEKIT_API_URL`, `LIVEKIT_WS_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` from the LiveKit project. Keep `.env` private.
3. Run `npm ci && npm start`, or build the included Dockerfile and pass the variables through the deployment platform.
4. Expose this token service through HTTPS and use that public URL in the launcher's **Voice service URL** field.

The launcher stores the service URL and display name locally. Room codes are private invite codes, not account authentication. Anyone with a code can join while the room is open. The LiveKit room enforces an eight-participant limit and expires after it is empty for five minutes. The API applies an in-memory per-IP request limit; production deployments should also rate-limit at their reverse proxy.

This repository does not include a LiveKit media server or a hosted public endpoint. A token service alone is not enough for audio: a reachable LiveKit server is required. LiveKit Cloud can provide that media service, or you can self-host it and configure its public network/TURN ports.
