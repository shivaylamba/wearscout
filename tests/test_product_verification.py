from types import SimpleNamespace

from jev_ultrafast import fashion

URL = "https://www.amazon.in/dp/B0H12ZRJRW"
RECORD = dict(url=URL, title="Blue floral V neck dress", price="₹500", image=None)


def test_rejects_redirect_but_enriches_changed_title_for_reranking():
    result = fashion.verify_record(RECORD, dict(url="https://www.amazon.in/", title=RECORD["title"]))
    assert result["verification"]["status"] == "mismatch"
    result = fashion.verify_record(RECORD, dict(url=URL, title="Red leather boots"))
    assert result["verification"]["status"] == "title_changed"
    assert result["title"] == "Red leather boots"
    assert result["card_title"] == RECORD["title"]


def test_block_is_not_verification():
    result = fashion.verify_record(RECORD, dict(url=URL, blocked=True, title=RECORD["title"]))
    assert result["verification"]["status"] == "blocked"
    assert result["price"] == "₹500"


def test_page_price_has_separate_provenance():
    result = fashion.verify_record(RECORD, dict(url=URL, title=RECORD["title"], price="₹550"))
    assert result["verification"]["status"] == "page_checked"
    assert result["card_price"] == "₹500"
    assert result["price"] == result["page_price"] == "₹550"


def test_duplicates_preserve_image_but_not_conflicting_price():
    rows = [
        dict(RECORD, image="https://example.com/dress.jpg"),
        dict(RECORD, title="Beautiful Blue floral V neck dress", price="₹600"),
    ]
    result = fashion.collect(SimpleNamespace(evaluate=lambda _: rows), "amazon")[0]
    assert result["image"] == rows[0]["image"]
    assert result["price"] is None
    assert result["price_conflict"]


def test_supported_host_and_identity_required():
    assert not fashion.product_identity("https://amazon.in.evil.test/dp/B0H12ZRJRW")
    assert not fashion.product_identity("https://www.amazon.in/s?k=dress")
    assert fashion.product_identity("https://www.myntra.com/dress/12345/buy?x=1") == ("myntra.com", "12345")


def test_stop_prevents_verification_navigation():
    assert fashion.verify_products(object(), [RECORD], lambda: True, lambda _: None) == []


def test_navigation_exception_is_not_retried():
    calls = []

    def call(*args, **kwargs):
        calls.append((args, kwargs))
        raise RuntimeError("Disconnected")

    result = fashion.verify_products(SimpleNamespace(call=call), [RECORD], lambda: False, lambda _: None)
    assert len(calls) == 1
    assert calls[0][1]["retry"] is False
    assert result[0]["verification"]["status"] == "unverified"
