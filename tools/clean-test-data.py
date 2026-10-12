#!/usr/bin/env python3
"""Remove accounts and listings left behind by the automated test suites.

The suites create real accounts through the real API - that is the point, it
is what makes them trustworthy - but several do not delete everything they
make. Left alone they accumulate in the member register and the client sees
fake people. Run this after a regression.

It is deliberately CONSERVATIVE: it only removes accounts that match a known
test fixture name AND have no real activity signal, and it never touches an
admin. Anything it is unsure about, it leaves and prints.
"""
import sqlite3, sys, os

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                  "server", "data", "namma.db")

FIXTURE_NAMES = {
    "Persist Check", "RL Probe", "Privacy Probe", "Consenting Seller",
    "To Be Deleted", "Goat Seller", "Interested Buyer", "Watcher", "Car Person",
    "Seller", "Buyer", "Bad Seller", "Reporter", "Image QA", "Thumb QA",
    "Design QA", "Brand QA", "Cat QA", "Nav Test", "Upload Check", "Strip QA",
    "Safety QA", "Fav QA", "Link QA", "Consent QA", "Register Test",
    "Plain User", "Notif Tester", "Real Tester", "Push Tester", "Ramesh Kumar",
    "Admin",
}
# Reserved ranges for automated tests. A fixture does not always set a name
# (a deletion test re-signs-in and leaves a nameless row), so the NUMBER has to
# be identifiable too. Test suites must use these prefixes.
FIXTURE_PREFIXES = ("98700", "98800", "98701", "98711")

FIXTURE_TITLES = {
    "Instant Live Goat", "Alert Test Goat", "Delete Me Goat", "EXIF Test Goat",
    "Disguised File", "Scam Goat", "Persist Goat", "huge", "Notify Me Goat",
    "My Ad For Msg", "Android Camera Goat", "E2E Jamunapari Goat",
    "Company Test Goat", "Plain Link Goat", "Genuine Listing Test",
    "Android Upload Goat", "Test Jamunapari",
}

def main():
    dry = "--apply" not in sys.argv
    con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
    victims = []
    for u in con.execute("SELECT * FROM users"):
        if u["role"] == "admin":
            continue                                  # never touch a moderator
        name = (u["name"] or "").strip()
        reserved = u["phone"].startswith(FIXTURE_PREFIXES)
        if name not in FIXTURE_NAMES and not reserved:
            continue
        real = con.execute(
            "SELECT COUNT(*) FROM listings WHERE owner_id=? AND status IN ('active','sold')",
            (u["id"],)).fetchone()[0]
        if real:
            print("SKIP %s (%s) - has %d real listing(s)" % (u["phone"], name, real))
            continue
        victims.append((u["id"], u["phone"], name or "(no name)"))

    titles = [r["id"] for r in con.execute(
        "SELECT id FROM listings WHERE title IN (%s)" % ",".join("?" * len(FIXTURE_TITLES)),
        tuple(FIXTURE_TITLES))]

    print("\n%d fixture account(s), %d fixture listing(s)" % (len(victims), len(titles)))
    for _, ph, nm in victims:
        print("   %s  %s" % (ph, nm))
    if dry:
        print("\nDRY RUN - re-run with --apply to delete")
        return

    for lid in titles:
        con.execute("DELETE FROM likes WHERE listing_id=?", (lid,))
        con.execute("DELETE FROM comments WHERE listing_id=?", (lid,))
        for tbl, col in (("media", "listing_id"), ("notifications", "listing_id")):
            con.execute("DELETE FROM %s WHERE %s=?" % (tbl, col), (lid,))
        con.execute("DELETE FROM messages WHERE conv_id IN "
                    "(SELECT id FROM conversations WHERE listing_id=?)", (lid,))
        con.execute("DELETE FROM conversations WHERE listing_id=?", (lid,))
        con.execute("DELETE FROM reports WHERE listing_id=?", (lid,))
        con.execute("DELETE FROM listings WHERE id=?", (lid,))
    for uid, _, _ in victims:
        # likes and comments a fixture left on a REAL seller's ad
        con.execute("DELETE FROM likes WHERE user_id=?", (uid,))
        con.execute("DELETE FROM comments WHERE user_id=?", (uid,))
        for tbl in ("push_subs", "notifications", "sessions"):
            con.execute("DELETE FROM %s WHERE user_id=?" % tbl, (uid,))
        con.execute("DELETE FROM messages WHERE sender_id=?", (uid,))
        con.execute("DELETE FROM conversations WHERE buyer_id=? OR seller_id=?", (uid, uid))
        con.execute("DELETE FROM media WHERE owner_id=?", (uid,))
        con.execute("DELETE FROM listings WHERE owner_id=?", (uid,))
        con.execute("DELETE FROM reports WHERE reporter_id=? OR reported_user_id=?", (uid, uid))
        con.execute("DELETE FROM blocks WHERE blocker_id=? OR blocked_id=?", (uid, uid))
        con.execute("DELETE FROM users WHERE id=?", (uid,))
    # Rows whose owner no longer exists. A like from a deleted account still
    # counted on a real seller's ad, which inflates their numbers with ghosts.
    orphan_l = con.execute("DELETE FROM likes WHERE user_id NOT IN (SELECT id FROM users)").rowcount
    orphan_c = con.execute("DELETE FROM comments WHERE user_id NOT IN (SELECT id FROM users)").rowcount
    if orphan_l or orphan_c:
        print("removed %d orphan like(s), %d orphan comment(s)" % (orphan_l, orphan_c))
    con.commit()
    print("\nremaining accounts:")
    for r in con.execute("SELECT phone,name,role FROM users ORDER BY id"):
        print("   %s  %s  %s" % (r[0], r[1] or "-", r[2]))

main()
