# PrintForge Phase Prompts

This document is the stored execution plan for cost-optimized PrintForge product growth.

## Global Phase Rule

Whenever we are working on phase prompts, after one phase prompt implementation is done, Codex must give the next phase prompt kickstart word stored in this document.

Do not skip the kickstart word in the final response for a completed phase.

## Phase Order

| Order | Phase | Kickstart word | Outcome |
| --- | --- | --- | --- |
| 1 | UX Architecture and Guided Setup | `FORGE_PHASE_01` | Cleaner dashboard, setup wizard, and no-device flow |
| 2 | Print Readiness and Saved Health | `FORGE_PHASE_02` | Local readiness score and saved printer health checks |
| 3 | System Print and Share-To-Print | `FORGE_PHASE_03` | Native Android/iOS print path and share entry point |
| 4 | Printer Profiles and Cost-Saving Mode | `FORGE_PHASE_04` | Per-printer defaults and ink/paper saving workflow |
| 5 | Test Print and Print History | `FORGE_PHASE_05` | Better test page, reprint, and local history insights |
| 6 | Troubleshooting Playbooks and ForgeGuide | `FORGE_PHASE_06` | Offline help flows with clearer user guidance |
| 7 | Compatibility Memory and Diagnostics Intelligence | `FORGE_PHASE_07` | Local learning from past printer behavior |
| 8 | Scanner Foundation | `FORGE_PHASE_08` | Visible scanner readiness without full scan overbuild |
| 9 | Release Hardening | `FORGE_PHASE_09` | Tests, bug audit, performance checks, and launch polish |

## Phase 1 Prompt

Kickstart word: `FORGE_PHASE_01`

```txt
Implement Phase 1: UX Architecture and Guided Setup for PrintForge.

Goal:
Make the app easier to understand without adding backend cost.

Requirements:
- Keep saved printers visible on the dashboard.
- Create or refine a dedicated saved devices section where users can manage saved printers/scanners.
- Make the dashboard feel organized into clear sections instead of placing every CTA on the landing view.
- Refine the guided setup flow:
  - Search Wi-Fi/network.
  - Add by IP address.
  - Help me troubleshoot.
- When discovery starts, show a focused modal/dialog with a polished loading animation and changing informative text.
- While discovery is running, prevent interaction with dashboard CTAs and setup sections.
- If devices are found, list them inside the discovery dialog.
- Let the user tap a found device to begin connection.
- Close the dialog once connection starts.
- If no devices are found, show one polished no-device feedback section with clear next actions.
- Remove repeated "Search again" CTAs.
- Preserve PrintForge dark premium branding.

Constraints:
- No backend.
- No paid services.
- Do not break saved printer persistence.
- Do not hide saved printers from the dashboard.
- Keep interactions easy to tap and scroll.

Verification:
- Run typecheck and tests if available.
- Run Android demo if requested.
- Manually verify buttons remain clickable after assistant navigation and setup flows.

After completing this phase, tell the user the next kickstart word: FORGE_PHASE_02.
```

## Phase 2 Prompt

Kickstart word: `FORGE_PHASE_02`

```txt
Implement Phase 2: Print Readiness and Saved Health for PrintForge.

Goal:
Make each printer communicate a simple readiness state using local checks only.

Requirements:
- Add a local print readiness score model:
  - READY
  - SLOW
  - SLEEPING_OR_OFFLINE
  - NEEDS_ATTENTION
  - UNKNOWN
- Use existing discovery, capability, latency, diagnostics, and print attempt logs.
- Add saved printer health checks on app open.
- Avoid aggressive scanning or battery-heavy loops.
- Show "Last checked" for saved printers.
- If a saved printer IP no longer responds, show calm guidance and offer:
  - Try again.
  - Find it again.
  - Edit IP address.
- Make health status visible on printer cards with premium status badges.
- Keep all data local.

Constraints:
- No backend.
- No account system.
- No analytics vendor.
- Do not block the UI thread.
- Do not silently mark a printer offline from one failed check; handle unreliable networks gracefully.

Verification:
- Run typecheck and tests if available.
- Confirm saved printers appear instantly before health checks finish.
- Confirm health checks update progressively.

After completing this phase, tell the user the next kickstart word: FORGE_PHASE_03.
```

