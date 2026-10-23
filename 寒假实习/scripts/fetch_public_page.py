"""使用 Python 标准库读取公开招聘页面；保留 HTML、文本和请求元数据。"""

import argparse
from datetime import datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skipped = 0
        self.parts = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skipped += 1
        if tag == "a":
            href = dict(attrs).get("href", "")
            if any(key in href for key in ("intern/", "job_detail", "jobs/")):
                self.links.append(href)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skipped = max(0, self.skipped - 1)

    def handle_data(self, data):
        if not self.skipped and data.strip():
            self.parts.append(data.strip())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="公开 HTTPS 页面地址，不含凭据")
    parser.add_argument("--name", required=True, help="本次页面的唯一文件名，不含扩展名")
    parser.add_argument("--out", type=Path, required=True, help="输出目录；不覆盖已有文件")
    parser.add_argument("--source-html", type=Path, help="离线重放已有 HTML，不发送请求")
    args = parser.parse_args()
    url = urlsplit(args.url)
    if url.scheme != "https" or not url.hostname or url.username or url.password:
        parser.error("仅接受不含用户凭据的 HTTPS 地址")
    if not re.fullmatch(r"[\w-]+", args.name):
        parser.error("name 仅可包含文字、数字、下划线、连字符")
    if re.search(r"(?:token|password|secret|authorization|api_key)=", url.query, re.I):
        parser.error("URL 不应携带认证参数")
    args.out.mkdir(parents=True, exist_ok=True)
    files = {ext: args.out / (args.name + ext) for ext in (".html", ".txt", ".json")}
    if any(path.exists() for path in files.values()):
        parser.error("目标文件已存在；请使用新日期目录或新名称")

    if args.source_html:
        body = args.source_html.read_bytes()
        html = body.decode("utf-8", errors="replace")
        final_url, status = args.url, None
    else:
        request = Request(args.url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            # 复用平台代理，保持默认 TLS 校验；不带登录 Cookie，不绕过验证。
            with urlopen(request, timeout=30) as response:
                body = response.read()
                charset = response.headers.get_content_charset() or "utf-8"
                html = body.decode(charset, errors="replace")
                final_url, status = response.geturl(), response.status
        except HTTPError as error:
            print(f"HTTP {error.code}：未保存新页面；区分网站拒绝与平台策略后再处理。", file=sys.stderr)
            return 1
        except (URLError, TimeoutError, OSError):
            print("请求失败：检查网络策略、代理或超时；未保存新页面。", file=sys.stderr)
            return 1

    page = PageParser()
    page.feed(html)
    text = "\n".join(page.parts) + "\nLINKS\n" + "\n".join(dict.fromkeys(page.links))
    files[".html"].write_bytes(body)
    files[".txt"].write_text(text, encoding="utf-8")
    metadata = {
        "url": args.url,
        "final_url": final_url,
        "processed_at": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(),
        "mode": "offline_replay" if args.source_html else "public_http",
        "http_status": status,
        "html_sha256": hashlib.sha256(body).hexdigest(),
        "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "text_contains_private_use_glyphs": bool(re.search(r"[\ue000-\uf8ff]", text)),
        "links": list(dict.fromkeys(urljoin(final_url, link) for link in page.links)),
        "review_status": "needs_manual_review",
        "note": "HTTP 成功不表示岗位有效；需检查正文、日期、薪资及实习条件。",
    }
    files[".json"].write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已保存 {args.name} 的 HTML、文本和元数据；正文条件待人工核验。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
