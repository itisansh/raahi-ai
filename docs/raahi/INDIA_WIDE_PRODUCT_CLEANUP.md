# India-wide product cleanup

The product plans travel across India. Uttarakhand is one example, not a scope
restriction. The existing North India onboarding trip remains an explicitly
simulated regional sample; no supplied trips or accounts were modified.

## Public surfaces

- Replaced inherited destination screenshots with accessible, localized React
  previews for Rajasthan, Kerala, Goa, Meghalaya and a Himalayan trip. These are
  labeled illustrative plans, not screenshots or live booking evidence.
- Updated English/Chinese landing copy, the Chinese README, destination input
  examples and user-guide examples. Retained Chinese localization as Chinese.
- Retired inherited screenshots and demo/promotional videos from shipped assets
  and user documentation. Original assets remain recoverable in Git history.
- Changed the currency picker default to INR. Supported foreign currencies and
  financial regression tests remain valid; stored currencies are not rewritten.
- Removed the unconditional regional ambulance contact from the medical panel
  and offline export. 112 remains the nationwide emergency contact, verified
  against https://112.gov.in/ and the Ministry of Home Affairs ERSS information.
- Replaced region-specific transport shortcuts with IRCTC train/bus and BusIndia
  search links. These are provider search handoffs, not live inventory. Sources:
  https://www.bus.irctc.co.in/home and
  https://www.busindia.com/preStaticPages?Page=AboutUs.

Historical audits/reference documents retain descriptions of earlier versions;
they are not current product positioning. Existing sample trips are not migrated.
Brand icons and upstream attribution remain; they do not depict destinations.

## Verification

Medical search tests cover saved stops in Jaipur, Kochi, Panaji, Shillong and
Port Blair using simulated providers. This verifies routing locations through
the service, not successful live provider coverage. Offline export checks ensure
no regional emergency number is displayed for arbitrary trips.

Production builds and workspace checks are recorded in BUILD_PROGRESS.md.
Human browser visual review and fresh product video recordings remain separate
acceptance tasks. No claim of live provider success or deployment is made.
