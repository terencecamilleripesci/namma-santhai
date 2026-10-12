#!/usr/bin/env python3
"""Guard against a bug that has now bitten three times.

Clicks are handled by ONE delegated listener whose closest() selector lists the
attributes it will respond to. Add a new data-* handler and forget the
selector, and the control renders, looks right, and silently does nothing.
That is how Report, Block, Favourites, the radius chips and the member
register all shipped dead.

This fails the build if a PRIMARY click attribute is handled but not matched.
"""
import re, sys

SRC = "js/app.js"
# Read from an element that was matched by a DIFFERENT attribute, or bound
# directly with addEventListener - not primary click targets.
EXEMPT = {
    "uid":        "read from the element matched by data-ustat",
    "rep":        "read from the element matched by data-rep-act",
    "report-lid": "read from the element matched by data-report-reason",
    "cid":        "read from #chat-send, bound directly",
    "rmphoto":    "bound directly in wirePost()",
    "setradius":  "bound directly in wireSettings()",
    "topic":      "bound directly in wireSettings()",
    "type":       "bound directly in wirePost()",
}

src = open(SRC).read()
m = re.search(r'e\.target\.closest\("([^"]+)"\)', src)
if not m:
    print("FAIL: could not find the delegated closest() selector")
    sys.exit(1)
selector = set(re.findall(r'\[data-([a-z-]+)\]', m.group(1)))
handled = set(re.findall(r'getAttribute\("data-([a-z-]+)"\)', src))
handled |= set(re.findall(r'hasAttribute\("data-([a-z-]+)"\)', src))

missing = sorted(a for a in handled - selector if a not in EXEMPT)
stale = sorted(a for a in EXEMPT if a in selector)

print("selector attributes : %d" % len(selector))
print("handled attributes  : %d" % len(handled))
if stale:
    print("note: now in the selector, exemption no longer needed: %s" % ", ".join(stale))
if missing:
    print("\nFAIL - handled but NOT in the delegated selector, so these do nothing:")
    for a in missing:
        print("   data-%s" % a)
    sys.exit(1)
print("OK - every primary click attribute is matched")
