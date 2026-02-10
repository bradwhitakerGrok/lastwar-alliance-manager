# Image Recognition & OCR Enhancement

## Overview

The application now includes intelligent image preprocessing to significantly improve OCR accuracy when processing power ranking screenshots from Last War: Survival.

## Distinct Attributes Detected

When analyzing a screenshot, the system identifies and processes these distinct visual elements:

### 1. **Title Bar Region**
- Location: Top 5-7% of image  
- Contains: "STRENGTH RANKING" text
- Background: Dark color
- Processing: Removed before OCR (UI element, not data)

### 2. **Tab Buttons**
- Location: Below title bar (~5-8% of height)
- Contains: "Power", "Kills", "Donation" buttons
- Styling: Orange/gray tabs with highlighted active tab
- Processing: Removed before OCR (UI navigation, not data)

### 3. **Column Headers**
- Location: Below tabs (~5% of height)
- Contains: "Ranking", "Commander", "Power" labels
- Background: Light brown/beige
- Processing: Removed before OCR (UI labels, not data)

### 4. **Data Rows Region** ⭐ PRIMARY FOCUS
- Location: Middle section (between headers and bottom button)
- Contains per row:
  - **Ranking Number**: Position in list (e.g., 7, 8, 9, 10)
  - **Player Icon**: Small square avatar image
  - **Rank Badge**: R5, R4, R3, R2, R1 (orange badge icons)
  - **Player Name**: Commander name (e.g., "dvdAlbert91", "Nutty Tx", "WoodWould")
  - **Power Value**: Large numbers (e.g., "50914631", "49758621")
- Background: Alternating colors with occasional highlighting
- Row Height: Auto-detected based on image dimensions
- Processing: **Enhanced and focused for OCR**

### 5. **Bottom Button Region**
- Location: Bottom 8-10% of image
- Contains: Back arrow navigation button
- Processing: Removed before OCR (UI control, not data)

## Image Preprocessing Pipeline

The system applies these enhancements sequentially:

### Step 1: Region Analysis
```
analyzeScreenshot(img) → ScreenshotAttributes
```
- Detects image dimensions
- Calculates region boundaries
- Estimates row height and count
- Logs analysis results for debugging

### Step 2: Region Cropping
```
cropToDataRegion(img, region) → Cropped Image
```
- Removes title bar, tabs, headers, and bottom button
- Focuses only on the data rows
- Reduces noise and OCR errors from UI elements

### Step 3: Grayscale Conversion
```
convertToGrayscale(img) → Gray Image
```
- Simplifies image to single color channel
- Improves OCR accuracy
- Reduces processing time

### Step 4: Contrast Enhancement
```
enhanceContrast(img) → Enhanced Image
```
- Applies histogram equalization
- Makes text more distinct from background
- Improves readability of faded or low-contrast screenshots

### Step 5: Adaptive Thresholding
```
applyAdaptiveThreshold(img, blockSize) → Binary Image
```
- Converts to black/white binary image
- Uses local mean for each pixel region
- Adapts to varying lighting/background colors
- Block size adjusts based on row density (25px standard, 15px for dense text)

### Step 6: Image Inversion
```
invertImage(img) → Inverted Image  
```
- Ensures black text on white background
- Tesseract OCR performs best with this format

### Result
The preprocessed image is then passed to Tesseract OCR with optimized settings:
- Page segmentation mode: PSM_AUTO
- Character whitelist: A-Z, a-z, 0-9, and basic punctuation
- Output: Clean text containing only player names and power values

## Technical Details

### Data Structures

```go
type ImageRegion struct {
    Name   string  // Region identifier
    Top    int     // Y-coordinate of top edge
    Bottom int     // Y-coordinate of bottom edge  
    Left   int     // X-coordinate of left edge
    Right  int     // X-coordinate of right edge
}

type ScreenshotAttributes struct {
    Width          int          // Total image width
    Height         int          // Total image height
    TitleBarRegion *ImageRegion // Title area
    TabsRegion     *ImageRegion // Tab buttons area
    HeaderRegion   *ImageRegion // Column headers area
    DataRegion     *ImageRegion // Player data rows ⭐
    ButtonRegion   *ImageRegion // Bottom navigation area
    RowHeight      int          // Estimated height per row
    EstimatedRows  int          // Expected number of visible rows
}
```

