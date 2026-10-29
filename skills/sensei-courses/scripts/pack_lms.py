#!/usr/bin/env python3
"""Package a single-file course (index.html) as SCORM 1.2, SCORM 2004 4th Edition or cmi5. Python standard library.

    python pack_lms.py index.html --format scorm12|scorm2004|cmi5 --title "My course" --id my-course -o out.zip
    python -I pack_lms.py --selftest

The manifest (imsmanifest.xml or cmi5.xml) goes at the zip ROOT, next to the page: a zip with a folder on top is the
most common import failure. The self-test builds all three from a dummy page and validates them: well-formed XML,
manifest at the root, identifiers unique, every referenced file present, the right schemaversion.

verified: Windows 10, Python 3 (--selftest, all three formats PASS; test-lms.mjs runs it too).
not verified: import into any real LMS (SCORM Cloud, Moodle, Canvas, Blackboard). Import there before shipping.
Origin: code-apps/course/pack_lms.py in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code).
"""
import argparse, sys, zipfile, tempfile, os
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

def m12(cid, title, href, files):
    fl = "".join('<file href="%s"/>' % escape(f) for f in files)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="{escape(cid)}" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1"><title>{escape(title)}</title>
      <item identifier="ITEM-1" identifierref="RES-1"><title>{escape(title)}</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="{escape(href)}">{fl}</resource>
  </resources>
</manifest>
'''

def m2004(cid, title, href, files):
    fl = "".join('<file href="%s"/>' % escape(f) for f in files)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="{escape(cid)}" version="1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1" structure="hierarchical"><title>{escape(title)}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true"><title>{escape(title)}</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormType="sco" href="{escape(href)}">{fl}</resource>
  </resources>
</manifest>
'''

def cmi5(cid, title, href, files, mastery=0.7):
    base = "urn:sensei:course:" + cid
    t = escape(title)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="{base}"><title><langstring lang="en">{t}</langstring></title><description><langstring lang="en">{t}</langstring></description></course>
  <au id="{base}:au1" moveOn="CompletedAndPassed" masteryScore="{mastery}" launchMethod="AnyWindow">
    <title><langstring lang="en">{t}</langstring></title><description><langstring lang="en">{t}</langstring></description>
    <url>{escape(href)}</url>
  </au>
</courseStructure>
'''

def pack(src, fmt, title, cid, out, extra=()):
    href = os.path.basename(src)
    files = [href] + list(extra)
    man = {"scorm12": m12, "scorm2004": m2004, "cmi5": cmi5}[fmt](cid, title, href, files)
    name = "cmi5.xml" if fmt == "cmi5" else "imsmanifest.xml"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(name, man)            # manifest at the ROOT: the most common import failure is a zip with a folder on top
        z.write(src, href)
        for e in extra: z.write(os.path.join(os.path.dirname(src), e), e)
    return out

def validate(zpath, fmt):
    errs = []
    with zipfile.ZipFile(zpath) as z:
        names = z.namelist()
        mname = "cmi5.xml" if fmt == "cmi5" else "imsmanifest.xml"
        if mname not in names: return ["%s not at zip root (%s)" % (mname, names[:3])]
        root = ET.fromstring(z.read(mname))          # raises if not well-formed
        ids = [e.get("identifier") or e.get("id") for e in root.iter() if (e.get("identifier") or e.get("id"))]
        if len(ids) != len(set(ids)): errs.append("duplicate identifiers")
        if fmt == "cmi5":
            url = [e.text for e in root.iter() if e.tag.endswith("}url")][0]
            if url not in names: errs.append("au url missing: " + url)
        else:
            for e in root.iter():
                if e.tag.endswith("}file") or (e.tag.endswith("}resource") and e.get("href")):
                    h = e.get("href")
                    if h not in names: errs.append("missing file " + h)
            ver = [e.text for e in root.iter() if e.tag.endswith("}schemaversion")][0]
            if ver != {"scorm12": "1.2", "scorm2004": "2004 4th Edition"}[fmt]: errs.append("schemaversion " + ver)
    return errs

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?"); ap.add_argument("--format", choices=["scorm12", "scorm2004", "cmi5"])
    ap.add_argument("--title", default="Course"); ap.add_argument("--id", default="course"); ap.add_argument("-o")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        d = tempfile.mkdtemp(); p = os.path.join(d, "index.html"); open(p, "w", encoding="utf-8").write("<!doctype html><title>x</title>")
        bad = 0
        for f in ("scorm12", "scorm2004", "cmi5"):
            o = os.path.join(d, f + ".zip"); pack(p, f, "Self & Test <course>", "selftest", o); e = validate(o, f)
            print("PASS" if not e else "FAIL", f, e or "ok"); bad += bool(e)
        sys.exit(1 if bad else 0)
    if not (a.src and a.format and a.o): ap.error("src, --format and -o are required")
    print(pack(a.src, a.format, a.title, a.id, a.o))
