from fastapi import FastAPI

app = FastAPI(title="kaithangu-ml")


@app.get("/health")
def health() -> dict[str, bool | str]:
    return {"ok": True, "service": "ml"}
