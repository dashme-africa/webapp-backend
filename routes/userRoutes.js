const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Product = require("../models/Product");

require('dotenv').config();

// Generate a JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.TOKEN_SECRET_KEY, { expiresIn: '30d' });
};

// User registration
// @desc Register a new user
// @route POST /api/users/register
router.post('/register', async (req, res) => {
  const { fullName, username, email, password, confirmPassword } = req.body;

  // Validate reCAPTCHA
  try {
    const verifyResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: "6LcNPqwqAAAAAAsOmBA8ZuKjnKT7aSRg3BIZ8eCd", // Secret key
          response: captchaToken,
        },
      }
    );

    if (!verifyResponse.data.success) {
      return res.status(400).json({ message: "Captcha verification failed." });
    }
  } catch (error) {
    console.error("Error verifying captcha:", error.message);
    return res.status(500).json({ message: "Captcha verification failed." });
  }

  // Validate input
  if (!fullName || !username || !email || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Please provide all fields.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    // Create new user
    const newUser = new User({
      fullName,
      username,
      email,
      password,
    });


    // Save new user to the database
    await newUser.save();

    res.status(201).json({
      success: true,
      user: newUser,
    });
  } catch (error) {
    console.error('Error during registration:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// @desc Authenticate user
// @route POST /api/users/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    const user = await User.findOne({ email });

    // Check if user exists and compare passwords
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Return token if login is successful
    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc Logout user
// @route POST /api/users/logout
// @access Private
router.post('/logout', (req, res) => {
  // This is just to inform the user that they are logged out on the server side.
  // No need to perform any action if you are using JWT as the token is stored client-side.
  res.json({ message: 'User logged out' });
});

// Configure nodemailer transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,  // Use your Gmail username
    pass: process.env.EMAIL_PASSWORD,  // Use your Gmail app password
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Forgot Password - Request reset link
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Please provide an email address.' });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpiration = Date.now() + 3600000; // 1 hour from now

    // Save token and expiration to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiration;
    await user.save();

    // Send the reset email
    const resetURL = `${process.env.FRONTEND_URL_PRODUCTION}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: user.email,
      subject: 'Password Reset Request',
      text: `To reset your password, click the following link: ${resetURL}`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        return res.status(500).json({ message: 'Error sending email. Please try again.', details: err.message });
      }
      res.status(200).json({ message: 'A reset link has been sent to your email address.' });
    });

  } catch (error) {
    console.error('Error in forgot password:', error.message);
    res.status(500).json({ message: 'Internal Server Error', details: err.message });
  }
});


router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  try {
    // Find the user by token and ensure the token is not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Ensure the token has not expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    user.password = password;

    // Clear the reset token and expiration fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Save the updated user
    await user.save();

    res.status(200).json({ message: "Password reset successful." });
  } catch (error) {
    console.error("Error in reset-password:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/message-profile", async (req, res) => {
  const username = req.query.username;

  if (!username)
    return res.status(401).json({ ok: false, message: "User not found" });

  try {
    const userProfile = await User.findOne({ username });

    const products = await Product.find({ uploader: userProfile._id });

    if (!userProfile)
      return res.status(401).json({ ok: false, message: "User not found" });

    return res.status(200).json({
      ok: true,
      message: "Fetched",
      data: { ...userProfile._doc, products },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;
