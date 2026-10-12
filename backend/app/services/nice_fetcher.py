"""
NICE Guidance Auto-Fetcher Service.
Automatically fetches and parses recommendations directly from the official NICE website
using either:
1. The official Baseline Assessment Tool (.xlsx) from the guidance resources page.
2. Direct HTML scraping of guideline chapter recommendations as a robust fallback.
"""

import logging
import re
import urllib.parse
import urllib.request
from typing import Optional
from bs4 import BeautifulSoup

from app.services.smart_excel_parser import (
    ParsedGuidelineData,
    ParsedRecommendation,
    SmartExcelParser,
)

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
BASE_URL = "https://www.nice.org.uk"


class NiceFetcherError(Exception):
    """Raised when fetching or parsing guidance from NICE fails."""
    pass


class NiceFetcher:
    """Automates finding, downloading, and extracting NICE guideline recommendations."""

    CODE_PATTERN = re.compile(r"^(NG|CG|QS|PH|MTG|DG|HST|TA)\s*(\d+)$", re.IGNORECASE)

    @classmethod
    def normalise_code(cls, raw_code: str) -> str:
        """Normalises codes like 'ng 253', 'NG253', 'cg191' to canonical 'NG253'."""
        cleaned = raw_code.strip().replace(" ", "").upper()
        match = cls.CODE_PATTERN.match(cleaned)
        if not match:
            raise NiceFetcherError(f"Invalid NICE guideline code '{raw_code}'. Expected format like NG253, CG191, QS213.")
        return f"{match.group(1).upper()}{match.group(2)}"

    @classmethod
    def fetch_guideline(cls, code_input: str) -> ParsedGuidelineData:
        """
        Fetches guideline recommendations automatically from NICE.
        Attempts Method 1 (Official Excel BAT) first, falling back to
        Method 2 (Direct Chapter HTML scraping) if no Excel BAT exists.
        """
        code = cls.normalise_code(code_input)
        code_lower = code.lower()

        logger.info(f"Attempting to fetch NICE guidance for {code}...")

        # 1. Try fetching via official Excel Baseline Assessment Tool
        try:
            excel_data = cls._fetch_via_excel_bat(code, code_lower)
            if excel_data and excel_data.recommendations:
                logger.info(f"Successfully fetched {len(excel_data.recommendations)} recommendations for {code} via Excel BAT.")
                return excel_data
        except Exception as e:
            logger.warning(f"Excel BAT fetch failed or unavailable for {code}: {e}. Trying direct chapter scrape fallback...")

        # 2. Fallback: Direct Chapter HTML Scraping
        try:
            web_data = cls._fetch_via_web_chapters(code, code_lower)
            if web_data and web_data.recommendations:
                logger.info(f"Successfully fetched {len(web_data.recommendations)} recommendations for {code} via Chapter Scraper.")
                return web_data
        except Exception as e:
            logger.error(f"Web chapter scrape also failed for {code}: {e}")
            raise NiceFetcherError(f"Could not retrieve recommendations for {code} from NICE: {e}")

        raise NiceFetcherError(f"No recommendations could be found or extracted for NICE guidance {code}.")

    @classmethod
    def _fetch_via_excel_bat(cls, code: str, code_lower: str) -> Optional[ParsedGuidelineData]:
        """Locates and downloads the official Baseline Assessment Tool Excel spreadsheet."""
        resources_url = f"{BASE_URL}/guidance/{code_lower}/resources"
        html = cls._http_get_text(resources_url)

        # Look for the baseline assessment tool link
        soup = BeautifulSoup(html, "html.parser")
        bat_link = None

        for a in soup.find_all("a", href=True):
            href = a["href"]
            text = a.get_text().lower()
            if f"/guidance/{code_lower}/resources/" in href:
                if "baseline-assessment-tool" in href or "baseline assessment" in text:
                    bat_link = href
                    break
                elif ("excel" in href or "xlsx" in href) and "baseline" in href:
                    bat_link = href
                    break

        if not bat_link:
            logger.info(f"No official Baseline Assessment Tool Excel link found on {resources_url}.")
            return None

        full_download_url = urllib.parse.urljoin(BASE_URL, bat_link)
        logger.info(f"Downloading NICE BAT spreadsheet from: {full_download_url}")
        excel_bytes = cls._http_get_bytes(full_download_url)

        parsed = SmartExcelParser.parse(excel_bytes, filename=f"{code}_baseline_tool.xlsx")
        if not parsed.code:
            parsed.code = code
        return parsed

    @classmethod
    def _fetch_via_web_chapters(cls, code: str, code_lower: str) -> ParsedGuidelineData:
        """Scrapes recommendations directly from the guidance HTML chapter pages on nice.org.uk."""
        overview_url = f"{BASE_URL}/guidance/{code_lower}"
        overview_html = cls._http_get_text(overview_url)
        soup = BeautifulSoup(overview_html, "html.parser")

        # Extract Title
        title_tag = soup.find("h1", class_="page-header__heading") or soup.find("h1")
        title = title_tag.get_text().strip() if title_tag else f"NICE Guideline {code}"

        # Find chapter links under recommendations
        chapter_links = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if f"/guidance/{code_lower}/chapter/" in href:
                full_href = urllib.parse.urljoin(BASE_URL, href)
                # Ignore non-recommendation chapters
                lower_href = full_href.lower()
                if not any(skip in lower_href for skip in ["using-this-guideline", "terms-used", "recommendations-for-research", "update-information", "committee"]):
                    if full_href not in chapter_links:
                        chapter_links.append(full_href)

        if not chapter_links:
            # Try single-page or recommendations chapter directly
            chapter_links.append(f"{BASE_URL}/guidance/{code_lower}/chapter/Recommendations")

        recommendations: list[ParsedRecommendation] = []
        rec_pattern = re.compile(r"^\d+(?:\.\d+)+$")

        for chap_url in chapter_links:
            try:
                chap_html = cls._http_get_text(chap_url)
                chap_soup = BeautifulSoup(chap_html, "html.parser")

                # NICE wraps recommendations in <article class="numbered-paragraph">
                articles = chap_soup.find_all("article", class_=lambda c: c and "numbered-paragraph" in c)
                for art in articles:
                    heading = art.find(["h4", "h3", "h2", "strong", "p"])
                    rec_num = heading.get_text().strip() if heading else ""

                    if not rec_pattern.match(rec_num):
                        continue

                    # Extract recommendation text
                    content_div = art.find("div") or art
                    # Extract year if present in <strong>[2025]</strong>
                    year = ""
                    year_tag = content_div.find("strong")
                    if year_tag and re.search(r"\b(19\d\d|20\d\d)\b", year_tag.get_text()):
                        year = year_tag.get_text().strip("[]() ")

                    rec_text = content_div.get_text(separator=" ").strip()
                    # Remove the rec number from the start if repeated
                    rec_text = re.sub(rf"^{re.escape(rec_num)}\s*", "", rec_text)

                    recommendations.append(
                        ParsedRecommendation(
                            rec_number=rec_num,
                            rec_text=rec_text,
                            rec_year=year,
                        )
                    )
            except Exception as e:
                logger.warning(f"Failed to scrape chapter {chap_url}: {e}")

        if not recommendations:
            raise NiceFetcherError(f"No recommendations could be parsed from chapter pages for {code}.")

        return ParsedGuidelineData(
            title=title,
            code=code,
            recommendations=recommendations,
        )

    @staticmethod
    def _http_get_text(url: str) -> str:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise NiceFetcherError(f"Guideline URL not found on NICE (404): {url}")
            raise NiceFetcherError(f"HTTP error {e.code} fetching {url}: {e.reason}")
        except Exception as e:
            raise NiceFetcherError(f"Network error accessing {url}: {e}")

    @staticmethod
    def _http_get_bytes(url: str) -> bytes:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            raise NiceFetcherError(f"HTTP error {e.code} downloading file {url}: {e.reason}")
        except Exception as e:
            raise NiceFetcherError(f"Network error downloading file {url}: {e}")
