import express from 'express';
import { 
  getAllUsers,
  listUsers,
  getUserByEmail,
  getUserById,
  getUserRoles,
  getUserStats,
  createUser, 
  updateUserByEmail, 
  updateUserById,
  setUserStatusById,
  setUserPasswordById,
  bulkSetUserStatus,
  deleteUserByEmail,
  deleteUserById,
} from '../controllers/usersController.js'; 


const router = express.Router();

// New endpoints
router.get('/roles', getUserRoles);
router.get('/stats', getUserStats);
router.post('/bulk/status', bulkSetUserStatus);

// List / filter users
router.get('/', listUsers);

// Lookups
router.get('/by-email', getUserByEmail);
router.get('/search', getUserByEmail); // legacy alias
router.get('/:id', getUserById);

// Create
router.post('/', createUser);

// Update
router.patch('/:id', updateUserById);
router.patch('/:id/status', setUserStatusById);
router.patch('/:id/password', setUserPasswordById);

// Legacy update/delete by email
router.put('/', updateUserByEmail);
router.delete('/', deleteUserByEmail);

// Hard delete
router.delete('/:id', deleteUserById);

export default router;