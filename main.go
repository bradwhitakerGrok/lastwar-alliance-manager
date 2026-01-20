package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

type Member struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Rank string `json:"rank"`
}

type MemberStats struct {
	ID                   int     `json:"id"`
	Name                 string  `json:"name"`
	Rank                 string  `json:"rank"`
	ConductorCount       int     `json:"conductor_count"`
	LastConductorDate    *string `json:"last_conductor_date"`
	BackupCount          int     `json:"backup_count"`
	BackupUsedCount      int     `json:"backup_used_count"`
	ConductorNoShowCount int     `json:"conductor_no_show_count"`
}

type User struct {
	ID       int
	Username string
	Password string
	MemberID *int
	IsAdmin  bool
}

type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type TrainSchedule struct {
	ID                int     `json:"id"`
	Date              string  `json:"date"`
	ConductorID       int     `json:"conductor_id"`
	ConductorName     string  `json:"conductor_name"`
	ConductorScore    *int    `json:"conductor_score"`
	BackupID          int     `json:"backup_id"`
	BackupName        string  `json:"backup_name"`
	BackupRank        string  `json:"backup_rank"`
	ConductorShowedUp *bool   `json:"conductor_showed_up"`
	Notes             *string `json:"notes"`
	CreatedAt         string  `json:"created_at"`
}

type Award struct {
	ID         int    `json:"id"`
	WeekDate   string `json:"week_date"`
	AwardType  string `json:"award_type"`
	Rank       int    `json:"rank"`
	MemberID   int    `json:"member_id"`
	MemberName string `json:"member_name"`
	CreatedAt  string `json:"created_at"`
}

type Recommendation struct {
	ID              int    `json:"id"`
	MemberID        int    `json:"member_id"`
	MemberName      string `json:"member_name"`
	MemberRank      string `json:"member_rank"`
	RecommendedBy   string `json:"recommended_by"`
	RecommendedByID int    `json:"recommended_by_id"`
	Notes           string `json:"notes"`
	CreatedAt       string `json:"created_at"`
}

type WeekAwards struct {
	WeekDate string             `json:"week_date"`
	Awards   map[string][]Award `json:"awards"`
}

type Settings struct {
	ID                           int    `json:"id"`
	AwardFirstPoints             int    `json:"award_first_points"`
	AwardSecondPoints            int    `json:"award_second_points"`
	AwardThirdPoints             int    `json:"award_third_points"`
	RecommendationPoints         int    `json:"recommendation_points"`
	RecentConductorPenaltyDays   int    `json:"recent_conductor_penalty_days"`
	AboveAverageConductorPenalty int    `json:"above_average_conductor_penalty"`
	R4R5RankBoost                int    `json:"r4r5_rank_boost"`
	FirstTimeConductorBoost      int    `json:"first_time_conductor_boost"`
	ScheduleMessageTemplate      string `json:"schedule_message_template"`
	DailyMessageTemplate         string `json:"daily_message_template"`
}

type MemberRanking struct {
	Member                  Member        `json:"member"`
	TotalScore              int           `json:"total_score"`
	AwardPoints             int           `json:"award_points"`
	RecommendationPoints    int           `json:"recommendation_points"`
	RecentConductorPenalty  int           `json:"recent_conductor_penalty"`
	AboveAveragePenalty     int           `json:"above_average_penalty"`
	RankBoost               int           `json:"rank_boost"`
	FirstTimeConductorBoost int           `json:"first_time_conductor_boost"`
	ConductorCount          int           `json:"conductor_count"`
	LastConductorDate       *string       `json:"last_conductor_date"`
	DaysSinceLastConductor  *int          `json:"days_since_last_conductor"`
	AwardDetails            []AwardDetail `json:"award_details"`
	RecommendationCount     int           `json:"recommendation_count"`
}

type AwardDetail struct {
	AwardType string `json:"award_type"`
	Rank      int    `json:"rank"`
	Points    int    `json:"points"`
}

type StormAssignment struct {
	ID         int    `json:"id"`
	TaskForce  string `json:"task_force"`
	BuildingID string `json:"building_id"`
	MemberID   int    `json:"member_id"`
	Position   int    `json:"position"`
}

type DetectedMember struct {
	Name         string   `json:"name"`
	Rank         string   `json:"rank"`
	IsNew        bool     `json:"is_new"`
	RankChanged  bool     `json:"rank_changed"`
	OldRank      string   `json:"old_rank,omitempty"`
	SimilarMatch []string `json:"similar_match,omitempty"`
}

type RenameInfo struct {
	OldName string `json:"old_name"`
	NewName string `json:"new_name"`
}

type MemberToRemove struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Rank string `json:"rank"`
}

type ConfirmRequest struct {
	Members         []DetectedMember `json:"members"`
	RemoveMemberIDs []int            `json:"remove_member_ids"`
	Renames         []RenameInfo     `json:"renames"`
}

type ConfirmResult struct {
	Added     int `json:"added"`
	Updated   int `json:"updated"`
	Unchanged int `json:"unchanged"`
	Removed   int `json:"removed"`
}

var db *sql.DB
var store *sessions.CookieStore

// Calculate Levenshtein distance between two strings
func levenshteinDistance(s1, s2 string) int {
	s1Lower := strings.ToLower(s1)
	s2Lower := strings.ToLower(s2)
	len1 := len(s1Lower)
	len2 := len(s2Lower)

	if len1 == 0 {
		return len2
	}
	if len2 == 0 {
		return len1
	}

	matrix := make([][]int, len1+1)
	for i := range matrix {
		matrix[i] = make([]int, len2+1)
		matrix[i][0] = i
	}
	for j := 0; j <= len2; j++ {
		matrix[0][j] = j
	}

	for i := 1; i <= len1; i++ {
		for j := 1; j <= len2; j++ {
			cost := 0
			if s1Lower[i-1] != s2Lower[j-1] {
				cost = 1
			}
			matrix[i][j] = min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+cost)
		}
	}
	return matrix[len1][len2]
}

func min(nums ...int) int {
	if len(nums) == 0 {
		return 0
	}
	minNum := nums[0]
	for _, n := range nums[1:] {
		if n < minNum {
			minNum = n
		}
	}
	return minNum
}

// Check if two names are similar (case-insensitive)
func areSimilar(name1, name2 string) bool {
	if strings.EqualFold(name1, name2) {
		return false // Exact match, not similar but same
	}

	// Calculate similarity (case-insensitive)
	lower1 := strings.ToLower(name1)
	lower2 := strings.ToLower(name2)
	dist := levenshteinDistance(lower1, lower2)
	maxLen := max(len(lower1), len(lower2))
	similarity := 1.0 - float64(dist)/float64(maxLen)

	// Consider similar if:
	// 1. Similarity >= 70%
	// 2. Distance <= 3 characters
	// 3. One name contains the other (for abbreviations like IRA vs IRAQ Army)
	if similarity >= 0.7 || dist <= 3 {
		return true
	}

	// Check if one name contains significant part of another
	name1Lower := strings.ToLower(name1)
	name2Lower := strings.ToLower(name2)
	if strings.Contains(name1Lower, name2Lower) || strings.Contains(name2Lower, name1Lower) {
		if len(name1) >= 3 && len(name2) >= 3 {
			return true
		}
	}

	return false
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// initSessionStore initializes the session store with secure settings
func initSessionStore() {
	// Get session key from environment or generate a secure one
	sessionKey := os.Getenv("SESSION_KEY")
	if sessionKey == "" {
		// Generate a random 32-byte key for development
		key := make([]byte, 32)
		rand.Read(key)
		sessionKey = hex.EncodeToString(key)
		log.Println("WARNING: No SESSION_KEY environment variable set. Using generated key (not persistent across restarts).")
		log.Printf("For production, set SESSION_KEY environment variable. Example: export SESSION_KEY=%s", sessionKey)
	}

	// Decode hex key
	key, err := hex.DecodeString(sessionKey)
	if err != nil || len(key) != 32 {
		// Fallback: use the string directly if not valid hex
		key = []byte(sessionKey)
		if len(key) < 32 {
			// Pad to 32 bytes
			padded := make([]byte, 32)
			copy(padded, key)
			key = padded
		}
	}

	store = sessions.NewCookieStore(key[:32])

	// Configure secure cookie options
	// Check if we're running in production (HTTPS)
	isProduction := os.Getenv("PRODUCTION") == "true" || os.Getenv("HTTPS") == "true"

	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400,                   // 24 hours
		HttpOnly: true,                    // Prevent JavaScript access
		Secure:   isProduction,            // Only send over HTTPS in production
		SameSite: http.SameSiteStrictMode, // CSRF protection
	}

	if isProduction {
		log.Println("Session cookies configured for HTTPS (Secure flag enabled)")
	} else {
		log.Println("Session cookies configured for HTTP (development mode)")
	}
}

