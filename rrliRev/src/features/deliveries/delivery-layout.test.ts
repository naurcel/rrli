import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePersonnelNames,
  getPersonnelInitials,
} from "./crew-utils.ts";
import { SMALL_MOCK_DATABASE } from "./small-mock-database.ts";

test("parsePersonnelNames accurately parses single and multiple drivers/helpers", () => {
  // Single names
  assert.deepEqual(parsePersonnelNames("Juan Dela Cruz"), ["Juan Dela Cruz"]);
  assert.equal(parsePersonnelNames("Juan Dela Cruz").length, 1);

  // Comma-separated multiple personnel
  const commaSeparated = parsePersonnelNames("Juan Dela Cruz, Pedro Santos");
  assert.deepEqual(commaSeparated, ["Juan Dela Cruz", "Pedro Santos"]);
  assert.equal(commaSeparated.length, 2);

  // Slash-separated multiple personnel
  const slashSeparated = parsePersonnelNames("Juan Dela Cruz / Pedro Santos");
  assert.deepEqual(slashSeparated, ["Juan Dela Cruz", "Pedro Santos"]);
  assert.equal(slashSeparated.length, 2);

  // Ampersand-separated multiple personnel
  const ampersandSeparated = parsePersonnelNames("Juan Dela Cruz & Pedro Santos");
  assert.deepEqual(ampersandSeparated, ["Juan Dela Cruz", "Pedro Santos"]);
  assert.equal(ampersandSeparated.length, 2);

  // Mixed delimiters with semicolons and extra whitespace
  const mixed = parsePersonnelNames("  Juan Dela Cruz  ;  Pedro Santos ,  Maria Clara  ");
  assert.deepEqual(mixed, ["Juan Dela Cruz", "Pedro Santos", "Maria Clara"]);
  assert.equal(mixed.length, 3);

  // Array of string values
  const arrayVal = parsePersonnelNames(["Lead: Juan Dela Cruz", "Relief: Pedro Santos"]);
  assert.equal(arrayVal.length, 2);

  // Null, undefined, empty, or placeholder strings
  assert.deepEqual(parsePersonnelNames(null), []);
  assert.deepEqual(parsePersonnelNames(undefined), []);
  assert.deepEqual(parsePersonnelNames(""), []);
  assert.deepEqual(parsePersonnelNames("Not recorded"), []);
  assert.deepEqual(parsePersonnelNames("None"), []);
  assert.deepEqual(parsePersonnelNames("N/A"), []);
});

test("getPersonnelInitials produces clean avatar badges", () => {
  assert.equal(getPersonnelInitials("Juan Dela Cruz"), "JC");
  assert.equal(getPersonnelInitials("Pedro Santos"), "PS");
  assert.equal(getPersonnelInitials("Alex"), "AL");
  assert.equal(getPersonnelInitials("John Michael Doe"), "JD");
  assert.equal(getPersonnelInitials(""), "—");
});

test("mock deliveries have associated truck plates and personnel for delivery details view", () => {
  for (const delivery of SMALL_MOCK_DATABASE.deliveries) {
    const record = delivery.record;
    assert.ok(record.plateNumber, "Delivery must have an associated truck plate");
    assert.ok(record.truckType, "Delivery must specify truck type");
    assert.ok(record.truckOwnership, "Delivery must specify truck ownership");

    // In small mock database, deliveries are assigned to DRIVERS and HELPERS
    assert.ok(delivery.driverId, "Delivery must reference a driver");
    assert.ok(delivery.helperId, "Delivery must reference a helper");

    const driver = SMALL_MOCK_DATABASE.drivers.find((d) => d.id === delivery.driverId);
    const helper = SMALL_MOCK_DATABASE.helpers.find((h) => h.id === delivery.helperId);

    assert.ok(driver, "Driver ID must resolve to a valid driver record");
    assert.ok(helper, "Helper ID must resolve to a valid helper record");

    const parsedDriver = parsePersonnelNames(driver?.fullName);
    const parsedHelper = parsePersonnelNames(helper?.fullName);

    assert.equal(parsedDriver.length, 1);
    assert.equal(parsedHelper.length, 1);
  }
});