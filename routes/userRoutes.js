const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();
const jwt = require('jsonwebtoken');

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

module.exports = router;
