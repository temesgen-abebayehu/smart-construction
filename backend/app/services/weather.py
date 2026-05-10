import logging
import time
from typing import Optional, TypedDict
import httpx

logger = logging.getLogger(__name__)

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 1800  # 30 minutes
HTTP_TIMEOUT = 5.0
FORECAST_DAYS = 7


class DailyForecast(TypedDict):
    date: str                    # ISO date YYYY-MM-DD
    temperature_max: float | None
    temperature_min: float | None
    precipitation_sum: float | None  # mm
    wind_speed_max: float | None     # km/h
    weather_code: int | None         # WMO weather code


class WeatherData(TypedDict):
    temperature: float           # °C (current)
    humidity: float              # % (current)
    resolved_location: str       # what the geocoder matched
    latitude: float
    longitude: float
    fetched_at: float            # unix timestamp
    forecast: list[DailyForecast]   # next 7 days


_cache: dict[str, tuple[float, WeatherData]] = {}


async def _geocode(client: httpx.AsyncClient, location: str) -> Optional[dict]:
    params = {"name": location, "count": 1}
    logger.info("Calling Open-Meteo Geocoding API: url=%s params=%s", GEOCODE_URL, params)
    resp = await client.get(GEOCODE_URL, params=params)
    resp.raise_for_status()
    body = resp.json()
    logger.info("Open-Meteo Geocoding API response: status=%s body=%s", resp.status_code, body)
    results = body.get("results") or []
    return results[0] if results else None


async def _fetch_forecast(client: httpx.AsyncClient, lat: float, lng: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": "temperature_2m,relative_humidity_2m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
        "forecast_days": FORECAST_DAYS,
        "timezone": "auto",
    }
    logger.info("Calling Open-Meteo Forecast API: url=%s params=%s", FORECAST_URL, params)
    resp = await client.get(FORECAST_URL, params=params)
    resp.raise_for_status()
    body = resp.json()
    logger.info("Open-Meteo Forecast API response: status=%s body=%s", resp.status_code, body)
    return body


def _parse_daily(daily: dict) -> list[DailyForecast]:
    """Open-Meteo returns parallel arrays under `daily` keyed by metric name."""
    if not daily:
        return []
    dates = daily.get("time") or []
    tmax = daily.get("temperature_2m_max") or []
    tmin = daily.get("temperature_2m_min") or []
    precip = daily.get("precipitation_sum") or []
    wind = daily.get("wind_speed_10m_max") or []
    code = daily.get("weather_code") or []

    out: list[DailyForecast] = []
    for i, d in enumerate(dates):
        out.append({
            "date": d,
            "temperature_max": float(tmax[i]) if i < len(tmax) and tmax[i] is not None else None,
            "temperature_min": float(tmin[i]) if i < len(tmin) and tmin[i] is not None else None,
            "precipitation_sum": float(precip[i]) if i < len(precip) and precip[i] is not None else None,
            "wind_speed_max": float(wind[i]) if i < len(wind) and wind[i] is not None else None,
            "weather_code": int(code[i]) if i < len(code) and code[i] is not None else None,
        })
    return out


async def get_weather(location: Optional[str]) -> Optional[WeatherData]:
    """
    Fetch current temperature & humidity AND a 7-day forecast for a free-text location.
    Returns None on any failure (empty location, geocode miss, network error)
    so callers can fall back gracefully.
    """
    logger.info("get_weather called with location=%r", location)
    if not location or not location.strip():
        logger.info("get_weather: empty location, returning None")
        return None

    key = location.strip().lower()
    now = time.time()

    cached = _cache.get(key)
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        age = now - cached[0]
        logger.info("get_weather: cache HIT for key=%r (age=%.1fs)", key, age)
        return cached[1]
    logger.info("get_weather: cache MISS for key=%r, fetching from Open-Meteo", key)

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            geo = await _geocode(client, location)

            # Fallback: try parent city if specific location fails
            if not geo and "," in location:
                parts = [p.strip() for p in location.split(",")]
                for i in range(1, len(parts)):
                    fallback = ", ".join(parts[i:])
                    logger.info("get_weather: trying fallback location=%r", fallback)
                    geo = await _geocode(client, fallback)
                    if geo:
                        break

            if not geo:
                logger.info("get_weather: geocode returned no match for location=%r (including fallbacks)", location)
                return None

            lat, lng = geo["latitude"], geo["longitude"]
            forecast = await _fetch_forecast(client, lat, lng)
            current = forecast.get("current") or {}
            daily = forecast.get("daily") or {}

            data: WeatherData = {
                "temperature": float(current.get("temperature_2m")),
                "humidity": float(current.get("relative_humidity_2m")),
                "resolved_location": ", ".join(
                    p for p in [geo.get("name"), geo.get("admin1"), geo.get("country")] if p
                ),
                "latitude": float(lat),
                "longitude": float(lng),
                "fetched_at": now,
                "forecast": _parse_daily(daily),
            }
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as e:
        logger.warning("get_weather: failed for location=%r error=%s", location, e)
        return None

    logger.info("get_weather: success for location=%r forecast_days=%d", location, len(data["forecast"]))
    _cache[key] = (now, data)
    return data
