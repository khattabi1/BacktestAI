"""
Unit tests for packages/agent/src/core/parser.py
Verifies StreamThoughtParser handling of streaming tokens, boundary splits, and tag isolation.
"""

from packages.agent.src.core.parser import StreamThoughtParser


def test_parser_pure_content():
    parser = StreamThoughtParser()
    chunks = ["Hello ", "world, ", "let's build an EA."]
    results = []
    for c in chunks:
        results.extend(list(parser.feed(c)))
    results.extend(list(parser.finalize()))

    assert parser.has_thought is False
    assert parser.full_thought == ""
    assert parser.full_content == "Hello world, let's build an EA."
    assert all(kind == "content" for kind, _ in results)


def test_parser_with_complete_thought():
    parser = StreamThoughtParser()
    chunks = [
        "<think>",
        "We need to evaluate RSI(14) overbought conditions.",
        "</think>",
        "Here is the strategy plan.",
    ]
    results = []
    for c in chunks:
        results.extend(list(parser.feed(c)))
    results.extend(list(parser.finalize()))

    assert parser.has_thought is True
    assert parser.full_thought == "We need to evaluate RSI(14) overbought conditions."
    assert parser.full_content == "Here is the strategy plan."


def test_parser_boundary_split_tags():
    parser = StreamThoughtParser()
    # Tag split across multiple chunks
    chunks = [
        "Prefix ",
        "<th",
        "ink>The market is trending",
        " strongly.</",
        "think> Final message.",
    ]
    results = []
    for c in chunks:
        results.extend(list(parser.feed(c)))
    results.extend(list(parser.finalize()))

    assert parser.has_thought is True
    assert parser.full_thought == "The market is trending strongly."
    assert parser.full_content == "Prefix  Final message."


def test_parser_unclosed_thought_finalization():
    parser = StreamThoughtParser()
    chunks = [
        "<think>Still thinking about stop loss levels",
    ]
    results = []
    for c in chunks:
        results.extend(list(parser.feed(c)))
    results.extend(list(parser.finalize()))

    assert parser.has_thought is True
    assert parser.full_thought == "Still thinking about stop loss levels"
    assert ("thought_end", "") in results