### Function Flow

```
User uploads screenshot
    ↓
extractPowerDataFromImage(imageData)
    ↓
preprocessImageForOCR(imageData)
    ├→ analyzeScreenshot()
    ├→ cropToDataRegion()
    ├→ convertToGrayscale()
    ├→ enhanceContrast()
    ├→ applyAdaptiveThreshold()
    └→ invertImage()
    ↓
Tesseract OCR (gosseract library)
    ↓
parsePowerRankingsText(text)
    ├→ Pattern matching: "R4 Gary6126 73716853"
    ├→ Pattern matching: "Anjel87 57250482"
    ├→ Validation: name length 3-30, power 1M-10B
    └→ Deduplication: skip duplicate names
    ↓
Fuzzy matching with database members
    └→ Levenshtein-like similarity scoring
    ↓
Records saved to database
```

## Advantages of Image Preprocessing

### Before Preprocessing ❌
- OCR attempts to read entire screenshot
- Gets confused by UI elements, buttons, titles
- Low contrast text missed or misread
- Background colors interfere with text detection
- Icons/badges mistaken for characters
- Lower accuracy, more manual corrections needed

### After Preprocessing ✅
- Focuses only on relevant data region
- UI clutter removed completely
- High contrast black-on-white text
- Even lighting across entire image
- Clear text boundaries
- Significantly higher OCR accuracy

## Requirements

### On Linux (Production)
```bash
sudo apt install tesseract-ocr tesseract-ocr-all
sudo apt install libtesseract-dev libleptonica-dev
```

### On Windows (Development)
The image processing uses Go's standard library (`image`, `image/color`, `image/draw`) which works without CGO. However, Tesseract OCR requires CGO:

```bash
# Install MinGW-w64 or TDM-GCC for CGO support
# Then test:
go env CGO_ENABLED  # Should show: 1

# If CGO is disabled, development on Windows won't compile
# Deploy to Linux server for full functionality
```

### Dependencies
- `image` - Standard Go image decoding/encoding
- `image/color` - Color model support
- `image/draw` - Image composition
- `image/png` - PNG encoding for processed images
- `bytes` - Buffer management for image data
- `github.com/otiai10/gosseract/v2` - Tesseract OCR bindings (requires CGO)

## Usage Example

1. Take a screenshot of the Power Rankings screen in Last War: Survival
2. Navigate to Settings page in the Alliance Manager
3. Click the "📷 Image Upload" tab
4. Upload the screenshot
5. Click "🔍 Process Image with OCR"
6. The system will:
   - Analyze the screenshot structure
   - Crop to data region
   - Enhance for optimal OCR
   - Extract player names and power values
   - Match to database members (with fuzzy matching)
   - Save records to power history

## Logging & Debugging

The system logs detailed information at each stage:

```
[INFO] Screenshot Analysis: 1080x1920, DataRegion: (0,250) to (1080,1650), Est. Rows: 10
[INFO] Cropped image from (0,0)-(1080,1920) to (0,0)-(1080,1400)
[INFO] Image preprocessed: 1080x1920 -> 1080x1400
[INFO] OCR extracted text:
7 dvdAlbert91 50914631
8 Nutty Tx 49758621
9 WoodWould 49359118
...
---END OCR---
[INFO] Parsed: dvdAlbert91 -> 50914631
[INFO] ✓ Fuzzy matched 'dvdAlbert' to 'dvdAlbert91' (score: 92%)
```

## Future Enhancements

Potential improvements for even better accuracy:

1. **Template Matching**: Detect rank badges (R3, R4) visually to verify text OCR
2. **Icon Detection**: Use player icons to help identify row boundaries
3. **Multi-language Support**: Add language packs for non-English game versions
4. **Confidence Scoring**: Report OCR confidence per record
5. **Auto-rotation**: Detect and correct tilted/rotated screenshots
6. **Batch Processing**: Upload multiple screenshots at once
7. **Machine Learning**: Train a model to specifically recognize Last War UI fonts

---

**Result**: The image recognition system automatically filters out UI elements and enhances the relevant data before OCR, dramatically improving accuracy and reducing manual corrections needed.
