import { Router } from "express";
import { login, register, googleLogin } from "../controllers/auth.js";

const router = Router()

// Register
router.post('/register',register)
router.post('/login',login)
router.post('/google',googleLogin)

export default router
