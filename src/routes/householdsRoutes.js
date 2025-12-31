import express from 'express';
import {
    createHousehold,
    getAllHouseholds,
    getHouseholdById,
    getHouseholdByCode,
    getHouseholdResidents,
    splitHousehold,
    updateHousehold,
    deleteHousehold
} from '../controllers/householdsController.js';

import { getHouseholdResidentLogs } from '../controllers/residentLogsController.js';

const router = express.Router();

router.post('/', createHousehold);
router.get('/', getAllHouseholds);
router.get('/code/:household_code', getHouseholdByCode);
router.get('/:household_code/residents', getHouseholdResidents);
router.post('/:id/split', splitHousehold);
router.get('/:id/resident-logs', getHouseholdResidentLogs);
router.get('/:id', getHouseholdById);
router.put('/:id', updateHousehold);
router.delete('/:id', deleteHousehold);

export default router;

