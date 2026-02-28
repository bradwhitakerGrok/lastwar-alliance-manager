# Build stage
FROM golang:1.21-alpine AS builder

# Install all necessary build tools: 
# build-base includes gcc and g++ (required for CGO and gosseract)
# pkgconfig helps Go find the C-library paths
# tesseract-ocr-dev and leptonica-dev are the "blueprints" for the OCR engine
RUN apk add --no-cache \
    build-base \
    sqlite-dev \
    tesseract-ocr-dev \
    leptonica-dev \
    pkgconfig

WORKDIR /app

# Copy go mod files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the application with CGO enabled (required for SQLite and OCR)
RUN CGO_ENABLED=1 GOOS=linux go build -o main .

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
# tesseract-ocr-data-eng is the English language pack for the OCR to work
RUN apk add --no-cache \
    ca-certificates \
    sqlite-libs \
    tesseract-ocr \
    tesseract-ocr-data-eng

WORKDIR /app

# Copy the compiled binary and the web assets from the builder stage
COPY --from=builder /app/main .
COPY --from=builder /app/static ./static

# Create the data directory (This will be where we mount our Azure File Share)
RUN mkdir -p /data

# Expose the internal port the Go app listens on
EXPOSE 8080

# Set the environment variable so the app knows where to save the database
ENV DATABASE_PATH=/data/alliance.db

# Start the application
CMD ["./main"]
