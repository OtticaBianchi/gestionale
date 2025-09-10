# Voice Transcription – Current Status (2025‑09‑10)

This note captures exactly what we changed for voice‑note transcription, what we observed, why it still fails, and the next steps to finish it fast next time we pick it up.

## Summary
- Goal: have Telegram voice notes automatically transcribed and the text visible in Voice Triage and copied into the linked busta’s “Note Generali”.
- Result so far: UI and server flows are wired, but AssemblyAI transcription keeps failing in your environment. Transcription text is therefore empty and the busta block shows “(nessuna trascrizione)”.

## What’s Failing (Primary Symptom)
- Server logs show AssemblyAI returning a 404 HTML page when creating a transcript:
  - Error: `AssemblyAI create transcript failed: 404 <html>404: Not Found</html>`
  - Stack: in `safeTranscribeIfRequested()` during `POST https://api.assemblyai.com/v2/transcripts`.
- A 404 HTML from that endpoint suggests the request is not hitting AssemblyAI’s JSON API (likely a local proxy/VPN/dev intercept or network egress issue), not a normal AAI error.

## Changes Implemented
- Display transcription in triage UI (if present)
  - File: `src/app/dashboard/voice-notes/page.tsx`
  - Read and render `note.transcription` in the note card and in the “Nota selezionata” panel.

- Append/replace transcription in busta notes (idempotent)
  - File: `src/app/api/voice-notes/[id]/route.ts`
  - When linking a note to a busta (or re‑transcribing), the server appends a block in `buste.note_generali` with marker `[VoiceNote <id>]`.
  - If a block already exists with “(nessuna trascrizione)”, a later successful transcription replaces that block text rather than duplicating it.

- Immediate transcription on ingest (triage‑first UX)
  - File: `src/app/api/voice-notes/route.ts`
  - After saving a Telegram note, we start a background transcription attempt so the triage card can show text without waiting for linking.

- AssemblyAI helper hardening
  - File: `src/lib/transcription/assemblyai.ts`
  - Upload uses `application/octet-stream` (safer), and we infer audio MIME from `audio_file_path` (ogg/webm/mp3/m4a) to reduce mis‑detection issues.

## Why This Didn’t Fix It
- The failure is environmental, not logic: the `create transcript` step returns an HTML 404, which points to a network/proxy route problem reaching `https://api.assemblyai.com/v2/transcripts`. With network blocked or intercepted, both the background transcription on ingest and the re‑do flow will keep failing.

## Confirmed Behaviors (when/if network works)
- Triaging shows the transcription immediately once the background task succeeds.
- Linking a note to a busta appends the text in “Note Generali” once; subsequent successful transcriptions update the same block.
- UI now renders `transcription` text; if empty, it falls back to `note_aggiuntive` or shows nothing.

## Next Steps (Actionable Checklist)
1) Verify environment + key
- Ensure `ASSEMBLYAI_API_KEY` is set in the deployed environment (Vercel) and not just locally.
- From the same environment that runs the API, curl the endpoints to confirm routing is OK:
  ```bash
  # Expect JSON (200/201 or 4xx with JSON), not HTML 404
  curl -i https://api.assemblyai.com/v2/transcripts \
    -H "authorization: $ASSEMBLYAI_API_KEY" \
    -H "content-type: application/json" \
    -d '{"audio_url":"https://example.com/test.mp3"}'
  ```

2) Add diagnostic logging (temporary)
- In `assemblyai.ts`, log `createRes.status` and `await createRes.text()` (first 200 chars) on failure to capture what gateway returns in your environment.

3) Strip data‑URL prefixes (defensive)
- If Telegram sends base64 with prefix like `data:audio/ogg;base64,`, strip it before upload (currently upload still works, but stripping is cleaner and avoids edge cases).

4) Alternative input path (if 404 persists)
- Upload the audio to Supabase Storage and pass a signed/public `audio_url` directly to AAI (skip AAI `/upload`). Implementation: store the blob to `storage.from('voice-notes')`, get a public URL, then `POST /transcripts` with that URL.

5) Consider provider fallback
- If AAI is blocked in your network, consider OpenAI Whisper or a server‑side Whisper (CPU) fallback for short notes.

## Open Questions / Assumptions
- Is the dev network using a proxy/VPN that rewrites outbound HTTPS and returns HTML 404?
- Is the API key set in all environments (local, preview, production)?
- Are voice blobs sometimes very large? (We currently stream bytes; a direct URL may be more robust.)

## File Index
- UI
  - `src/app/dashboard/voice-notes/page.tsx` (render `transcription`, UX tweaks)
- API endpoints
  - `src/app/api/voice-notes/route.ts` (POST: save + background transcription)
  - `src/app/api/voice-notes/[id]/route.ts` (PATCH/GET/DELETE: redo + append/replace in busta notes)
- Helper
  - `src/lib/transcription/assemblyai.ts` (upload + poll logic)

## Current Outcome
- “Nothing gained” from a user perspective because the AAI call fails upstream; however, once network/API access is fixed, the UI and server logic will immediately surface the transcription in triage and sync it to the corresponding busta.

---

Last updated: 2025‑09‑10
