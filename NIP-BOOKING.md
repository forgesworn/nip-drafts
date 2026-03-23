NIP-BOOKING
===========

Calendar Availability & Booking
---------------------------------

`draft` `optional`

Six addressable event kinds for calendar-based scheduling on Nostr — a provider publishes available time slots, a requester books a specific slot, either party can cancel a booking, providers declare recurring availability patterns, confirm or decline bookings, and either party can request a reschedule.

> **Design principle:** Booking events coordinate scheduling — they communicate availability and record reservations. They do not enforce exclusivity at the relay level; the consuming application is responsible for preventing double-bookings and handling cancellation policies.

> **Standalone usability:** This NIP works independently on any Nostr application. Within the [TROTT protocol](https://github.com/forgesworn/nip-drafts) (v0.9), TROTT-11: Scheduling & Availability extends NIP-BOOKING with domain-specific configuration (default slot durations, cancellation windows per domain) and composition with the TROTT task lifecycle — but adoption of TROTT is not required.

## Motivation

Nostr has NIP-52 for calendar events and NIP-53 for live activities, but no standard mechanism for **advertising availability and accepting bookings**. Many workflows require structured scheduling:

- **Appointment booking** — a professional publishes available slots, clients book sessions
- **Recurring services** — weekly or monthly time slots with availability management
- **Venue & resource reservation** — rooms, equipment, or shared spaces with time-slot allocation
- **Event ticketing** — time-limited entry slots with capacity management
- **Tutoring & consulting** — one-on-one sessions with calendar-based scheduling

Without a standard, each scheduling application invents its own availability and booking scheme. NIP-BOOKING provides a minimal, composable primitive that any Nostr application can adopt for time-based coordination.

## Kinds

| kind  | description            |
| ----- | ---------------------- |
| 30582 | Availability Calendar  |
| 30583 | Booking Slot           |
| 30584 | Booking Cancellation   |
| 30585 | Recurring Availability |
| 30586 | Booking Confirmation   |
| 30587 | Reschedule Request     |

All six kinds are addressable events (NIP-01). The `d` tag format ensures each event occupies a unique slot, allowing updates via republication.

---

## Availability Calendar (`kind:30582`)

Published by a provider to advertise their available time slots. Addressable — the provider can update their calendar by republishing with the same `d` tag, typically to mark slots as booked or blocked.

```json
{
    "kind": 30582,
    "pubkey": "<provider-hex-pubkey>",
    "created_at": 1698774000,
    "tags": [
        ["d", "<provider-hex-pubkey>:calendar:2026-W09"],
        ["t", "availability-calendar"],
        ["g", "gcpuuz"],
        ["slot", "1698822000", "1698832800", "available"],
        ["slot", "1698832800", "1698843600", "available"],
        ["slot", "1698908400", "1698919200", "available"],
        ["slot", "1698919200", "1698930000", "blocked"],
        ["slot_duration_minutes", "180"],
        ["recurrence", "weekly"],
        ["recurrence_pattern", "mon,thu"]
    ],
    "content": "",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<provider_pubkey>:calendar:<period>`. Addressable — one calendar per provider per period.
* `t` (REQUIRED): Protocol family marker. MUST be `"availability-calendar"`.
* `slot` (RECOMMENDED, multiple): Available time slots. Format: `["slot", "<start_unix>", "<end_unix>", "<status>"]` where `status` is `"available"`, `"booked"`, or `"blocked"`. A calendar event MAY contain multiple `slot` tags.
* `g` (RECOMMENDED): Geohash of the service area.
* `recurrence` (OPTIONAL): Recurrence frequency. One of `"daily"`, `"weekdays"`, `"weekly"`, `"biweekly"`, `"monthly"`.
* `recurrence_pattern` (OPTIONAL): Comma-separated day codes (e.g. `"mon,wed,fri"`).
* `slot_duration_minutes` (OPTIONAL): Default slot duration in minutes.
* `max_bookings_per_slot` (OPTIONAL): Maximum concurrent bookings per slot (defaults to 1 if omitted).
* `expiration` (OPTIONAL): Unix timestamp — calendar validity period. Clients SHOULD use NIP-40 `expiration` for relay-level enforcement.

**Content:** Empty string or NIP-44 encrypted JSON with additional scheduling metadata (booking policies, cancellation terms, pricing per slot).

### Slot Tag Format

Each available slot is encoded as a `slot` tag with structured positional values:

```
["slot", "<start_unix>", "<end_unix>", "<status>"]
```

- `start_unix`: Unix timestamp for slot start time
- `end_unix`: Unix timestamp for slot end time
- `status`: One of `"available"`, `"booked"`, or `"blocked"`

Providers update slot statuses by republishing the entire calendar event with revised `slot` tags.

---

## Booking Slot (`kind:30583`)

Published by a requester to book a specific slot from a provider's calendar.

```json
{
    "kind": 30583,
    "pubkey": "<requester-hex-pubkey>",
    "created_at": 1698775000,
    "tags": [
        ["d", "<provider-hex-pubkey>:calendar:2026-W09:slot:1698822000:booking:<requester-hex-pubkey>"],
        ["t", "booking-slot"],
        ["e", "<calendar-event-id>", "wss://relay.example.com"],
        ["p", "<provider-hex-pubkey>"],
        ["slot_start", "1698822000"],
        ["slot_end", "1698832800"],
        ["amount", "5000"],
        ["currency", "SAT"]
    ],
    "content": "<NIP-44 encrypted JSON: {\"address\":\"42 Oak Lane, London SE1 2AB\",\"notes\":\"Please arrive 10 minutes early.\"}>",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<calendar_d_tag>:slot:<slot_start>:booking:<requester_pubkey>`. The `slot_start` timestamp participates in the identifier to ensure one booking per requester per slot — without it, a second booking from the same requester on the same calendar would replace the first.
* `t` (REQUIRED): Protocol family marker. MUST be `"booking-slot"`.
* `e` (REQUIRED): Event ID of the Kind 30582 availability calendar.
* `p` (REQUIRED): Provider's hex pubkey.
* `slot_start` (REQUIRED): Unix timestamp — start time of the booked slot.
* `slot_end` (REQUIRED): Unix timestamp — end time of the booked slot.
* `amount` (RECOMMENDED): Agreed price in smallest currency unit (pence for GBP, cents for USD, satoshis for SAT).
* `currency` (RECOMMENDED): Currency code.
* `ref` (OPTIONAL): External reference (booking confirmation number).
* `notes` (OPTIONAL): Booking notes or special requests.

**Content:** Empty string or NIP-44 encrypted JSON with booking details (address, special requirements, access instructions).

---

## Booking Cancellation (`kind:30584`)

Published by either party to cancel a booking. The `d` tag format creates one cancellation per booking.

```json
{
    "kind": 30584,
    "pubkey": "<requester-hex-pubkey>",
    "created_at": 1698776000,
    "tags": [
        ["d", "<provider-hex-pubkey>:calendar:2026-W09:slot:1698822000:booking:<requester-hex-pubkey>:cancellation"],
        ["t", "booking-cancellation"],
        ["e", "<booking-event-id>", "wss://relay.example.com"],
        ["cancel_reason", "requester_initiated"],
        ["p", "<provider-hex-pubkey>"],
        ["refund_amount", "5000"],
        ["refund_currency", "SAT"]
    ],
    "content": "Need to reschedule due to an unexpected commitment. Apologies for the short notice.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<booking_d_tag>:cancellation`. One cancellation per booking.
* `t` (REQUIRED): Protocol family marker. MUST be `"booking-cancellation"`.
* `e` (REQUIRED): Event ID of the Kind 30583 booking being cancelled.
* `cancel_reason` (REQUIRED): Reason code. One of `"requester_initiated"`, `"provider_initiated"`, `"schedule_conflict"`, `"no_show"`, `"force_majeure"`.
* `p` (RECOMMENDED): Other party's hex pubkey (for notification).
* `refund_amount` (OPTIONAL): Refund amount in smallest currency unit.
* `refund_currency` (OPTIONAL): Currency of the refund.
* `penalty_amount` (OPTIONAL): Cancellation penalty in smallest currency unit.
* `penalty_currency` (OPTIONAL): Currency of the penalty.

**Content:** Plain text with cancellation details or reason.

---

## Recurring Availability (`kind:30585`)

Published by a provider to define a repeating availability pattern using iCalendar RRULE format ([RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545)). Unlike Kind 30582 (Availability Calendar) which lists explicit time slots per period, Kind 30585 declares a recurring pattern that clients expand into concrete slots. A single Kind 30585 event can express complex schedules like "every Monday and Thursday 10am-12pm, except bank holidays, until December 2026".

The provider publishes one Kind 30585 per service category. Clients resolve the RRULE into concrete time windows and present them as bookable slots. When a requester books a slot derived from a Kind 30585 pattern, they publish a standard Kind 30583 (Booking Slot) referencing the Kind 30585 event.

```json
{
    "kind": 30585,
    "pubkey": "<provider-hex-pubkey>",
    "created_at": 1698780000,
    "tags": [
        ["d", "<provider-hex-pubkey>:recurring:appointments"],
        ["t", "recurring-availability"],
        ["recurrence", "FREQ=WEEKLY;BYDAY=MO,TH"],
        ["slot_start", "10:00"],
        ["slot_duration_minutes", "60"],
        ["g", "gcpuuz"],
        ["slot_capacity", "1"],
        ["pricing", "7500"],
        ["currency", "GBP"],
        ["timezone", "Europe/London"],
        ["expiration", "1735689600"],
        ["exclude_date", "2026-03-17"],
        ["exclude_date", "2026-04-06"],
        ["cancellation_window_hours", "48"],
        ["cancellation_fee", "3750"],
        ["cancellation_fee_currency", "GBP"]
    ],
    "content": "",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<provider_pubkey>:recurring:<category>`. Addressable — one recurring pattern per provider per category.
* `t` (REQUIRED): Protocol family marker. MUST be `"recurring-availability"`.
* `recurrence` (REQUIRED): RRULE string conforming to [RFC 5545, Section 3.3.10](https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10). See [RRULE Format](#rrule-format) below.
* `slot_start` (REQUIRED, multiple): Start time of each recurring slot in `HH:MM` format (24-hour, UTC unless `timezone` is specified). Multiple `slot_start` tags are allowed for multi-slot days.
* `slot_duration_minutes` (REQUIRED): Duration of each slot in minutes.
* `g` (RECOMMENDED): Geohash of the service area.
* `slot_capacity` (RECOMMENDED): Maximum concurrent bookings per slot. Defaults to `1` if omitted.
* `pricing` (RECOMMENDED): Price per slot in smallest currency unit (pence for GBP, cents for USD, satoshis for SAT).
* `currency` (RECOMMENDED): Currency code (ISO 4217).
* `timezone` (RECOMMENDED): Provider's local timezone in IANA format (e.g. `Europe/London`). If omitted, clients MUST default to UTC.
* `expiration` (RECOMMENDED): Unix timestamp — pattern validity end date. Clients SHOULD use NIP-40 `expiration` for relay-level enforcement.
* `exclude_date` (OPTIONAL, multiple): ISO 8601 date to exclude from the pattern (e.g. bank holidays).
* `cancellation_window_hours` (OPTIONAL): Minimum notice hours for penalty-free cancellation.
* `cancellation_fee` (OPTIONAL): Fee in smallest currency unit when cancelled outside the window.
* `cancellation_fee_currency` (OPTIONAL): Currency code for the cancellation fee.
* `p` (OPTIONAL, multiple): Additional parties to notify of availability changes.
* `ref` (OPTIONAL): External reference (e.g. practice management system ID).
* `env_constraint` (OPTIONAL, multiple): Environmental or seasonal constraint on this availability pattern. Values: `frost_sensitive`, `dry_weather_only`, `temperature_min:<celsius>`, `temperature_max:<celsius>`, `daylight_only`, `wind_max:<knots>`, `humidity_max:<percent>`, `seasonal_material`, `tidal_dependent`, `noise_restricted`. Multiple tags are cumulative — all constraints must be satisfied for a slot to be viable.
* `seasonal_window` (OPTIONAL): ISO 8601 month range during which this pattern is active, e.g. `apr-oct`. Outside this window the pattern is suspended.

**Content:** Empty string or NIP-44 encrypted JSON with additional scheduling metadata (service descriptions, preparation instructions, booking policies).

### RRULE Format

NIP-BOOKING uses a subset of the iCalendar RRULE specification (RFC 5545, Section 3.3.10). Supported RRULE properties:

| Property   | Description                  | Example                                   |
|------------|------------------------------|-------------------------------------------|
| `FREQ`     | Recurrence frequency         | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`    |
| `BYDAY`    | Days of the week             | `MO`, `TU`, `WE`, `TH`, `FR`, `SA`, `SU` |
| `BYHOUR`   | Hours of the day (0-23)      | `10`, `14`                                |
| `INTERVAL` | Interval between recurrences | `1` (every week), `2` (every other week)  |
| `COUNT`    | Number of occurrences        | `52` (52 weeks)                           |
| `UNTIL`    | End date (ISO 8601)          | `20261231T235959Z`                        |
| `WKST`     | Week start day               | `MO` (Monday)                             |

**Example RRULE patterns:**

| Schedule                           | RRULE                                         |
|------------------------------------|-----------------------------------------------|
| Every Monday                       | `FREQ=WEEKLY;BYDAY=MO`                        |
| Monday and Thursday                | `FREQ=WEEKLY;BYDAY=MO,TH`                     |
| Every weekday                      | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`           |
| Every other Saturday               | `FREQ=WEEKLY;INTERVAL=2;BYDAY=SA`             |
| First Monday of each month         | `FREQ=MONTHLY;BYDAY=1MO`                      |
| 52 weekly sessions                 | `FREQ=WEEKLY;BYDAY=WE;COUNT=52`               |

Clients MUST support at minimum `FREQ`, `BYDAY`, `INTERVAL`, `COUNT`, and `UNTIL`. Clients SHOULD support `BYHOUR` and `WKST`. Unsupported RRULE properties MUST be silently ignored — clients SHOULD NOT reject events containing unsupported properties.

Libraries such as `rrule.js` (JavaScript) or `dateutil.rrule` (Python) provide RFC 5545 RRULE parsing.

### Multi-Slot Days

A provider who offers multiple time slots on the same days (e.g. morning and afternoon sessions) publishes multiple `slot_start` tags on a single Kind 30585 event:

```json
{
    "kind": 30585,
    "pubkey": "<provider-hex-pubkey>",
    "created_at": 1698780000,
    "tags": [
        ["d", "<provider-hex-pubkey>:recurring:tutoring"],
        ["t", "recurring-availability"],
        ["recurrence", "FREQ=WEEKLY;BYDAY=MO,WE,FR"],
        ["slot_start", "09:00"],
        ["slot_start", "14:00"],
        ["slot_duration_minutes", "60"],
        ["slot_capacity", "1"],
        ["pricing", "4000"],
        ["currency", "GBP"],
        ["timezone", "Europe/London"]
    ],
    "content": "",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

This expands to six slots per week: Monday 09:00, Monday 14:00, Wednesday 09:00, Wednesday 14:00, Friday 09:00, Friday 14:00.

### Relationship to Kind 30582

Kind 30585 (Recurring Availability) and Kind 30582 (Availability Calendar) serve complementary roles:

| Aspect         | Kind 30582 (Calendar)            | Kind 30585 (Recurring Availability)     |
|----------------|----------------------------------|-----------------------------------------|
| **Pattern**    | Explicit slot list per period    | RRULE-based repeating pattern           |
| **Granularity**| Individual slots                 | Recurring template                      |
| **Use case**   | Ad-hoc or irregular availability | Regular recurring schedules             |
| **Updates**    | Republish each period            | Publish once, override with exclusions  |
| **Overrides**  | Direct slot status changes       | `exclude_date` tags for exceptions      |

Providers MAY publish both kinds simultaneously. When both exist for the same provider, clients SHOULD merge the two: Kind 30585 generates the baseline recurring slots, and Kind 30582 provides overrides (blocked slots, additional ad-hoc slots). If a Kind 30582 slot conflicts with a Kind 30585 pattern, the Kind 30582 event takes precedence.

### RRULE Resolution

Clients resolve Kind 30585 events into concrete bookable slots by:

1. Parsing the `recurrence` tag as an RFC 5545 RRULE
2. Generating occurrence dates within the requested time window
3. Applying `exclude_date` exclusions
4. Combining each occurrence date with the `slot_start` time and `slot_duration_minutes` to produce concrete slots
5. Checking each slot against existing Kind 30583 bookings to determine remaining capacity
6. Presenting available slots to the requester

### Tag Reference

| Tag                         | Required | Multiple | Description                                       |
|-----------------------------|----------|----------|---------------------------------------------------|
| `d`                         | MUST     | No       | Addressable event identifier                      |
| `t`                         | MUST     | No       | Protocol family marker                            |
| `recurrence`                | MUST     | No       | RRULE string (RFC 5545)                           |
| `slot_start`                | MUST     | Yes      | Start time per slot (multiple for multi-slot days) |
| `slot_duration_minutes`     | MUST     | No       | Slot duration in minutes                          |
| `g`                         | SHOULD   | No       | Service area geohash                              |
| `slot_capacity`             | SHOULD   | No       | Max concurrent bookings per slot                  |
| `pricing`                   | SHOULD   | No       | Price per slot (smallest currency unit)           |
| `currency`                  | SHOULD   | No       | Currency code                                     |
| `timezone`                  | SHOULD   | No       | Provider's timezone (IANA format)                 |
| `expiration`                | SHOULD   | No       | Pattern end date (NIP-40)                         |
| `exclude_date`              | MAY      | Yes      | Excluded dates (ISO 8601)                         |
| `cancellation_window_hours` | MAY      | No       | Penalty-free cancellation window                  |
| `cancellation_fee`          | MAY      | No       | Fee for late cancellation                         |
| `cancellation_fee_currency` | MAY      | No       | Currency of the cancellation fee                  |
| `p`                         | MAY      | Yes      | Additional notification targets                   |
| `ref`                       | MAY      | No       | External reference                                |
| `env_constraint`            | MAY      | Yes      | Environmental/seasonal constraint                 |
| `seasonal_window`           | MAY      | No       | Active month range (e.g. `apr-oct`)               |

---

## Booking Confirmation (`kind:30586`)

Published by a provider to confirm or decline a Kind 30583 (Booking Slot) request. In workflows where bookings require provider approval, a Kind 30583 booking is treated as a _request_ rather than a confirmed reservation. The booking enters a `pending_confirmation` state until the provider publishes a Kind 30586 event.

In workflows where bookings are auto-confirmed, Kind 30586 is optional — the Kind 30583 booking itself constitutes confirmation.

```json
{
    "kind": 30586,
    "pubkey": "<provider-hex-pubkey>",
    "created_at": 1698781000,
    "tags": [
        ["d", "<provider-hex-pubkey>:calendar:2026-W10:slot:1699254000:booking:<requester-hex-pubkey>:confirmation"],
        ["t", "booking-confirmation"],
        ["e", "<booking-event-id>", "wss://relay.example.com"],
        ["decision", "confirmed"],
        ["p", "<requester-hex-pubkey>"],
        ["slot_start", "1699254000"],
        ["slot_end", "1699257600"],
        ["amount", "7500"],
        ["currency", "GBP"]
    ],
    "content": "<NIP-44 encrypted JSON: {\"location\":\"Suite 4B, 12 Harley Street, London W1G 9PF\",\"preparation\":\"Please arrive 10 minutes early for your first session.\"}>",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<booking_d_tag>:confirmation`. One confirmation per booking.
* `t` (REQUIRED): Protocol family marker. MUST be `"booking-confirmation"`.
* `e` (REQUIRED): Event ID of the Kind 30583 booking being confirmed or declined.
* `decision` (REQUIRED): The provider's decision. MUST be `"confirmed"` or `"declined"`.
* `p` (RECOMMENDED): Requester's hex pubkey (for notification).
* `slot_start` (RECOMMENDED): Unix timestamp — start time of the confirmed slot.
* `slot_end` (RECOMMENDED): Unix timestamp — end time of the confirmed slot.
* `decline_reason` (OPTIONAL): Reason for declining. One of `"schedule_conflict"`, `"capacity_full"`, `"provider_unavailable"`, `"requirements_unmet"`.
* `amount` (OPTIONAL): Confirmed price in smallest currency unit.
* `currency` (OPTIONAL): Currency code.
* `notes` (OPTIONAL): Provider notes (preparation instructions, etc.).
* `expiration` (OPTIONAL): Unix timestamp — confirmation validity period. Clients SHOULD use NIP-40 `expiration` for relay-level enforcement.
* `ref` (OPTIONAL): External reference (booking confirmation number).

**Content:** Plain text or NIP-44 encrypted JSON with confirmation details, preparation instructions, or location/access information.

**Example (declined):**

```json
{
    "kind": 30586,
    "pubkey": "<provider-hex-pubkey>",
    "created_at": 1698781000,
    "tags": [
        ["d", "<provider-hex-pubkey>:calendar:2026-W10:slot:1699254000:booking:<requester-hex-pubkey>:confirmation"],
        ["t", "booking-confirmation"],
        ["e", "<booking-event-id>", "wss://relay.example.com"],
        ["decision", "declined"],
        ["p", "<requester-hex-pubkey>"],
        ["decline_reason", "schedule_conflict"]
    ],
    "content": "Unfortunately I have a scheduling conflict for this slot. Please check my availability for Wednesday afternoon instead.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

### Tag Reference

| Tag              | Required | Multiple | Description                                |
|------------------|----------|----------|--------------------------------------------|
| `d`              | MUST     | No       | Addressable event identifier               |
| `t`              | MUST     | No       | Protocol family marker                     |
| `e`              | MUST     | No       | Reference to Kind 30583 booking event      |
| `decision`       | MUST     | No       | `confirmed` or `declined`                  |
| `p`              | SHOULD   | No       | Requester's pubkey for notification        |
| `slot_start`     | SHOULD   | No       | Confirmed slot start time                  |
| `slot_end`       | SHOULD   | No       | Confirmed slot end time                    |
| `decline_reason` | MAY      | No       | Reason code when decision is `declined`    |
| `amount`         | MAY      | No       | Confirmed price (smallest currency unit)   |
| `currency`       | MAY      | No       | Currency code                              |
| `notes`          | MAY      | No       | Provider notes                             |
| `expiration`     | MAY      | No       | Confirmation validity period               |
| `ref`            | MAY      | No       | External reference                         |

---

## Reschedule Request (`kind:30587`)

Published by either party to request a time change for an existing booking. The other party approves or declines the reschedule by publishing a Kind 30586 (Booking Confirmation) event referencing the rescheduled booking.

Rescheduling preserves the booking history and relationship between the original request and the new time, unlike cancellation-and-rebook which creates two independent events. Cancellation policy tags on the Kind 30587 event determine whether penalties apply based on the notice period.

**Example (requester-initiated):**

```json
{
    "kind": 30587,
    "pubkey": "<requester-hex-pubkey>",
    "created_at": 1698782000,
    "tags": [
        ["d", "<provider-hex-pubkey>:calendar:2026-W10:slot:1699254000:booking:<requester-hex-pubkey>:reschedule:001"],
        ["t", "reschedule-request"],
        ["e", "<booking-event-id>", "wss://relay.example.com"],
        ["new_slot_start", "1699340400"],
        ["new_slot_end", "1699344000"],
        ["p", "<provider-hex-pubkey>"],
        ["original_slot_start", "1699254000"],
        ["original_slot_end", "1699257600"],
        ["reschedule_reason", "requester_conflict"],
        ["cancellation_window_hours", "48"],
        ["penalty_waived", "true"]
    ],
    "content": "I have a work commitment that has come up on Monday. Could we move to Tuesday afternoon instead?",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

Tags:

* `d` (REQUIRED): Format `<booking_d_tag>:reschedule:<sequence>`. Addressable — allows multiple reschedule attempts per booking.
* `t` (REQUIRED): Protocol family marker. MUST be `"reschedule-request"`.
* `e` (REQUIRED): Event ID of the Kind 30583 booking being rescheduled.
* `new_slot_start` (REQUIRED): Unix timestamp — proposed new start time.
* `new_slot_end` (REQUIRED): Unix timestamp — proposed new end time.
* `p` (RECOMMENDED): Other party's hex pubkey (for notification).
* `original_slot_start` (RECOMMENDED): Unix timestamp — original booking start time.
* `original_slot_end` (RECOMMENDED): Unix timestamp — original booking end time.
* `reschedule_reason` (RECOMMENDED): Reason code. One of `"requester_conflict"`, `"provider_conflict"`, `"weather"`, `"illness"`, `"other"`.
* `cancellation_window_hours` (OPTIONAL): Penalty-free window echoed from Kind 30585 or application policy.
* `cancellation_fee` (OPTIONAL): Applicable fee if outside window (smallest currency unit).
* `cancellation_fee_currency` (OPTIONAL): Currency of the cancellation fee.
* `penalty_waived` (OPTIONAL): `"true"` if the requesting party accepts the penalty, or the other party waives it.
* `amount` (OPTIONAL): Price for the rescheduled slot (if different from original).
* `currency` (OPTIONAL): Currency code.
* `ref` (OPTIONAL): External reference.
* `expiration` (OPTIONAL): Unix timestamp — deadline for the other party to respond. Clients SHOULD use NIP-40 `expiration` for relay-level enforcement.

**Content:** Plain text with the reason for rescheduling and any relevant context.

**Example (provider-initiated):**

```json
{
    "kind": 30587,
    "pubkey": "<provider-hex-pubkey>",
    "created_at": 1698782000,
    "tags": [
        ["d", "<provider-hex-pubkey>:calendar:2026-W10:slot:1699254000:booking:<requester-hex-pubkey>:reschedule:001"],
        ["t", "reschedule-request"],
        ["e", "<booking-event-id>", "wss://relay.example.com"],
        ["new_slot_start", "1699340400"],
        ["new_slot_end", "1699344000"],
        ["p", "<requester-hex-pubkey>"],
        ["original_slot_start", "1699254000"],
        ["original_slot_end", "1699257600"],
        ["reschedule_reason", "illness"],
        ["penalty_waived", "true"],
        ["expiration", "1698868400"]
    ],
    "content": "I'm unwell today and need to reschedule our session. Tuesday same time would work if that suits you.",
    "id": "<32-bytes lowercase hex>",
    "sig": "<64-bytes lowercase hex>"
}
```

When a reschedule is approved, the responder publishes a Kind 30586 (Booking Confirmation) event referencing the **original** Kind 30583 booking but with updated `slot_start` and `slot_end` tags reflecting the new time. This preserves the full event chain: booking → reschedule request → confirmation of new time.

### Cancellation Policy on Reschedules

Cancellation policies are declared at two levels, with the most specific taking precedence:

1. **Kind 30585** (Recurring Availability) — `cancellation_window_hours` and `cancellation_fee` tags
2. **Kind 30587** (Reschedule Request) — echoes the applicable policy for transparency

When a reschedule is requested:

1. The requesting party checks the applicable cancellation window
2. If the reschedule is requested within the cancellation window (i.e. less than `cancellation_window_hours` before the original slot), the `cancellation_fee` MAY apply
3. The `penalty_waived` tag allows the requesting party to signal that they accept the penalty, or allows the other party to waive it when responding

**Provider-initiated reschedules** SHOULD NOT incur penalties on the requester.

### Tag Reference

| Tag                         | Required | Multiple | Description                                      |
|-----------------------------|----------|----------|--------------------------------------------------|
| `d`                         | MUST     | No       | Addressable event identifier                     |
| `t`                         | MUST     | No       | Protocol family marker                           |
| `e`                         | MUST     | No       | Reference to Kind 30583 booking event            |
| `new_slot_start`            | MUST     | No       | Proposed new start time                          |
| `new_slot_end`              | MUST     | No       | Proposed new end time                            |
| `p`                         | SHOULD   | No       | Other party's pubkey for notification            |
| `original_slot_start`       | SHOULD   | No       | Original booking start time                      |
| `original_slot_end`         | SHOULD   | No       | Original booking end time                        |
| `reschedule_reason`         | SHOULD   | No       | Reason code for the reschedule                   |
| `cancellation_window_hours` | MAY      | No       | Penalty-free cancellation window (hours)         |
| `cancellation_fee`          | MAY      | No       | Applicable cancellation fee                      |
| `cancellation_fee_currency` | MAY      | No       | Currency of the cancellation fee                 |
| `penalty_waived`            | MAY      | No       | Whether the penalty is waived                    |
| `amount`                    | MAY      | No       | Rescheduled slot price (if different)            |
| `currency`                  | MAY      | No       | Currency code                                    |
| `ref`                       | MAY      | No       | External reference                               |
| `expiration`                | MAY      | No       | Response deadline (NIP-40)                       |

---

## Protocol Flow

```
  Provider                       Relay                     Requester
      |                            |                            |
      |-- kind:30582 Calendar ---->|                            |
      |  (slots: available)        |                            |
      |                            |<-- kind:30583 Booking -----|
      |<------ notification -------|    (slot: Mon 09:00-12:00) |
      |                            |                            |
      |-- kind:30582 Calendar ---->|  (updated: Mon slot        |
      |  (Mon slot: booked)        |   now 'booked')            |
      |                            |                            |
      |           ... service delivered ...                      |
      |                            |                            |
      |  Provider publishes new    |                            |
      |  calendar for next period  |                            |
      |                            |                            |
```

**With cancellation:**

```
  Provider                       Relay                     Requester
      |                            |                            |
      |                            |<-- kind:30584 Cancel ------|
      |<------ notification -------|    (cancel_reason:         |
      |                            |     requester_initiated)   |
      |                            |                            |
      |-- kind:30582 Calendar ---->|  (updated: slot restored   |
      |  (slot: available again)   |   to 'available')          |
      |                            |                            |
```

1. **Publish calendar:** Provider publishes `kind:30582` with available time slots for a given period, or `kind:30585` with a recurring pattern.
2. **Book slot:** Requester discovers available slots and publishes `kind:30583` to book a specific slot.
3. **Confirm booking (optional):** Provider publishes `kind:30586` to confirm or decline the booking. If the workflow does not require confirmation, the booking is auto-confirmed.
4. **Update calendar:** Provider republishes `kind:30582` with the booked slot's status changed to `"booked"`.
5. **Service delivery:** The consuming application handles what happens during the booked slot (task creation, payment, etc.).
6. **Reschedule (optional):** Either party publishes `kind:30587` to request a time change. The other party responds with `kind:30586`.
7. **Cancellation (optional):** Either party publishes `kind:30584` to cancel. The provider restores the slot to `"available"` in their next calendar update.
8. **Next period:** Provider publishes a new `kind:30582` for the next scheduling period.

## Recurring Schedules

Providers offering recurring services use the `recurrence` and `recurrence_pattern` tags to indicate their regular schedule. For example, a weekly Monday/Thursday pattern:

```json
["recurrence", "weekly"],
["recurrence_pattern", "mon,thu"]
```

Clients SHOULD interpret these tags to project future availability. The provider publishes a concrete calendar (`kind:30582`) for each upcoming period with specific slot times, while the recurrence tags indicate the expected pattern. The `max_bookings_per_slot` tag (defaulting to 1) controls whether multiple requesters can book the same time slot — useful for group classes or shared resources.

## Validation Rules

All validation rules for NIP-BOOKING events. Implementations MUST enforce these rules when processing booking events.

| Rule     | Event Kind(s)                  | Requirement                                                                                |
|----------|--------------------------------|--------------------------------------------------------------------------------------------|
| V-BK-01  | 30585 (Recurring Availability) | MUST include a valid RRULE string in the `recurrence` tag conforming to RFC 5545           |
| V-BK-02  | 30585 (Recurring Availability) | MUST include at least one `slot_start` tag in `HH:MM` format and a `slot_duration_minutes` tag |
| V-BK-03  | 30585 (Recurring Availability) | `slot_capacity` value MUST be a positive integer when present (minimum `1`)                |
| V-BK-04  | 30585 (Recurring Availability) | `exclude_date` values MUST be valid ISO 8601 dates                                         |
| V-BK-05  | 30586 (Booking Confirmation)   | MUST reference a valid Kind 30583 (Booking Slot) via `e` tag                               |
| V-BK-06  | 30586 (Booking Confirmation)   | `decision` tag MUST be either `confirmed` or `declined`                                    |
| V-BK-07  | 30586 (Booking Confirmation)   | MUST be published by the provider referenced in the Kind 30583 booking's `p` tag           |
| V-BK-08  | 30587 (Reschedule Request)     | MUST reference a valid Kind 30583 (Booking Slot) via `e` tag                               |
| V-BK-09  | 30587 (Reschedule Request)     | `new_slot_start` MUST be a valid future Unix timestamp                                     |
| V-BK-10  | 30587 (Reschedule Request)     | `new_slot_end` MUST be greater than `new_slot_start`                                       |
| V-BK-11  | 30587 (Reschedule Request)     | MUST be published by either the requester or provider of the referenced booking            |
| V-BK-12  | 30585 (Recurring Availability) | `pricing` and `cancellation_fee` values MUST be non-negative integers when present         |

## Relay Recommendations

| Event Kind                      | Recommended Retention                   | Rationale                   |
|---------------------------------|-----------------------------------------|-----------------------------|
| 30582 (Availability Calendar)   | 90 days post-expiration or post-update  | Scheduling infrastructure   |
| 30583 (Booking Slot)            | 90 days post-slot-end                   | Booking record              |
| 30584 (Booking Cancellation)    | 90 days post-slot-end                   | Cancellation audit trail    |
| 30585 (Recurring Availability)  | 90 days post-expiration or post-update  | Scheduling infrastructure   |
| 30586 (Booking Confirmation)    | 90 days post-slot-end                   | Booking audit trail         |
| 30587 (Reschedule Request)      | 90 days post-slot-end                   | Reschedule audit trail      |

## Use Cases Beyond TROTT

### Professional Appointment Booking

Therapists, consultants, tutors, and other professionals can publish their availability calendar on Nostr. Clients browse available slots and book sessions directly. The NIP-44 encrypted content on booking events protects client details (address, session notes). Cancellation events with penalty tags enable automated cancellation policy enforcement.

### Venue & Resource Reservation

Co-working spaces, meeting rooms, sports facilities, and shared equipment can use availability calendars for reservation management. The `max_bookings_per_slot` tag supports both exclusive-use resources (set to 1) and shared resources (set to capacity). The `g` tag enables location-based discovery.

### Recurring Event Registration

Community organisers can publish recurring event slots (weekly meetups, monthly workshops, regular classes). Attendees book specific sessions via `kind:30583`. The `recurrence` tags communicate the schedule pattern, while individual bookings track attendance per session.

### Service Provider Scheduling

Any service provider who works by appointment (plumbers, electricians, dog walkers, personal trainers) can publish their availability and accept bookings through Nostr. The calendar model handles the common pattern of time-slotted availability with location-based discovery.

## Security Considerations

* **Double-booking prevention.** Relays do not enforce slot exclusivity. The provider is responsible for updating their calendar (`kind:30582`) after each booking. Applications SHOULD check slot status before confirming bookings and SHOULD handle race conditions gracefully (e.g. by notifying the requester if a slot was booked by someone else).
* **Cancellation policies.** The `penalty_amount` and `refund_amount` tags communicate cancellation terms but do not enforce payment. Applications SHOULD integrate with payment protocols (NIP-ESCROW) for automated penalty collection.
* **Content encryption.** Booking details (addresses, personal information, session notes) SHOULD be NIP-44 encrypted in the `content` field. Public `slot` tags on calendars reveal when a provider is busy but not who booked or why.
* **Calendar authenticity.** Clients MUST verify that `kind:30582` calendar events are signed by the provider's pubkey. Forged calendars could lead to bookings with non-existent providers.
* **Slot time validation.** Clients SHOULD verify that `slot_start` and `slot_end` on booking events (`kind:30583`) match an `available` slot on the referenced calendar (`kind:30582`). Bookings referencing non-existent or `blocked` slots SHOULD be rejected.
* **Timestamp manipulation.** Providers could manipulate slot timestamps to create artificial scarcity or conflict. Clients SHOULD cross-reference `created_at` timestamps with slot times and flag anomalies.
* **Booking spam.** Providers SHOULD implement rate limiting on incoming Kind 30583 bookings. A requester who repeatedly books and cancels slots MAY be flagged or blocked at the application level.
* **Cancellation policy manipulation.** The cancellation policy tags on Kind 30585 and Kind 30587 are informational — they declare the policy but do not enforce it cryptographically. Enforcement depends on the consuming application and payment integration.
* **Slot overbooking.** When `slot_capacity` is greater than 1 (on Kind 30582 or Kind 30585), multiple requesters may book the same slot. Providers MUST track the number of active bookings per slot and decline (via Kind 30586) or update their calendar (Kind 30582) when capacity is reached.
* **Time zone handling.** Kind 30585 includes a `timezone` tag to avoid ambiguity in recurring patterns. Clients MUST resolve RRULE patterns in the provider's declared timezone. Daylight saving time transitions MUST be handled correctly — a recurring slot at "10:00 Europe/London" remains at 10:00 local time regardless of GMT/BST transitions.
* **Confirmation authenticity.** Clients MUST verify that Kind 30586 events are signed by the provider referenced in the original Kind 30583 booking's `p` tag. Forged confirmations could mislead requesters.

## Relationship to Existing NIPs

Complements [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md) (Calendar Events). NIP-52 announces events ("I'm hosting a workshop"); NIP-BOOKING manages availability and reservations ("You can book a time slot with me"). NIP-BOOKING's Kind 30585 (Recurring Availability) handles what NIP-52 intentionally defers — recurring scheduling patterns — using RFC 5545 RRULE.

## Dependencies

* [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow, addressable events
* [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md): Expiration timestamps (calendar validity)
* [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Versioned encrypted payloads (private booking details)
* [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md): Calendar Events (complementary — NIP-52 defines events, NIP-BOOKING defines availability and reservations)
* [RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545): Internet Calendaring and Scheduling (iCalendar) — RRULE format for recurring availability patterns

## Reference Implementation

The `@trott/sdk` (TypeScript SDK) provides builders and parsers for all six kinds defined in this NIP. For standalone use without TROTT, implementors SHOULD refer to the kind definitions above.

A minimal implementation requires:

1. A Nostr client that supports addressable event publishing.
2. Calendar rendering logic — parsing `slot` tags and `recurrence`/RRULE patterns to display provider availability.
3. Booking state management — tracking slot statuses and preventing double-bookings at the application level.
4. Confirmation handling — processing Kind 30586 events to update booking status (confirmed/declined).
5. Reschedule handling — publishing Kind 30587 requests and processing Kind 30586 responses with updated slot times.
6. Cancellation handling with refund/penalty computation per the provider's published policies.