## Phase 3 Prompt

Kickstart word: `FORGE_PHASE_03`

```txt
Implement Phase 3: System Print and Share-To-Print for PrintForge.

Goal:
Improve compatibility and reduce custom protocol risk by adding native print system paths.

Requirements:
- Android:
  - Add integration with the Android print framework where appropriate.
  - Use a PrintDocumentAdapter-compatible native path for supported documents.
  - Keep existing IPP/RAW direct print engine as advanced fallback.
- iOS:
  - Add AirPrint/UIPrintInteractionController foundation for PDFs and images.
  - Keep PrintForge UI consistent before handing off to native print UI.
- Add share-to-print entry point:
  - User can share a PDF/image from another app into PrintForge.
  - PrintForge opens the print workflow with the file preselected.
- Preserve existing file picker flow.
- Clearly explain when PrintForge is using system print versus direct print.
- Log print attempts locally for diagnostics.

Constraints:
- No vendor SDKs.
- No cloud print relay.
- No file upload.
- Keep user documents local.
- Do not remove existing direct IPP/RAW functionality.

Verification:
- Run typecheck and tests if available.
- Verify Android app builds.
- Verify iOS project remains build-ready.
- Verify share intent/deep link configuration does not break normal app launch.

After completing this phase, tell the user the next kickstart word: FORGE_PHASE_04.
```

## Phase 4 Prompt

Kickstart word: `FORGE_PHASE_04`

```txt
Implement Phase 4: Printer Profiles and Cost-Saving Mode for PrintForge.

Goal:
Make PrintForge feel personal and useful while staying local-first.

Requirements:
- Add local per-printer print profiles.
- Allow users to save defaults:
  - Copies.
  - Color or black and white.
  - Duplex if supported.
  - Paper size.
  - Orientation.
  - Quality/draft preference if supported.
  - Fit to page.
- Add a simple "Save ink and paper" mode.
- When enabled, prefer:
  - Black and white.
  - Duplex.
  - Draft/standard quality.
  - Page range warning for large PDFs.
  - Image size warning for large images.
- Make profile settings easy to understand in non-technical language.
- Store profiles locally with AsyncStorage or existing persistence layer.

Constraints:
- No backend.
- No account system.
- Do not expose unsupported settings as if guaranteed.
- Respect printer capability detection.
- Keep UI premium and uncluttered.

Verification:
- Run typecheck and tests if available.
- Confirm settings persist across app restart.
- Confirm unsupported settings are explained calmly.

After completing this phase, tell the user the next kickstart word: FORGE_PHASE_05.
```

## Phase 5 Prompt

Kickstart word: `FORGE_PHASE_05`

```txt
Implement Phase 5: Test Print and Print History for PrintForge.

Goal:
Turn setup validation and previous jobs into useful local product value.

Requirements:
- Build a premium test print page.
- Include:
  - Printer name.
  - IP address.
  - Protocol used.
  - Timestamp.
  - Color bars.
  - Alignment grid.
  - Simple diagnostic code.
- Add a "Print test page" action from printer details.
- Improve print history:
  - File name.
  - Printer.
  - Date/time.
  - Success/failure.
  - Protocol.
  - Friendly failure reason.
- Add actions:
  - Reprint.
  - Use same settings.
  - Diagnose this failure.
- Store only metadata by default.

Constraints:
- Do not store document contents unless a future explicit user setting is added.
- No cloud storage.
- No account requirement.
- Keep history local and lightweight.

Verification:
- Run typecheck and tests if available.
- Confirm history survives app restart.
- Confirm failed print attempts create useful diagnostic entries.

After completing this phase, tell the user the next kickstart word: FORGE_PHASE_06.
```

## Phase 6 Prompt

Kickstart word: `FORGE_PHASE_06`

