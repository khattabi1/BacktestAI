"""
Scaffolding verification tests for packages/agent.
"""

def test_package_scaffolding():
    from packages.agent.src import core, adapters, tools, sandbox, storage
    assert core is not None
    assert adapters is not None
    assert tools is not None
    assert sandbox is not None
    assert storage is not None
