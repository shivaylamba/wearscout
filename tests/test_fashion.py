import base64
import copy

import pytest

from jev_ultrafast import fashion, wardrobe


def garment():
    return dict(
        is_clothing=True,
        category="dress",
        description="A blue floral dress",
        color="blue",
        pattern="floral",
        silhouette="flared",
        search_query="blue floral dress",
        details=[],
        uncertainty=[],
    )


def test_rejects_nonimage_and_oversized_uploads():
    for image in [
        "https://example.com/image.jpg",
        "data:image/jpeg;base64," + base64.b64encode(b"not an image").decode(),
        "a" * 8_000_001,
    ]:
        with pytest.raises(ValueError):
            fashion.validate_image(image)


def test_vision_requires_valid_fields_and_clothing():
    assert fashion.validate_description(garment())["category"] == "dress"
    for edits in [
        dict(is_clothing=False),
        dict(search_query="https://evil.test"),
        dict(details=[123]),
        dict(color=None),
    ]:
        with pytest.raises(ValueError):
            fashion.validate_description({**garment(), **edits})


def test_shopping_actions_cannot_buy_or_enter_credentials():
    for label in ["Add to bag", "Buy now", "Checkout", "Sign in", "Contact seller"]:
        assert not fashion.safe_action(dict(kind="click", label=label))
    assert not fashion.safe_action(dict(kind="fill", label="Email address"))
    assert fashion.safe_action(dict(kind="fill", label="Search products"))
    assert fashion.safe_action(dict(kind="scroll", label="Scroll down"))


def test_relevance_never_synthesizes_products(monkeypatch):
    records = [
        dict(url="https://shop.example/product/1", title="Blue floral dress"),
        dict(url="https://shop.example/product/2", title="Red shoes"),
    ]

    def answer(choice):
        return dict(
            choice=choice,
            confidence=0.9,
            probabilities={x: 0.9 if x == choice else 0.05 for x in ["strong", "possible", "unrelated"]},
        )

    def provider(url, key, body):
        assert len(body["questions"]) == 2
        return dict(answers={"0": answer("strong"), "1": answer("unrelated")}, model="jev", usage={})

    monkeypatch.setenv("TYPESAFE_API_KEY", "test")
    monkeypatch.setattr(fashion, "post_json", provider)
    ranked, _ = fashion.rank(garment(), records)
    assert [x["url"] for x in ranked] == [records[0]["url"]]
    assert "price" not in ranked[0]


def test_cancel_during_prediction_executes_no_action(monkeypatch):
    saved = copy.deepcopy(wardrobe.STATE)
    wardrobe.STOP.clear()
    calls = []

    class FakeAgent:
        def __init__(self, *args, **kwargs):
            self.state = {"page": dict(url="https://shop.example", title="", text="", actions=[], fingerprint="a")}
            self.browser = object()

        def command(self, name, *args):
            calls.append(name)
            if name == "predict":
                wardrobe.STOP.set()
                self.state["decision"] = dict(choice="click")

        def close(self):
            calls.append("close")

    monkeypatch.setattr(wardrobe, "Agent", FakeAgent)
    monkeypatch.setattr(wardrobe, "collect", lambda *a: [])
    wardrobe.STATE["sources"] = {"amazon": {}}
    try:
        wardrobe.search_worker(garment(), "blue floral dress", ["amazon"])
        assert calls == ["predict", "close"]
        assert wardrobe.STATE["status"] == "stopped"
    finally:
        wardrobe.STATE.clear()
        wardrobe.STATE.update(saved)
        wardrobe.STOP.clear()


def test_homepage_cards_do_not_count_as_submitted_search():
    from types import SimpleNamespace

    initial = "https://shop.example/"
    agent = SimpleNamespace(state={"page": {"url": initial}, "history": []})
    assert not wardrobe.search_applied(agent, initial)
    agent.state["history"] = [{"kind": "fill"}]
    agent.state["page"]["url"] = "https://shop.example/search?q=dress"
    assert not wardrobe.search_applied(agent, initial)
    agent.state["history"].append({"kind": "click"})
    assert wardrobe.search_applied(agent, initial)


def test_amazon_tracking_links_are_one_product():
    from types import SimpleNamespace

    rows = [
        dict(url="https://www.amazon.in/a/dp/B0H12ZRJRW/ref=sr_1?x=1", title="Brand"),
        dict(url="https://www.amazon.in/a/dp/B0H12ZRJRW/ref=sr_1?x=2", title="Blue floral dress"),
    ]
    browser = SimpleNamespace(evaluate=lambda _: rows)
    collected = fashion.collect(browser, "amazon")
    assert len(collected) == 1
    assert collected[0]["title"] == "Blue floral dress"


def test_enter_is_typed_as_its_own_target_head():
    from jev_ultrafast.model import action_space

    _, targets, _ = action_space(
        [
            dict(
                id="submit_1",
                node=1,
                kind="press",
                label="Submit search with Enter: Search products",
                value="blue dress",
            )
        ]
    )
    assert targets["PRESS_ENTER"]["1"]["id"] == "submit_1"