// RankingContext holds all data needed for ranking calculations
type RankingContext struct {
	Settings          Settings
	RecommendationMap map[int]int // memberID -> count
	AwardScoreMap     map[int]int // memberID -> total points
	ConductorStats    map[int]ConductorStat
	AvgConductorCount float64
	ReferenceDate     time.Time
}

type ConductorStat struct {
	Count          int
	LastDate       *string
	LastBackupUsed *string
}

// loadSettings loads the settings from the database
func loadSettings() (Settings, error) {
	var settings Settings
	err := db.QueryRow(`SELECT id, award_first_points, award_second_points, award_third_points, 
		recommendation_points, recent_conductor_penalty_days, above_average_conductor_penalty, r4r5_rank_boost,
		first_time_conductor_boost, schedule_message_template, daily_message_template 
		FROM settings WHERE id = 1`).Scan(
		&settings.ID,
		&settings.AwardFirstPoints,
		&settings.AwardSecondPoints,
		&settings.AwardThirdPoints,
		&settings.RecommendationPoints,
		&settings.RecentConductorPenaltyDays,
		&settings.AboveAverageConductorPenalty,
		&settings.R4R5RankBoost,
		&settings.FirstTimeConductorBoost,
		&settings.ScheduleMessageTemplate,
		&settings.DailyMessageTemplate,
	)
	return settings, err
}

// loadRecommendations loads recommendation counts for all members
func loadRecommendations() (map[int]int, error) {
	rows, err := db.Query(`
		SELECT member_id, COUNT(*) as rec_count
		FROM recommendations
		GROUP BY member_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	recommendationMap := make(map[int]int)
	for rows.Next() {
		var memberID, count int
		if err := rows.Scan(&memberID, &count); err != nil {
			return nil, err
		}
		recommendationMap[memberID] = count
	}
	return recommendationMap, nil
}

// loadAwards loads award scores for all members from a specific week
func loadAwards(weekDate string, settings Settings) (map[int]int, error) {
	rows, err := db.Query(`
		SELECT member_id, rank
		FROM awards
		WHERE week_date = ?
	`, weekDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	awardScoreMap := make(map[int]int)
	for rows.Next() {
		var memberID, rank int
		if err := rows.Scan(&memberID, &rank); err != nil {
			return nil, err
		}
		switch rank {
		case 1:
			awardScoreMap[memberID] += settings.AwardFirstPoints
		case 2:
			awardScoreMap[memberID] += settings.AwardSecondPoints
		case 3:
			awardScoreMap[memberID] += settings.AwardThirdPoints
		}
	}
	return awardScoreMap, nil
}

// loadConductorStats loads conductor statistics for all members
func loadConductorStats() (map[int]ConductorStat, float64, error) {
	rows, err := db.Query(`
		SELECT conductor_id, COUNT(*) as conductor_count, MAX(date) as last_date
		FROM train_schedules
		GROUP BY conductor_id
	`)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	conductorStats := make(map[int]ConductorStat)
	totalConductorCount := 0
	memberCount := 0

	for rows.Next() {
		var memberID, count int
		var lastDate sql.NullString
		if err := rows.Scan(&memberID, &count, &lastDate); err != nil {
			return nil, 0, err
		}
		var lastDatePtr *string
		if lastDate.Valid {
			lastDatePtr = &lastDate.String
		}
		conductorStats[memberID] = ConductorStat{
			Count:    count,
			LastDate: lastDatePtr,
		}
		totalConductorCount += count
		memberCount++
	}

	// Load backup usage dates (when conductor didn't show up)
	backupRows, err := db.Query(`
		SELECT backup_id, MAX(date) as last_backup_used
		FROM train_schedules
		WHERE conductor_showed_up = 0
		GROUP BY backup_id
	`)
	if err != nil {
		return nil, 0, err
	}
	defer backupRows.Close()

	for backupRows.Next() {
		var memberID int
		var lastBackupUsed sql.NullString
		if err := backupRows.Scan(&memberID, &lastBackupUsed); err != nil {
			return nil, 0, err
		}
		var lastBackupUsedPtr *string
		if lastBackupUsed.Valid {
			lastBackupUsedPtr = &lastBackupUsed.String
		}

		// Update existing stat or create new one
		if stat, exists := conductorStats[memberID]; exists {
			stat.LastBackupUsed = lastBackupUsedPtr
			conductorStats[memberID] = stat
		} else {
			conductorStats[memberID] = ConductorStat{
				Count:          0,
				LastDate:       nil,
				LastBackupUsed: lastBackupUsedPtr,
			}
		}
	}

	var avgConductorCount float64
	if memberCount > 0 {
		avgConductorCount = float64(totalConductorCount) / float64(memberCount)
	}

	return conductorStats, avgConductorCount, nil
}

// buildRankingContext creates a complete ranking context for calculations
func buildRankingContext(referenceDate time.Time) (*RankingContext, error) {
	settings, err := loadSettings()
	if err != nil {
		return nil, err
	}

	recommendationMap, err := loadRecommendations()
	if err != nil {
		return nil, err
	}

	// Get awards from previous week (Monday of reference week - 7 days)
	weekStart := getMondayOfWeek(referenceDate)
	prevWeek := weekStart.AddDate(0, 0, -7)
	prevWeekStr := formatDateString(prevWeek)
	awardScoreMap, err := loadAwards(prevWeekStr, settings)
	if err != nil {
		return nil, err
	}

	conductorStats, avgConductorCount, err := loadConductorStats()
	if err != nil {
		return nil, err
	}

	return &RankingContext{
		Settings:          settings,
		RecommendationMap: recommendationMap,
		AwardScoreMap:     awardScoreMap,
		ConductorStats:    conductorStats,
		AvgConductorCount: avgConductorCount,
		ReferenceDate:     referenceDate,
	}, nil
}

// calculateMemberScore calculates the ranking score for a member
func calculateMemberScore(member Member, ctx *RankingContext) int {
	score := 0

	// Add recommendation points
	score += ctx.RecommendationMap[member.ID] * ctx.Settings.RecommendationPoints

	// Add award points
	score += ctx.AwardScoreMap[member.ID]

	// Add rank boost for R4/R5 members
	if member.Rank == "R4" || member.Rank == "R5" {
		score += ctx.Settings.R4R5RankBoost
	}

	// Add first time conductor boost if member has never been conductor and has some points
	if stats, exists := ctx.ConductorStats[member.ID]; !exists || stats.Count == 0 {
		// Only give boost if they have some positive score (awards, recommendations, or rank boost)
		if score > 0 {
			score += ctx.Settings.FirstTimeConductorBoost
		}
	}

	// Apply conductor-based penalties
	if stats, exists := ctx.ConductorStats[member.ID]; exists {
		// Penalize if above average conductor count
		if float64(stats.Count) > ctx.AvgConductorCount {
			score -= ctx.Settings.AboveAverageConductorPenalty
		}

		// Penalize recent conductors - check both conductor date and backup used date
		var mostRecentDate *time.Time

		if stats.LastDate != nil {
			if lastDate, err := parseDate(*stats.LastDate); err == nil {
				mostRecentDate = &lastDate
			}
		}

		// If they stepped in as backup, check if that's more recent
		if stats.LastBackupUsed != nil {
			if backupDate, err := parseDate(*stats.LastBackupUsed); err == nil {
				if mostRecentDate == nil || backupDate.After(*mostRecentDate) {
					mostRecentDate = &backupDate
				}
			}
		}

		// Apply penalty based on most recent duty (conductor or backup usage)
		if mostRecentDate != nil {
			daysSince := int(ctx.ReferenceDate.Sub(*mostRecentDate).Hours() / 24)
			penalty := ctx.Settings.RecentConductorPenaltyDays - daysSince
			if penalty > 0 {
				score -= penalty
			}
		}
	}

	return score
}

func initDB() error {
	var err error

	// Use DATABASE_PATH environment variable if set, otherwise use local path
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./alliance.db"
	}

	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	// Create members table
	createMembersTableSQL := `CREATE TABLE IF NOT EXISTS members (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		rank TEXT NOT NULL
	);`

	_, err = db.Exec(createMembersTableSQL)
	if err != nil {
		return err
	}

	// Create users table
	createUsersTableSQL := `CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password TEXT NOT NULL,
		member_id INTEGER,
		is_admin BOOLEAN DEFAULT 0,
		FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
	);`

	_, err = db.Exec(createUsersTableSQL)
	if err != nil {
		return err
	}

	// Create train_schedules table
	createTrainSchedulesSQL := `CREATE TABLE IF NOT EXISTS train_schedules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL UNIQUE,
		conductor_id INTEGER NOT NULL,
		backup_id INTEGER NOT NULL,
		conductor_score INTEGER,
		conductor_showed_up BOOLEAN,
		notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (conductor_id) REFERENCES members(id) ON DELETE CASCADE,
		FOREIGN KEY (backup_id) REFERENCES members(id) ON DELETE CASCADE
	);`

	_, err = db.Exec(createTrainSchedulesSQL)
	if err != nil {
		return err
	}

	// Migrate existing train_schedules table to add conductor_score column if missing
	var columnExists bool
	err = db.QueryRow(`
		SELECT COUNT(*) > 0
		FROM pragma_table_info('train_schedules')
		WHERE name = 'conductor_score'
	`).Scan(&columnExists)
	if err != nil {
		return err
	}

	if !columnExists {
		_, err = db.Exec(`ALTER TABLE train_schedules ADD COLUMN conductor_score INTEGER`)
		if err != nil {
			return err
		}
		log.Println("Database migration: Added conductor_score column to train_schedules table")
	}

	// Create awards table
	createAwardsSQL := `CREATE TABLE IF NOT EXISTS awards (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		week_date TEXT NOT NULL,
		award_type TEXT NOT NULL,
		rank INTEGER NOT NULL,
		member_id INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
		UNIQUE(week_date, award_type, rank)
	);`

	_, err = db.Exec(createAwardsSQL)
	if err != nil {
		return err
	}

	// Create recommendations table
	createRecommendationsSQL := `CREATE TABLE IF NOT EXISTS recommendations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		member_id INTEGER NOT NULL,
		recommended_by_id INTEGER NOT NULL,
		notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
		FOREIGN KEY (recommended_by_id) REFERENCES users(id) ON DELETE CASCADE
	);`

	_, err = db.Exec(createRecommendationsSQL)
	if err != nil {
		return err
	}

	// Create settings table
	createSettingsSQL := `CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		award_first_points INTEGER NOT NULL DEFAULT 3,
		award_second_points INTEGER NOT NULL DEFAULT 2,
		award_third_points INTEGER NOT NULL DEFAULT 1,
		recommendation_points INTEGER NOT NULL DEFAULT 10,
		recent_conductor_penalty_days INTEGER NOT NULL DEFAULT 30,
		above_average_conductor_penalty INTEGER NOT NULL DEFAULT 10,
		r4r5_rank_boost INTEGER NOT NULL DEFAULT 5,
		first_time_conductor_boost INTEGER NOT NULL DEFAULT 5,
		schedule_message_template TEXT NOT NULL DEFAULT 'Train Schedule - Week {WEEK}\n\n{SCHEDULES}\n\nNext in line:\n{NEXT_3}'
	);`

	_, err = db.Exec(createSettingsSQL)
	if err != nil {
		return err
	}

	// Create storm assignments table
	createStormAssignmentsSQL := `CREATE TABLE IF NOT EXISTS storm_assignments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		task_force TEXT NOT NULL CHECK (task_force IN ('A', 'B')),
		building_id TEXT NOT NULL,
		member_id INTEGER NOT NULL,
		position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
		FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
		UNIQUE(task_force, building_id, position)
	);`

	_, err = db.Exec(createStormAssignmentsSQL)
	if err != nil {
		return err
	}

	// Initialize default settings if not exist
	var settingsCount int
	err = db.QueryRow("SELECT COUNT(*) FROM settings").Scan(&settingsCount)
	if err != nil {
		return err
	}

	if settingsCount == 0 {
		_, err = db.Exec(`INSERT INTO settings (id, award_first_points, award_second_points, award_third_points, 
			recommendation_points, recent_conductor_penalty_days, above_average_conductor_penalty, r4r5_rank_boost, 
			first_time_conductor_boost, schedule_message_template) 
			VALUES (1, 3, 2, 1, 10, 30, 10, 5, 5, 'Train Schedule - Week {WEEK}\n\n{SCHEDULES}\n\nNext in line:\n{NEXT_3}')`)
		if err != nil {
			return err
		}
		log.Println("Default settings initialized")
	}

	// Migrate settings table to add r4r5_rank_boost column if missing
	var rankBoostColumnExists bool
	err = db.QueryRow(`
		SELECT COUNT(*) > 0
		FROM pragma_table_info('settings')
		WHERE name = 'r4r5_rank_boost'
	`).Scan(&rankBoostColumnExists)
	if err != nil {
		return err
	}

	if !rankBoostColumnExists {
		_, err = db.Exec(`ALTER TABLE settings ADD COLUMN r4r5_rank_boost INTEGER NOT NULL DEFAULT 5`)
		if err != nil {
			return err
		}
		log.Println("Database migration: Added r4r5_rank_boost column to settings table")
	}

	// Migrate settings table to add schedule_message_template column if missing
	var scheduleTemplateColumnExists bool
	err = db.QueryRow(`
		SELECT COUNT(*) > 0
		FROM pragma_table_info('settings')
		WHERE name = 'schedule_message_template'
	`).Scan(&scheduleTemplateColumnExists)
	if err != nil {
		return err
	}

	if !scheduleTemplateColumnExists {
		_, err = db.Exec(`ALTER TABLE settings ADD COLUMN schedule_message_template TEXT NOT NULL DEFAULT 'Train Schedule - Week {WEEK}

