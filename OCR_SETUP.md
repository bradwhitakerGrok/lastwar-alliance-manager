# Screenshot Upload & OCR Setup

## Overview

The screenshot upload feature allows R4/R5 alliance members to upload screenshots of the in-game member list, and the system will automatically extract member names and ranks to update the database.

## Current Implementation

The basic upload infrastructure is in place, but **OCR (Optical Character Recognition) is not yet fully implemented**. The system currently provides a mock implementation that needs to be replaced with actual OCR functionality.

## Setting Up OCR (Tesseract)

To enable actual text extraction from screenshots, you'll need to integrate Tesseract OCR:

### 1. Install Tesseract

**Windows:**
```bash
# Download and install from:
# https://github.com/UB-Mannheim/tesseract/wiki

# Or use chocolatey:
choco install tesseract
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr
sudo apt-get install libtesseract-dev
```

**macOS:**
```bash
brew install tesseract
```

### 2. Install Go Tesseract Bindings

Add the gosseract package to your Go project:

```bash
go get -u github.com/otiai10/gosseract/v2
```

### 3. Update main.go

Update the import section to include gosseract:

```go
import (
    // ... existing imports
    "github.com/otiai10/gosseract/v2"
)
```

Replace the `simulateOCR` function with actual OCR:

```go
func simulateOCR(imageData []byte) string {
    client := gosseract.NewClient()
    defer client.Close()
    
    // Set image from bytes
    client.SetImageFromBytes(imageData)
    
    // Optional: Configure for better accuracy
    client.SetPageSegMode(gosseract.PSM_AUTO)
    
    // Extract text
    text, err := client.Text()
    if err != nil {
        log.Printf("OCR error: %v", err)
        return ""
    }
    
    return text
}
```

### 4. Improve Text Parsing

The `parseMembers` function may need tuning based on actual OCR output. Consider:

- Handling OCR errors and common misreadings
- Filtering out UI elements (buttons, labels, etc.)
- Matching member names more accurately
- Handling special characters in names

Example improved parsing:

```go
func parseMembers(text string) []DetectedMember {
    members := []DetectedMember{}
    lines := strings.Split(text, "\n")
    
    // Patterns
    rankPattern := regexp.MustCompile(`\b(R5|R4|R3|R2|R1)\b`)
    
    // Keywords to ignore (UI elements)
    ignoreKeywords := []string{"Power", "Online", "Offline", "Manage", "Member", "List"}
    
    for _, line := range lines {
        line = strings.TrimSpace(line)
        if line == "" {
            continue
        }
        
        // Skip UI elements
        shouldSkip := false
        for _, keyword := range ignoreKeywords {
            if strings.Contains(line, keyword) {
                shouldSkip = true
                break
            }
        }
        if shouldSkip {
            continue
        }
        
        // Look for rank
        rankMatches := rankPattern.FindStringSubmatch(line)
        if len(rankMatches) > 0 {
            rank := rankMatches[1]
            
            // Extract name (before rank)
            namePart := rankPattern.ReplaceAllString(line, "")
            namePart = strings.TrimSpace(namePart)
            
            // Clean common OCR mistakes
            namePart = strings.ReplaceAll(namePart, "|", "I")  // Vertical bar to I
            namePart = strings.ReplaceAll(namePart, "0", "O")  // Zero to O in names
            
            if namePart != "" && len(namePart) > 1 {
                members = append(members, DetectedMember{
                    Name: namePart,
                    Rank: rank,
                })
            }
        }
    }
    
    return members
}
```

## Alternative Approaches

### 1. Cloud OCR Services

For better accuracy without local setup, consider cloud services:

**Google Cloud Vision API:**
```go
import "cloud.google.com/go/vision/apiv1"

func processWithGoogleVision(imageData []byte) (string, error) {
    ctx := context.Background()
    client, err := vision.NewImageAnnotatorClient(ctx)
    if err != nil {
        return "", err
    }
    defer client.Close()
    
    image := &visionpb.Image{Content: imageData}
    response, err := client.DetectText(ctx, image, nil)
    if err != nil {
        return "", err
    }
    
    if len(response.TextAnnotations) > 0 {
        return response.TextAnnotations[0].Description, nil
    }
    
    return "", nil
}
```

**Microsoft Azure Computer Vision:**
```go
import "github.com/Azure/azure-sdk-for-go/services/cognitiveservices/v3.1/computervision"
```

### 2. Manual CSV Import (Fallback)

The system already has CSV import functionality on the main Members page. Users can:

1. Take screenshots
2. Manually type out member list in CSV format
3. Upload CSV file

This works without OCR but requires manual data entry.

## Testing the Feature

Once OCR is set up:

1. Log in as R4, R5, or Admin user
2. Navigate to "📸 Upload" page
3. Select one or more screenshots
4. Click "Process Screenshots"
5. Review detected members
6. Confirm to update database

## Screenshots Format

For best OCR results, screenshots should:
- Show member names clearly visible
- Include rank badges (R1-R5)
- Have good contrast/lighting
- Be in PNG or JPG format
- Not be too compressed or blurry

## Troubleshooting

**No members detected:**
- Check if OCR is properly installed
- Verify screenshot quality
- Check logs for OCR errors
- Try preprocessing images (enhance contrast, denoise)

**Wrong member names:**
- Tune the `parseMembers` function
- Add more filtering for UI elements
- Improve name cleaning logic

**Incorrect ranks:**
- Verify rank badge recognition
- Check if rank text is clear in screenshot
- May need to use computer vision to detect rank badges by color/icon

## Future Enhancements

- Image preprocessing (contrast, denoise, rotation correction)
- Rank badge detection using computer vision
- Batch processing with progress tracking
- Member position/power extraction
- Duplicate detection across multiple screenshots
- Confidence scores for OCR results
