# Dockerfile for Hugging Face Spaces (Docker SDK)
#
# HF Spaces expects the container to listen on port 7860 and, by
# convention, to run as a non-root user with a writable home directory
# (Spaces' build environment enforces this for its own caching/permissions).

FROM python:3.11-slim

WORKDIR /app

# Minimal build deps for onnxruntime/Pillow native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Create the non-root user Spaces expects
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    U2NET_HOME=/home/user/.u2net

WORKDIR /app
COPY --chown=user . /app
USER user

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
