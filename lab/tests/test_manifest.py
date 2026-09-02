from datetime import UTC, datetime

from void_mind.manifest import ModelHashes, ModelManifest, ModelSource


def test_a0_manifest_validates() -> None:
    manifest = ModelManifest(
        name="VOID Mind",
        version="A0",
        base="example/instruct-model",
        source=ModelSource(uri="https://example.invalid/model", license="Apache-2.0"),
        quantization="Q4_K_M",
        languages=["pt-BR", "en"],
        context=8192,
        chat_template="llama3",
        hashes=ModelHashes(sha256="a" * 64),
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    assert manifest.created_by == "SCamposs"
    assert manifest.format == "GGUF"
