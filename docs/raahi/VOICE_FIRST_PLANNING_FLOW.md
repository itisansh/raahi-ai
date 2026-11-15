# Voice-first planning flow

New-trip planning is a conversation with an explicit Send action:

1. Open Add new trip. Tap the floating microphone or type in the single message box.
2. The microphone shows connecting/listening/finalizing states and live partial text.
3. Stop recording. Only the finalized transcript is placed in the editable message
   box. Review it and press Send; recording never sends or saves a trip automatically.
4. The configured planning model (including Gemini) extracts constraints. Missing
   core constraints produce localized clarification questions; follow-up messages
   retain earlier user requests. Short messages such as “Goa” are accepted.
5. Read Raahi's reply. ElevenLabs automatically speaks it when Voice on is selected.
   Voice off persists on this browser and immediately cancels playback or synthesis.
   Stop speaking stops only the current reply. Read reply aloud supports manual replay.
6. Open View itinerary and costs to inspect the complete plan, provider evidence,
   uncertainty, timing guidance and budget. Approve and save remains explicit.
   A pending recording, unsent edit or model request disables approval of the old plan.

The secondary manual form remains available for typing a trip without the model.
The previous separate transcript confirmation, follow-up forms, language playback
buttons and redundant spoken-summary panel were removed from the planning flow.
Notes and journal editors no longer show their fixed formatting toolbar; existing
Markdown content, attachments and editor support remain intact.

## Speech and persistence

Planning responses include `proposalId` and `reply: { text, language }` for both
clarifications and previews. Replies are stored in the existing proposal payload
with owner scope and a 30-minute expiration. Clarification IDs are rejected by
approval; they cannot create trips. No collection/schema/index change is needed.

Clarification text comes from the validated missing constraints, in English or
Hindi according to the extracted language. Preview replies contain the model's
concise response and questions, plus deterministic uncertainty/review caveats.
The same bounded text is displayed and sent to ElevenLabs. Detailed itinerary and
seasonal guidance remain available in the expandable plan. The speech endpoint
accepts an owned proposal ID, never arbitrary client text. Existing session,
trusted-origin, rate-limit and expiry checks remain in force. Older stored preview
payloads retain the prior deterministic summary behavior.

Starting recording, sending another message, hiding the tab, closing the dialog,
or switching voice off stops active speech and prevents late audio from playing.
If browser autoplay policy blocks speech, the UI offers a direct playback action
that reuses downloaded audio. Provider failures leave the conversation usable.

## Limits and acceptance

This is tap-to-record, review-and-send voice planning. Continuous hands-free turns,
streaming spoken model output and automatic silence-based submission are not part
of this flow. Recording uses the existing ElevenLabs Scribe Realtime integration.
No microphone starts without a tap. Reduced-motion preferences disable orb animation.

Combined user messages are limited to 4,000 characters. Start a new conversation
clears the current dialog's context. The model remains configurable server-side;
no provider endpoint, model identifier or credential is embedded in the browser.

DOM tests cover transcript review, explicit send, automatic speech, mute during a
pending request, context retention and cancellation. Audio lifecycle tests cover
late responses, browser playback rejection and unmount cleanup. Service/HTTP tests
cover stored reply identity, ownership, limits and non-approvable clarifications.
Real microphone recognition, audible pronunciation and visual mobile acceptance
still require a live browser/device run; mocked tests do not establish those gates.

## Existing trips and mobile layout

Editable, online trips expose **Plan more stops**. The shared
`widgets/trip-planning` surface composes voice recording and spoken replies for
both entry points. Proposals show retained stops alongside additions. Approval
appends stops to existing days on Mongo; it preserves current content, expenses
and bookings. Current permissions and revision are checked transactionally.
Concurrent duplicate approval adds once. Cost estimates cover additions only.

On phones the dialog fills the visual viewport. Messages scroll independently
of the composer, which remains available when viewport height shrinks. Starter
prompts fill the draft without sending. The microphone becomes compact after
interaction. Committed transcript chunks and live partial text stay visible
while recording; submission still requires Send. Late replies in a hidden tab
never start audio.

Browser automation verified five viewport sizes, explicit send, clarification,
voice opt-out, reduced motion and no horizontal overflow with mocked APIs.
Live model extraction, scoped STT token issuance and English/Hindi TTS generation
passed separately. These checks do not verify actual microphone recognition,
physical-device keyboard behavior or audible pronunciation.

## Voice expenses (Phase 5)

The Budget expense form uses the same compact microphone. Final speech fills an
editable expense request; **Fill expense draft** is an explicit extraction step.
The form blocks saving while recording or interpreting. Interpretation can be
cancelled without losing the request; late results are discarded. A request for
four people in a five-member trip leaves unnamed participants unselected and
shows selected/requested counts. Save still requires the exact participant count.
Participant controls have 44-pixel minimum touch targets.

Settle-up explanations use saved shares, including custom shares and paise
remainders, and exclude other currencies just like the underlying balance.
Transfer explanations calculate in integer minor units, then format once in the
trip currency; paise-sized transfers remain visible. This does not add currency
conversion or settlement-payment recording.
