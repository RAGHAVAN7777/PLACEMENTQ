# Interview workspace UI correction — 5 October 2026

Scope: presentation only. Aria stays on the left; the current task, speech controls and answer tools share a bounded right-hand panel. The document uses the viewport height. Profile review replaces the long card/checkbox list with category tabs, six selectable claim chips per page, a source/evidence inspector, next/previous navigation and persistent confirmation/Continue actions. Conversation history opens on demand. Existing model calls, grading, persistence, avatar animation and landing page are unchanged.

Changed: frontend/src/features/interview/InterviewPage.tsx; new ProfileReview.tsx and InterviewWorkspace.css.

Verified in browser with real local resume extraction: paste resume, category switching, edit/add claim, next/previous across the six-item boundary, confirm all, save/continue to GitHub, skip optional GitHub, domain selection. At 1280×720, 1366×768 and 390×844 the document height matched the viewport without horizontal overflow. Long source passages and history use bounded internal scrolling; short screens retain internal panel scrolling so controls remain reachable. No content is discarded.

Command: npm.cmd run build --prefix frontend — passed. Existing large-bundle warning remains.

Screenshot: interview-workspace-review.jpg (fictional test profile).
`nLive question screen verified at 1280×720: document 720px, console client/scroll height both 498px (no overflow). Typed-answer submit enables correctly; conversation history opens and closes. Final screenshot: interview-workspace-question.jpg.