{SCHEDULES}

Next in line:
{NEXT_3}'`)
		if err != nil {
			return err
		}
		log.Println("Database migration: Added schedule_message_template column to settings table")
	}

	// Migrate settings table to add first_time_conductor_boost column if missing
	var firstTimeBoostColumnExists bool
	err = db.QueryRow(`
		SELECT COUNT(*) > 0
		FROM pragma_table_info('settings')
		WHERE name = 'first_time_conductor_boost'
	`).Scan(&firstTimeBoostColumnExists)
	if err != nil {
		return err
	}

	if !firstTimeBoostColumnExists {
		_, err = db.Exec(`ALTER TABLE settings ADD COLUMN first_time_conductor_boost INTEGER NOT NULL DEFAULT 5`)
		if err != nil {
			return err
		}
		log.Println("Database migration: Added first_time_conductor_boost column to settings table")
	}

	// Migrate settings table to add daily_message_template column if missing
	var dailyTemplateColumnExists bool
	err = db.QueryRow(`
		SELECT COUNT(*) > 0
		FROM pragma_table_info('settings')
		WHERE name = 'daily_message_template'
	`).Scan(&dailyTemplateColumnExists)
	if err != nil {
		return err
	}

	if !dailyTemplateColumnExists {
		defaultDailyTemplate := `ALL ABOARD! Daily Train Assignment

Date: {DATE}

Today's Conductor: {CONDUCTOR_NAME} ({CONDUCTOR_RANK})
Backup Engineer: {BACKUP_NAME} ({BACKUP_RANK})

DEPARTURE SCHEDULE:
- 15:00 ST (17:00 UK) - Conductor {CONDUCTOR_NAME}, please request train assignment in alliance chat
- 16:30 ST (18:30 UK) - If conductor hasn't shown up, Backup {BACKUP_NAME} takes over and assigns train to themselves

Remember: Communication is key! Let the alliance know if you can't make it.

All aboard for another successful run!`
		// Add column without default first
		_, err = db.Exec(`ALTER TABLE settings ADD COLUMN daily_message_template TEXT`)
		if err != nil {
			return err
		}
		// Then update existing row with the default value
		_, err = db.Exec(`UPDATE settings SET daily_message_template = ? WHERE id = 1`, defaultDailyTemplate)
		if err != nil {
			return err
		}
		log.Println("Database migration: Added daily_message_template column to settings table")
	}

	// Create default admin user if no users exist
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		// Default credentials: admin/admin123
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		_, err = db.Exec("INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)", "admin", string(hashedPassword), true)
		if err != nil {
			return err
		}
		log.Println("Default admin user created - Username: admin, Password: admin123")
	}

	return nil
}

// Authentication middleware
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "session")
		if auth, ok := session.Values["authenticated"].(bool); !ok || !auth {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

// Permission middleware - only R4/R5 or admin can manage ranks
func rankManagementMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "session")

		// Check if admin
		if isAdmin, ok := session.Values["is_admin"].(bool); ok && isAdmin {
			next(w, r)
			return
		}

		// Check if member has R4 or R5 rank
		if memberID, ok := session.Values["member_id"].(int); ok {
			var rank string
			err := db.QueryRow("SELECT rank FROM members WHERE id = ?", memberID).Scan(&rank)
			if err == nil && (rank == "R4" || rank == "R5") {
				next(w, r)
				return
			}
		}

		http.Error(w, "Forbidden: Only R4/R5 members can manage ranks", http.StatusForbidden)
	}
}

// Permission middleware - only R5 or admin
func adminR5Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "session")

		// Check if admin
		if isAdmin, ok := session.Values["is_admin"].(bool); ok && isAdmin {
			next(w, r)
			return
		}

		// Check if member has R5 rank
		if memberID, ok := session.Values["member_id"].(int); ok {
			var rank string
			err := db.QueryRow("SELECT rank FROM members WHERE id = ?", memberID).Scan(&rank)
			if err == nil && rank == "R5" {
				next(w, r)
				return
			}
		}

		http.Error(w, "Forbidden: Only R5 members and admins can perform this action", http.StatusForbidden)
	}
}

