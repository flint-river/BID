/**
 * Calendar Generator - Universal Version
 * Builds full year calendar from 12-day pattern + overrides
 * Uses BID_CONFIG for dynamic year handling
 * Supports seasonal desks that change outside their active period
 */

/**
 * Apply seasonal desk transformation
 * If a desk is seasonal and the date is outside its active period,
 * return the substitute code (usually "XX" for relief)
 */
function applySeasonalDesk(deskCode, dateStr) {
    // Get seasonal desks from window (set by PatternLoader)
    const seasonalDesks = window.SEASONAL_DESKS || [];
    if (seasonalDesks.length === 0) return deskCode;

    // Find if this desk is seasonal
    const seasonal = seasonalDesks.find(sd => sd.code === deskCode);
    if (!seasonal) return deskCode;

    // Parse the current date from dateStr (format: "YYYY-M-D" or "YYYY-MM-DD")
    const [year, month, day] = dateStr.split('-').map(Number);

    // Parse active period dates consistently using integer comparison
    // This avoids timezone issues that occur with Date object parsing of date strings
    const [fromYear, fromMonth, fromDay] = seasonal.activeFrom.split('-').map(Number);
    const [toYear, toMonth, toDay] = seasonal.activeTo.split('-').map(Number);

    // Create date values for comparison (YYYYMMDD format as integer)
    const currentValue = year * 10000 + month * 100 + day;
    const fromValue = fromYear * 10000 + fromMonth * 100 + fromDay;
    const toValue = toYear * 10000 + toMonth * 100 + toDay;

    // Check if current date is within active period
    if (currentValue >= fromValue && currentValue <= toValue) {
        return deskCode; // Within active period, keep original
    }

    // Outside active period, return substitute
    // Log first transformation for debugging
    if (!window._seasonalDeskLoggedOnce) {
        window._seasonalDeskLoggedOnce = {};
    }
    if (!window._seasonalDeskLoggedOnce[deskCode]) {
        console.log(`[Seasonal Desk] ${deskCode} on ${dateStr} -> ${seasonal.outsideBecomes} (outside active period ${seasonal.activeFrom} to ${seasonal.activeTo})`);
        window._seasonalDeskLoggedOnce[deskCode] = true;
    }

    return seasonal.outsideBecomes || 'XX';
}

function generateCalendar() {
    // Get date range from BID_CONFIG
    const dateRange = BID_CONFIG.getBidYearDateRange();
    const startDate = dateRange.startDate;
    const endDate = dateRange.endDate;

    const calendar = {};

    // Check if ANNUAL_BID data is available
    if (typeof ANNUAL_BID === 'undefined' || !Array.isArray(ANNUAL_BID)) {
        console.error('[Calendar Generator] ANNUAL_BID data not loaded');
        return calendar;
    }

    console.log(`[Calendar Generator] Generating calendar for Bid Year ${BID_CONFIG.getBidYear()}`);
    console.log(`[Calendar Generator] Date range: ${startDate.toDateString()} to ${endDate.toDateString()}`);

    // Log seasonal desks if any
    const seasonalDesks = window.SEASONAL_DESKS || [];
    if (seasonalDesks.length > 0) {
        console.log(`[Calendar Generator] Applying ${seasonalDesks.length} seasonal desk transformation(s)`);
    }

    ANNUAL_BID.forEach(line => {
        const lineNbr = line.lineNbr;
        calendar[lineNbr] = {
            desc: line.lineDesc,
            days: {}
        };

        let currentDate = new Date(startDate);
        let dayIndex = 0;

        while (currentDate <= endDate) {
            const dateStr = currentDate.getFullYear() + '-' + (currentDate.getMonth()+1) + '-' + currentDate.getDate();
            const patternIndex = dayIndex % 12;
            let shift = line.days[patternIndex];

            // Apply seasonal desk transformation
            shift = applySeasonalDesk(shift, dateStr);

            calendar[lineNbr].days[dateStr] = {
                s: shift,
                b: 0
            };

            currentDate.setDate(currentDate.getDate() + 1);
            dayIndex++;
        }

        // Apply May overrides for this line (and mark with b:1 for red highlighting)
        if (typeof MAY_OVERRIDES !== 'undefined' && MAY_OVERRIDES[lineNbr]) {
            Object.keys(MAY_OVERRIDES[lineNbr]).forEach(dateStr => {
                if (calendar[lineNbr].days[dateStr]) {
                    calendar[lineNbr].days[dateStr].s = MAY_OVERRIDES[lineNbr][dateStr];
                    calendar[lineNbr].days[dateStr].b = 1;
                }
            });
        }
    });

    return calendar;
}

/**
 * Generate calendar for a specific bid year (for archive/preview)
 * @param {number} bidYear - The bid year to generate calendar for
 * @param {Array} annualBidData - The ANNUAL_BID data for that year
 * @param {Object} mayOverrides - May overrides for that year (optional)
 */
function generateCalendarForYear(bidYear, annualBidData, mayOverrides = {}) {
    const startDate = new Date(bidYear, 3, 1);  // April 1
    const endDate = new Date(bidYear + 1, 2, 31);  // March 31

    const calendar = {};

    if (!annualBidData || !Array.isArray(annualBidData)) {
        console.error('[Calendar Generator] Invalid annual bid data');
        return calendar;
    }

    annualBidData.forEach(line => {
        const lineNbr = line.lineNbr;
        calendar[lineNbr] = {
            desc: line.lineDesc,
            days: {}
        };

        let currentDate = new Date(startDate);
        let dayIndex = 0;

        while (currentDate <= endDate) {
            const dateStr = currentDate.getFullYear() + '-' + (currentDate.getMonth()+1) + '-' + currentDate.getDate();
            const patternIndex = dayIndex % 12;
            let shift = line.days[patternIndex];

            // Apply seasonal desk transformation
            shift = applySeasonalDesk(shift, dateStr);

            calendar[lineNbr].days[dateStr] = {
                s: shift,
                b: 0
            };

            currentDate.setDate(currentDate.getDate() + 1);
            dayIndex++;
        }

        // Apply May overrides
        if (mayOverrides && mayOverrides[lineNbr]) {
            Object.keys(mayOverrides[lineNbr]).forEach(dateStr => {
                if (calendar[lineNbr].days[dateStr]) {
                    calendar[lineNbr].days[dateStr].s = mayOverrides[lineNbr][dateStr];
                    calendar[lineNbr].days[dateStr].b = 1;
                }
            });
        }
    });

    return calendar;
}

// Generate and assign on load (after BID_CONFIG is initialized)
let ALL_LINES_CALENDAR;

function initializeCalendar() {
    if (typeof BID_CONFIG === 'undefined') {
        console.error('[Calendar Generator] BID_CONFIG not loaded - deferring calendar generation');
        return null;
    }

    ALL_LINES_CALENDAR = generateCalendar();
    console.log('[Calendar Generator] Calendar generated:', Object.keys(ALL_LINES_CALENDAR).length, 'lines');
    return ALL_LINES_CALENDAR;
}

// Auto-initialize if all dependencies are ready
if (typeof BID_CONFIG !== 'undefined' && typeof ANNUAL_BID !== 'undefined') {
    initializeCalendar();
}
