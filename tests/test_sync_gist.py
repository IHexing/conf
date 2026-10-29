import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("sync_gist", ROOT / "scripts" / "sync_gist.py")
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)


class RuleMaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.apple = root / "apple-rules"
        self.windows = root / "windows-rules"
        self.apple.mkdir()
        self.windows.mkdir()
        self.script = root / "Script.js"
        self.script.write_text("unchanged local client", encoding="utf-8")
        for name, value in (
            ("APPLE_RULES_DIR", self.apple),
            ("WINDOWS_RULES_DIR", self.windows),
            ("SCRIPT_JS_PATH", self.script),
        ):
            patcher = patch.object(sync, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        (self.apple / "custom.list").write_text(
            "# personal proxy\nDOMAIN-SUFFIX,example.com\nDOMAIN,api.example.net\n"
            "DOMAIN-SUFFIX,example.com\n", encoding="utf-8"
        )
        (self.apple / "direct-custom.list").write_text(
            "# personal direct\nIP-CIDR,10.0.0.0/8,no-resolve\n", encoding="utf-8"
        )

    def test_conversion_preserves_rule_meaning_and_removes_exact_duplicates(self):
        self.assertEqual(
            sync.sync_apple_rules_to_windows(), ["custom.yaml", "direct-custom.yaml"]
        )
        self.assertEqual(
            sync.read_rules((self.windows / "custom.yaml").read_text("utf-8"), yaml=True),
            ["DOMAIN-SUFFIX,example.com", "DOMAIN,api.example.net"],
        )
        self.assertEqual(
            sync.read_rules((self.windows / "direct-custom.yaml").read_text("utf-8"), yaml=True),
            ["IP-CIDR,10.0.0.0/8,no-resolve"],
        )
        self.assertEqual(sync.sync_apple_rules_to_windows(), [])

    def test_intentionally_empty_personal_rules_are_valid(self):
        (self.apple / "custom.list").write_text("# no proxy overrides\n", encoding="utf-8")
        sync.sync_apple_rules_to_windows()
        text = (self.windows / "custom.yaml").read_text("utf-8")
        self.assertTrue(text.startswith("payload: []\n"))
        self.assertEqual(sync.read_rules(text, yaml=True), [])

    def test_invalid_second_source_does_not_partially_update_first_output(self):
        destination = self.windows / "custom.yaml"
        destination.write_text("previous output", encoding="utf-8")
        (self.apple / "direct-custom.list").write_text("invalid rule\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            sync.sync_apple_rules_to_windows()
        self.assertEqual(destination.read_text("utf-8"), "previous output")

    def test_missing_second_source_does_not_create_partial_output(self):
        (self.apple / "direct-custom.list").unlink()
        with self.assertRaises(FileNotFoundError):
            sync.sync_apple_rules_to_windows()
        self.assertFalse((self.windows / "custom.yaml").exists())

    def test_check_does_not_rewrite_stale_output(self):
        destination = self.windows / "custom.yaml"
        destination.write_text("previous output", encoding="utf-8")
        with self.assertRaises(RuntimeError):
            sync.sync_apple_rules_to_windows(check=True)
        self.assertEqual(destination.read_text("utf-8"), "previous output")

    def test_prepare_only_never_reads_credentials_or_uses_network(self):
        with patch.object(sync, "extract_creds_from_script_js") as credentials, patch.object(
            sync.urllib.request, "urlopen"
        ) as network, patch.object(sync, "get_github_token") as token:
            sync.main(["--prepare-only"])
        credentials.assert_not_called()
        network.assert_not_called()
        token.assert_not_called()
        self.assertEqual(self.script.read_text("utf-8"), "unchanged local client")

    def test_deploy_stops_before_credentials_when_remote_rules_are_stale(self):
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                pass

            def read(self):
                return b"DOMAIN,stale.example\n"

        with patch.object(sync.urllib.request, "urlopen", return_value=Response()), patch.object(
            sync, "extract_creds_from_script_js"
        ) as credentials, patch.object(sync, "get_github_token") as token:
            with self.assertRaisesRegex(RuntimeError, "CDN"):
                sync.main([])
        credentials.assert_not_called()
        token.assert_not_called()
        self.assertEqual(self.script.read_text("utf-8"), "unchanged local client")

    def test_remote_comments_and_yaml_quotes_do_not_require_republishing(self):
        sync.sync_apple_rules_to_windows()

        class Response:
            def __init__(self, content):
                self.content = content

            def __enter__(self):
                return self

            def __exit__(self, *_):
                pass

            def read(self):
                return self.content.encode("utf-8")

        def remote(request, **_):
            relative = request.full_url.removeprefix(sync.RULES_CDN + "/")
            path = self.apple.parent / relative
            content = path.read_text("utf-8")
            if path.suffix == ".yaml":
                rules = sync.read_rules(content, yaml=True)
                content = "payload:\n" + "\n".join("  - '" + r + "'" for r in rules)
            return Response("# different remote comment\n" + content)

        with patch.object(sync.urllib.request, "urlopen", side_effect=remote):
            sync.ensure_rules_published()


if __name__ == "__main__":
    unittest.main()