// Login handler
func login(w http.ResponseWriter, r *http.Request) {
	var creds Credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var user User
	var memberID sql.NullInt64
	var isAdmin sql.NullBool
	err := db.QueryRow("SELECT id, username, password, member_id, is_admin FROM users WHERE username = ?", creds.Username).Scan(&user.ID, &user.Username, &user.Password, &memberID, &isAdmin)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if memberID.Valid {
		mid := int(memberID.Int64)
		user.MemberID = &mid
	}
	user.IsAdmin = isAdmin.Valid && isAdmin.Bool

	// Compare password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(creds.Password))
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Create session
	session, _ := store.Get(r, "session")
	session.Values["authenticated"] = true
	session.Values["username"] = user.Username
	session.Values["user_id"] = user.ID
	if user.MemberID != nil {
		session.Values["member_id"] = *user.MemberID
	}
	session.Values["is_admin"] = user.IsAdmin
	session.Save(r, w)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"message": "Login successful", "username": user.Username})
}

// Logout handler
func logout(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, "session")
	session.Values["authenticated"] = false
	session.Options.MaxAge = -1
	session.Save(r, w)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Logout successful"})
}

// Change password handler
func changePassword(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, "session")
	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var input struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(input.NewPassword) < 6 {
		http.Error(w, "New password must be at least 6 characters", http.StatusBadRequest)
		return
	}

	// Get current password hash
	var currentHash string
	err := db.QueryRow("SELECT password FROM users WHERE id = ?", userID).Scan(&currentHash)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Verify current password
	err = bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(input.CurrentPassword))
	if err != nil {
		http.Error(w, "Current password is incorrect", http.StatusUnauthorized)
		return
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// Update password
	_, err = db.Exec("UPDATE users SET password = ? WHERE id = ?", string(newHash), userID)
	if err != nil {
		http.Error(w, "Failed to update password", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password changed successfully"})
}

// Generate random alphanumeric password
func generateRandomPassword(length int) (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	password := make([]byte, length)
	for i := range password {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		password[i] = charset[num.Int64()]
	}
	return string(password), nil
}

// Create user for member
func createUserForMember(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	memberID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid member ID", http.StatusBadRequest)
		return
	}

	// Check if member exists
	var memberName string
	err = db.QueryRow("SELECT name FROM members WHERE id = ?", memberID).Scan(&memberName)
	if err != nil {
		http.Error(w, "Member not found", http.StatusNotFound)
		return
	}

	// Check if user already exists for this member
	var existingUserID int
	err = db.QueryRow("SELECT id FROM users WHERE member_id = ?", memberID).Scan(&existingUserID)
	if err == nil {
		http.Error(w, "User already exists for this member", http.StatusConflict)
		return
	}

	// Generate random password
	randomPassword, err := generateRandomPassword(10)
	if err != nil {
		http.Error(w, "Failed to generate password", http.StatusInternalServerError)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(randomPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// Create username from member name (lowercase, no spaces)
	username := strings.ToLower(strings.ReplaceAll(memberName, " ", ""))

	// Check if username already exists, if so, append member ID
	var existingUsername string
	err = db.QueryRow("SELECT username FROM users WHERE username = ?", username).Scan(&existingUsername)
	if err == nil {
		username = username + strconv.Itoa(memberID)
	}

	// Insert user
	_, err = db.Exec("INSERT INTO users (username, password, member_id, is_admin) VALUES (?, ?, ?, ?)",
		username, string(hashedPassword), memberID, false)
	if err != nil {
		http.Error(w, "Failed to create user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":  "User created successfully",
		"username": username,
		"password": randomPassword,
	})
}

// Check auth status
func checkAuth(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, "session")
	if auth, ok := session.Values["authenticated"].(bool); ok && auth {
		username := session.Values["username"].(string)
		isAdmin := false
		if adminVal, ok := session.Values["is_admin"].(bool); ok {
			isAdmin = adminVal
		}

		var rank string
		var canManageRanks bool

		if isAdmin {
			rank = "Admin"
			canManageRanks = true
		} else if memberID, ok := session.Values["member_id"].(int); ok {
			// Get member's rank
			err := db.QueryRow("SELECT rank FROM members WHERE id = ?", memberID).Scan(&rank)
			if err == nil {
				canManageRanks = (rank == "R4" || rank == "R5")
			}
		}

		// Check if user is R5 or admin (for more sensitive operations)
		isR5OrAdmin := isAdmin
		if !isR5OrAdmin && rank == "R5" {
			isR5OrAdmin = true
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated":    true,
			"username":         username,
			"rank":             rank,
			"is_admin":         isAdmin,
			"can_manage_ranks": canManageRanks,
			"is_r5_or_admin":   isR5OrAdmin,
		})
	} else {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"authenticated": false})
	}
}

// Get all members
func getMembers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, name, rank FROM members ORDER BY name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	members := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Name, &m.Rank); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		members = append(members, m)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

