Permissions and Consent Framework
Drivest mobile permissions, optional consent, and logging model
Version
Version 1.1
Last updated
5 April 2026
Prepared for
Drivest Limited

Document purpose
This internal document defines how permissions and consent should now be requested in the app so that the mobile journey stays low-friction, legally defensible, and consistent with the current website, app behavior, and backend logging model.

1. Purpose of this document
This document sets out the current permission and consent framework for Drivest. It is intended to keep the mobile experience usable while remaining aligned with the active legal, privacy, and app store position.
The core principle remains the same. Drivest should ask only for permissions that are necessary, should ask in context, should not pre-enable optional choices, and should be able to prove what the user chose and when.

2. Current onboarding permission model
Drivest now uses a two-stage onboarding model.

Stage 1 handles mandatory legal acceptance. It covers:
- Terms and Conditions acceptance
- Privacy Policy acceptance
- age confirmation
- safety notice acknowledgement

Stage 2 handles operational permissions and optional consent. It presents:
- location access
- analytics choice
- notifications choice

Location is operationally important for route and parking related features, but still remains an operating-system permission. Analytics is optional. Notifications are optional.

3. Mandatory legal acceptance stage
The first onboarding stage must make clear that Drivest is a driving support platform that provides guidance only.
It must make clear that Drivest does not replace the user's judgement, a driving instructor, or the law.
The stage must provide access to the Terms and Conditions and the Privacy Policy before the user continues.
The user must actively check a box before continuing.
The app must not continue until that checkbox is selected.
The same stage captures age confirmation and safety acknowledgement as part of the acceptance event.
The backend must store the accepted terms version, privacy version, safety version, acceptance timestamp, source screen, app version, platform, and install identifier where available.

4. Location permission
Location should be requested through an in-context action and then through the operating-system permission dialogue.
The explanatory wording should remain consistent with the current privacy position:
- location is used for routes and navigation when active
- route and parking features need location when the user tries to use them
- Drivest should not imply that continuous background location history is stored on servers

If a user refuses location permission, the app may restrict route and parking related features, but it should not block unrelated learning features.
The app should store the user's effective location choice as one of:
- allow
- deny
- skip

5. Analytics consent
Analytics must remain optional where consent is the intended legal basis.
Analytics behavior should stay off until the user makes an affirmative choice.
The user interface should describe analytics as helping improve performance and reliability.
The interface must not suggest that analytics is required to use the core service.
The backend should store:
- analyticsChoice
- timestamp
- source surface
- app version
- platform
- install identifier where available

6. Notifications consent
Notifications must remain optional.
The prompt should describe their operational purpose, including updates, bookings, reminders, and important account activity where relevant.
Notifications must not be pre-enabled by default.
The app should store the user's in-app preference choice separately from the operating-system permission result.
The backend should store:
- notificationsChoice
- timestamp
- source surface
- app version
- platform
- install identifier where available

7. Logging requirements
The system must log the legal acceptance event separately from the permission and consent choices.
At minimum, the backend should store:
- terms version
- privacy version
- safety version
- acceptance timestamp
- age confirmation state
- analytics choice
- analytics timestamp
- notifications choice
- notifications timestamp
- location choice
- location timestamp
- source screen or source surface
- app version
- platform
- install identifier where available

8. Current implementation requirement
The permission framework must match the actual app behavior.
If the legal flow describes analytics as optional, analytics must actually be optional in implementation.
If the app stores location choice as part of onboarding, that data model must be reflected in the internal compliance documentation.
If the app later adds a new permission, new tracking behavior, or continuous background location processing, the permission framework, privacy policy, in-app copy, and store declarations must all be updated together before release.

9. Final permission inventory
Permission or choice
Final position

Mandatory combined legal acknowledgement
Terms acceptance, Privacy acceptance, age confirmation, and safety acknowledgement. Required before the user can enter the product.

Location
Requested in context to support routes, navigation, and location-dependent features. Controlled by the operating system, but the app also stores a recorded choice state.

Analytics
Optional consent. Must remain off until the user makes an affirmative choice.

Notifications
Optional consent. Must not be pre-enabled. Device settings remain the final permission authority, while the app stores the user's in-app preference choice.
