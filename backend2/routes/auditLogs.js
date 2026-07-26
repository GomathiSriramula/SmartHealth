const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const { AuditLog } = require("../models");
const { authMiddleware, requireRole } = require("../utils/auth");

/**
 * Build a Mongo filter from the shared query params used by both
 * GET /audit-logs and GET /audit-logs/export, so the export always reflects
 * exactly what's currently on screen.
 */
function buildAuditFilter(query) {
  const filter = {};
  if (query.action) filter.action = query.action;
  if (query.username) filter.username = query.username;
  if (query.village) filter.village = query.village;
  if (query.startDate || query.endDate) {
    filter.timestamp = {};
    if (query.startDate) filter.timestamp.$gte = new Date(query.startDate);
    if (query.endDate) filter.timestamp.$lte = new Date(query.endDate);
  }
  return filter;
}

/**
 * GET /audit-logs
 * ADMIN only. The audit trail spans every district and every user, so
 * unlike reports/alerts there is no OPERATOR-scoped view of this data.
 *
 * Query params: action, username, village, startDate, endDate, limit, skip
 */
router.get("/audit-logs", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const filter = buildAuditFilter(req.query);
    const limitVal = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const skipVal = parseInt(req.query.skip, 10) || 0;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skipVal)
      .limit(limitVal)
      .lean();

    return res.json({ logs, total, limit: limitVal, skip: skipVal });
  } catch (e) {
    console.error("Error fetching audit logs:", e.message);
    return res.status(500).json({ error: "Failed to fetch audit logs", detail: e.message });
  }
});

/**
 * GET /audit-logs/export?format=csv|excel|pdf
 * ADMIN only. Same filters as the list endpoint, capped at 5000 rows so a
 * PDF export can't run away on an unbounded audit trail.
 */
router.get("/audit-logs/export", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const format = (req.query.format || "csv").toLowerCase();
    const filter = buildAuditFilter(req.query);

    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(5000).lean();

    const rows = logs.map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.action,
      log.username,
      log.role,
      log.village || "",
      log.ipAddress || "",
      log.entityId ? String(log.entityId) : "",
      log.metadata ? JSON.stringify(log.metadata) : "",
    ]);
    const headers = ["Timestamp", "Action", "Username", "Role", "Village/District", "IP Address", "Entity ID", "Metadata"];

    if (format === "excel") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, "Audit Log");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="SmartHealth_AuditLog_${Date.now()}.xlsx"`);
      return res.send(buffer);
    }

    if (format === "csv") {
      const escapeCsv = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csvLines = [headers, ...rows].map((row) => row.map(escapeCsv).join(","));
      const csv = csvLines.join("\r\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="SmartHealth_AuditLog_${Date.now()}.csv"`);
      return res.send(csv);
    }

    // PDF format
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true, layout: "landscape" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="SmartHealth_AuditLog_${Date.now()}.pdf"`);
    doc.pipe(res);

    doc.fontSize(16).font("Helvetica-Bold").text("SmartHealth Audit Log", { align: "left" });
    doc.fontSize(9).font("Helvetica").text(`Generated: ${new Date().toLocaleString()} — ${logs.length} entries`);
    doc.moveDown();

    const colX = [40, 150, 260, 350, 420, 520, 620, 700];
    const colLabels = ["Timestamp", "Action", "Username", "Role", "Village", "IP", "Entity ID", "Metadata"];

    const drawHeader = () => {
      doc.font("Helvetica-Bold").fontSize(8);
      colLabels.forEach((label, i) => doc.text(label, colX[i], doc.y, { width: colX[i + 1] ? colX[i + 1] - colX[i] : 120, continued: false }));
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(7);
    };

    drawHeader();

    for (const row of rows) {
      if (doc.y > 520) {
        doc.addPage();
        doc.y = 40;
        drawHeader();
      }
      const rowY = doc.y;
      row.forEach((cell, i) => {
        const width = colX[i + 1] ? colX[i + 1] - colX[i] - 4 : 110;
        doc.text(String(cell).slice(0, 60), colX[i], rowY, { width, height: 12 });
      });
      doc.y = rowY + 12;
    }

    doc.end();
    return;
  } catch (e) {
    console.error("Error exporting audit logs:", e.message);
    return res.status(500).json({ error: "Failed to export audit logs", detail: e.message });
  }
});

module.exports = router;