// Get member statistics for train scheduling
func getMemberStats(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT 
			m.id, 
			m.name, 
			m.rank,
			COUNT(DISTINCT CASE WHEN ts.conductor_id = m.id THEN ts.date END) as conductor_count,
			MAX(CASE WHEN ts.conductor_id = m.id THEN ts.date END) as last_conductor_date,
			COUNT(DISTINCT CASE WHEN ts.backup_id = m.id THEN ts.date END) as backup_count,
			COUNT(DISTINCT CASE WHEN ts.backup_id = m.id AND ts.conductor_showed_up = 0 THEN ts.date END) as backup_used_count,
			COUNT(DISTINCT CASE WHEN ts.conductor_id = m.id AND ts.conductor_showed_up = 0 THEN ts.date END) as conductor_no_show_count
		FROM members m
		LEFT JOIN train_schedules ts ON ts.conductor_id = m.id OR ts.backup_id = m.id
		GROUP BY m.id, m.name, m.rank
		ORDER BY m.name
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	stats := []MemberStats{}
	for rows.Next() {
		var s MemberStats
		var lastDate sql.NullString
		if err := rows.Scan(&s.ID, &s.Name, &s.Rank, &s.ConductorCount, &lastDate, &s.BackupCount, &s.BackupUsedCount, &s.ConductorNoShowCount); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if lastDate.Valid {
			s.LastConductorDate = &lastDate.String
		}
		stats = append(stats, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// Create a new member
func createMember(w http.ResponseWriter, r *http.Request) {
	var m Member
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := db.Exec("INSERT INTO members (name, rank) VALUES (?, ?)", m.Name, m.Rank)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	m.ID = int(id)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(m)
}

// Update a member
func updateMember(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid member ID", http.StatusBadRequest)
		return
	}

	var m Member
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = db.Exec("UPDATE members SET name = ?, rank = ? WHERE id = ?", m.Name, m.Rank, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	m.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}

// Delete a member
func deleteMember(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid member ID", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("DELETE FROM members WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Get train schedules (optionally filtered by date range)
func getTrainSchedules(w http.ResponseWriter, r *http.Request) {
	startDate := r.URL.Query().Get("start")
	endDate := r.URL.Query().Get("end")

	query := `
		SELECT 
			ts.id, ts.date, ts.conductor_id, m1.name as conductor_name,
			ts.conductor_score, ts.backup_id, m2.name as backup_name, m2.rank as backup_rank,
			ts.conductor_showed_up, ts.notes, ts.created_at
		FROM train_schedules ts
		JOIN members m1 ON ts.conductor_id = m1.id
		JOIN members m2 ON ts.backup_id = m2.id
	`

	var rows *sql.Rows
	var err error

	if startDate != "" && endDate != "" {
		query += " WHERE ts.date BETWEEN ? AND ? ORDER BY ts.date, ts.conductor_score DESC"
		rows, err = db.Query(query, startDate, endDate)
	} else {
		query += " ORDER BY ts.date, ts.conductor_score DESC"
		rows, err = db.Query(query)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	schedules := []TrainSchedule{}
	for rows.Next() {
		var ts TrainSchedule
		var showedUp sql.NullBool
		var notes sql.NullString
		var score sql.NullInt64

		if err := rows.Scan(&ts.ID, &ts.Date, &ts.ConductorID, &ts.ConductorName,
			&score, &ts.BackupID, &ts.BackupName, &ts.BackupRank, &showedUp, &notes, &ts.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if showedUp.Valid {
			ts.ConductorShowedUp = &showedUp.Bool
		}
		if notes.Valid {
			ts.Notes = &notes.String
		}
		if score.Valid {
			scoreInt := int(score.Int64)
			ts.ConductorScore = &scoreInt
		}

		schedules = append(schedules, ts)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(schedules)
}

// Create a train schedule
func createTrainSchedule(w http.ResponseWriter, r *http.Request) {
	var ts TrainSchedule
	if err := json.NewDecoder(r.Body).Decode(&ts); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate backup is R4 or R5
	var backupRank string
	err := db.QueryRow("SELECT rank FROM members WHERE id = ?", ts.BackupID).Scan(&backupRank)
	if err != nil {
		http.Error(w, "Backup member not found", http.StatusBadRequest)
		return
	}

	if backupRank != "R4" && backupRank != "R5" {
		http.Error(w, "Backup must be an R4 or R5 member", http.StatusBadRequest)
		return
	}

	result, err := db.Exec(
		"INSERT INTO train_schedules (date, conductor_id, backup_id, conductor_score, conductor_showed_up, notes) VALUES (?, ?, ?, ?, ?, ?)",
		ts.Date, ts.ConductorID, ts.BackupID, ts.ConductorScore, ts.ConductorShowedUp, ts.Notes)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			http.Error(w, "Schedule already exists for this date", http.StatusConflict)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	id, _ := result.LastInsertId()
	ts.ID = int(id)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ts)
}

// Update a train schedule
func updateTrainSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid schedule ID", http.StatusBadRequest)
		return
	}

	var ts TrainSchedule
	if err := json.NewDecoder(r.Body).Decode(&ts); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate backup is R4 or R5 if backup is being updated
	if ts.BackupID > 0 {
		var backupRank string
		err := db.QueryRow("SELECT rank FROM members WHERE id = ?", ts.BackupID).Scan(&backupRank)
		if err != nil {
			http.Error(w, "Backup member not found", http.StatusBadRequest)
			return
		}

		if backupRank != "R4" && backupRank != "R5" {
			http.Error(w, "Backup must be an R4 or R5 member", http.StatusBadRequest)
			return
		}
	}

	_, err = db.Exec(
		"UPDATE train_schedules SET date = ?, conductor_id = ?, backup_id = ?, conductor_score = ?, conductor_showed_up = ?, notes = ? WHERE id = ?",
		ts.Date, ts.ConductorID, ts.BackupID, ts.ConductorScore, ts.ConductorShowedUp, ts.Notes, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	ts.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ts)
}

// Delete a train schedule
func deleteTrainSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid schedule ID", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("DELETE FROM train_schedules WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Auto-schedule train conductors and backups for a single day
func autoSchedule(w http.ResponseWriter, r *http.Request) {
	var input struct {
		StartDate string `json:"start_date"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Parse the date and get the week start (Monday)
	scheduleDate, err := parseDate(input.StartDate)
	if err != nil {
		http.Error(w, "Invalid date format", http.StatusBadRequest)
		return
	}

	weekStart := getMondayOfWeek(scheduleDate)

	// Build ranking context
	ctx, err := buildRankingContext(weekStart)
	if err != nil {
		http.Error(w, "Failed to load ranking context: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get all members
	rows, err := db.Query("SELECT id, name, rank FROM members ORDER BY name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var candidates []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Name, &m.Rank); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		candidates = append(candidates, m)
	}

	if len(candidates) < 7 {
		http.Error(w, "Not enough members for weekly scheduling (need at least 7)", http.StatusBadRequest)
		return
	}

	// Score each candidate using the abstracted ranking system
	type ScoredMember struct {
		Member Member
		Score  int
	}

	var scoredCandidates []ScoredMember
	for _, member := range candidates {
		score := calculateMemberScore(member, ctx)
		scoredCandidates = append(scoredCandidates, ScoredMember{
			Member: member,
			Score:  score,
		})
	}

	// Sort by score (highest first)
	for i := 0; i < len(scoredCandidates); i++ {
		for j := i + 1; j < len(scoredCandidates); j++ {
			if scoredCandidates[j].Score > scoredCandidates[i].Score {
				scoredCandidates[i], scoredCandidates[j] = scoredCandidates[j], scoredCandidates[i]
			}
		}
	}

	// Pre-select top 7 performers as conductors for the week
	plannedConductors := make(map[int]bool)
	for i := 0; i < 7 && i < len(scoredCandidates); i++ {
		plannedConductors[scoredCandidates[i].Member.ID] = true
	}

	// Now schedule each day
	var weekSchedules []TrainSchedule
	usedConductors := make(map[int]bool)
	usedBackups := make(map[int]bool)

	for day := 0; day < 7; day++ {
		currentDate := weekStart.AddDate(0, 0, day)
		dateStr := formatDateString(currentDate)

		// Select conductor from top 7 who hasn't been assigned yet
		var conductorID int
		var conductorScore int

		for _, sc := range scoredCandidates {
			if plannedConductors[sc.Member.ID] && !usedConductors[sc.Member.ID] {
				conductorID = sc.Member.ID
				conductorScore = sc.Score
				usedConductors[sc.Member.ID] = true
				break
			}
		}

		if conductorID == 0 {
			http.Error(w, "Unable to assign conductor for all days", http.StatusInternalServerError)
			return
		}

		// Select backup (must be R4/R5, not a planned conductor, not already used as backup)
		var availableBackups []Member
		for _, sc := range scoredCandidates {
			if !plannedConductors[sc.Member.ID] &&
				!usedBackups[sc.Member.ID] &&
				(sc.Member.Rank == "R4" || sc.Member.Rank == "R5") {
				availableBackups = append(availableBackups, sc.Member)
			}
		}

		var backupID int
		if len(availableBackups) > 0 {
			// Randomly select from available backups
			randomIndex := time.Now().UnixNano() % int64(len(availableBackups))
			backupID = availableBackups[randomIndex].ID
			usedBackups[backupID] = true
		}

		if backupID == 0 {
			http.Error(w, "No R4/R5 members available for backup", http.StatusBadRequest)
			return
		}

		// Insert schedule for this day
		result, err := db.Exec(
			"INSERT OR REPLACE INTO train_schedules (date, conductor_id, backup_id, conductor_score) VALUES (?, ?, ?, ?)",
			dateStr, conductorID, backupID, conductorScore,
		)
		if err != nil {
			http.Error(w, "Failed to create schedule: "+err.Error(), http.StatusInternalServerError)
			return
		}

		scheduleID, _ := result.LastInsertId()

		// Get the full schedule details
		var schedule TrainSchedule
		var score sql.NullInt64
		err = db.QueryRow(`
			SELECT 
				ts.id, ts.date, ts.conductor_id, 
				mc.name, ts.conductor_score, ts.backup_id, mb.name, mb.rank,
				ts.conductor_showed_up, ts.notes, ts.created_at
			FROM train_schedules ts
			JOIN members mc ON ts.conductor_id = mc.id
			JOIN members mb ON ts.backup_id = mb.id
			WHERE ts.id = ?
		`, scheduleID).Scan(
			&schedule.ID, &schedule.Date, &schedule.ConductorID,
			&schedule.ConductorName, &score, &schedule.BackupID, &schedule.BackupName,
			&schedule.BackupRank, &schedule.ConductorShowedUp, &schedule.Notes,
			&schedule.CreatedAt,
		)

		if err != nil {
			http.Error(w, "Failed to retrieve schedule: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if score.Valid {
			scoreInt := int(score.Int64)
			schedule.ConductorScore = &scoreInt
		}

		weekSchedules = append(weekSchedules, schedule)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":   "Week scheduled successfully",
		"schedules": weekSchedules,
	})
}

// Helper function to parse date string
func parseDate(dateStr string) (time.Time, error) {
	return time.Parse("2006-01-02", dateStr)
}

// Helper function to format date to string
func formatDateString(t time.Time) string {
	return t.Format("2006-01-02")
}

// Helper function to get Monday of a week
func getMondayOfWeek(date time.Time) time.Time {
	offset := int(time.Monday - date.Weekday())
	if offset > 0 {
		offset = -6
	}
	return date.AddDate(0, 0, offset)
}

// Import members from CSV
func importCSV(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (10MB max)
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, "Failed to parse form data", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Parse CSV
	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1 // Allow variable number of fields

	records, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "Failed to parse CSV: "+err.Error(), http.StatusBadRequest)
		return
	}

	if len(records) == 0 {
		http.Error(w, "CSV file is empty", http.StatusBadRequest)
		return
	}

	// Skip header row if it looks like a header
	startIndex := 0
	if len(records) > 0 {
		firstRow := records[0]
		if len(firstRow) > 0 {
			firstCell := strings.ToLower(strings.TrimSpace(firstRow[0]))
			// Check if first row is a header
			if firstCell == "username" || firstCell == "name" || firstCell == "member" {
				startIndex = 1
			}
		}
	}

	validRanks := map[string]bool{"R1": true, "R2": true, "R3": true, "R4": true, "R5": true}
	detectedMembers := []DetectedMember{}
	errors := []string{}

	// Get existing members
	existingMembers := make(map[string]Member)
	rows, err := db.Query("SELECT id, name, rank FROM members")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var m Member
			rows.Scan(&m.ID, &m.Name, &m.Rank)
			existingMembers[m.Name] = m
		}
	}

	for i := startIndex; i < len(records); i++ {
		record := records[i]

		// New format: Username,Rank,Power,Level,Status,Last_Active
		// We only care about Username (index 0) and Rank (index 1)
		if len(record) < 2 {
			errors = append(errors, fmt.Sprintf("Line %d: Insufficient columns (need at least Username and Rank)", i+1))
			continue
		}

		name := strings.TrimSpace(record[0])
		rank := strings.TrimSpace(record[1])

		if name == "" {
			errors = append(errors, fmt.Sprintf("Line %d: Empty username", i+1))
			continue
		}

		if !validRanks[rank] {
			errors = append(errors, fmt.Sprintf("Line %d: Invalid rank '%s' (must be R1-R5)", i+1, rank))
			continue
		}

		detected := DetectedMember{
			Name: name,
			Rank: rank,
		}

		// Check if member exists
		if existing, found := existingMembers[name]; found {
			// Existing member - check for rank change
			if existing.Rank != rank {
				detected.RankChanged = true
				detected.OldRank = existing.Rank
			}
		} else {
			// New member - check for similar names in existing members
			detected.IsNew = true
			similarNames := []string{}
			for existingName := range existingMembers {
				if areSimilar(name, existingName) {
					similarNames = append(similarNames, existingName)
				}
			}
			if len(similarNames) > 0 {
				detected.SimilarMatch = similarNames
			}
		}

		detectedMembers = append(detectedMembers, detected)
	}

	// Find members that would be removed (in database but not in CSV)
	membersToRemove := []MemberToRemove{}
	csvNames := make(map[string]bool)
	for _, m := range detectedMembers {
		csvNames[m.Name] = true
	}
	for _, existing := range existingMembers {
		if !csvNames[existing.Name] {
			membersToRemove = append(membersToRemove, MemberToRemove{
				ID:   existing.ID,
				Name: existing.Name,
				Rank: existing.Rank,
			})
		}
	}

	// Return preview data
	result := map[string]interface{}{
		"detected_members":  detectedMembers,
		"members_to_remove": membersToRemove,
		"errors":            errors,
		"total_rows":        len(records) - startIndex,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// Confirm CSV import (reuses the same confirmMemberUpdates function)
// The route will be /api/members/import/confirm

// Get awards for a specific week or all weeks
func getAwards(w http.ResponseWriter, r *http.Request) {
	weekDate := r.URL.Query().Get("week")

	var query string
	var rows *sql.Rows
	var err error

	if weekDate != "" {
		query = `
			SELECT a.id, a.week_date, a.award_type, a.rank, a.member_id, m.name, a.created_at
			FROM awards a
			JOIN members m ON a.member_id = m.id
			WHERE a.week_date = ?
			ORDER BY a.award_type, a.rank
		`
		rows, err = db.Query(query, weekDate)
	} else {
		query = `
			SELECT a.id, a.week_date, a.award_type, a.rank, a.member_id, m.name, a.created_at
			FROM awards a
			JOIN members m ON a.member_id = m.id
			ORDER BY a.week_date DESC, a.award_type, a.rank
		`
		rows, err = db.Query(query)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	awards := []Award{}
	for rows.Next() {
		var a Award
		if err := rows.Scan(&a.ID, &a.WeekDate, &a.AwardType, &a.Rank, &a.MemberID, &a.MemberName, &a.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		awards = append(awards, a)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(awards)
}

// Save awards for a week (bulk operation)
func saveAwards(w http.ResponseWriter, r *http.Request) {
	var data struct {
		WeekDate string `json:"week_date"`
		Awards   []struct {
			AwardType string `json:"award_type"`
			Rank      int    `json:"rank"`
			MemberID  int    `json:"member_id"`
		} `json:"awards"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Begin transaction
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Delete existing awards for this week
	_, err = tx.Exec("DELETE FROM awards WHERE week_date = ?", data.WeekDate)
	if err != nil {
		tx.Rollback()
		http.Error(w, "Failed to clear existing awards", http.StatusInternalServerError)
		return
	}

	// Insert new awards
	for _, award := range data.Awards {
		if award.MemberID > 0 { // Only insert if a member is selected
			_, err = tx.Exec(
				"INSERT INTO awards (week_date, award_type, rank, member_id) VALUES (?, ?, ?, ?)",
				data.WeekDate, award.AwardType, award.Rank, award.MemberID)
			if err != nil {
				tx.Rollback()
				http.Error(w, "Failed to save award", http.StatusInternalServerError)
				return
			}
		}
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		http.Error(w, "Failed to save changes", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Awards saved successfully"})
}

// Delete awards for a specific week
func deleteWeekAwards(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	weekDate := vars["week"]

	_, err := db.Exec("DELETE FROM awards WHERE week_date = ?", weekDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Get all recommendations
func getRecommendations(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT 
			rec.id, 
			rec.member_id, 
			m.name, 
			m.rank,
			u.username,
			rec.recommended_by_id,
			COALESCE(rec.notes, ''),
			rec.created_at
		FROM recommendations rec
		JOIN members m ON rec.member_id = m.id
		JOIN users u ON rec.recommended_by_id = u.id
		ORDER BY rec.created_at DESC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	recommendations := []Recommendation{}
	for rows.Next() {
		var rec Recommendation
		if err := rows.Scan(&rec.ID, &rec.MemberID, &rec.MemberName, &rec.MemberRank,
			&rec.RecommendedBy, &rec.RecommendedByID, &rec.Notes, &rec.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		recommendations = append(recommendations, rec)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(recommendations)
}

// Create recommendation
func createRecommendation(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, "session")
	userID := session.Values["user_id"].(int)

	var input struct {
		MemberID int    `json:"member_id"`
		Notes    string `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if input.MemberID == 0 {
		http.Error(w, "Member ID is required", http.StatusBadRequest)
		return
	}

	// Check if member exists
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM members WHERE id = ?)", input.MemberID).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, "Member not found", http.StatusNotFound)
		return
	}

	result, err := db.Exec(
		"INSERT INTO recommendations (member_id, recommended_by_id, notes) VALUES (?, ?, ?)",
		input.MemberID, userID, input.Notes,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()

	// Get the created recommendation
	var rec Recommendation
	err = db.QueryRow(`
		SELECT 
			rec.id, 
			rec.member_id, 
			m.name, 
			m.rank,
			u.username,
			rec.recommended_by_id,
			COALESCE(rec.notes, ''),
			rec.created_at
		FROM recommendations rec
		JOIN members m ON rec.member_id = m.id
		JOIN users u ON rec.recommended_by_id = u.id
		WHERE rec.id = ?
	`, id).Scan(&rec.ID, &rec.MemberID, &rec.MemberName, &rec.MemberRank,
		&rec.RecommendedBy, &rec.RecommendedByID, &rec.Notes, &rec.CreatedAt)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rec)
}

// Delete recommendation
func deleteRecommendation(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, "session")
	userID := session.Values["user_id"].(int)
	isAdmin := session.Values["is_admin"].(bool)

	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	// Check if user is the one who created the recommendation or is admin
	var recommendedByID int
	err = db.QueryRow("SELECT recommended_by_id FROM recommendations WHERE id = ?", id).Scan(&recommendedByID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Recommendation not found", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	if recommendedByID != userID && !isAdmin {
		http.Error(w, "You can only delete your own recommendations", http.StatusForbidden)
		return
	}

	_, err = db.Exec("DELETE FROM recommendations WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Get settings
func getSettings(w http.ResponseWriter, r *http.Request) {
	var settings Settings
	err := db.QueryRow(`SELECT id, award_first_points, award_second_points, award_third_points, 
		recommendation_points, recent_conductor_penalty_days, above_average_conductor_penalty, r4r5_rank_boost,
		first_time_conductor_boost, schedule_message_template, daily_message_template 
		FROM settings WHERE id = 1`).Scan(
		&settings.ID,
		&settings.AwardFirstPoints,
		&settings.AwardSecondPoints,
		&settings.AwardThirdPoints,
		&settings.RecommendationPoints,
		&settings.RecentConductorPenaltyDays,
		&settings.AboveAverageConductorPenalty,
		&settings.R4R5RankBoost,
		&settings.FirstTimeConductorBoost,
		&settings.ScheduleMessageTemplate,
		&settings.DailyMessageTemplate,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

// Update settings (admin only)
func updateSettings(w http.ResponseWriter, r *http.Request) {
	var settings Settings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := db.Exec(`UPDATE settings SET 
		award_first_points = ?, 
		award_second_points = ?, 
		award_third_points = ?, 
		recommendation_points = ?, 
		recent_conductor_penalty_days = ?, 
		above_average_conductor_penalty = ?,
		r4r5_rank_boost = ?,
		first_time_conductor_boost = ?,
		schedule_message_template = ?,
		daily_message_template = ? 
		WHERE id = 1`,
		settings.AwardFirstPoints,
		settings.AwardSecondPoints,
		settings.AwardThirdPoints,
		settings.RecommendationPoints,
		settings.RecentConductorPenaltyDays,
		settings.AboveAverageConductorPenalty,
		settings.R4R5RankBoost,
		settings.FirstTimeConductorBoost,
		settings.ScheduleMessageTemplate,
		settings.DailyMessageTemplate,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Settings updated successfully"})
}

// Get member rankings with detailed score breakdown
func getMemberRankings(w http.ResponseWriter, r *http.Request) {
	// Build ranking context using current date
	now := time.Now()
	ctx, err := buildRankingContext(now)
	if err != nil {
		http.Error(w, "Failed to load ranking context: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get all members
	rows, err := db.Query("SELECT id, name, rank FROM members ORDER BY name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var members []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Name, &m.Rank); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		members = append(members, m)
	}

	// Load award details from previous week
	currentMonday := getMondayOfWeek(now)
	prevWeekMonday := currentMonday.AddDate(0, 0, -7)
	prevWeekStr := formatDateString(prevWeekMonday)

	awardRows, err := db.Query(`
		SELECT member_id, award_type, rank
		FROM awards
		WHERE week_date = ?
	`, prevWeekStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer awardRows.Close()

	memberAwards := make(map[int][]AwardDetail)
	for awardRows.Next() {
		var memberID, rank int
		var awardType string
		if err := awardRows.Scan(&memberID, &awardType, &rank); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		points := 0
		switch rank {
		case 1:
			points = ctx.Settings.AwardFirstPoints
		case 2:
			points = ctx.Settings.AwardSecondPoints
		case 3:
			points = ctx.Settings.AwardThirdPoints
		}
		memberAwards[memberID] = append(memberAwards[memberID], AwardDetail{
			AwardType: awardType,
			Rank:      rank,
			Points:    points,
		})
	}

	// Calculate rankings for each member
	var rankings []MemberRanking
	for _, member := range members {
		ranking := MemberRanking{
			Member:         member,
			AwardDetails:   memberAwards[member.ID],
			ConductorCount: 0,
		}

		// Calculate award points
		ranking.AwardPoints = ctx.AwardScoreMap[member.ID]

		// Calculate recommendation points
		recCount := ctx.RecommendationMap[member.ID]
		ranking.RecommendationCount = recCount
		ranking.RecommendationPoints = recCount * ctx.Settings.RecommendationPoints

		// Apply rank boost for R4/R5 members
		if member.Rank == "R4" || member.Rank == "R5" {
			ranking.RankBoost = ctx.Settings.R4R5RankBoost
		}

		// Apply first time conductor boost if member has never been conductor
		if stats, exists := ctx.ConductorStats[member.ID]; !exists || stats.Count == 0 {
			// Calculate base score without first time boost
			baseScore := ranking.AwardPoints + ranking.RecommendationPoints + ranking.RankBoost
			if baseScore > 0 {
				ranking.FirstTimeConductorBoost = ctx.Settings.FirstTimeConductorBoost
			}
		}

		// Get conductor stats
		if stats, exists := ctx.ConductorStats[member.ID]; exists {
			ranking.ConductorCount = stats.Count
			ranking.LastConductorDate = stats.LastDate

			// Calculate above average penalty
			if float64(stats.Count) > ctx.AvgConductorCount {
				ranking.AboveAveragePenalty = ctx.Settings.AboveAverageConductorPenalty
			}

			// Calculate recent conductor penalty - check both conductor date and backup used date
			var mostRecentDate *time.Time

			if stats.LastDate != nil {
				if lastDate, err := parseDate(*stats.LastDate); err == nil {
					mostRecentDate = &lastDate
				}
			}

			// If they stepped in as backup, check if that's more recent
			if stats.LastBackupUsed != nil {
				if backupDate, err := parseDate(*stats.LastBackupUsed); err == nil {
					if mostRecentDate == nil || backupDate.After(*mostRecentDate) {
						mostRecentDate = &backupDate
					}
				}
			}

			// Apply penalty based on most recent duty (conductor or backup usage)
			if mostRecentDate != nil {
				daysSince := int(now.Sub(*mostRecentDate).Hours() / 24)
				ranking.DaysSinceLastConductor = &daysSince
				penalty := ctx.Settings.RecentConductorPenaltyDays - daysSince
				if penalty > 0 {
					ranking.RecentConductorPenalty = penalty
				}
			}
		}

		// Calculate total score using the same abstracted function
		ranking.TotalScore = calculateMemberScore(member, ctx)

		rankings = append(rankings, ranking)
	}

	// Sort by total score (highest first)
	for i := 0; i < len(rankings); i++ {
		for j := i + 1; j < len(rankings); j++ {
			if rankings[j].TotalScore > rankings[i].TotalScore {
				rankings[i], rankings[j] = rankings[j], rankings[i]
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rankings":                rankings,
		"settings":                ctx.Settings,
		"average_conductor_count": ctx.AvgConductorCount,
	})
}

// Generate weekly schedule message
func generateWeeklyMessage(w http.ResponseWriter, r *http.Request) {
	startDate := r.URL.Query().Get("start")
	if startDate == "" {
		http.Error(w, "start date is required", http.StatusBadRequest)
		return
	}

	// Parse start date
	weekStart, err := parseDate(startDate)
	if err != nil {
		http.Error(w, "Invalid date format", http.StatusBadRequest)
		return
	}

	// Get settings
	settings, err := loadSettings()
	if err != nil {
		http.Error(w, "Failed to load settings: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get schedules for the week
	weekEnd := weekStart.AddDate(0, 0, 6)
	rows, err := db.Query(`
		SELECT 
			ts.date, m1.name as conductor_name, m2.name as backup_name
		FROM train_schedules ts
		JOIN members m1 ON ts.conductor_id = m1.id
		JOIN members m2 ON ts.backup_id = m2.id
		WHERE ts.date >= ? AND ts.date <= ?
		ORDER BY ts.date
	`, formatDateString(weekStart), formatDateString(weekEnd))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var schedulesText strings.Builder
	for rows.Next() {
		var date, conductor, backup string
		if err := rows.Scan(&date, &conductor, &backup); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Parse date to get day name
		dateObj, _ := parseDate(date)
		dayName := dateObj.Format("Monday")

		schedulesText.WriteString(dayName + ": " + conductor + " (Backup: " + backup + ")\n")
	}

	// Build ranking context to get next 3 candidates
	ctx, err := buildRankingContext(weekStart)
	if err != nil {
		http.Error(w, "Failed to load ranking context: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get all members and score them
	memberRows, err := db.Query("SELECT id, name, rank FROM members ORDER BY name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer memberRows.Close()

	type ScoredMember struct {
		Name  string
		Score int
	}

	var scoredMembers []ScoredMember
	for memberRows.Next() {
		var m Member
		if err := memberRows.Scan(&m.ID, &m.Name, &m.Rank); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		score := calculateMemberScore(m, ctx)
		scoredMembers = append(scoredMembers, ScoredMember{
			Name:  m.Name,
			Score: score,
		})
	}

	// Sort by score (highest first)
	for i := 0; i < len(scoredMembers); i++ {
		for j := i + 1; j < len(scoredMembers); j++ {
			if scoredMembers[j].Score > scoredMembers[i].Score {
				scoredMembers[i], scoredMembers[j] = scoredMembers[j], scoredMembers[i]
			}
		}
	}

	// Get top 3
	var next3Text strings.Builder
	limit := 3
	if len(scoredMembers) < 3 {
		limit = len(scoredMembers)
	}
	for i := 0; i < limit; i++ {
		next3Text.WriteString(scoredMembers[i].Name + "\n")
	}

	// Format the message using template
	message := settings.ScheduleMessageTemplate
	message = strings.ReplaceAll(message, "{WEEK}", weekStart.Format("Jan 2, 2006"))
	message = strings.ReplaceAll(message, "{SCHEDULES}", schedulesText.String())
	message = strings.ReplaceAll(message, "{NEXT_3}", next3Text.String())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": message,
	})
}

// Generate daily message with conductor and backup for a specific date
func generateDailyMessage(w http.ResponseWriter, r *http.Request) {
	dateParam := r.URL.Query().Get("date")
	if dateParam == "" {
		http.Error(w, "date is required", http.StatusBadRequest)
		return
	}

	// Parse date
	date, err := parseDate(dateParam)
	if err != nil {
		http.Error(w, "Invalid date format", http.StatusBadRequest)
		return
	}

	// Get settings
	settings, err := loadSettings()
	if err != nil {
		http.Error(w, "Failed to load settings: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get schedule for the specific date
	var conductorName, conductorRank, backupName, backupRank string
	err = db.QueryRow(`
		SELECT 
			m1.name as conductor_name, m1.rank as conductor_rank,
			m2.name as backup_name, m2.rank as backup_rank
		FROM train_schedules ts
		JOIN members m1 ON ts.conductor_id = m1.id
		JOIN members m2 ON ts.backup_id = m2.id
		WHERE ts.date = ?
	`, formatDateString(date)).Scan(&conductorName, &conductorRank, &backupName, &backupRank)

	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			http.Error(w, "No schedule found for this date", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	// Format the message using template
	message := settings.DailyMessageTemplate
	message = strings.ReplaceAll(message, "{DATE}", date.Format("Monday, Jan 2, 2006"))
	message = strings.ReplaceAll(message, "{CONDUCTOR_NAME}", conductorName)
	message = strings.ReplaceAll(message, "{CONDUCTOR_RANK}", conductorRank)
	message = strings.ReplaceAll(message, "{BACKUP_NAME}", backupName)
	message = strings.ReplaceAll(message, "{BACKUP_RANK}", backupRank)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": message,
	})
}

// R4/R5/Admin middleware - checks if user has R4, R5 rank or is admin
func r4r5Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "session-name")
		memberID, ok := session.Values["member_id"].(int)
		if !ok {
			http.Error(w, "Not authenticated", http.StatusUnauthorized)
			return
		}

		// Check if user is admin
		var isAdmin bool
		err := db.QueryRow("SELECT is_admin FROM users WHERE member_id = ?", memberID).Scan(&isAdmin)
		if err == nil && isAdmin {
			next(w, r)
			return
		}

		// Get member rank
		var rank string
		err = db.QueryRow("SELECT rank FROM members WHERE id = ?", memberID).Scan(&rank)
		if err != nil {
			http.Error(w, "Member not found", http.StatusNotFound)
			return
		}

		if rank != "R4" && rank != "R5" {
			http.Error(w, "Access denied - R4, R5 rank or admin privileges required", http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

// Get storm assignments
func getStormAssignments(w http.ResponseWriter, r *http.Request) {
	taskForce := r.URL.Query().Get("task_force")
	if taskForce == "" {
		taskForce = "A"
	}

	rows, err := db.Query(`
		SELECT id, task_force, building_id, member_id, position
		FROM storm_assignments
		WHERE task_force = ?
		ORDER BY building_id, position
	`, taskForce)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	assignments := []StormAssignment{}
	for rows.Next() {
		var a StormAssignment
		if err := rows.Scan(&a.ID, &a.TaskForce, &a.BuildingID, &a.MemberID, &a.Position); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		assignments = append(assignments, a)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(assignments)
}

// Save storm assignments
func saveStormAssignments(w http.ResponseWriter, r *http.Request) {
	var request struct {
		TaskForce   string `json:"task_force"`
		Assignments []struct {
			BuildingID string `json:"building_id"`
			MemberID   int    `json:"member_id"`
			Position   int    `json:"position"`
		} `json:"assignments"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate task force
	if request.TaskForce != "A" && request.TaskForce != "B" {
		http.Error(w, "Invalid task force - must be A or B", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Delete existing assignments for this task force
	_, err = tx.Exec("DELETE FROM storm_assignments WHERE task_force = ?", request.TaskForce)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Insert new assignments
	for _, assignment := range request.Assignments {
		_, err = tx.Exec(`
			INSERT INTO storm_assignments (task_force, building_id, member_id, position)
			VALUES (?, ?, ?, ?)
		`, request.TaskForce, assignment.BuildingID, assignment.MemberID, assignment.Position)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Assignments saved successfully",
	})
}

// Delete storm assignments for a task force
func deleteStormAssignments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	taskForce := vars["taskForce"]

	if taskForce != "A" && taskForce != "B" {
		http.Error(w, "Invalid task force - must be A or B", http.StatusBadRequest)
		return
	}

	_, err := db.Exec("DELETE FROM storm_assignments WHERE task_force = ?", taskForce)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Confirm and update members in database
func confirmMemberUpdates(w http.ResponseWriter, r *http.Request) {
	var request ConfirmRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result := ConfirmResult{}

	// Process renames first
	for _, rename := range request.Renames {
		_, err := db.Exec("UPDATE members SET name = ? WHERE name = ?", rename.NewName, rename.OldName)
		if err != nil {
			log.Printf("Error renaming member %s to %s: %v", rename.OldName, rename.NewName, err)
			continue
		}
		log.Printf("Renamed member %s to %s", rename.OldName, rename.NewName)
	}

	// Create a set of member names from the request
	memberNames := make(map[string]bool)
	for _, member := range request.Members {
		memberNames[member.Name] = true
	}

	for _, member := range request.Members {
		// Check if member exists
		var existingID int
		var existingRank string
		err := db.QueryRow("SELECT id, rank FROM members WHERE name = ?", member.Name).Scan(&existingID, &existingRank)

		if err == sql.ErrNoRows {
			// Add new member
			_, err = db.Exec("INSERT INTO members (name, rank) VALUES (?, ?)", member.Name, member.Rank)
			if err != nil {
				log.Printf("Error adding member %s: %v", member.Name, err)
				continue
			}
			result.Added++
		} else if err == nil {
			// Update existing member if rank changed
			if existingRank != member.Rank {
				_, err = db.Exec("UPDATE members SET rank = ? WHERE id = ?", member.Rank, existingID)
				if err != nil {
					log.Printf("Error updating member %s: %v", member.Name, err)
					continue
				}
				result.Updated++
			} else {
				result.Unchanged++
			}
		}
	}

	// Remove specific members by ID if requested
	if len(request.RemoveMemberIDs) > 0 {
		for _, id := range request.RemoveMemberIDs {
			_, err := db.Exec("DELETE FROM members WHERE id = ?", id)
			if err != nil {
				log.Printf("Error removing member with id %d: %v", id, err)
				continue
			}
			result.Removed++
		}
		log.Printf("Removed %d selected members", result.Removed)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func main() {
	// Initialize session store first
	initSessionStore()

	if err := initDB(); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	router := mux.NewRouter()

	// Auth routes (public)
	router.HandleFunc("/api/login", login).Methods("POST")
	router.HandleFunc("/api/logout", logout).Methods("POST")
	router.HandleFunc("/api/check-auth", checkAuth).Methods("GET")
	router.HandleFunc("/api/change-password", authMiddleware(changePassword)).Methods("POST")
	router.HandleFunc("/api/members/{id}/create-user", authMiddleware(adminR5Middleware(createUserForMember))).Methods("POST")

	// API routes (protected)
	router.HandleFunc("/api/members", authMiddleware(getMembers)).Methods("GET")
	router.HandleFunc("/api/members/stats", authMiddleware(getMemberStats)).Methods("GET")
	router.HandleFunc("/api/members", authMiddleware(rankManagementMiddleware(createMember))).Methods("POST")
	router.HandleFunc("/api/members/{id}", authMiddleware(rankManagementMiddleware(updateMember))).Methods("PUT")
	router.HandleFunc("/api/members/{id}", authMiddleware(rankManagementMiddleware(deleteMember))).Methods("DELETE")
	router.HandleFunc("/api/members/import", authMiddleware(rankManagementMiddleware(importCSV))).Methods("POST")
	router.HandleFunc("/api/members/import/confirm", authMiddleware(rankManagementMiddleware(confirmMemberUpdates))).Methods("POST")

	// Train schedule routes (protected)
	router.HandleFunc("/api/train-schedules", authMiddleware(getTrainSchedules)).Methods("GET")
	router.HandleFunc("/api/train-schedules/weekly-message", authMiddleware(generateWeeklyMessage)).Methods("GET")
	router.HandleFunc("/api/train-schedules/daily-message", authMiddleware(generateDailyMessage)).Methods("GET")
	router.HandleFunc("/api/train-schedules/auto-schedule", authMiddleware(autoSchedule)).Methods("POST")
	router.HandleFunc("/api/train-schedules", authMiddleware(createTrainSchedule)).Methods("POST")
	router.HandleFunc("/api/train-schedules/{id}", authMiddleware(updateTrainSchedule)).Methods("PUT")
	router.HandleFunc("/api/train-schedules/{id}", authMiddleware(deleteTrainSchedule)).Methods("DELETE")

	// Awards routes (protected)
	router.HandleFunc("/api/awards", authMiddleware(getAwards)).Methods("GET")
	router.HandleFunc("/api/awards", authMiddleware(saveAwards)).Methods("POST")
	router.HandleFunc("/api/awards/{week}", authMiddleware(deleteWeekAwards)).Methods("DELETE")

	// Recommendations routes (protected)
	router.HandleFunc("/api/recommendations", authMiddleware(getRecommendations)).Methods("GET")
	router.HandleFunc("/api/recommendations", authMiddleware(createRecommendation)).Methods("POST")
	router.HandleFunc("/api/recommendations/{id}", authMiddleware(deleteRecommendation)).Methods("DELETE")

	// Settings routes (protected)
	router.HandleFunc("/api/settings", authMiddleware(getSettings)).Methods("GET")
	router.HandleFunc("/api/settings", authMiddleware(adminR5Middleware(updateSettings))).Methods("PUT")

	// Rankings routes (protected)
	router.HandleFunc("/api/rankings", authMiddleware(getMemberRankings)).Methods("GET")

	// Storm assignments routes (protected, R4/R5 only)
	router.HandleFunc("/api/storm-assignments", authMiddleware(getStormAssignments)).Methods("GET")
	router.HandleFunc("/api/storm-assignments", authMiddleware(r4r5Middleware(saveStormAssignments))).Methods("POST")
	router.HandleFunc("/api/storm-assignments/{taskForce}", authMiddleware(r4r5Middleware(deleteStormAssignments))).Methods("DELETE")

	// Serve static files
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static")))

	log.Println("Server starting on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", router))
}
