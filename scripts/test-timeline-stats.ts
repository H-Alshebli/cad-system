import assert from "node:assert/strict";
import { timelineStats } from "../lib/timelineStats";

const imported = Array.from({ length: 4857 }, () => ({ status: "Closed" }));
const active = Array.from({ length: 46 }, () => ({ status: "Assigned" }));
const rows = [...imported, ...active, { status: "Cancelled" }, { status: "canceled" }];
const original = JSON.stringify(rows);
assert.equal(timelineStats(rows, 53).totalCases, 4903);
assert.equal(timelineStats(rows, 53).activeCases, 46);
assert.equal(timelineStats(rows, 53).closedCases, 4857);
assert.equal(timelineStats(rows, 53).totalAmbulances, 53);
assert.equal(JSON.stringify(rows), original);
rows[4857] = { status: "Cancelled" };
assert.equal(timelineStats(rows, 53).totalCases, 4902);
assert.equal(timelineStats(rows, 53).activeCases, 45);
rows[4857] = { status: "Assigned" };
assert.equal(timelineStats(rows, 53).totalCases, 4903);
const transports = timelineStats([
  { status: "Closed", transportingToType: "hospital" },
  { status: "Cancelled", transportingToType: "hospital" },
  { status: "Hospital", transportingToType: "clinic" },
], 0);
assert.equal(transports.closedHospitalCases, 1);
assert.equal(transports.transportingClinicCases, 1);
assert.equal(transports.totalCases, 2);
assert.equal(timelineStats([], 0).totalCases, 0);
console.log("Timeline stats: import volume, cancellation, restoration, destinations and empty results passed.");
