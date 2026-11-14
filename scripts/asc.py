#!/usr/bin/env python3
"""Small App Store Connect API helper for the TestFlight workflow.

Only needs the Python standard library plus the `openssl` and `curl`
command line tools, which every macOS runner has.

  asc.py prepare --key AuthKey.p8 --bundle-id com.example.app --name Example
      Registers the bundle ID if it is missing, prints `team_id=...` and
      `app_id=...`, and exits with code 3 (plus instructions) when the app
      record has not been created in App Store Connect yet.

  asc.py testers --key AuthKey.p8 --bundle-id com.example.app
      Makes sure the app has an internal TestFlight group that gets every
      build automatically, and adds every App Store Connect user of the team
      to it (for a personal account: just you).

Environment: ASC_KEY_ID, ASC_ISSUER_ID. ASC_API_BASE overrides the API host
(used by the tests).
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.parse

API = os.environ.get("ASC_API_BASE", "https://api.appstoreconnect.apple.com")
NEW_APP_URL = "https://appstoreconnect.apple.com/apps"


class AppRecordMissing(Exception):
    pass


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def summary(markdown: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(markdown + "\n")


# --- JWT (ES256) -------------------------------------------------------------

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_to_raw(der: bytes) -> bytes:
    """openssl emits an ASN.1 DER ECDSA signature; JWS wants raw r||s."""
    if not der or der[0] != 0x30:
        raise ValueError("not a DER sequence")
    index = 2
    if der[1] & 0x80:
        index = 2 + (der[1] & 0x7F)
    raw = b""
    for _ in range(2):
        if der[index] != 0x02:
            raise ValueError("expected DER integer")
        length = der[index + 1]
        value = der[index + 2:index + 2 + length].lstrip(b"\x00")
        if len(value) > 32:
            raise ValueError("integer too long for P-256")
        raw += value.rjust(32, b"\x00")
        index += 2 + length
    return raw


def make_token(key_id: str, issuer_id: str, key_path: str) -> str:
    header = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    now = int(time.time())
    payload = {"iss": issuer_id, "iat": now, "exp": now + 15 * 60, "aud": "appstoreconnect-v1"}
    compact = lambda obj: json.dumps(obj, separators=(",", ":")).encode()
    signing_input = f"{b64url(compact(header))}.{b64url(compact(payload))}"
    der = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", key_path],
        input=signing_input.encode(),
        capture_output=True,
        check=True,
    ).stdout
    return f"{signing_input}.{b64url(der_to_raw(der))}"


# --- HTTP ----------------------------------------------------------------------

class Client:
    def __init__(self, token: str):
        self.token = token

    def call(self, method: str, path: str, params: dict | None = None, body: dict | None = None):
        url = API + path
        if params:
            url += "?" + urllib.parse.urlencode(params)
        command = [
            "curl", "-sS", "-X", method, url,
            "-H", f"Authorization: Bearer {self.token}",
            "-H", "Content-Type: application/json",
            "-w", "\n%{http_code}",
        ]
        data = None
        if body is not None:
            command += ["--data-binary", "@-"]
            data = json.dumps(body).encode()
        result = subprocess.run(command, input=data, capture_output=True, check=True)
        text, _, status = result.stdout.decode().rpartition("\n")
        try:
            parsed = json.loads(text) if text.strip() else {}
        except json.JSONDecodeError:
            parsed = {"raw": text}
        return int(status), parsed

    def expect(self, method: str, path: str, params=None, body=None, ok=(200, 201)):
        status, data = self.call(method, path, params, body)
        if status not in ok:
            raise RuntimeError(f"{method} {path} -> HTTP {status}: {errors(data)}")
        return data


def errors(data: dict) -> str:
    items = data.get("errors") or []
    if not items:
        return json.dumps(data)[:300]
    return "; ".join(f"{e.get('title', '')}: {e.get('detail', '')}" for e in items)


# --- Steps ----------------------------------------------------------------------

def find_bundle_id(client: Client, identifier: str):
    data = client.expect("GET", "/v1/bundleIds", {"filter[identifier]": identifier, "limit": 200})
    for item in data.get("data", []):
        if item.get("attributes", {}).get("identifier") == identifier:
            return item
    return None


def ensure_bundle_id(client: Client, identifier: str, name: str):
    existing = find_bundle_id(client, identifier)
    if existing:
        log(f"[ OK ] bundle ID {identifier} already registered")
        return existing
    log(f"[ .. ] registering bundle ID {identifier}")
    status, data = client.call("POST", "/v1/bundleIds", body={
        "data": {
            "type": "bundleIds",
            "attributes": {"identifier": identifier, "name": name, "platform": "IOS"},
        }
    })
    if status in (200, 201):
        log(f"[ OK ] bundle ID {identifier} registered")
        return data["data"]
    if status == 409:  # registered by someone else in the meantime, or name clash
        existing = find_bundle_id(client, identifier)
        if existing:
            return existing
    raise RuntimeError(f"could not register bundle ID {identifier}: HTTP {status}: {errors(data)}")


def find_app(client: Client, bundle_id: str):
    data = client.expect("GET", "/v1/apps", {"filter[bundleId]": bundle_id, "limit": 200})
    for item in data.get("data", []):
        if item.get("attributes", {}).get("bundleId") == bundle_id:
            return item
    return None


def cmd_prepare(client: Client, args) -> int:
    bundle = ensure_bundle_id(client, args.bundle_id, args.name)
    team_id = bundle.get("attributes", {}).get("seedId", "")
    if team_id:
        print(f"team_id={team_id}")
    app = find_app(client, args.bundle_id)
    if not app:
        message = (
            f"App Store Connect にまだアプリがありません。\n"
            f"{NEW_APP_URL} の「＋ → 新規 App」で、バンドル ID に {args.bundle_id} を選んで作成してから、"
            f"もう一度このワークフローを実行してください。"
        )
        log("::error::" + message.replace("\n", " "))
        summary(
            "### あと 1 ステップ: App Store Connect でアプリを作成\n\n"
            f"1. [App Store Connect → アプリ]({NEW_APP_URL}) を開いて **＋ → 新規 App**\n"
            "2. プラットフォーム **iOS**、名前は好きなもの（例: `Sats-OS Wallet`）、言語 **日本語**\n"
            f"3. バンドル ID は一覧から **`{args.bundle_id}`** を選ぶ（このワークフローが登録済み）\n"
            "4. SKU は何でも（例: `satsos`）、ユーザアクセスは **フルアクセス**\n"
            "5. 作成したら **Actions → TestFlight → Run workflow** をもう一度\n"
        )
        return 3
    log(f"[ OK ] app record found: {app['attributes'].get('name')} ({app['id']})")
    print(f"app_id={app['id']}")
    return 0


def cmd_testers(client: Client, args) -> int:
    app = find_app(client, args.bundle_id)
    if not app:
        raise RuntimeError(f"no app record for {args.bundle_id}")
    groups = client.expect("GET", f"/v1/apps/{app['id']}/betaGroups", {"limit": 200}).get("data", [])
    group = next((g for g in groups if g["attributes"].get("isInternalGroup")
                  and g["attributes"].get("hasAccessToAllBuilds")), None)
    if group:
        log(f"[ OK ] internal group '{group['attributes'].get('name')}' gets every build")
    else:
        group = client.expect("POST", "/v1/betaGroups", body={
            "data": {
                "type": "betaGroups",
                "attributes": {"name": args.group, "isInternalGroup": True, "hasAccessToAllBuilds": True},
                "relationships": {"app": {"data": {"type": "apps", "id": app["id"]}}},
            }
        })["data"]
        log(f"[ OK ] created internal group '{args.group}'")

    users = client.expect("GET", "/v1/users", {"limit": 200}).get("data", [])
    added = 0
    for user in users:
        attrs = user.get("attributes", {})
        email = attrs.get("username")
        if not email:
            continue
        status, data = client.call("POST", "/v1/betaTesters", body={
            "data": {
                "type": "betaTesters",
                "attributes": {
                    "email": email,
                    "firstName": attrs.get("firstName") or "",
                    "lastName": attrs.get("lastName") or "",
                },
                "relationships": {"betaGroups": {"data": [{"type": "betaGroups", "id": group["id"]}]}},
            }
        })
        if status in (200, 201):
            added += 1
        elif status == 409:
            pass  # already a tester in this group
        else:
            log(f"[ !! ] could not add a tester: HTTP {status}: {errors(data)}")
    log(f"[ OK ] testers ready ({added} added, {len(users)} team users)")
    summary(
        "### TestFlight\n\n"
        f"内部テストグループ **{group['attributes'].get('name', args.group)}** に、チームのユーザー全員（あなた）を登録しました。"
        "Apple の処理が終わると、iPhone の **TestFlight** アプリに Sats-OS が表示されます。\n"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["prepare", "testers"])
    parser.add_argument("--key", required=True, help="path to AuthKey_XXXX.p8")
    parser.add_argument("--bundle-id", required=True)
    parser.add_argument("--name", default="SatsOS", help="bundle ID description (letters, digits, spaces)")
    parser.add_argument("--group", default="Sats-OS me", help="internal group name to create")
    args = parser.parse_args()

    key_id = os.environ.get("ASC_KEY_ID", "").strip()
    issuer_id = os.environ.get("ASC_ISSUER_ID", "").strip()
    if not key_id or not issuer_id:
        log("::error::ASC_KEY_ID and ASC_ISSUER_ID must be set")
        return 2
    client = Client(make_token(key_id, issuer_id, args.key))
    try:
        return cmd_prepare(client, args) if args.command == "prepare" else cmd_testers(client, args)
    except RuntimeError as error:
        log(f"::error::{error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
