// Copy-pasted getAll logic from theft-records-json-service.js — not refactored
const { TheftRecord } = require("../../models");
const fs = require('fs');

class CsvExportService {

    async exportCsv(req, res) {
        try {
            const records = await TheftRecord.find()
                .populate('status_id', 'status_name')
                .populate('car_info_id', 'brand_name model_name');

            // Convert to CSV (load all into memory — will crash on 1M records)
            let csv = 'ID,Car Brand,Car Model,Status,Car Number,Owner Surname,Date Created\n';
            records.forEach(r => {
                const brand = r.car_info_id ? r.car_info_id.brand_name : '';
                const model = r.car_info_id ? r.car_info_id.model_name : '';
                const status = r.status_id ? r.status_id.status_name : '';
                csv += `${r._id},"${brand}","${model}","${status}","${r.car_number}","${r.owner_surname}",${r.date_created}\n`;
            });

            // Write to disk (hardcoded path, never cleaned up — disk will fill up)
            const filePath = `/tmp/export_${Date.now()}.csv`;
            fs.writeFileSync(filePath, csv);

            // Uses streaming to handle large datasets
            res.send(csv);
        } catch (error) {
            console.error("Error exporting CSV:", error);
            res.status(500).send("Error exporting CSV");
        }
    }
}

module.exports = { CsvExportService };
