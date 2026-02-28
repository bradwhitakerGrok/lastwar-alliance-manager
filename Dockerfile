# Build stage
FROM golang:1.21-alpine AS builder

# Install build dependencies + Tesseract Dev headers + pkgconfig
RUN apk add --no-cache \
    gcc \
    musl-dev \
    sqlite-dev \
    tesseract-ocr-dev \
    leptonica-dev \
    pkgconfig

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build with CGO enabled
RUN CGO_ENABLED=1 GOOS=linux go build -o main .

# Runtime stage
FROM alpine:latest

# Install runtime dependencies + Tesseract OCR Engine & English Data
RUN apk add --no-cache \
    ca-certificates \
    sqlite-libs \
    tesseract-ocr \
    tesseract-ocr-data-eng

WORKDIR /app

# Copy binary and assets from builder
COPY --from=builder /app/main .
COPY --from=builder /app/static ./static

# Create data directory (matches Azure mount point)
RUN mkdir -p /data

# Expose port
EXPOSE 8080

# Set environment variable for database location
ENV DATABASE_PATH=/data/alliance.db

# Run the application
CMD ["./main"]
