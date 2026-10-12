import pytest
from app.services.nice_fetcher import NiceFetcher, NiceFetcherError


def test_normalise_guideline_code():
    assert NiceFetcher.normalise_code("ng253") == "NG253"
    assert NiceFetcher.normalise_code("NG 253") == "NG253"
    assert NiceFetcher.normalise_code("cg191") == "CG191"
    assert NiceFetcher.normalise_code("qs 213") == "QS213"
    assert NiceFetcher.normalise_code("ph48") == "PH48"


def test_normalise_invalid_code():
    with pytest.raises(NiceFetcherError):
        NiceFetcher.normalise_code("INVALID123")
    with pytest.raises(NiceFetcherError):
        NiceFetcher.normalise_code("12345")
