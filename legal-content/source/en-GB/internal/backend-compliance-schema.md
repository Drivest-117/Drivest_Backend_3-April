Backend Compliance Schema
Drivest legal, audit, and enforcement baseline
Version
Version 1.1
Last updated
5 April 2026
Prepared for
Drivest Limited

How this document should be used
This is an internal implementation document. It translates the current Drivest legal and marketplace model into backend records, events, and enforcement controls. It should guide engineering, product, support, and operations teams.

1. Objective and Scope
This schema defines the minimum backend compliance architecture required to support the current Drivest legal onboarding, consent capture, subscriptions, instructor marketplace, disputes, and administrative enforcement model.
The backend must be treated as the single source of truth for legal acceptance, consent choice, booking terms, cancellation timing, refund calculation, payout control, dispute handling, and administrative enforcement. Mobile applications may collect inputs and display outcomes, but the backend must store the authoritative record and must calculate decisions that have legal or financial consequences.

2. Core Compliance Principles
Every legally significant event must create a record.
The system must be able to prove who took the action, what they were shown, what version applied, what choice they made, and when the event occurred.
Frontend timestamps must not be treated as authoritative for financial or legal decisions. Server-side time must be used for legal acceptance, permission and consent changes, booking creation, cancellation timing, payout release or hold, dispute creation, and administrative action.
Historical evidence should be append-only wherever possible. Existing records should not be overwritten where doing so would erase the ability to prove the original event.

3. Current app legal model that the backend must support
The current app legal stack uses:
- Terms version: 3.0
- Privacy version: 3.0
- Safety version: 2026-03-24.v1
- Legal last updated date shown in app metadata: 24 March 2026

The app records two distinct onboarding stages:
- Mandatory legal acceptance
- Operational permissions and optional consent

The current tracked choices are:
- termsVersion accepted
- privacyVersion accepted
- safetyVersion accepted
- ageConfirmed
- analyticsChoice
- notificationsChoice
- locationChoice

The current app also sends legal sync requests with:
- install identifier
- platform
- app version
- source screen or source surface

4. Required data structures
The minimum required structures are as follows.

The legal_document_versions table should store every active and historical version of the Terms and Conditions, Privacy Policy, safety notice, and any other document that requires traceable acceptance. It should include a unique identifier, document type, version, content hash, publication timestamp, and active status.

The user_legal_acceptances table should store each legal acceptance event. At a minimum it should record the user identifier or anonymous install/session identifier, the accepted terms version, privacy version, and safety version, whether age was confirmed, the acceptance timestamp, the source screen, the app version, the platform, and a stable install identifier where available.

The user_consents table should store the current state of optional and operational choices. At minimum it should support:
- analytics choice
- notifications choice
- location choice

The consent_history table should store the full change history for the same choices, including previous and new values, timestamps, source surface, platform, app version, and install identifier where available.

The booking_snapshots table should freeze exactly what the learner was shown before a booking was confirmed or paid. This record should include the booking identifier, learner identifier, instructor identifier, lesson time, booking creation time, displayed price, currency, cancellation policy version, cancellation policy text or snapshot, the terms and privacy versions in force, the platform, and the app version.

The bookings table should contain the operational booking state, including booking status, payment status, creation time, confirmation time, lesson start time, lesson completion time, cancellation time, and any no-show flags.

The cancellations table should store the cancellation event separately from the booking status. It should record who cancelled, when the cancellation occurred, how many hours remained before the lesson according to server time, whether an emergency path was used, the refund percentage, refund amount, instructor amount, and the Drivest commission amount, which must be zero for cancellations.

The dispute_cases table should store the dispute identifier, linked lesson identifier where applicable, opened-by user and role, against user and role, category, priority, status, SLA timestamps, summary fields, and resolution fields.

The dispute_evidence table should store uploaded or linked evidence tied to a dispute, including who uploaded it, what type it is, where it is stored, and when it was added.

The instructor_declarations table should store the text or version of the legal declaration accepted by each instructor, the acceptance time, and the review status.

The instructor_profile_compliance_reviews table, or an equivalent linked review model, should store reviewer identity, review outcome, review timestamp, reason codes, and notes for approval, rejection, suspension, or restriction decisions.

The instructor_module_legal_acceptances table, or equivalent versioned store, should record one-time legal acknowledgments for module surfaces such as:
- find_instructor
- instructor_hub

The audit_logs table should capture sensitive events across the system, including legal acceptance, consent changes, booking lifecycle events, financial decisions, dispute decisions, and enforcement actions.

5. Mandatory logged events
At minimum, the backend must log:
- initial acceptance of the Terms and Conditions
- initial acceptance of the Privacy Policy
- age confirmation
- safety acknowledgement
- analytics choice and later changes
- notifications choice and later changes
- location choice and later changes
- relevant versions and timestamps
- source screen or source surface
- install identifier, app version, and platform where available

For bookings, the backend must log:
- the price shown
- the cancellation rule shown
- the time the booking was created
- the time payment was authorised or settled
- the booking snapshot that proves what the user saw

