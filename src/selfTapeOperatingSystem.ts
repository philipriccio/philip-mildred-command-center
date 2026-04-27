import type { SelfTapeOpsData } from './types';

export const selfTapeOpsData: SelfTapeOpsData = {
  northStar: {
    goal: 'Become the best and most-used self-tape app on the market.',
    strategy: 'First build actor trust through a beautiful, reliable audition workflow. Then turn that trust into awareness and adoption.',
    phase: 'Controlled TestFlight validation + product operating-system buildout',
    currentRecommendation: 'Protect trust: do one clean EAS retry after the Expo iOS worker incident clears, then device-test the full actor journey before adding more recording-surface complexity.',
  },
  authority: {
    green: [
      'Audit product and code against actor trust and market leadership.',
      'Research competitors, actor workflows, and adoption opportunities.',
      'Prepare QA plans, build scopes, issue lists, and product recommendations.',
      'Update project truth, dashboard state, and internal work queues.',
    ],
    yellow: [
      'Trigger paid EAS/TestFlight builds.',
      'Submit to App Store Connect/TestFlight.',
      'Contact beta users, acting coaches, partners, press, or sponsors.',
      'Publish marketing, launch, or public positioning copy.',
    ],
    red: [
      'Spend money beyond approved build/tooling usage.',
      'Make legal, privacy, or revenue commitments.',
      'Launch publicly or announce Self-e-Tape before Philip approves.',
      'Remove capability-bearing config or credentials without live smoke proof.',
    ],
  },
  journey: [
    {
      step: 'Import sides',
      status: 'yellow',
      evidence: 'Parser hardening and William late-START regressions pass locally; real noisy PDF imports still need device validation.',
      nextAction: 'Device-test William and Chuck imports on the next successful TestFlight build.',
    },
    {
      step: 'Review / fix script',
      status: 'yellow',
      evidence: 'Script Review supports scene-aware editing and now matches app red/black branding.',
      nextAction: 'Confirm scene/role corrections are obvious on iPhone after import.',
    },
    {
      step: 'Choose scene / role',
      status: 'yellow',
      evidence: 'Scene-role alias handling and per-scene selection improved; WILLIAM OLESON → WILLIAM is covered locally.',
      nextAction: 'Verify actor-line exclusion and role alias behavior on device.',
    },
    {
      step: 'Prepare reader voices',
      status: 'yellow',
      evidence: 'Reader readiness now checks session, quota, preload, and playable MP3 files before Record/Rehearse proceeds.',
      nextAction: 'Confirm no visible Supabase/sign-in concepts and no fake cache success.',
    },
    {
      step: 'Reader-only / Rehearse',
      status: 'yellow',
      evidence: 'Reader-only mode is available from Voice Setup and reuses Rehearse voice/preload/silence cue flow.',
      nextAction: 'Validate hands-free feel, scene switching, and line readability on iPhone.',
    },
    {
      step: 'Record audition',
      status: 'red',
      evidence: 'NativeCapture ownership and richer audible-start telemetry are in code, but live AI audibility/routing are device-only.',
      nextAction: 'Device-test visible cue, audible cue, route, Keep, and diagnostics on next build.',
    },
    {
      step: 'Review takes',
      status: 'yellow',
      evidence: 'Takes Review now groups takes by parsed scene and asks for keeper selections per scene.',
      nextAction: 'Confirm this feels clear in real audition flow and does not hide escape routes.',
    },
    {
      step: 'Edit picture / sound',
      status: 'yellow',
      evidence: 'Visual/Sound edit provenance is hardened; Sound Edit stale URI/double-mix risks reduced.',
      nextAction: 'Device-listen saved/edit/export output before calling robust.',
    },
    {
      step: 'Arrange delivery',
      status: 'yellow',
      evidence: 'Delivery mode now distinguishes combined file vs separate scene files and respects selected keepers.',
      nextAction: 'Device-check actual separate-file artifact labels and title-card/slate behavior.',
    },
    {
      step: 'Export / share',
      status: 'red',
      evidence: 'Export now blocks stale preview and can produce separate scene files, but rendered artifacts and audio truth are not device-proven.',
      nextAction: 'Export and listen on iPhone from a real recorded take.',
    },
  ],
  proactiveLoops: [
    {
      cadence: 'Daily',
      name: 'Trust scan',
      output: 'What is blocking actor trust, what can move without Philip, and what needs device proof.',
      trigger: 'Morning or heartbeat when Self-e-Tape is active.',
    },
    {
      cadence: 'After every device test',
      name: 'Test synthesis',
      output: 'Separate UX confusion, parser failure, native/device bug, product gap, and build-scope decision.',
      trigger: 'Philip sends device feedback or diagnostics.',
    },
    {
      cadence: 'Weekly',
      name: 'Market leadership review',
      output: 'Top product risks, top adoption opportunities, competitor benchmark, recommended sprint.',
      trigger: 'Weekly proactive review.',
    },
    {
      cadence: 'Before every build',
      name: 'Release truth gate',
      output: 'Verified from code/tests vs CANNOT VERIFY device-only claims, with build/no-build recommendation.',
      trigger: 'Any build request or build-readiness question.',
    },
  ],
  risks: [
    {
      title: 'Live reader audibility is still the trust gate.',
      severity: 'critical',
      owner: 'Philip + Mildred',
      status: 'CANNOT VERIFY — needs device test',
    },
    {
      title: 'Expo/EAS iOS Mac worker incident is blocking the next TestFlight build.',
      severity: 'high',
      owner: 'Mildred monitors; Expo resolves',
      status: 'Blocked outside the app; retry only after incident clears.',
    },
    {
      title: 'Exported audio and separate-scene files are locally hardened but not device-proven.',
      severity: 'high',
      owner: 'Philip device test; Mildred audit',
      status: 'CANNOT VERIFY — needs device test',
    },
    {
      title: 'Feature growth can outrun core recording trust.',
      severity: 'high',
      owner: 'Mildred',
      status: 'Hold new recording-surface features until next device proof.',
    },
  ],
  opportunities: [
    {
      title: 'Reader-only mode can become a standalone wedge.',
      impact: 'High',
      nextAction: 'Make it feel excellent even for actors recording on another camera.',
    },
    {
      title: 'Delivery compliance can solve a real actor anxiety.',
      impact: 'High',
      nextAction: 'Turn casting instructions into combined/separate/slate/file-name guardrails.',
    },
    {
      title: 'Scene-aware keeper selection differentiates the workflow.',
      impact: 'Medium',
      nextAction: 'Validate clarity in Takes Review and make the export package feel inevitable.',
    },
  ],
  decisions: [
    {
      title: 'When Expo clears, do we spend one more TestFlight build immediately?',
      neededFrom: 'Philip approval after Mildred confirms EAS health and clean repo state.',
      recommendation: 'Yes — one monitored retry is worth it because Builds 276/277 failed before Xcode and local gates passed.',
      timing: 'As soon as Expo iOS worker incident is resolved.',
    },
    {
      title: 'Should new feature work pause after the next build?',
      neededFrom: 'Philip strategic alignment.',
      recommendation: 'Yes. Freeze recording/export surface changes until device proof confirms the current actor journey.',
      timing: 'Before starting any new Self-e-Tape feature beyond bug fixes.',
    },
    {
      title: 'What counts as minimum launch trust?',
      neededFrom: 'Philip + Mildred product judgment after next device test.',
      recommendation: 'Require one clean import → rehearse/record → keep → review → export pass with honest diagnostics before calling beta confidence.',
      timing: 'Immediately after the next TestFlight device session.',
    },
  ],
  watchedSignals: [
    {
      signal: 'Expo/EAS iOS worker status',
      whyItMatters: 'Builds 276 and 277 failed before Xcode, so this is the immediate build blocker.',
      response: 'Retry once only after the incident clears; do not burn attempts while degraded.',
    },
    {
      signal: 'Philip device feedback after next TestFlight',
      whyItMatters: 'Device truth outranks local tests for recording, routing, live reader audio, export, and UX clarity.',
      response: 'Convert feedback into classified findings: device bug, UX confusion, parser issue, architecture issue, or product gap.',
    },
    {
      signal: 'Any fake-success path in recording/export/editing',
      whyItMatters: 'Actor trust collapses if the app says success when reader audio, saved audio, or export output is degraded.',
      response: 'Block, surface honestly, or require explicit degraded-output confirmation.',
    },
    {
      signal: 'Competitor workflow advantages',
      whyItMatters: 'The goal is market leadership, not just a working app.',
      response: 'Keep a weekly benchmark against Linus, coldRead, OnBook, and actor workflow expectations.',
    },
  ],
  actionPackets: [
    {
      title: 'EAS recovery and Build 278 retry packet',
      owner: 'Mildred',
      status: 'blocked',
      approvalNeeded: true,
      nextStep: 'Wait for Expo incident to clear, verify repo is clean, then request/execute one monitored build retry.',
    },
    {
      title: 'Next device-test script',
      owner: 'Mildred',
      status: 'ready',
      approvalNeeded: false,
      nextStep: 'Prepare a concise William/Chuck test checklist covering import, role alias, reader preload/playback, recording, keep/review/export, diagnostics.',
    },
    {
      title: 'Actor trust audit packet',
      owner: 'Mildred',
      status: 'ready',
      approvalNeeded: false,
      nextStep: 'Walk the app journey as an actor and identify every point where confusion, uncertainty, or false confidence can happen.',
    },
    {
      title: 'Reader-only wedge packet',
      owner: 'Mildred',
      status: 'waiting',
      approvalNeeded: false,
      nextStep: 'After device proof, decide whether reader-only deserves its own product lane and onboarding emphasis.',
    },
    {
      title: 'Launch awareness packet',
      owner: 'Shared',
      status: 'waiting',
      approvalNeeded: true,
      nextStep: 'Hold until product trust is proven; then draft actor-facing launch story, demo script, and beta-user plan.',
    },
  ],
};
