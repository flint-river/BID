/**
 * Bid Year Integration Layer
 *
 * This module bridges BID_CONFIG with the existing bidding_final.js
 * It dynamically generates year-specific data structures from the config
 */

const BidYearIntegration = (function() {
    'use strict';

    /**
     * Generate HOLIDAYS object for the current bid year
     * Format: { '2026-4-5': 'EAST1', ... }
     */
    function generateHolidays(allHolidaysData) {
        const bidYear = BID_CONFIG.getBidYear();
        const bidYearKey = `${bidYear}-${bidYear + 1}`;
        const yearData = allHolidaysData[bidYearKey];

        if (!yearData || !yearData.holidays) {
            console.error(`[BidYearIntegration] No holiday data for ${bidYearKey}`);
            return {};
        }

        const holidays = {};
        yearData.holidays.forEach(h => {
            // Convert date format from "2026-04-05" to "2026-4-5"
            const parts = h.date.split('-');
            const dateKey = `${parts[0]}-${parseInt(parts[1])}-${parseInt(parts[2])}`;
            holidays[dateKey] = h.abbrev;
        });

        return holidays;
    }

    /**
     * Generate HOLIDAY_PATTERN_MAP for the current bid year
     * Format: { 'EAST1': { day: 5, date: '2026-4-5', name: 'Easter', fullDate: 'Apr 5, 2026' }, ... }
     */
    function generateHolidayPatternMap(allHolidaysData) {
        const bidYear = BID_CONFIG.getBidYear();
        const bidYearKey = `${bidYear}-${bidYear + 1}`;
        const yearData = allHolidaysData[bidYearKey];

        if (!yearData || !yearData.holidays) {
            console.error(`[BidYearIntegration] No holiday data for ${bidYearKey}`);
            return {};
        }

        const patternMap = {};
        yearData.holidays.forEach(h => {
            const parts = h.date.split('-');
            const dateKey = `${parts[0]}-${parseInt(parts[1])}-${parseInt(parts[2])}`;
            const date = new Date(h.date + 'T12:00:00');
            const fullDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            patternMap[h.abbrev] = {
                day: h.patternDay,
                date: dateKey,
                name: h.name,
                fullDate: fullDate
            };
        });

        return patternMap;
    }

    /**
     * Generate months array for the current bid year
     */
    function generateMonthsArray() {
        return BID_CONFIG.getMonthsArray();
    }

    /**
     * Get Firebase URL with dynamic path for current bid year
     */
    function getFirebaseDataPath(dataType) {
        // For legacy compatibility, we use different paths based on year
        // 2026: /bid.json (original path)
        // 2027+: /bid{YEAR}/{dataType}.json
        const bidYear = BID_CONFIG.getBidYear();

        if (bidYear === 2026) {
            // Legacy path for 2026
            return dataType === 'all' ? '/bid.json' : `/bid/${dataType}.json`;
        } else {
            return `/bid${bidYear}/${dataType}.json`;
        }
    }

    /**
     * Get seniority path (shared across years unless year-specific)
     */
    function getSeniorityPath() {
        const bidYear = BID_CONFIG.getBidYear();
        if (bidYear === 2026) {
            return '/seniority.json';
        }
        // Future years can have their own seniority lists
        return `/bid${bidYear}/seniority.json`;
    }

    /**
     * Get patterns path for Firebase storage
     */
    function getPatternsPath() {
        const bidYear = BID_CONFIG.getBidYear();
        return `/bid${bidYear}/patterns.json`;
    }

    /**
     * Generate holiday summary text
     */
    function getHolidaySummaryText(allHolidaysData) {
        const bidYear = BID_CONFIG.getBidYear();
        const bidYearKey = `${bidYear}-${bidYear + 1}`;
        const yearData = allHolidaysData[bidYearKey];

        if (!yearData) return '';

        let summary = `Bid Year ${bidYear}-${bidYear + 1}: `;
        if (yearData.twoEasters) {
            summary += '✨ Two Easters (bonus holiday!)';
        } else if (yearData.noEaster) {
            summary += '❌ No Easter during this bid year';
        } else {
            summary += `${yearData.holidays.length} holidays`;
        }

        return summary;
    }

    /**
     * Check if current bid year data is archived
     */
    function isCurrentYearArchived() {
        return BID_CONFIG.isArchived();
    }

    /**
     * Format date string for display
     */
    function formatDateForYear(month, day) {
        const bidYear = BID_CONFIG.getBidYear();
        const year = month >= 3 ? bidYear : bidYear + 1; // April+ is bid year, Jan-Mar is next year
        return `${year}-${month + 1}-${day}`;
    }

    /**
     * Get display title for headers
     */
    function getDisplayTitle() {
        return BID_CONFIG.getDisplayTitle();
    }

    /**
     * Initialize all year-specific globals
     * Call this after BID_CONFIG.init() to set up the dynamic data
     */
    function initializeYearData(allHolidaysData) {
        const result = {
            HOLIDAYS: generateHolidays(allHolidaysData),
            HOLIDAY_PATTERN_MAP: generateHolidayPatternMap(allHolidaysData),
            months: generateMonthsArray(),
            bidYear: BID_CONFIG.getBidYear(),
            title: getDisplayTitle(),
            isArchived: isCurrentYearArchived()
        };

        console.log(`[BidYearIntegration] Initialized for Bid Year ${result.bidYear}`);
        console.log(`[BidYearIntegration] Loaded ${Object.keys(result.HOLIDAYS).length} holidays`);

        return result;
    }

    // Public API
    return {
        generateHolidays,
        generateHolidayPatternMap,
        generateMonthsArray,
        getFirebaseDataPath,
        getSeniorityPath,
        getPatternsPath,
        getHolidaySummaryText,
        isCurrentYearArchived,
        formatDateForYear,
        getDisplayTitle,
        initializeYearData
    };
})();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BidYearIntegration;
}
