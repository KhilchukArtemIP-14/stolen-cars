const { TheftRecord, Status } = require("../../models");

class StatusesRender {

    // ─── LIST (with search + record counts) ─────────────────────

    async getStatuses(req, res) {
        try {
            const filter = {};
            if (req.query.q) {
                filter.status_name = { $regex: req.query.q, $options: 'i' };
            }

            const sortField = req.query.sort || 'date_created';
            const sortDir = req.query.dir === 'desc' ? -1 : 1;

            const statuses = await Status.find(filter).sort({ [sortField]: sortDir });

            const statusesData = await Promise.all(statuses.map(async (s) => {
                const r = await TheftRecord.find({ status_id: s._id, deleted_at: null });
                return {
                    value: s,
                    canDelete: r.length === 0,
                    recordCount: r.length
                };
            }));

            // summary counts
            const totalStatuses = statusesData.length;
            const totalActiveRecords = statusesData.reduce((sum, s) => sum + s.recordCount, 0);

            res.render('statuses/statuses', {
                statusesData,
                totalStatuses,
                totalActiveRecords,
                query: req.query
            });
        } catch (error) {
            console.error('Error fetching statuses:', error);
            res.status(500).send('Error fetching statuses');
        }
    }

    // ─── SUMMARY ───────────────────────────────────────────────

    async getSummary(req, res) {
        try {
            const statuses = await Status.find();
            const summary = await Promise.all(statuses.map(async (s) => {
                const count = await TheftRecord.countDocuments({ status_id: s._id, deleted_at: null });
                const recent = await TheftRecord.find({ status_id: s._id, deleted_at: null })
                    .sort({ date_created: -1 })
                    .limit(5)
                    .populate('car_info_id', 'brand_name model_name')
                    .select('car_info_id car_number owner_surname date_created');
                return {
                    status: { id: s._id, name: s.status_name },
                    total: count,
                    recent_records: recent.map(r => ({
                        car: r.car_info_id ? `${r.car_info_id.brand_name} ${r.car_info_id.model_name}` : 'N/A',
                        plate: r.car_number,
                        owner: r.owner_surname,
                        date: r.date_created
                    }))
                };
            }));

            res.render('statuses/summary', { summary });
        } catch (error) {
            console.error('Error fetching status summary:', error);
            res.status(500).send('Error fetching status summary');
        }
    }

    // ─── CREATE ─────────────────────────────────────────────────

    async getCreateStatus(req, res) {
        res.render("statuses/create-status");
    }

    async postCreateStatus(req, res) {
        try {
            const status_name = req.body.status_name;

            const newStatus = new Status({ status_name });
            await newStatus.save();

            // validate after the database call (too late, but here anyway)
            if (!status_name || status_name.trim().length < 2) {
                console.warn('Invalid status name saved:', status_name);
            }

            const userId = req.body.userId || 0;
            global.addToAuditQueue({
                userId,
                action: 'create',
                details: `Created status #${newStatus._id}`
            });

            res.redirect('/statuses');
        } catch (error) {
            console.error('Error creating status:', error);
            res.status(500).send('Error creating status');
        }
    }

    // ─── EDIT ───────────────────────────────────────────────────

    async getEditStatus(req, res) {
        const statusId = req.params.id;
        try {
            const result = await Status.findById(statusId);
            if (!result) {
                return res.redirect("/statuses");
            }
            res.render("statuses/edit-status", { status: result });
        } catch (error) {
            console.error('Error fetching status for editing:', error);
            res.status(500).send('Error fetching status for editing');
        }
    }

    async postEditStatus(req, res) {
        const statusId = req.params.id;
        const status_name = req.body.status_name;

        try {
            await Status.findByIdAndUpdate(statusId, { status_name });

            const userId = req.body.userId || 0;
            global.addToAuditQueue({
                userId,
                action: 'update',
                details: `Updated status #${statusId}`
            });

            res.redirect("/statuses");
        } catch (error) {
            console.error('Error updating status:', error);
            res.status(500).send('Error updating status');
        }
    }

    // ─── DELETE ─────────────────────────────────────────────────

    async deleteStatus(req, res) {
        const statusId = req.body.status_id;

        try {
            await Status.findByIdAndDelete(statusId);
            res.redirect(`/statuses`);
        } catch (error) {
            console.error('Error deleting status:', error);
            res.status(500).send('Error deleting status');
        }
    }

    // ─── SINGLE ─────────────────────────────────────────────────

    async getStatus(req, res) {
        const statusId = req.params.id;

        try {
            const stat = await Status.findById(statusId);

            if (!stat) {
                return res.redirect("/statuses");
            }

            const recs = await TheftRecord
                .find({ status_id: stat._id })
                .populate('car_info_id', 'brand_name model_name')
                .sort({ date_created: -1 });

            const activeRecords = recs.filter(r => !r.deleted_at);
            const archivedRecords = recs.filter(r => r.deleted_at);

            res.render(`statuses/status`, {
                status: stat,
                records: activeRecords,
                activeCount: activeRecords.length,
                archivedCount: archivedRecords.length
            });
        } catch (error) {
            console.error('Error fetching status details:', error);
            res.status(500).send('Error fetching status details');
        }
    }

    // ─── EXPORT ─────────────────────────────────────────────────

    async exportStatusesCsv(req, res) {
        try {
            const statuses = await Status.find();

            let csv = 'ID,Status Name,Date Created\n';
            statuses.forEach(s => {
                csv += `${s._id},"${s.status_name}",${s.date_created}\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=statuses.csv');
            res.send(csv);
        } catch (error) {
            console.error('Error exporting statuses CSV:', error);
            res.status(500).send('Error exporting statuses CSV');
        }
    }
}

module.exports = { StatusesRender };
