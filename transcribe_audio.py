"""Transcribe one local audio file for the Jev helper.

The browser sends audio to this local process only. Jev receives the resulting
transcript as text because the decision endpoint is text based.
"""
from __future__ import annotations

import json
import os
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"ok": False, "error": "缺少音频文件路径"}, ensure_ascii=False))
        return 2
    source = sys.argv[1]
    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"本地未安装 faster-whisper：{exc}"}, ensure_ascii=False))
        return 1

    model_size = os.environ.get("WHISPER_MODEL_SIZE", "tiny")
    cache_dir = os.environ.get(
        "WHISPER_MODEL_CACHE",
        r"E:\secondsoft\myclaudeenv\models\huggingface\hub",
    )
    try:
        model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            download_root=cache_dir,
            local_files_only=True,
        )
        segments, info = model.transcribe(source, beam_size=5, vad_filter=True)
        cues = []
        for index, segment in enumerate(segments):
            text = segment.text.strip()
            if text:
                cues.append(
                    {
                        "index": index,
                        "start_ms": round(segment.start * 1000),
                        "end_ms": round(segment.end * 1000),
                        "text": text,
                    }
                )
        text = "\n".join(cue["text"] for cue in cues).strip()
        if not text:
            raise RuntimeError("音频中没有识别到可用语音")
        print(
            json.dumps(
                {
                    "ok": True,
                    "text": text,
                    "cues": cues,
                    "model": f"faster-whisper:{model_size}",
                    "language": getattr(info, "language", None),
                },
                ensure_ascii=False,
            )
        )
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"语音转写失败：{exc}"}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
