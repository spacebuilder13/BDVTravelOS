"""Quote money math. No database, no network."""

from server import QuoteItemCreate, compute_quote_totals


def item(**kwargs):
    return QuoteItemCreate(**kwargs)


def test_multi_currency_percentage_markup_and_gst():
    # 3 nights × 500 USD × 84.5, plus 2 × 35,000 INR.
    result = compute_quote_totals(
        [
            item(
                category="Hotels",
                title="Hotel",
                qty=3,
                unit_price=500,
                currency="USD",
                roe_to_base=84.5,
            ),
            item(
                category="Flights",
                title="Flights",
                qty=2,
                unit_price=35000,
                currency="INR",
                roe_to_base=1,
            ),
        ],
        markup_type="percentage",
        markup_value=10,
        gst_rate=5,
        tcs_enabled=False,
        tcs_rate=5,
    )

    assert result["items"][0]["amount"] == 1500
    assert result["items"][0]["amount_base"] == 126750
    assert result["items"][1]["amount_base"] == 70000
    assert result["operating_cost"] == 196750
    assert result["markup_amount"] == 19675
    assert result["subtotal"] == 216425
    assert result["gst_amount"] == 10821.25
    assert result["tcs_amount"] == 0
    assert result["grand_total_base"] == 227246.25


def test_flat_markup_skips_percentage():
    result = compute_quote_totals(
        [item(qty=1, unit_price=1000, roe_to_base=1)],
        markup_type="fixed",
        markup_value=150,
    )

    assert result["operating_cost"] == 1000
    assert result["markup_amount"] == 150
    assert result["subtotal"] == 1150
    assert result["gst_amount"] == 0
    assert result["tcs_amount"] == 0
    assert result["grand_total_base"] == 1150


def test_tcs_applies_only_when_enabled():
    items = [item(qty=1, unit_price=1000, roe_to_base=1)]

    off = compute_quote_totals(items, gst_rate=18, tcs_rate=5, tcs_enabled=False)
    on = compute_quote_totals(items, gst_rate=18, tcs_rate=5, tcs_enabled=True)

    assert off["gst_amount"] == 180
    assert off["tcs_amount"] == 0
    assert off["grand_total_base"] == 1180

    assert on["gst_amount"] == 180
    assert on["tcs_amount"] == 59
    assert on["grand_total_base"] == 1239


def test_empty_items_are_zero():
    result = compute_quote_totals(
        [], markup_value=10, gst_rate=5, tcs_enabled=True, tcs_rate=5
    )

    assert result["items"] == []
    assert result["operating_cost"] == 0
    assert result["markup_amount"] == 0
    assert result["subtotal"] == 0
    assert result["gst_amount"] == 0
    assert result["tcs_amount"] == 0
    assert result["grand_total_base"] == 0


def test_line_amounts_round_before_roe():
    # 3 × 10.333 = 30.999 → 31.00, then × 2.
    result = compute_quote_totals(
        [item(qty=3, unit_price=10.333, roe_to_base=2)],
    )

    assert result["items"][0]["amount"] == 31.0
    assert result["items"][0]["amount_base"] == 62.0
    assert result["operating_cost"] == 62.0
    assert result["grand_total_base"] == 62.0


def test_zero_qty_stays_zero():
    result = compute_quote_totals(
        [item(qty=0, unit_price=500, roe_to_base=2)],
    )

    assert result["items"][0]["amount"] == 0
    assert result["items"][0]["amount_base"] == 0
    assert result["operating_cost"] == 0
    assert result["grand_total_base"] == 0


def test_existing_item_id_is_kept():
    result = compute_quote_totals([item(id="line-1", qty=1, unit_price=10)])

    assert result["items"][0]["id"] == "line-1"
    assert result["items"][0]["amount"] == 10
