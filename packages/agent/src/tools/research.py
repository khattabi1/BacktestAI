"""
Quantitative Web Research & Domain Knowledge Plugin for BacktestAI Agent Harness (DSH).
Provides real-time web search capabilities for economic calendars, MQL5 documentation,
quantitative formulas, and algorithmic trading literature.
"""

from __future__ import annotations
import html
import json
import logging
import os
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("backtest_ai.agent.tools.research")


async def search_web(
    query: str,
    max_results: int = 5,
    search_depth: str = "standard",
) -> Dict[str, Any]:
    """
    Searches the live web for quantitative financial knowledge, documentation, or market news.
    Uses Tavily as primary AI search engine, Serper (Google Search) as secondary fallback,
    and a zero-key engine as tertiary fallback.
    """
    clean_query = query.strip()
    if not clean_query:
        return {"success": False, "error": "Search query cannot be empty."}

    logger.info(f"[Research Tool] Executing web search for: '{clean_query}'")

    # 1. Primary Engine: Tavily Search (AI-optimized with direct answer)
    tavily_key = os.environ.get("TAVILY_API_KEY")
    if tavily_key:
        try:
            res = await _search_tavily(clean_query, tavily_key, max_results)
            if res.get("success") and res.get("results"):
                return res
        except Exception as e:
            logger.warning(f"[Research Tool] Tavily search error: {e}, falling back to Serper...")

    # 2. Secondary Engine: Serper Google Search
    serper_key = os.environ.get("SERPER_API_KEY")
    if serper_key:
        try:
            res = await _search_serper(clean_query, serper_key, max_results)
            if res.get("success") and res.get("results"):
                return res
        except Exception as e:
            logger.warning(f"[Research Tool] Serper search error: {e}, falling back to zero-key...")

    # 3. Tertiary Engine: Zero-key Modern fallback
    return await _search_duckduckgo_zero_key(clean_query, max_results)


async def _search_tavily(query: str, api_key: str, max_results: int = 5) -> Dict[str, Any]:
    """Tavily search provider with AI direct answer and clean content snippets."""
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
        "search_depth": "advanced",
        "include_answer": True,
    }
    async with httpx.AsyncClient(timeout=12.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        raw_results = data.get("results", [])
        results = [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": r.get("content", ""),
            }
            for r in raw_results[:max_results]
        ]
        out: Dict[str, Any] = {
            "success": True,
            "provider": "tavily",
            "query": query,
            "results_count": len(results),
            "results": results,
        }
        if data.get("answer"):
            out["direct_answer"] = data["answer"]
        return out


async def _search_serper(query: str, api_key: str, max_results: int = 5) -> Dict[str, Any]:
    """Serper Google search provider."""
    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    payload = {"q": query, "num": max_results}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        raw_results = data.get("organic", [])
        results = [
            {
                "title": r.get("title", ""),
                "url": r.get("link", ""),
                "snippet": r.get("snippet", ""),
            }
            for r in raw_results[:max_results]
        ]
        out: Dict[str, Any] = {
            "success": True,
            "provider": "serper_google",
            "query": query,
            "results_count": len(results),
            "results": results,
        }
        if data.get("knowledgeGraph", {}).get("description"):
            out["knowledge_graph"] = data["knowledgeGraph"]["description"]
        return out


