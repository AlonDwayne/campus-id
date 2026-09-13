"""
Eligible students source.

Reads student records from a published Google Sheet (as CSV). The local
`eligible_students` Postgres table acts as a fallback and a cache, so
lookups still work when Google is unreachable.

Column parsing is tolerant: it accepts Google Forms defaults such as
`Add your Student number` and split names (`First Name` + `Middle names`
+ `Surnames`), and normalizes float-formatted numbers and campus
spellings.
"""

import csv
import io
import threading
import time

import requests

from .config import Config
from .constants import VALID_CAMPUSES


# ---------- header / value helpers ----------

def _norm_header(s):
    return "".join(ch for ch in str(s).lower() if ch.isalnum())


def _find_col(header, *aliases):
    wanted = {_norm_header(a) for a in aliases}
    for i, h in enumerate(header):
        if h in wanted:
            return i
    return None


def _find_col_contains(header, *fragments):
    frags = [_norm_header(f) for f in fragments]
    for i, h in enumerate(header):
        if all(f in h for f in frags):
            return i
    return None


def _clean_student_number(raw):
    s = str(raw).strip()
    if s.endswith(".0") and s[:-2].replace(".", "").isdigit():
        s = s[:-2]
    return s


CAMPUS_ALIASES = {
    "kwadlangenzwa":  "Kwadlangenzwa",
    "kwadlangezwa":   "Kwadlangenzwa",
    "kwa dlangezwa":  "Kwadlangenzwa",
    "kwa dlangenzwa": "Kwadlangenzwa",
    "richardsbay":    "Richards Bay",
    "richards bay":   "Richards Bay",
}


def _canonical_campus(raw):
    if not raw:
        return None
    key = " ".join(str(raw).split()).casefold()
    if key in CAMPUS_ALIASES:
        return CAMPUS_ALIASES[key]
    for c in VALID_CAMPUSES:
        if c.casefold() == key:
            return c
    return None


# ---------- cache ----------

_cache_lock = threading.Lock()
_cache = {
    "fetched_at": 0.0,
    "students": {},   # student_number -> { student_number, full_name, campus }
    "error": None,
}


def _is_cache_fresh():
    age = time.time() - _cache["fetched_at"]
    return age < Config.ELIGIBLE_SHEET_CACHE_SECONDS


def _fetch_sheet():
    """Fetch and parse the published Google Sheet CSV. Raises on failure."""
    resp = requests.get(Config.ELIGIBLE_SHEET_CSV_URL, timeout=15)
    resp.raise_for_status()

    reader = csv.reader(io.StringIO(resp.text))
    rows = list(reader)

    if not rows:
        return {}

    header = [_norm_header(c) for c in rows[0]]

    col_studno = _find_col(
        header,
        "student_number", "student number", "studentno", "studentnumber",
    )
    if col_studno is None:
        col_studno = _find_col_contains(header, "student", "number")

    col_name = _find_col(header, "full_name", "full name", "name")
    col_first = _find_col(header, "first name", "firstname", "first names", "given name")
    col_middle = _find_col(header, "middle names", "middlenames", "middle name", "middle")
    col_last = _find_col(header, "surnames", "surname", "last name", "lastname", "family name")

    col_campus = _find_col(header, "campus", "campus_name", "campusname")
    if col_campus is None:
        col_campus = _find_col_contains(header, "campus")

    if col_studno is None or col_campus is None:
        raise ValueError("Sheet is missing a student_number or campus column")
    if col_name is None and col_first is None and col_last is None:
        raise ValueError("Sheet is missing a name column")

    out = {}
    for row in rows[1:]:
        if not row:
            continue

        def cell(i):
            if i is None or i >= len(row) or row[i] is None:
                return ""
            return str(row[i]).strip()

        studno = _clean_student_number(cell(col_studno))
        campus = _canonical_campus(cell(col_campus))

        if col_name is not None:
            name = " ".join(cell(col_name).split())
        else:
            parts = [cell(c) for c in (col_first, col_middle, col_last) if c is not None]
            name = " ".join(" ".join(parts).split())

        if not studno or not name or not campus:
            continue

        out[studno] = {
            "student_number": studno,
            "full_name": name,
            "campus": campus,
        }

    return out


def refresh_cache(force=False):
    """Fetch and replace the in-memory cache. Safe to call from any thread."""
    if not Config.ELIGIBLE_SHEET_ENABLED or not Config.ELIGIBLE_SHEET_CSV_URL:
        return

    with _cache_lock:
        if not force and _is_cache_fresh():
            return
        try:
            students = _fetch_sheet()
            _cache["students"] = students
            _cache["fetched_at"] = time.time()
            _cache["error"] = None
        except Exception as e:
            _cache["error"] = str(e)


def get_sheet_student(student_number):
    """Return the student from the sheet, or None. Refreshes cache if stale."""
    if not Config.ELIGIBLE_SHEET_ENABLED or not Config.ELIGIBLE_SHEET_CSV_URL:
        return None

    key = str(student_number).strip()

    with _cache_lock:
        if not _is_cache_fresh():
            try:
                students = _fetch_sheet()
                _cache["students"] = students
                _cache["fetched_at"] = time.time()
                _cache["error"] = None
            except Exception as e:
                _cache["error"] = str(e)
                # Fall through and use the stale cache if it exists.

    return _cache["students"].get(key)


def cache_metadata():
    return {
        "enabled": Config.ELIGIBLE_SHEET_ENABLED,
        "url_configured": bool(Config.ELIGIBLE_SHEET_CSV_URL),
        "cached_students": len(_cache["students"]),
        "fetched_at": _cache["fetched_at"] or None,
        "last_error": _cache["error"],
    }


def cached_students():
    """Return a shallow copy of the current cache. Useful for syncing."""
    with _cache_lock:
        return dict(_cache["students"])