In-App Onboarding Legal Screens
Current two-stage onboarding model
Version
Version 1.1
Last updated
5 April 2026
Prepared for
Drivest Limited

Document purpose
This internal document defines the current onboarding legal and permissions flow approved for Drivest. It reflects the implementation now present in the app and replaces older wording that did not fully describe the stored consent model.

1. Objective
This document defines the current in-app onboarding flow for legal acceptance and permissions. The approved model uses two stages rather than a longer multi-screen legal journey. The purpose is to reduce user friction while still capturing valid legal acknowledgement and separately recorded choices that can be enforced and evidenced by the backend.

2. Stage 1: Combined legal acceptance
Stage 1 is the mandatory entry gate into the app.

Current title:
Before you start

Current body copy:
Drivest is a driving support platform. It provides guidance only and does not replace your judgement, your instructor, or the law.

You must always follow road signs, traffic laws, and real-world conditions. If anything in the app conflicts with the road, follow the road.

By continuing, you confirm that you are 16 years of age or older, that you understand and accept the safety notice, and that you agree to the Terms and Conditions and the Privacy Policy.

Required controls:
- View Terms
- View Privacy
- one mandatory checkbox
- Continue button disabled until the checkbox is selected

Current checkbox text:
I confirm that I am 16 or older, I understand the safety notice, and I agree to the Terms and Conditions and Privacy Policy.

This stage creates the authoritative legal acceptance record.
The backend should store:
- termsVersion
- privacyVersion
- safetyVersion
- ageConfirmed
- safetyAccepted
- acceptance timestamp
- sourceScreen
- app version
- platform
- install identifier where available

3. Stage 2: Permissions and optional consent
Stage 2 is the operational permissions screen.

Current title:
Permissions

Current body copy:
Drivest needs certain permissions to work properly. Location is used for routes and navigation when active. Analytics helps improve performance and reliability and is optional. Notifications keep you updated about bookings and activity.

Required controls:
- a location action that triggers the native location permission flow
- separate analytics allow and do not allow actions
- separate notifications enable and not now actions
- Continue button

Current location section:
Title: Location
Message: Location is used for routes and navigation when active.
Button: Request location access

Current location status states:
- Location access is already allowed for Drivest.
- Location access is currently denied. You can continue, but route features will stay limited until you enable it.
- Location is optional for now, but route and parking features need it when you use them.

Current analytics section:
Title: Optional Analytics
Message: Analytics helps improve performance and reliability and is optional.
Actions:
- Allow Analytics
- Do Not Allow

Current notifications section:
Title: Optional Notifications
Message: Notifications keep you updated about bookings and activity.
Actions:
- Enable Notifications
- Not Now

4. Backend mapping
At minimum, Stage 1 should create or update records in:
- legal_document_versions
- user_legal_acceptances

At minimum, Stage 2 should create or update current choice and history records for:
- analyticsChoice
- notificationsChoice
- locationChoice

Later settings changes must write back to the same backend compliance model so that Drivest can prove both the original onboarding choice and later changes or withdrawals where applicable.

5. Hard rules
No checkbox may be pre-selected.
The app must not allow a user to bypass the legal acceptance stage and continue into the product without agreement.
The Terms and Conditions and Privacy Policy must be accessible from the legal stage.
The safety notice must remain part of the legal acceptance copy unless the legal position changes and versions are updated accordingly.
The permissions stage must not bundle analytics, notifications, and location into a single vague consent.
Each choice must remain separately understandable and separately recordable.
Any material change to the legal copy, permission model, or tracked behavior should trigger a version update and re-acceptance where required.