async def _search_duckduckgo_zero_key(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Executes a zero-key search via DuckDuckGo HTML endpoint and parses snippets.
    """
    try:
        encoded = urllib.parse.quote_plus(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        req = urllib.request.Request(url, headers=headers)

        with urllib.request.urlopen(req, timeout=8.0) as resp:
            content = resp.read().decode("utf-8", errors="ignore")

        results: List[Dict[str, str]] = []
        pattern = re.compile(
            r'<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)</a>.*?'
            r'<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>',
            re.DOTALL | re.IGNORECASE,
        )

        matches = pattern.findall(content)
        for link, raw_title, raw_snippet in matches[:max_results]:
            clean_title = html.unescape(re.sub(r"<[^>]+>", "", raw_title).strip())
            clean_snippet = html.unescape(re.sub(r"<[^>]+>", "", raw_snippet).strip())

            parsed_link = link
            if "uddg=" in link:
                match_uddg = re.search(r"uddg=([^&]+)", link)
                if match_uddg:
                    parsed_link = urllib.parse.unquote(match_uddg.group(1))

            if clean_title and clean_snippet:
                results.append({
                    "title": clean_title,
                    "url": parsed_link,
                    "snippet": clean_snippet,
                })

        if results:
            return {
                "success": True,
                "provider": "duckduckgo_zero_key",
                "query": query,
                "results_count": len(results),
                "results": results,
            }

        return {
            "success": True,
            "provider": "fallback_quant_index",
            "query": query,
            "results_count": 0,
            "results": [],
            "message": f"Zero-key web search returned no direct snippets for '{query}'. Please use specific keywords or read verified documentation via read_web_page."
        }
    except Exception as err:
        logger.warning(f"[Research Tool] DuckDuckGo zero-key query error: {err}")
        return {
            "success": False,
            "provider": "fallback_quant_index",
            "query": query,
            "error": str(err),
            "results": [],
        }


async def read_web_page(
    url: str,
    max_chars: int = 12000,
) -> Dict[str, Any]:
    """
    Fetches and parses the full readable text content of a web page URL.
    Ideal for reading official MQL5 documentation, GitHub EA repositories,
    quantitative research papers, or economic calendar analysis.
    """
    clean_url = url.strip().strip('"').strip("'")
    if not clean_url.startswith(("http://", "https://")):
        return {"success": False, "error": "URL must start with http:// or https://"}

    # 1. Try Tavily Extract first if API key is present (bypasses Cloudflare / Bot blocks)
    tavily_key = os.environ.get("TAVILY_API_KEY")
    if tavily_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                t_resp = await client.post(
                    "https://api.tavily.com/extract",
                    json={"api_key": tavily_key, "urls": [clean_url]},
                )
                if t_resp.status_code == 200:
                    t_data = t_resp.json()
                    results = t_data.get("results", [])
                    if results and results[0].get("raw_content"):
                        raw_c = results[0]["raw_content"]
                        truncated = False
                        if len(raw_c) > max_chars:
                            raw_c = raw_c[:max_chars] + f"\n\n[... Truncated at {max_chars} characters ...]"
                            truncated = True
                        return {
                            "success": True,
                            "url": clean_url,
                            "title": clean_url,
                            "content": raw_c,
                            "length": len(raw_c),
                            "provider": "tavily_extract",
                            "truncated": truncated,
                        }
        except Exception as e:
            logger.warning(f"[Research Tool] Tavily extract fallback due to: {e}")

    # 2. Fallback to direct httpx fetch
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(clean_url, headers=headers)
            resp.raise_for_status()
            raw_html = resp.text

        # Extract title
        title_match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.IGNORECASE | re.DOTALL)
        page_title = html.unescape(title_match.group(1)).strip() if title_match else clean_url

        # Strip scripts, styles, svg, and nav headers
        cleaned = re.sub(r"<(script|style|svg|noscript|header|footer|nav)[^>]*>.*?</\1>", " ", raw_html, flags=re.DOTALL | re.IGNORECASE)
        # Strip HTML comments
        cleaned = re.sub(r"<!--.*?-->", " ", cleaned, flags=re.DOTALL)
        # Convert paragraph/break tags to newlines
        cleaned = re.sub(r"<(?:p|br|div|tr|li)[^>]*>", "\n", cleaned, flags=re.IGNORECASE)
        # Strip remaining tags
        text = re.sub(r"<[^>]+>", " ", cleaned)
        text = html.unescape(text)

        # Normalize whitespace
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        full_text = "\n".join(lines)

        truncated = False
        if len(full_text) > max_chars:
            full_text = full_text[:max_chars] + f"\n\n[... Truncated at {max_chars} characters ...]"
            truncated = True

        return {
            "success": True,
            "url": clean_url,
            "title": page_title,
            "content": full_text,
            "length": len(full_text),
            "truncated": truncated,
        }

    except Exception as exc:
        logger.error(f"[Research Tool] Failed to read web page '{clean_url}': {exc}")
        return {
            "success": False,
            "url": clean_url,
            "error": f"Failed to fetch web page content: {str(exc)}",
        }


def register_research_tools(harness: Any) -> None:
    """Registers the quantitative web research tools into an AgentHarness."""
    harness.register_tool(
        name="search_web",
        description="Searches the live web for financial documentation, MQL5 API references, macroeconomic news, and quantitative formulas. Backed by Tavily AI Search and Serper Google Search.",
        parameters={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query (e.g. 'MQL5 CPositionInfo documentation', 'Sortino ratio downside deviation math').",
                },
                "max_results": {
                    "type": "integer",
                    "default": 5,
                    "description": "Maximum number of search result snippets to retrieve (1-10).",
                },
            },
            "required": ["query"],
        },
        handler=search_web,
    )

    harness.register_tool(
        name="read_web_page",
        description="Fetches and reads the full text content of any web page URL (e.g. MQL5 documentation articles, GitHub code repositories, or quant research papers).",
        parameters={
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The full HTTP/HTTPS URL of the web page to read.",
                },
                "max_chars": {
                    "type": "integer",
                    "default": 12000,
                    "description": "Maximum number of characters to extract (default 12,000).",
                },
            },
            "required": ["url"],
        },
        handler=read_web_page,
    )
