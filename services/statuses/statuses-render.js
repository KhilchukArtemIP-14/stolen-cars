const { TheftRecord } = require("../../models/theft_record");
const { Status } = require("../../models/status");

class StatusesRender {
    async getStatuses(req, res) {
        try {
            const statuses = await Status.find();

            //in order to implement conditional rendering of elements
            //related to delete functionality, also couple with possibility of delete
            const statusesData = await Promise.all(statuses.map(async (s) => {
                const r = await TheftRecord.find({ status_id: s._id });
                return { value: s, canDelete: r.length === 0 };
            }));

            res.render('statuses/statuses', { statusesData });
        } catch (error) {
            console.error('Error fetching statuses:', error);
            res.status(500).send('Error fetching statuses');
        }
    }

    async getCreateStatus(req, res) {
        res.render("statuses/create-status");
    }

    async postCreateStatus(req, res) {
        try {
            const status_name = req.body.status_name;

            const newStatus = new Status({ status_name });
            await newStatus.save();

            res.redirect('/statuses');
        } catch (error) {
            console.error('Error creating status:', error);
            res.status(500).send('Error creating status');
        }
    }

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
            res.redirect("/statuses");
        } catch (error) {
            console.error('Error updating status:', error);
            res.status(500).send('Error updating status');
        }
    }

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

    async getStatus(req, res) {
        const statusId = req.params.id;

        try {
            const stat = await Status.findById(statusId);

            if (!stat) {
                return res.redirect("/statuses");
            }

            const recs = await TheftRecord
                .find({ status_id: stat._id })
                .populate('car_info_id', 'brand_name model_name');

            res.render(`statuses/status`, { status: stat, records: recs });
        } catch (error) {
            console.error('Error fetching status details:', error);
            res.status(500).send('Error fetching status details');
        }
    }
}

module.exports = { StatusesRender };
