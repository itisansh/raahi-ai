import type { TripSnapshot } from "../services/rules/trip";

export interface SeedMemberDef {
  id: string;
  name: string;
  short: string;
  initials: string;
  bg: string;
  fg: string;
  me?: boolean;
}

export interface SeedTrip {
  snapshot: TripSnapshot;
  startLabel: string;
  endLabel: string;
  coverColor: string;
}

const MEMBERS: SeedMemberDef[] = [
  {
    "id": "lynn",
    "name": "Aarav Sharma",
    "short": "Aarav",
    "initials": "AS",
    "bg": "#dde7fb",
    "fg": "#2b4d93",
    "me": true
  },
  {
    "id": "marco",
    "name": "Kabir Singh",
    "short": "Kabir",
    "initials": "KS",
    "bg": "#dde7fb",
    "fg": "#2b4d93"
  },
  {
    "id": "aiko",
    "name": "Ananya Rao",
    "short": "Ananya",
    "initials": "AR",
    "bg": "#dde7fb",
    "fg": "#2b4d93"
  },
  {
    "id": "sam",
    "name": "Meera Patel",
    "short": "Meera",
    "initials": "MP",
    "bg": "#dde7fb",
    "fg": "#2b4d93"
  }
];

function members(): TripSnapshot["members"] {
  return MEMBERS.map(m => ({ id: m.id, name: m.name, shortName: m.short,
    initials: m.initials, avatarBg: m.bg, avatarFg: m.fg, userId: null,
    role: m.me ? "owner" : "editor", canInvite: true, isCurrentUser: !!m.me }));
}

/** Illustrative geography and costs, not provider-verified schedules or fares.
 * Dates are fixed demo dates. Mountain access requires local confirmation. */
