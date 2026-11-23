# UX review — 2026-11-24

Reviewed the two supplied mock screenshot sheets and current UI/service contracts before implementation. All seven Claude findings are valid. One qualification: automatic updates still need a visible stale/offline state and an optional pull-to-refresh; hiding the button must not imply that cached money is current.

| Screen | First-time-user problem | Change |
| --- | --- | --- |
| Home | Claude 1–4: balance card dominates Noa; empty speech, duplicate unit, buried payments and too many equal actions. | One screen: slim header, tappable amount + eye + breakdown, quiet update status, flexible hero with useful speech, two recent rows, pinned Receive/Send. Compact mock control. Large text may scroll. |
| Receive | Claude 2, 7: waiting state is offscreen; manual update implies the QR is not live. Loading/error has no retry. | Focus-scoped fast automatic watching; QR, live waiting/confirmed state, full address and copy together. Address retry. Share and help secondary. Never celebrate an unconfirmed receipt. |
| Send | Max consumes a full row and available balance is separated from input. | Small 44pt Max chip beside amount; available balance beside label. Keep both steps, all review fields and authentication. |
| Assets | Claude 2, 6: technical expiry explanation competes with the number; no clear overall health summary. | Amount then a plain one-sentence health summary, quiet stale status and pull-to-refresh. Keep urgent warnings visible; put expiry caveat and block details behind help. Distinguish not loaded, failure and empty coins. |
| Activity | Claude 2: big update card obscures the purpose. “Received/Sent” can imply completion even on pending rows. | Quiet update line and pull-to-refresh, rows with neutral direction labels and explicit status; keep do-not-resend warnings visible. Separate loading/error/empty states. |
| Settings | Disabled seed button has no local explanation in mock; backup information is important but dense. | Keep honest export/restore warnings, put seed action first in Security and explain mock restriction there. Shared tighter header/spacing. |
| Guide | Claude 5: six large cards turn a checklist into a long reading task. | One compact checklist, purple completion ticks, Try links and details on row tap. Keep backup learning inside its expanded item. |
| Seed | The scary warning is necessary, but the reveal button does not explain what happens next. Large text can overflow fixed three-column words. | Add short authentication explanation and adaptive word columns. Preserve revealSeed-only access, capture protection and clear-on-leave behavior; guard late authentication results after leaving. |
| Recovery | Mock says recovery is unavailable but seed-only action still looks available. | Disable both mock recovery routes and retain visible seed-only limitations. Clear secret input when leaving; keep recovery contracts unchanged. |

Additional findings Claude did not list: respect hidden balance in new home activity previews; use neutral incoming/outgoing wording before confirmation; never show a failed first load as an empty wallet; make amount unit switching discoverable to assistive technology; avoid clipping long speech or safety warnings to satisfy screen-fit. Recovery still imports BackupManager directly: request a container-facing restore operation rather than editing internals.

Safety wins over density: expandable explanations use a modal on fixed-height Home; other screens scroll. Mainnet and MOCK banners stay visible. No new native dependencies or internal-service changes.
