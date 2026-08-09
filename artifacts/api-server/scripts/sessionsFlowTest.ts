/**
 * Integration test for the sessions booking/payment flow.
 *
 * Run: pnpm --filter @workspace/api-server run test:sessions
 * (builds with esbuild, requires the dev database and the API server running
 * on localhost:80 for the HTTP portion).
 *
 * Covers:
 *  1. Single-purchase booking: HTTP book → charged + paid invoice.
 *  2. Full capacity → second booking waitlisted.
 *  3. Cancellation → refund settles (refund_pending → refunded, single
 *     refund invoice) and the waitlisted single booking is promoted+charged.
 *  4. Race: cancelled-while-charge_pending + provider SUCCESS → charge is
 *     refunded, no entitlement.
 *  5. Race: cancelled-while-charge_pending + provider DECLINE → pending state
 *     cleared and the free seat is backfilled from the waitlist.
 *  6. Declined charge on an active booking → seat released, waitlist promoted.
 */
import { and, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  invoicesTable,
  liveSessionsTable,
  sessionBookingsTable,
  sessionPackagesTable,
  subscriptionsTable,
} from "@workspace/db";
import {
  finalizeBookingCharge,
  finalizePackageCharge,
  processBookingRefund,
} from "../src/lib/sessionPayments";
import app from "../src/app";

// Self-contained: the test boots its own server instance on an ephemeral
// port instead of relying on the dev workflow being up.
let API = "";
const EMAILS = ["sf-teach", "sf-a", "sf-b", "sf-c", "sf-d", "sf-e"].map(
  (p) => `${p}@flowtest.local`,
);

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`PASS ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}`, detail ?? "");
  }
}

async function register(email: string): Promise<string> {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: email.split("@")[0],
      email,
      password: "Test1234",
      pin: "1111",
    }),
  });
  if (!res.ok) throw new Error(`register ${email}: ${res.status}`);
  return res.headers.get("set-cookie")!.split(";")[0];
}

async function api(
  cookie: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}

async function bookingRow(id: number) {
  const [b] = await db
    .select()
    .from(sessionBookingsTable)
    .where(eq(sessionBookingsTable.id, id));
  return b;
}

async function bookingFor(userEmail: string, sessionId: number) {
  const [u] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, userEmail));
  const [b] = await db
    .select()
    .from(sessionBookingsTable)
    .where(
      and(
        eq(sessionBookingsTable.userId, u.id),
        eq(sessionBookingsTable.sessionId, sessionId),
      ),
    );
  return b;
}

async function invoicesFor(email: string) {
  const [u] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  return db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.userId, u.id));
}

async function cleanup() {
  const users = await db.select().from(usersTable);
  for (const u of users) {
    if (u.email.endsWith("@flowtest.local")) {
      await db.delete(usersTable).where(eq(usersTable.id, u.id));
    }
  }
  const sessions = await db.select().from(liveSessionsTable);
  for (const s of sessions) {
    if (s.title.startsWith("[flowtest]")) {
      await db.delete(liveSessionsTable).where(eq(liveSessionsTable.id, s.id));
    }
  }
}