For cancellations and reschedules, the backend must log:
- actor
- server timestamp
- lesson timestamp
- applicable policy window
- emergency flag where used
- refund allocation or reschedule outcome
- instructor amount
- Drivest commission amount

For completed lessons, the backend must log completion, commission calculation, payout release, payout hold, or payout adjustment.

For disputes, the backend must log:
- dispute creation
- evidence upload
- status changes
- outcome
- any override or enforcement action

For instructor onboarding and review, the backend must log:
- declaration acceptance
- profile review state
- approval, rejection, suspension, or restriction
- reviewer identity
- reason code
- timestamp

6. Current API behavior that the compliance model must support
The app currently relies on dedicated app-legal endpoints.

Minimum endpoint coverage:
- GET /v1/legal/app/bootstrap
  Returns current legal acceptance state and current consent choices.

- POST /v1/legal/app/acceptance
  Creates a traceable legal acceptance event using server-side time and the current document versions, including termsVersion, privacyVersion, safetyVersion, ageConfirmed, safetyAccepted, and sourceScreen.

- POST /v1/legal/app/consents
  Stores analyticsChoice, notificationsChoice, and locationChoice together with their timestamps and sourceSurface.

Legacy compatibility may still exist through /me/consents, but the dedicated app-legal endpoints should be treated as the target model.

Marketplace and dispute endpoints that must remain auditable include:
- POST /v1/disputes
- GET /v1/disputes/my
- GET /v1/disputes/:id
- POST /v1/disputes/:id/evidence
- PATCH /v1/disputes/:id/status

7. Refund and cancellation engine
Refund and cancellation outcomes must be calculated server-side. The frontend must not determine the applicable window or financial result.
The backend rule must reflect the current commercial policy. If the instructor cancels, a full refund applies. If the learner cancels forty-eight hours or more before the lesson, a full refund applies. Between twenty-four and forty-eight hours before the lesson, the learner receives a seventy-five percent refund and the instructor may retain twenty-five percent. Between twelve and twenty-four hours before the lesson, the learner receives a fifty percent refund and the instructor may retain fifty percent. Less than twelve hours before the lesson, no refund is due. Where the learner fails to attend, the booking may be treated as a no-show and the same no-refund logic may apply. Drivest commission must remain zero on cancellations.
The booking snapshot should store the policy version that was shown at the time of booking so that historical bookings are not silently reinterpreted when future policy versions change.

8. Dispute and payout controls
The dispute model should support SLA fields including:
- firstResponseBy
- resolutionTargetBy
- respondedAt
- resolvedAt
- closedAt

Payout status must support operational holds for disputes, policy review, chargebacks, provider settlement issues, fraud review, or other compliance controls.
Any payout hold, release, reversal, or adjustment must create an auditable record.

9. Retention and immutability
Legal acceptance records, consent history, booking records, payment metadata, dispute records, moderation actions, and compliance logs should be retained long enough to support legal defence, financial reconciliation, fraud prevention, and audit. A practical baseline is six years for legal, payment, booking, and dispute evidence, with shorter retention for lower-risk diagnostics unless required longer for investigation.
Where a record supports financial or legal defence, it should be append-only or versioned rather than overwritten. This principle is especially important for legal acceptance, consent history, booking snapshots, cancellations, disputes, payout decisions, and administrative overrides.

10. Operational governance
Support and operations teams must not make off-system financial decisions without creating an auditable backend record. Manual overrides should be rare, reason-coded, logged, and linked to the responsible administrator.
The backend should be treated as the truth hierarchy above the UI. If the UI display, a support message, or a drafted note conflicts with the logged snapshot and system record, the logged backend record should prevail for platform purposes.

11. Minimum table catalogue
Table or object
Purpose

legal_document_versions
Stores each published version of terms, privacy, safety, and any other acceptance-driven document.

user_legal_acceptances
Stores who accepted which legal versions, whether age and safety were confirmed, when, and from which platform and app version.

user_consents
Stores current analytics, notifications, and location choices.

consent_history
Stores the full change history for analytics, notifications, and location choices.

booking_snapshots
Stores the exact commercial and legal context shown before a booking is confirmed or paid.

bookings
Stores the operational booking state.

cancellations
Stores cancellation timing, actor, emergency flag, refund result, instructor amount, and zero-commission rule on cancellations.

dispute_cases
Stores linked booking or user dispute records and SLA-driven resolution state.

dispute_evidence
Stores uploaded evidence or metadata tied to disputes.

instructor_declarations
Stores the legal declaration accepted by each instructor.

instructor_profile_compliance_reviews
Stores reviewer outcome, status, reason code, and timestamp for instructor approval controls.

instructor_module_legal_acceptances
Stores versioned legal acknowledgments for instructor marketplace module surfaces.

audit_logs
Stores sensitive actions across legal acceptance, consent changes, financial events, disputes, moderation, and admin overrides.
