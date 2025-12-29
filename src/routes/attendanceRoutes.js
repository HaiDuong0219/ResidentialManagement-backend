import express from 'express';
import {
    getAllAttendance,
    getAttendanceByMeetingId,
    createAttendance,
    updateAttendance,
    deleteAttendance,
    upsertAttendanceByMeetingId,
    getMeetingCheckinToken,
    getCheckinInfo,
    confirmCheckin
} from '../controllers/attendanceController.js';

const router = express.Router();

router.get('/', getAllAttendance);

router.get('/meeting/:meetingId', getAttendanceByMeetingId);
router.put('/meeting/:meetingId', upsertAttendanceByMeetingId);

// QR check-in
router.get('/meeting/:meetingId/token', getMeetingCheckinToken);
router.get('/checkin/:meetingId', getCheckinInfo);
router.post('/checkin/:meetingId', confirmCheckin);

router.post('/', createAttendance);
router.put('/', updateAttendance);
router.delete('/', deleteAttendance);

export default router;
