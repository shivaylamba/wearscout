"""Jev chooses an observed action. Code owns execution."""

__all__ = ["Agent", "Browser"]


def __getattr__(name):
    # Let entrypoints configure browser IPC before the harness reads its environment.
    if name == "Agent":
        from .agent import Agent
        return Agent
    if name == "Browser":
        from .browser import Browser
        return Browser
    raise AttributeError(name)
