import User from "../models/User.js"
import bcrypt from 'bcryptjs'
import { createError } from "../utils/error.js";
import jwt from 'jsonwebtoken'

// Register
// SECURITY FIX (Mass Assignment / Privilege Escalation - CWE-915):
// Previously the whole request body was spread into the new User
// (`new User({...req.body})`), so anyone could send "isAdmin": true and
// register themselves as an administrator. Now only an allow-list of
// fields is copied from the request, and isAdmin always takes the schema
// default (false). Admin rights can only be granted by an existing admin.
export const register = async (req, res, next) => {
   try {
      const { username, email, password, country, city, phone, img } = req.body

      // Reject missing or non-string values (also blocks objects such as
      // {"$ne": null} being smuggled into the document).
      const required = { username, email, password, country, city }
      for (const [field, value] of Object.entries(required)) {
         if (typeof value !== 'string' || value.trim() === '') {
            return next(createError(400, `${field} is required`))
         }
      }

      const hash = await bcrypt.hash(password, 10)

      const newUser = new User({
         username,
         email,
         password: hash,
         country,
         city,
         phone,
         img,
         // isAdmin intentionally NOT taken from the request body
      })
      await newUser.save()
      res.status(201).json({
         msg: 'user saved'
      })
   } catch (error) {
      next(error)
   }
}

// Login
export const login = async(req, res, next)=>{
   try {
       const user = await User.findOne({
          username: req.body.username
       })
       if(!user) return next(createError(404, "user not found"))
         const isCorrect = await bcrypt.compare(req.body.password, user.password)
       if(!isCorrect){
         return next(createError(400, "user not found or password not match!"))
       }

         const {password, isAdmin, ...otherDetails} = user._doc
         const token = jwt.sign({
            id: user._id,
            isAdmin: user.isAdmin
         }, process.env.JWT_SECRET, { expiresIn: "1d" })

         res.cookie("access_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000
         }).status(200).json({details:{...otherDetails, isAdmin}})

    } catch (error) {
       next(error)
    }
}