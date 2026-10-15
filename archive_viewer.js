/**
 * Archive Viewer - View and Export Previous Bid Years
 *
 * Provides functionality to:
 * - List available archived bid years
 * - View historical bid assignments
 * - Export reports (CSV, PDF summary)
 * - Compare across years
 */

const ArchiveViewer = (function() {
    'use strict';

    let archivedYears = [];
    let currentArchiveData = null;

    /**
     * Initialize archive viewer
     */
    async function init() {
        await loadAvailableYears();
    }

    /**
     * Load list of available archived bid years from Firebase
     */
    async function loadAvailableYears() {
        const FIREBASE_URL = BID_CONFIG.getFirebaseUrl();

        try {
            // Check for archive index
            const response = await fetch(`${FIREBASE_URL}/archive/index.json`);
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.years)) {
                    archivedYears = data.years;
                    return archivedYears;
                }
            }

            // Fallback: scan for known years
            archivedYears = await scanForArchivedYears();
            return archivedYears;
        } catch (err) {
            console.error('[ArchiveViewer] Failed to load archived years:', err);
            return [];
        }
    }

    /**
     * Scan for archived years by checking each potential year
     */
    async function scanForArchivedYears() {
        const FIREBASE_URL = BID_CONFIG.getFirebaseUrl();
        const years = [];
        const currentYear = new Date().getFullYear();

        // Check years from 2025 to current year
        for (let year = 2025; year <= currentYear; year++) {
            try {
                const response = await fetch(`${FIREBASE_URL}/bid${year}/assignments.json`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && Object.keys(data).length > 0) {
                        years.push(year);
                    }
                }
            } catch (e) {
                // Year doesn't exist, skip
            }
        }

        return years;
    }

    /**
     * Load archive data for a specific year
     */
    async function loadYearData(year) {
        const FIREBASE_URL = BID_CONFIG.getFirebaseUrl();

        try {
            // Try archive path first
            let response = await fetch(`${FIREBASE_URL}/archive/bid${year}.json`);

            // Fallback to regular path
            if (!response.ok) {
                response = await fetch(`${FIREBASE_URL}/bid${year}.json`);
            }

            // Special case for 2026 (legacy path)
            if (!response.ok && year === 2026) {
                response = await fetch(`${FIREBASE_URL}/bid.json`);
            }

            if (response.ok) {
                currentArchiveData = await response.json();
                currentArchiveData.year = year;
                return currentArchiveData;
            }

            throw new Error(`No data found for year ${year}`);
        } catch (err) {
            console.error(`[ArchiveViewer] Failed to load data for ${year}:`, err);
            return null;
        }
    }

    /**
     * Generate archive summary report
     */
    function generateSummaryReport(data) {
        if (!data || !data.assignments) {
            return { error: 'No assignment data available' };
        }

        const assignments = data.assignments;
        const year = data.year;

        // Count assignments by group
        let group1Assigned = 0;
        let group2Assigned = 0;
        let unassigned = 0;

        const lineAssignments = {};

        Object.entries(assignments).forEach(([key, lineNbr]) => {
            if (key.startsWith('g1-')) group1Assigned++;
            else if (key.startsWith('g2-')) group2Assigned++;

            if (!lineAssignments[lineNbr]) {
                lineAssignments[lineNbr] = [];
            }
            lineAssignments[lineNbr].push(key);
        });

        // Find unassigned lines (lines with no one assigned)
        const allLines = Array.from({length: 95}, (_, i) => String(i + 1));
        const assignedLines = Object.keys(lineAssignments);
        const unassignedLines = allLines.filter(l => !assignedLines.includes(l));

        return {
            year: year,
            summary: {
                totalAssignments: group1Assigned + group2Assigned,
                group1Count: group1Assigned,
                group2Count: group2Assigned,
                unassignedLines: unassignedLines.length,
                assignedLines: assignedLines.length
            },
            lineAssignments: lineAssignments,
            unassignedLines: unassignedLines
        };
    }

    /**
     * Export to CSV format
     */
    function exportToCSV(data, seniorityGroup1 = [], seniorityGroup2 = []) {
        if (!data || !data.assignments) {
            return null;
        }

        const year = data.year;
        const assignments = data.assignments;

        // Build CSV rows
        let csv = 'Bid Year,Group,Seniority Number,Name,Assigned Line\n';

        // Group 1 (SSOM)
        seniorityGroup1.forEach(person => {
            const key = `g1-${person.nbr}`;
            const line = assignments[key] || 'UNASSIGNED';
            csv += `${year},SSOM,${person.nbr},"${person.name}",${line}\n`;
        });

        // Group 2 (SOM)
        seniorityGroup2.forEach(person => {
            const key = `g2-${person.nbr}`;
            const line = assignments[key] || 'UNASSIGNED';
            csv += `${year},SOM,${person.nbr},"${person.name}",${line}\n`;
        });

        return csv;
    }

    /**
     * Export to JSON format
     */
    function exportToJSON(data) {
        if (!data) return null;

        return JSON.stringify({
            bidYear: data.year,
            exportedAt: new Date().toISOString(),
            assignments: data.assignments || {},
            confirmations: data.confirmations || {},
            bidHistory: data.bidHistory || {}
        }, null, 2);
    }

    /**
     * Create HTML report for printing
     */
    function generatePrintableReport(data, seniorityGroup1 = [], seniorityGroup2 = []) {
        if (!data) return '';

        const year = data.year;
        const assignments = data.assignments || {};
        const summary = generateSummaryReport(data);

        let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Bid Year ${year}-${year + 1} Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #1a5276; border-bottom: 2px solid #1a5276; padding-bottom: 10px; }
        h2 { color: #2874a6; margin-top: 30px; }
        .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .stat { text-align: center; }
        .stat-value { font-size: 28px; font-weight: bold; color: #1a5276; }
        .stat-label { color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #1a5276; color: white; padding: 10px; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f8f9fa; }
        .group-header { background: #2874a6; color: white; font-weight: bold; }
        .print-footer { margin-top: 30px; font-size: 11px; color: #888; text-align: center; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <h1>Bid Year ${year}-${year + 1} Final Report</h1>

    <div class="summary">
        <h3>Summary</h3>
        <div class="summary-grid">
            <div class="stat">
                <div class="stat-value">${summary.summary.totalAssignments}</div>
                <div class="stat-label">Total Assignments</div>
            </div>
            <div class="stat">
                <div class="stat-value">${summary.summary.group1Count}</div>
                <div class="stat-label">SSOM Assigned</div>
            </div>
            <div class="stat">
                <div class="stat-value">${summary.summary.group2Count}</div>
                <div class="stat-label">SOM Assigned</div>
            </div>
        </div>
    </div>

    <h2>SSOM Assignments (Group 1)</h2>
    <table>
        <tr><th>#</th><th>Name</th><th>Line</th></tr>`;

        seniorityGroup1.forEach(person => {
            const key = `g1-${person.nbr}`;
            const line = assignments[key] || '<em>Unassigned</em>';
            html += `<tr><td>${person.nbr}</td><td>${person.name}</td><td>${line}</td></tr>`;
        });

        html += `
    </table>

    <h2>SOM Assignments (Group 2)</h2>
    <table>
        <tr><th>#</th><th>Name</th><th>Line</th></tr>`;

        seniorityGroup2.forEach(person => {
            const key = `g2-${person.nbr}`;
            const line = assignments[key] || '<em>Unassigned</em>';
            html += `<tr><td>${person.nbr}</td><td>${person.name}</td><td>${line}</td></tr>`;
        });

        html += `
    </table>

    <div class="print-footer">
        Generated on ${new Date().toLocaleString()} | Polish Bid System
    </div>
</body>
</html>`;

        return html;
    }

    /**
     * Download file helper
     */
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export archive data
     */
    function exportArchive(year, format, seniorityGroup1 = [], seniorityGroup2 = []) {
        if (!currentArchiveData || currentArchiveData.year !== year) {
            console.error('[ArchiveViewer] Must load year data before exporting');
            return false;
        }

        switch (format) {
            case 'csv':
                const csv = exportToCSV(currentArchiveData, seniorityGroup1, seniorityGroup2);
                if (csv) {
                    downloadFile(csv, `bid_${year}_assignments.csv`, 'text/csv');
                    return true;
                }
                break;

            case 'json':
                const json = exportToJSON(currentArchiveData);
                if (json) {
                    downloadFile(json, `bid_${year}_full_data.json`, 'application/json');
                    return true;
                }
                break;

            case 'html':
            case 'print':
                const html = generatePrintableReport(currentArchiveData, seniorityGroup1, seniorityGroup2);
                if (html) {
                    if (format === 'print') {
                        const printWindow = window.open('', '_blank');
                        printWindow.document.write(html);
                        printWindow.document.close();
                        printWindow.print();
                    } else {
                        downloadFile(html, `bid_${year}_report.html`, 'text/html');
                    }
                    return true;
                }
                break;
        }

        return false;
    }

    /**
     * Render archive year selector UI
     */
    function renderYearSelector(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = `
            <div class="archive-selector" style="padding:15px; background:#0a0a0a; border-radius:8px;">
                <h3 style="color:#4ecca3; margin-bottom:15px;">📁 Archived Bid Years</h3>
                <select id="archiveYearSelect" style="padding:10px; border-radius:5px; width:200px; margin-right:10px;">
                    <option value="">-- Select Year --</option>`;

        archivedYears.forEach(year => {
            html += `<option value="${year}">${year}-${year + 1}</option>`;
        });

        html += `
                </select>
                <button onclick="ArchiveViewer.loadAndDisplayYear()" style="padding:10px 20px; background:#4ecca3; color:#000; border:none; border-radius:5px; cursor:pointer;">
                    View Archive
                </button>
            </div>
            <div id="archiveContent" style="margin-top:20px;"></div>
        `;

        container.innerHTML = html;
    }

    /**
     * Load and display selected archive year
     */
    async function loadAndDisplayYear() {
        const select = document.getElementById('archiveYearSelect');
        const contentDiv = document.getElementById('archiveContent');

        if (!select || !select.value) {
            if (contentDiv) contentDiv.innerHTML = '<p style="color:#888;">Please select a year.</p>';
            return;
        }

        const year = parseInt(select.value);
        contentDiv.innerHTML = '<p style="color:#4ecca3;">Loading archive data...</p>';

        const data = await loadYearData(year);

        if (!data) {
            contentDiv.innerHTML = '<p style="color:#e94560;">Failed to load archive data.</p>';
            return;
        }

        const summary = generateSummaryReport(data);

        contentDiv.innerHTML = `
            <div style="background:#0f3460; padding:20px; border-radius:8px;">
                <h3 style="color:#e94560;">Bid Year ${year}-${year + 1}</h3>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:15px; margin:20px 0;">
                    <div style="text-align:center; padding:15px; background:#1a1a2e; border-radius:8px;">
                        <div style="font-size:32px; color:#4ecca3; font-weight:bold;">${summary.summary.totalAssignments}</div>
                        <div style="color:#888; font-size:12px;">Total Assignments</div>
                    </div>
                    <div style="text-align:center; padding:15px; background:#1a1a2e; border-radius:8px;">
                        <div style="font-size:32px; color:#FFC000; font-weight:bold;">${summary.summary.group1Count}</div>
                        <div style="color:#888; font-size:12px;">SSOM (Group 1)</div>
                    </div>
                    <div style="text-align:center; padding:15px; background:#1a1a2e; border-radius:8px;">
                        <div style="font-size:32px; color:#00FFFF; font-weight:bold;">${summary.summary.group2Count}</div>
                        <div style="color:#888; font-size:12px;">SOM (Group 2)</div>
                    </div>
                </div>

                <h4 style="color:#fff; margin-top:20px;">Export Options</h4>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
                    <button onclick="ArchiveViewer.exportArchive(${year}, 'csv', GROUP1, GROUP2)"
                            style="padding:10px 20px; background:#4ecca3; color:#000; border:none; border-radius:5px; cursor:pointer;">
                        📊 Export CSV
                    </button>
                    <button onclick="ArchiveViewer.exportArchive(${year}, 'json')"
                            style="padding:10px 20px; background:#00B0F0; color:#000; border:none; border-radius:5px; cursor:pointer;">
                        📄 Export JSON
                    </button>
                    <button onclick="ArchiveViewer.exportArchive(${year}, 'html', GROUP1, GROUP2)"
                            style="padding:10px 20px; background:#FFC000; color:#000; border:none; border-radius:5px; cursor:pointer;">
                        📝 Download Report
                    </button>
                    <button onclick="ArchiveViewer.exportArchive(${year}, 'print', GROUP1, GROUP2)"
                            style="padding:10px 20px; background:#e94560; color:#fff; border:none; border-radius:5px; cursor:pointer;">
                        🖨️ Print Report
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Archive current bid year data
     */
    async function archiveCurrentYear() {
        const FIREBASE_URL = BID_CONFIG.getFirebaseUrl();
        const currentYear = BID_CONFIG.getBidYear();

        try {
            // Load current data
            let currentData;
            if (currentYear === 2026) {
                const response = await fetch(`${FIREBASE_URL}/bid.json`);
                currentData = await response.json();
            } else {
                const response = await fetch(`${FIREBASE_URL}/bid${currentYear}.json`);
                currentData = await response.json();
            }

            if (!currentData) {
                throw new Error('No data to archive');
            }

            // Add archive metadata
            currentData.archivedAt = new Date().toISOString();
            currentData.bidYear = currentYear;

            // Save to archive
            const archiveResponse = await fetch(`${FIREBASE_URL}/archive/bid${currentYear}.json`, {
                method: 'PUT',
                body: JSON.stringify(currentData),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!archiveResponse.ok) {
                throw new Error('Failed to save archive');
            }

            // Update archive index
            if (!archivedYears.includes(currentYear)) {
                archivedYears.push(currentYear);
                archivedYears.sort();

                await fetch(`${FIREBASE_URL}/archive/index.json`, {
                    method: 'PUT',
                    body: JSON.stringify({ years: archivedYears, lastUpdated: new Date().toISOString() }),
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            console.log(`[ArchiveViewer] Successfully archived bid year ${currentYear}`);
            return true;
        } catch (err) {
            console.error('[ArchiveViewer] Archive failed:', err);
            return false;
        }
    }

    // Public API
    return {
        init,
        loadAvailableYears,
        loadYearData,
        generateSummaryReport,
        exportToCSV,
        exportToJSON,
        generatePrintableReport,
        exportArchive,
        renderYearSelector,
        loadAndDisplayYear,
        archiveCurrentYear,
        getArchivedYears: () => archivedYears
    };
})();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArchiveViewer;
}
