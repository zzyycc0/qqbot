# Project status

## Current state

- This is a QQ direct-message AI companion project named “大肥鱼”, with a Windows desktop console, a local model gateway, server templates, and rebuild documentation.
- The latest local handover record, dated 2026-10-21, says the three bot services were stopped and disabled at that time. The backup timer was recorded as enabled.
- No live server check was made while preparing this archive. Treat the stop state as the last recorded state, not as a current health check.
- The public Git repository contains source, sanitized examples, pinned component references, and instructions for rebuilding a clean instance.
- No service was started, no remote server was contacted, no model request was made, and no QQ message was sent during this archive preparation.

## Included in Git

- Windows Electron console source.
- Python model gateway and server helper scripts.
- systemd unit templates, sanitized configuration examples, dependency pins, and rebuild instructions.
- Project architecture, behavior baseline, and known-issue notes.

## Kept outside Git

QQ login state, QQ identifiers, real user bindings, chat history, long-term memories, runtime databases, API keys, SSH keys, panel tokens, logs, screenshots, dependency install folders, and full backups are not part of this repository. The local full backup remains under the owner's control; its location and checksum are intentionally not recorded in this public repository.

## Before any future restart

Recheck the target server, account credentials, model settings, budget limits, QQ login requirements, and service state. A clean Git rebuild does not restore old login state, conversations, or memories. See [docs/rebuild.md](docs/rebuild.md) and [AI-HANDOVER.md](AI-HANDOVER.md).
