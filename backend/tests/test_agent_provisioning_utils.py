from __future__ import annotations

from dataclasses import dataclass

from app.services import agent_provisioning


def test_slugify_normalizes_and_trims():
    assert agent_provisioning._slugify("Hello, World") == "hello-world"
    assert agent_provisioning._slugify("  A   B  ") == "a-b"


def test_slugify_falls_back_to_uuid_hex(monkeypatch):
    class _FakeUuid:
        hex = "deadbeef"

    monkeypatch.setattr(agent_provisioning, "uuid4", lambda: _FakeUuid())
    assert agent_provisioning._slugify("!!!") == "deadbeef"


def test_agent_id_from_session_key_parses_agent_prefix():
    assert agent_provisioning._agent_id_from_session_key(None) is None
    assert agent_provisioning._agent_id_from_session_key("") is None
    assert agent_provisioning._agent_id_from_session_key("not-agent") is None
    assert agent_provisioning._agent_id_from_session_key("agent:") is None
    assert agent_provisioning._agent_id_from_session_key("agent:riya:main") == "riya"


def test_extract_agent_id_supports_lists_and_dicts():
    assert agent_provisioning._extract_agent_id(["", "  ", "abc"]) == "abc"
    assert agent_provisioning._extract_agent_id([{"agent_id": "xyz"}]) == "xyz"

    payload = {
        "defaultAgentId": "dflt",
        "agents": [{"id": "ignored"}],
    }
    assert agent_provisioning._extract_agent_id(payload) == "dflt"

    payload2 = {
        "agents": [{"id": ""}, {"agentId": "foo"}],
    }
    assert agent_provisioning._extract_agent_id(payload2) == "foo"


def test_extract_agent_id_returns_none_for_unknown_shapes():
    assert agent_provisioning._extract_agent_id("nope") is None
    assert agent_provisioning._extract_agent_id({"agents": "not-a-list"}) is None


@dataclass
class _AgentStub:
    name: str
    openclaw_session_id: str | None = None
    heartbeat_config: dict | None = None
    is_board_lead: bool = False


def test_agent_key_uses_session_key_when_present(monkeypatch):
    agent = _AgentStub(name="Alice", openclaw_session_id="agent:alice:main")
    assert agent_provisioning._agent_key(agent) == "alice"

    monkeypatch.setattr(agent_provisioning, "_slugify", lambda value: "slugged")
    agent2 = _AgentStub(name="Alice", openclaw_session_id=None)
    assert agent_provisioning._agent_key(agent2) == "slugged"