export function seedTrips(): SeedTrip[] {
  const days: TripSnapshot["days"] = [
    { number: 1, date: "2027-04-12", dateLabel: "", city: "Lucknow → Rishikesh", color: "#3f6fc9" },
    { number: 2, date: "2027-04-13", dateLabel: "", city: "Rishikesh", color: "#3f6fc9" },
    { number: 3, date: "2027-04-14", dateLabel: "", city: "Rishikesh → Chopta", color: "#3f6fc9" },
    { number: 4, date: "2027-04-15", dateLabel: "", city: "Chopta", color: "#3f6fc9" },
    { number: 5, date: "2027-04-16", dateLabel: "", city: "Chopta → Haridwar", color: "#3f6fc9" },
    { number: 6, date: "2027-04-17", dateLabel: "", city: "Haridwar → Lucknow", color: "#3f6fc9" },
  ];
  const stops: TripSnapshot["stops"] = [
    {"id": "s1", "day": 1, "time": "07:00", "duration": "", "name": "Travel to Rishikesh \u2014 confirm transport", "area": "Lucknow \u2192 Rishikesh", "category": "Transit", "lat": 30.0869, "lng": 78.2676, "cost": 1600, "costCurrency": "INR", "createdBy": "lynn", "transit": true, "order": 0, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s2", "day": 1, "time": "20:00", "duration": "", "name": "Shared dinner estimate", "area": "Rishikesh", "category": "Food", "lat": 30.0869, "lng": 78.2676, "cost": 250, "costCurrency": "INR", "createdBy": "lynn", "transit": false, "order": 1, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s3", "day": 2, "time": "08:00", "duration": "", "name": "Triveni Ghat walk", "area": "Rishikesh", "category": "Walk", "lat": 30.1025, "lng": 78.2984, "cost": 0, "costCurrency": "", "createdBy": "lynn", "transit": false, "order": 2, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s3b", "day": 2, "time": "12:00", "duration": "", "name": "Guesthouse estimate \u2014 not a booking", "area": "Rishikesh", "category": "Stay", "lat": 30.0869, "lng": 78.2676, "cost": 900, "costCurrency": "INR", "createdBy": "lynn", "transit": false, "order": 3, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s4", "day": 2, "time": "18:00", "duration": "", "name": "Dinner estimate", "area": "Rishikesh", "category": "Food", "lat": 30.0869, "lng": 78.2676, "cost": 250, "costCurrency": "INR", "createdBy": "lynn", "transit": false, "order": 4, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s5", "day": 3, "time": "07:00", "duration": "", "name": "Road transfer estimate \u2014 confirm local vehicle", "area": "Rishikesh \u2192 Chopta", "category": "Transit", "lat": 30.487, "lng": 79.17, "cost": 1800, "costCurrency": "INR", "createdBy": "lynn", "transit": true, "order": 5, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s6", "day": 3, "time": "17:00", "duration": "", "name": "Rest and acclimatise", "area": "Chopta", "category": "Activity", "lat": 30.487, "lng": 79.17, "cost": 0, "costCurrency": "", "createdBy": "lynn", "transit": false, "order": 6, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s7", "day": 3, "time": "18:00", "duration": "", "name": "Local meal estimate", "area": "Chopta", "category": "Food", "lat": 30.487, "lng": 79.17, "cost": 300, "costCurrency": "INR", "createdBy": "lynn", "transit": false, "order": 7, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s8", "day": 4, "time": "07:00", "duration": "", "name": "Optional Tungnath walk \u2014 check trail and weather", "area": "Chopta", "category": "Walk", "lat": 30.487, "lng": 79.17, "cost": 0, "costCurrency": "", "createdBy": "lynn", "transit": false, "order": 8, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s9", "day": 4, "time": "18:00", "duration": "", "name": "Shared meal estimate", "area": "Chopta", "category": "Food", "lat": 30.487, "lng": 79.17, "cost": 300, "costCurrency": "INR", "createdBy": "lynn", "transit": false, "order": 9, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s10", "day": 5, "time": "07:00", "duration": "", "name": "Road transfer estimate \u2014 confirm locally", "area": "Chopta \u2192 Haridwar", "category": "Transit", "lat": 29.9457, "lng": 78.1642, "cost": 1800, "costCurrency": "INR", "createdBy": "lynn", "transit": true, "order": 10, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s11", "day": 5, "time": "18:00", "duration": "", "name": "Har Ki Pauri walk", "area": "Haridwar", "category": "Sight", "lat": 29.956, "lng": 78.17, "cost": 0, "costCurrency": "", "createdBy": "lynn", "transit": false, "order": 11, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s12", "day": 5, "time": "20:00", "duration": "", "name": "Dinner estimate", "area": "Haridwar", "category": "Food", "lat": 29.9457, "lng": 78.1642, "cost": 250, "costCurrency": "INR", "createdBy": "lynn", "transit": false, "order": 12, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s12b", "day": 5, "time": "21:00", "duration": "", "name": "Guesthouse estimate \u2014 not a booking", "area": "Haridwar", "category": "Stay", "lat": 29.9457, "lng": 78.1642, "cost": 800, "costCurrency": "INR", "createdBy": "lynn", "transit": false, "order": 13, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
    {"id": "s13", "day": 6, "time": "08:00", "duration": "", "name": "Return journey \u2014 confirm transport", "area": "Haridwar \u2192 Lucknow", "category": "Transit", "lat": 26.8467, "lng": 80.9462, "cost": 1500, "costCurrency": "INR", "createdBy": "lynn", "transit": true, "order": 14, "note": "SIMULATED_DEMO: illustrative cost and location; confirm availability, route and conditions locally.", "votes": [], "comments": []} ,
  ];
  return [{ snapshot: { id: "india-north-v1", title: "North India · Demo estimates",
    status: "active", currency: "INR", version: 0, startDate: "2027-04-12",
    endDate: "2027-04-17", coverUrl: null, intake: null, agentSeedPending: false,
    ownerId: "demo", members: members(), days, stops, expenses: [] },
    startLabel: "Apr 12", endLabel: "Apr 17", coverColor: "#3f6fc9" }];
}
