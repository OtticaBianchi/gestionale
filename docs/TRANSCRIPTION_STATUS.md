# Voice Transcription – RESOLVED ✅ (2025‑09‑12)

## 🎉 ISSUE RESOLVED

**Root Cause:** Wrong AssemblyAI API endpoint  
**Solution:** Use `/transcript` (singular) instead of `/transcripts` (plural)

## Problem Summary
- **Goal:** Automatic transcription of Telegram voice notes with immediate display in Voice Triage
- **Symptom:** AssemblyAI returning 404 HTML page: `<html>404: Not Found</html>`  
- **Original assumption:** Network/proxy issue blocking AssemblyAI access

## Root Cause Analysis
Through systematic debugging with detailed logging, we discovered:
1. ✅ **Upload endpoint worked** (`/v2/upload`) → Status 200
2. ❌ **Transcript creation failed** (`/v2/transcripts`) → Status 404 HTML  
3. 🔍 **Response headers showed AWS load balancer** → Request WAS reaching AssemblyAI
4. 🎯 **Issue was endpoint URL:** AssemblyAI uses `/transcript` not `/transcripts`

## Solution Applied
**File:** `src/lib/transcription/assemblyai.ts`
```diff
- const createRes = await fetch(`${AAI_BASE}/transcripts`, {
+ const createRes = await fetch(`${AAI_BASE}/transcript`, {

- const pollRes = await fetch(`${AAI_BASE}/transcripts/${transcriptId}`, {
+ const pollRes = await fetch(`${AAI_BASE}/transcript/${transcriptId}`, {
```

**Additional fixes:**
- Proper header capitalization: `Authorization` and `Content-Type`
- Cleaned up debug logging code

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

## Current Status: ✅ FULLY FUNCTIONAL

**Complete Voice Notes Flow Working:**
1. **Telegram voice message** → Webhook receives and saves to database
2. **Auto-transcription** → AssemblyAI processes immediately 
3. **Dashboard display** → Voice notes appear with transcription text (status: "In attesa")
4. **User control** → Click ✅ to mark as "Completata"
5. **Busta integration** → Link notes to work orders, transcription appends to note_generali
6. **Cleanup system** → Delete/dismiss notes (preserves transcription data for history)

**Auto-dismiss:** Completed notes automatically removed from dashboard after 7 days.

---

## Troubleshooting for Future
If transcription fails again, check:
1. **Environment variable:** `ASSEMBLYAI_API_KEY` set in Vercel
2. **API endpoint:** Ensure using `/transcript` not `/transcripts` 
3. **Headers:** Use `Authorization` and `Content-Type` (proper case)

---

Last updated: 2025‑09‑12 - **RESOLVED ✅**