async function main() {
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("could not determine test server port");
  }
  API = `http://127.0.0.1:${address.port}/api`;
  delete process.env.DEMO_PAYMENTS_DECLINE;
  await cleanup();
  const [teachCookie, aCookie, bCookie] = [
    await register(EMAILS[0]),
    await register(EMAILS[1]),
    await register(EMAILS[2]),
  ];
  for (const e of EMAILS.slice(3)) await register(e);
  await db
    .update(usersTable)
    .set({ role: "teacher" })
    .where(eq(usersTable.email, EMAILS[0]));

  const startsAt = new Date(Date.now() + 5 * 3600_000).toISOString();
  const mk = async (title: string) =>
    (
      await api(teachCookie, "POST", "/sessions", {
        title: `[flowtest] ${title}`,
        startsAt,
        capacity: 1,
        priceSar: 50,
        meetingLink: "https://zoom.us/j/flowtest",
      })
    ).json.id as number;

  // --- 1+2: book to capacity, waitlist the second single booking ---------
  const s1 = await mk("cap");
  const rA = await api(aCookie, "POST", `/sessions/${s1}/book`, {
    paymentMethod: "single",
  });
  check("A booked", rA.json?.status === "booked", rA);
  check("A charged", rA.json?.paymentState === "charged", rA);
  const invA1 = await invoicesFor(EMAILS[1]);
  check(
    "A paid invoice",
    invA1.filter((i) => i.status === "paid" && i.amountSar === 50).length === 1,
  );
  const rB = await api(bCookie, "POST", `/sessions/${s1}/book`, {
    paymentMethod: "single",
  });
  check("B waitlisted when full", rB.json?.status === "waitlisted", rB);
  check("B has no pending charge", rB.json?.paymentState === "none", rB);

  // --- 3: cancel A → refund settles, B promoted & charged -----------------
  const rCancel = await api(aCookie, "POST", `/sessions/${s1}/cancel-booking`);
  check("A cancel accepted", rCancel.status === 200, rCancel);
  const bA = await bookingFor(EMAILS[1], s1);
  check(
    "A refunded exactly once",
    bA.status === "cancelled" &&
      bA.paymentState === "refunded" &&
      !!bA.refundReference,
    bA,
  );
  const invA2 = await invoicesFor(EMAILS[1]);
  check(
    "single refund invoice",
    invA2.filter((i) => i.status === "refunded").length === 1,
  );
  const bB = await bookingFor(EMAILS[2], s1);
  check(
    "B promoted and charged",
    bB.status === "booked" && bB.paymentState === "charged",
    bB,
  );
  const invB = await invoicesFor(EMAILS[2]);
  check(
    "B paid invoice on promotion",
    invB.filter((i) => i.status === "paid").length === 1,
  );

  // --- 4: cancelled-while-pending, provider charge SUCCEEDS → refund ------
  const s2 = await mk("race-success");
  const [uC] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, EMAILS[3]));
  const [cRow] = await db
    .insert(sessionBookingsTable)
    .values({
      sessionId: s2,
      userId: uC.id,
      status: "cancelled", // user cancelled while the charge was in flight
      cancelledAt: new Date(),
      paymentMethod: "single",
      paymentState: "charge_pending",
    })
    .returning();
  const okC = await finalizeBookingCharge(cRow.id);
  const cAfter = await bookingRow(cRow.id);
  check("race-success: no entitlement", okC === false);
  check(
    "race-success: charge refunded",
    cAfter.status === "cancelled" && cAfter.paymentState === "refunded",
    cAfter,
  );
  const invC = await invoicesFor(EMAILS[3]);
  check(
    "race-success: paid + refunded ledger",
    invC.filter((i) => i.status === "paid").length === 1 &&
      invC.filter((i) => i.status === "refunded").length === 1,
    invC,
  );

  // --- 5: cancelled-while-pending, provider DECLINES → seat backfilled ----
  const s3 = await mk("race-decline");
  const [uD] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, EMAILS[4]));
  const [uE] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, EMAILS[5]));
  const [dRow] = await db
    .insert(sessionBookingsTable)
    .values({
      sessionId: s3,
      userId: uD.id,
      status: "cancelled",
      cancelledAt: new Date(),
      paymentMethod: "single",
      paymentState: "charge_pending",
    })
    .returning();
  const [eRow] = await db
    .insert(sessionBookingsTable)
    .values({
      sessionId: s3,
      userId: uE.id,
      status: "waitlisted",
      paymentMethod: "free",
      paymentState: "none",
    })
    .returning();
  process.env.DEMO_PAYMENTS_DECLINE = "1";
  const okD = await finalizeBookingCharge(dRow.id);
  delete process.env.DEMO_PAYMENTS_DECLINE;
  const dAfter = await bookingRow(dRow.id);
  const eAfter = await bookingRow(eRow.id);
  check("race-decline: not charged", okD === false);
  check(
    "race-decline: pending cleared, no refund state",
    dAfter.status === "cancelled" && dAfter.paymentState === "none",
    dAfter,
  );
  check(
    "race-decline: waitlist backfills the freed seat",
    eAfter.status === "booked",
    eAfter,
  );

  // --- 6: declined charge on an ACTIVE booking → release + promote --------
  const s4 = await mk("decline-active");
  const [fRow] = await db
    .insert(sessionBookingsTable)
    .values({
      sessionId: s4,
      userId: uC.id,
      status: "booked",
      paymentMethod: "single",
      paymentState: "charge_pending",
    })
    .returning();
  const [gRow] = await db
    .insert(sessionBookingsTable)
    .values({
      sessionId: s4,
      userId: uD.id,
      status: "waitlisted",
      paymentMethod: "free",
      paymentState: "none",
    })
    .returning();
  process.env.DEMO_PAYMENTS_DECLINE = "1";
  const okF = await finalizeBookingCharge(fRow.id);
  delete process.env.DEMO_PAYMENTS_DECLINE;
  const fAfter = await bookingRow(fRow.id);
  const gAfter = await bookingRow(gRow.id);
  check("decline-active: not charged", okF === false);
  check(
    "decline-active: seat released",
    fAfter.status === "cancelled" && fAfter.paymentState === "none",
    fAfter,
  );
  check("decline-active: waitlist promoted", gAfter.status === "booked", gAfter);

  // --- 7: concurrent cross-session cancellations must not lose a credit ---
  const s5 = await mk("credit-a");
  const s6 = await mk("credit-b");
  const hCookie = await register("sf-h@flowtest.local");
  await api(hCookie, "POST", "/sessions/packages", { credits: 2 });
  const rH1 = await api(hCookie, "POST", `/sessions/${s5}/book`, {
    paymentMethod: "package",
  });
  const rH2 = await api(hCookie, "POST", `/sessions/${s6}/book`, {
    paymentMethod: "package",
  });
  check(
    "package booked twice",
    rH1.json?.status === "booked" && rH2.json?.status === "booked",
    [rH1, rH2],
  );
  const [uH] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "sf-h@flowtest.local"));
  await Promise.all([
    api(hCookie, "POST", `/sessions/${s5}/cancel-booking`),
    api(hCookie, "POST", `/sessions/${s6}/cancel-booking`),
  ]);
  const [pkgH] = await db
    .select()
    .from(sessionPackagesTable)
    .where(eq(sessionPackagesTable.userId, uH.id));
  check(
    "concurrent cancellations restore both credits",
    pkgH.remainingCredits === 2,
    pkgH,
  );

  // --- 8: capacity increase promotes the waitlist ---------------------------
  const s7 = await mk("cap-raise");
  const iCookie = await register("sf-i@flowtest.local");
  const jCookie = await register("sf-j@flowtest.local");
  await api(iCookie, "POST", `/sessions/${s7}/book`, { paymentMethod: "single" });
  const rJ = await api(jCookie, "POST", `/sessions/${s7}/book`, {
    paymentMethod: "single",
  });
  check("J waitlisted before raise", rJ.json?.status === "waitlisted", rJ);
  await api(teachCookie, "PATCH", `/sessions/${s7}`, { capacity: 2 });
  const bJ = await bookingFor("sf-j@flowtest.local", s7);
  check(
    "capacity raise promotes and charges J",
    bJ.status === "booked" && bJ.paymentState === "charged",
    bJ,
  );

  // --- 9: expired subscription grants no entitlement ------------------------
  const kCookie = await register("sf-k@flowtest.local");
  const [uK] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "sf-k@flowtest.local"));
  await db.insert(subscriptionsTable).values({
    userId: uK.id,
    plan: "monthly",
    status: "trial",
    priceSar: 49,
    trialEndsAt: new Date(Date.now() - 86400_000), // expired yesterday
    currentPeriodEnd: new Date(Date.now() - 86400_000),
  });
  const s8 = (
    await api(teachCookie, "POST", "/sessions", {
      title: "[flowtest] sub-expired",
      startsAt,
      capacity: 5,
      priceSar: 50,
      includedInSubscription: true,
      meetingLink: "https://zoom.us/j/flowtest",
    })
  ).json.id as number;
  const rK = await api(kCookie, "POST", `/sessions/${s8}/book`, {});
  check(
    "expired subscription cannot book included session",
    rK.status !== 200 || rK.json?.paymentState === "charged",
    rK,
  );
  const bK = await bookingFor("sf-k@flowtest.local", s8).catch(() => null);
  check(
    "no subscription booking created for expired sub",
    !bK || bK.paymentMethod !== "subscription",
    bK,
  );

  // --- 10: concurrent settlement inserts exactly one paid invoice ----------
  const s9 = await mk("concurrent-settle");
  const lCookie = await register("sf-l@flowtest.local");
  const [uL] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "sf-l@flowtest.local"));
  const [lRow] = await db
    .insert(sessionBookingsTable)
    .values({
      sessionId: s9,
      userId: uL.id,
      status: "booked",
      paymentMethod: "single",
      paymentState: "charge_pending",
    })
    .returning();
  void lCookie;
  const results = await Promise.all([
    finalizeBookingCharge(lRow.id),
    finalizeBookingCharge(lRow.id),
    finalizeBookingCharge(lRow.id),
  ]);
  const lAfter = await bookingRow(lRow.id);
  const invL = await invoicesFor("sf-l@flowtest.local");
  check(
    "concurrent settle: booking charged once",
    lAfter.paymentState === "charged" && results.filter(Boolean).length >= 1,
    { lAfter, results },
  );
  check(
    "concurrent settle: exactly one paid invoice",
    invL.filter((i) => i.status === "paid").length === 1,
    invL,
  );

  // --- 11: concurrent refund settlement → exactly one refund invoice -------
  const s10 = await mk("concurrent-refund");
  const [mRow] = await db
    .insert(sessionBookingsTable)
    .values({
      sessionId: s10,
      userId: uL.id,
      status: "cancelled",
      cancelledAt: new Date(),
      paymentMethod: "single",
      paymentState: "refund_pending",
      paymentReference: "demo-concurrent-refund",
    })
    .returning();
  const refundResults = await Promise.all([
    processBookingRefund(mRow.id),
    processBookingRefund(mRow.id),
    processBookingRefund(mRow.id),
  ]);
  const mAfter = await bookingRow(mRow.id);
  const invM = await invoicesFor("sf-l@flowtest.local");
  check(
    "concurrent refund: booking refunded",
    mAfter.paymentState === "refunded" && refundResults.every(Boolean),
    { mAfter, refundResults },
  );
  check(
    "concurrent refund: exactly one refund invoice",
    invM.filter((i) => i.status === "refunded").length === 1,
    invM,
  );

  // --- 12: concurrent package settlement → exactly one paid invoice --------
  const nCookie = await register("sf-n@flowtest.local");
  void nCookie;
  const [uN] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "sf-n@flowtest.local"));
  const [pkgN] = await db
    .insert(sessionPackagesTable)
    .values({
      userId: uN.id,
      name: "[flowtest] pkg",
      totalCredits: 5,
      remainingCredits: 5,
      priceSar: 200,
      paymentState: "charge_pending",
    })
    .returning();
  const pkgResults = await Promise.all([
    finalizePackageCharge(pkgN.id),
    finalizePackageCharge(pkgN.id),
    finalizePackageCharge(pkgN.id),
  ]);
  const [pkgNAfter] = await db
    .select()
    .from(sessionPackagesTable)
    .where(eq(sessionPackagesTable.id, pkgN.id));
  const invN = await invoicesFor("sf-n@flowtest.local");
  check(
    "concurrent package: charged with reference",
    pkgNAfter.paymentState === "charged" &&
      !!pkgNAfter.paymentReference &&
      pkgResults.every(Boolean),
    { pkgNAfter, pkgResults },
  );
  check(
    "concurrent package: exactly one paid invoice",
    invN.filter((i) => i.status === "paid").length === 1,
    invN,
  );

  // --- 13: capacity decrease vs pending-charge settlement -------------------
  // A booked-but-charge_pending booking counts as active; a capacity edit
  // down to that count and the in-flight settlement must never leave active
  // bookings above capacity.
  const s11 = await mk("cap-vs-settle");
  const [pRow] = await db
    .insert(sessionBookingsTable)
    .values({
      sessionId: s11,
      userId: uL.id,
      status: "booked",
      paymentMethod: "single",
      paymentState: "charge_pending",
    })
    .returning();
  const [patchRes, settleRes] = await Promise.all([
    api(teachCookie, "PATCH", `/sessions/${s11}`, { capacity: 1 }),
    finalizeBookingCharge(pRow.id),
  ]);
  void patchRes;
  void settleRes;
  const [s11Row] = await db
    .select()
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.id, s11));
  const s11Active = (
    await db
      .select()
      .from(sessionBookingsTable)
      .where(eq(sessionBookingsTable.sessionId, s11))
  ).filter((b) => ["booked", "attended"].includes(b.status));
  check(
    "capacity-vs-settlement: active bookings never exceed capacity",
    s11Active.length <= s11Row.capacity,
    { capacity: s11Row.capacity, active: s11Active.length },
  );
  const pAfter = await bookingRow(pRow.id);
  check(
    "capacity-vs-settlement: booking either fully charged or released+refunded",
    (pAfter.status === "booked" && pAfter.paymentState === "charged") ||
      (pAfter.status === "cancelled" &&
        ["refund_pending", "refunded"].includes(pAfter.paymentState)),
    pAfter,
  );

  // --- 13b: admin cannot assign a session to a non-staff account -----------
  const adminCookie = await register("sf-admin@flowtest.local");
  await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.email, "sf-admin@flowtest.local"));
  const [uParent] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "sf-a@flowtest.local"));
  const rBadAssign = await api(adminCookie, "POST", "/sessions", {
    title: "[flowtest] bad-assign",
    startsAt,
    capacity: 3,
    priceSar: 0,
    meetingLink: "https://zoom.us/j/flowtest",
    teacherId: uParent.id,
  });
  check(
    "assigning session to non-staff account is rejected",
    rBadAssign.status === 400,
    rBadAssign,
  );
  const rBadSeries = await api(adminCookie, "POST", "/sessions/series", {
    title: "[flowtest] bad-series",
    teacherId: uParent.id,
  });
  check(
    "assigning series to non-staff account is rejected",
    rBadSeries.status === 400,
    rBadSeries,
  );
  const rGoodAssign = await api(adminCookie, "POST", "/sessions", {
    title: "[flowtest] good-assign",
    startsAt,
    capacity: 3,
    priceSar: 0,
    meetingLink: "https://zoom.us/j/flowtest",
    teacherId: (
      await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, EMAILS[0]))
    )[0].id,
  });
  check(
    "assigning session to a real teacher succeeds",
    rGoodAssign.status === 201,
    rGoodAssign,
  );

  // --- 14: concurrent credit refund vs package booking conserves credits ----
  const s12 = await mk("credit-race-a");
  const s13 = await mk("credit-race-b");
  const qCookie = await register("sf-q@flowtest.local");
  await api(qCookie, "POST", "/sessions/packages", { credits: 1 });
  const rQ1 = await api(qCookie, "POST", `/sessions/${s12}/book`, {
    paymentMethod: "package",
  });
  check("credit-race: first booking uses the credit", rQ1.json?.status === "booked", rQ1);
  // Concurrently: cancel the credit-holding booking (refunds the credit)
  // while booking another session with the package.
  const [cancelQ, bookQ] = await Promise.all([
    api(qCookie, "POST", `/sessions/${s12}/cancel-booking`),
    api(qCookie, "POST", `/sessions/${s13}/book`, { paymentMethod: "package" }),
  ]);
  void cancelQ;
  const [uQ] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "sf-q@flowtest.local"));
  const [pkgQ] = await db
    .select()
    .from(sessionPackagesTable)
    .where(eq(sessionPackagesTable.userId, uQ.id));
  const qActivePkgBookings = (
    await db
      .select()
      .from(sessionBookingsTable)
      .where(eq(sessionBookingsTable.userId, uQ.id))
  ).filter(
    (b) =>
      b.paymentMethod === "package" &&
      ["booked", "attended"].includes(b.status),
  );
  check(
    "credit-race: credits conserved (remaining + consumed = total)",
    pkgQ.remainingCredits + qActivePkgBookings.length === pkgQ.totalCredits,
    { pkgQ, active: qActivePkgBookings.length, bookQ: bookQ.json },
  );

  await cleanup();
  server.close();
  console.log(failures === 0 ? "ALL TESTS PASSED" : `${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