```txt
Implement Phase 6: Troubleshooting Playbooks and ForgeGuide for PrintForge.

Goal:
Make PrintForge feel like a calm printer setup assistant without paid AI cost.

Requirements:
- Add offline troubleshooting playbooks for:
  - Printer not found.
  - Printer found but will not print.
  - IP address changed.
  - Phone and printer on different Wi-Fi.
  - Guest network issue.
  - VPN blocking discovery.
  - Printer asleep.
  - iOS local network permission.
  - Android network permission or Wi-Fi restrictions.
- Expand ForgeGuide with app-specific knowledge.
- Keep prepopulated quick questions.
- Prevent duplicate sends when tapping quick questions.
- After each answer, ask a related follow-up question with varied wording.
- Add contextual quick actions only when they actually do something.
- Keep the assistant quiet and non-intrusive.

Constraints:
- Offline/rule-based only.
- No paid LLM API.
- No raw technical errors shown to users.
- Keep all language friendly, human, and non-technical.

Verification:
- Run typecheck and tests if available.
- Verify assistant close/back behavior does not block dashboard taps.
- Verify quick questions render once.
- Verify follow-up questions vary and relate to the answer.

After completing this phase, tell the user the next kickstart word: FORGE_PHASE_07.
```

## Phase 7 Prompt

Kickstart word: `FORGE_PHASE_07`

```txt
Implement Phase 7: Compatibility Memory and Diagnostics Intelligence for PrintForge.

Goal:
Let PrintForge learn locally which connection path works best for each printer.

Requirements:
- Add local compatibility memory per printer:
  - Best known protocol.
  - Last successful protocol.
  - Average latency band.
  - Common failure pattern.
  - Whether printer often sleeps.
  - Whether RAW fallback works better.
- Use compatibility memory to improve:
  - Printer detail recommendations.
  - Print mode selection.
  - Diagnostics copy.
  - Readiness scoring.
- Add privacy-safe local diagnostics summary.
- Provide an option to clear local compatibility memory.

Constraints:
- Local-only.
- No cloud analytics.
- No personally identifying data.
- Do not overfit to one failed attempt.
- Keep explanations simple.

Verification:
- Run typecheck and tests if available.
- Confirm memory updates after discovery, capability checks, and print attempts.
- Confirm clear/reset works.

After completing this phase, tell the user the next kickstart word: FORGE_PHASE_08.
```

## Phase 8 Prompt

Kickstart word: `FORGE_PHASE_08`

```txt
Implement Phase 8: Scanner Foundation for PrintForge.

Goal:
Prepare scan support without overbuilding full scanning too early.

Requirements:
- Add scanner capability model:
  - UNKNOWN
  - DETECTED
  - NOT_DETECTED
  - NEEDS_SETUP
- Extend capability detection to reserve scan-related signals.
- Add eSCL/AirScan detection foundation where practical.
- Add scanner-ready UI on printer detail.
- Add a dedicated scanner section for saved devices where relevant.
- If scanner is detected, show clear "Scanner detected" state.
- If not detected, explain that this printer may not expose scanning on the network.
- Keep scan actions disabled unless implementation is real.

Constraints:
- Do not fake full scan support.
- No vendor SDKs.
- No cloud document processing.
- Do not confuse users by implying scan is ready when it is not.

Verification:
- Run typecheck and tests if available.
- Confirm scanner states are visible but honest.
- Confirm print flows are unaffected.

After completing this phase, tell the user the next kickstart word: FORGE_PHASE_09.
```

## Phase 9 Prompt

Kickstart word: `FORGE_PHASE_09`

```txt
Implement Phase 9: Release Hardening for PrintForge.

Goal:
Make the app reliable enough for a free public release.

Requirements:
- Perform a strict audit for broken or half-applied features.
- Verify:
  - Dashboard taps remain responsive.
  - Assistant navigation does not block touches.
  - Discovery dialog opens, updates, closes, and recovers correctly.
  - Saved printers load instantly.
  - Manual IP flow works.
  - Print workflow handles missing file, bad file, offline printer, timeout, and unsupported format.
  - Diagnostics never show raw errors.
  - iOS project remains build-ready.
  - Android build works.
- Add or improve tests for critical state and service logic.
- Fix TypeScript, lint, and test failures.
- Document known limitations honestly in README if needed.

Constraints:
- No broad redesign unless a bug requires it.
- Do not add expensive services.
- Do not introduce account or backend dependencies.
- Preserve premium visual language.

Verification:
- Run typecheck.
- Run lint.
- Run test suite.
- Run Android build.
- Run iOS build checks where locally practical.
- End with a clear release-readiness summary.

After completing this phase, tell the user that the stored phase roadmap is complete.
```
