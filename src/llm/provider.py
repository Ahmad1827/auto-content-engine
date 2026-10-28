"""Picks the best available LLM automatically.

Order: the user's own Claude Code install (runs on their Claude subscription,
no API key) -> Gemini API key from .env. Override with ACE_LLM=claude|gemini.
"""
import json
import os
import shutil
import subprocess
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

CLAUDE_TIMEOUT = 900


class LLMError(RuntimeError):
    pass


def _find_claude_binary():
    found = shutil.which("claude")
    if found:
        return found
    # GUI launches often have a trimmed PATH, so also check the standard install spots.
    for candidate in ("~/.local/bin/claude", "~/.claude/local/claude", "/usr/local/bin/claude"):
        path = os.path.expanduser(candidate)
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return None


def _claude_env():
    env = os.environ.copy()
    # Lets the app run even when it was itself started from a Claude Code terminal.
    env.pop("CLAUDECODE", None)
    return env


@lru_cache(maxsize=1)
def detect_claude_code():
    """Returns {"path", "plan"} when Claude Code is installed and logged in, else None."""
    binary = _find_claude_binary()
    if not binary:
        return None
    try:
        out = subprocess.run([binary, "auth", "status"], capture_output=True, text=True,
                             timeout=30, env=_claude_env())
        status = json.loads(out.stdout)
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        return None
    if not status.get("loggedIn"):
        return None
    return {"path": binary, "plan": status.get("subscriptionType") or status.get("authMethod")}


def active_provider():
    forced = os.getenv("ACE_LLM", "").lower()
    if forced in ("claude", "gemini"):
        return forced
    if detect_claude_code():
        return "claude"
    if os.getenv("GEMINI_API_KEY"):
        return "gemini"
    return None


def describe_provider():
    provider = active_provider()
    if provider == "claude":
        info = detect_claude_code() or {}
        return f"Claude Code ({info.get('plan', 'logged in')})"
    if provider == "gemini":
        return "Gemini API"
    return "No AI found - install Claude Code or set GEMINI_API_KEY"


def _run_claude(prompt, schema=None, system=None):
    info = detect_claude_code()
    if not info:
        raise LLMError("Claude Code is not installed or not logged in (run `claude` once to log in).")

    cmd = [info["path"], "-p", "--output-format", "json", "--tools", "", "--no-session-persistence"]
    model = os.getenv("ACE_CLAUDE_MODEL")
    if model:
        cmd += ["--model", model]
    if system:
        cmd += ["--append-system-prompt", system]
    if schema:
        cmd += ["--json-schema", json.dumps(schema)]

    # Prompt goes through stdin so long scripts never hit argv limits.
    proc = subprocess.run(cmd, input=prompt, capture_output=True, text=True,
                          timeout=CLAUDE_TIMEOUT, env=_claude_env())
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        raise LLMError(f"Claude Code failed: {(proc.stderr or proc.stdout)[-500:]}")
    if payload.get("is_error"):
        raise LLMError(f"Claude Code error: {payload.get('result') or payload.get('subtype')}")

    if schema:
        if payload.get("structured_output") is not None:
            return payload["structured_output"]
        return _parse_json(payload.get("result", ""))
    return payload.get("result", "")


def _run_gemini(prompt, schema=None, system=None):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise LLMError("GEMINI_API_KEY not found in .env")
    from google import genai

    client = genai.Client(api_key=api_key)
    full_prompt = f"{system}\n\n{prompt}" if system else prompt
    config = None
    if schema:
        full_prompt += f"\n\nReturn ONLY JSON matching this JSON Schema:\n{json.dumps(schema)}"
        config = {"response_mime_type": "application/json"}
    response = client.models.generate_content(
        model=os.getenv("ACE_GEMINI_MODEL", "gemini-2.5-flash"), contents=full_prompt, config=config)
    return _parse_json(response.text) if schema else response.text


def _parse_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise LLMError(f"AI returned invalid JSON: {e}")


def generate(prompt, schema=None, system=None):
    """Text (or a dict when `schema` is given) from whichever AI is available."""
    provider = active_provider()
    if provider == "claude":
        return _run_claude(prompt, schema, system)
    if provider == "gemini":
        return _run_gemini(prompt, schema, system)
    raise LLMError(describe_provider())
