FROM python:3.12-slim

LABEL maintainer="Blitz <blitzlabx@users.noreply.github.com>"
LABEL org.opencontainers.image.title="blitzyxsc"
LABEL org.opencontainers.image.description="Auth-free X/Twitter scraping API"
LABEL org.opencontainers.image.source="https://github.com/blitzlabx/blitzyxsc"
LABEL org.opencontainers.image.license="MIT"
LABEL org.opencontainers.image.version="1.0.0"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

ENV BLITZYXSC_HOST=0.0.0.0
ENV BLITZYXSC_PORT=8000

CMD ["uvicorn", "blitzyxsc_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
