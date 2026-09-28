"""Trip checklist rules. No database, no network."""

from server import build_trip_checks


def _by_id(result):
    return {c["id"]: c for c in result["checks"]}


def _valid_parts():
    trip = {
        "origin_name": "Mumbai",
        "start_date": "2026-10-01",
        "end_date": "2026-10-04",
        "total_nights": 3,
        "children": [{"age": 7}],
    }
    stops = [
        {
            "id": "s1",
            "nights": 3,
            "accommodation_needed": True,
            "stays": [{"hotel_name": "Marina", "cancellation_policy": "Free cancel"}],
        }
    ]
    legs = [
        {
            "mode": "flight",
            "cost": 40000,
            "cancellation_policy": "Non-refundable",
            "to_stop_id": "s1",
        },
        {
            "mode": "flight",
            "cost": 40000,
            "cancellation_policy": "Non-refundable",
            "to_stop_id": "origin",
        },
    ]
    return trip, stops, legs


def test_complete_trip_passes():
    trip, stops, legs = _valid_parts()
    result = build_trip_checks(trip, stops, legs)

    assert result["valid"] is True
    assert all(c["pass"] for c in result["checks"])


def test_origin_and_dates_are_required():
    trip, stops, legs = _valid_parts()
    trip["origin_name"] = ""
    trip["end_date"] = None
    checks = _by_id(build_trip_checks(trip, stops, legs))

    assert checks["origin"]["pass"] is False
    assert checks["dates"]["pass"] is False


def test_null_nights_do_not_crash():
    trip, stops, legs = _valid_parts()
    stops[0]["nights"] = None

    result = build_trip_checks(trip, stops, legs)

    assert _by_id(result)["nights"]["pass"] is False


def test_nights_must_match_duration_and_be_positive():
    trip, stops, legs = _valid_parts()
    stops[0]["nights"] = 2
    short = _by_id(build_trip_checks(trip, stops, legs))
    assert short["nights"]["pass"] is False

    stops[0]["nights"] = 0
    trip["total_nights"] = 0
    zero = _by_id(build_trip_checks(trip, stops, legs))
    assert zero["nights"]["pass"] is False


def test_return_leg_must_point_at_origin():
    trip, stops, legs = _valid_parts()
    legs[1]["to_stop_id"] = "s1"
    checks = _by_id(build_trip_checks(trip, stops, legs))

    assert checks["return_leg"]["pass"] is False


def test_each_leg_needs_mode_cost_and_cancellation():
    trip, stops, legs = _valid_parts()
    legs[0]["mode"] = ""
    legs[0]["cost"] = None
    legs[1]["cancellation_policy"] = ""
    checks = _by_id(build_trip_checks(trip, stops, legs))

    assert checks["legs_complete"]["pass"] is False
    assert checks["legs_cancel"]["pass"] is False

    empty = _by_id(build_trip_checks(trip, stops, []))
    assert empty["legs_complete"]["pass"] is True
    assert empty["legs_cancel"]["pass"] is True
    assert empty["return_leg"]["pass"] is False


def test_accommodation_needs_a_stay_and_a_policy():
    trip, stops, legs = _valid_parts()
    stops[0]["stays"] = []
    missing = _by_id(build_trip_checks(trip, stops, legs))
    assert missing["stays"]["pass"] is False

    stops[0]["stays"] = [{"hotel_name": "Marina", "cancellation_policy": ""}]
    no_policy = _by_id(build_trip_checks(trip, stops, legs))
    assert no_policy["stays"]["pass"] is True
    assert no_policy["stays_cancel"]["pass"] is False

    stops[0]["accommodation_needed"] = False
    stops[0]["stays"] = []
    skipped = _by_id(build_trip_checks(trip, stops, legs))
    assert skipped["stays"]["pass"] is True
    assert skipped["stays_cancel"]["pass"] is True


def test_child_needs_age_or_dob_and_none_is_fine():
    trip, stops, legs = _valid_parts()
    trip["children"] = [{}]
    missing = _by_id(build_trip_checks(trip, stops, legs))
    assert missing["child_ages"]["pass"] is False

    trip["children"] = [{"dob": "2018-04-01"}]
    with_dob = _by_id(build_trip_checks(trip, stops, legs))
    assert with_dob["child_ages"]["pass"] is True

    trip["children"] = []
    result = build_trip_checks(trip, stops, legs)
    assert _by_id(result)["child_ages"]["pass"] is True
    assert result["valid"] is True
