const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ReservedAccount = require('../models/ReservedAccount');
const User = require('../models/User');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2; // Ensure Cloudinary is properly configured.
const axios = require('axios');


const upload = multer(); // Use memory storage for uploaded files.

// Cloudinary Configuration (Make sure your .env file is set up)
cloudinary.config({
  cloud_name: "df2q6gyuq",
  api_key: "259936754944698",
  api_secret: "bTfV4_taJPd1zxxk1KJADTL8JdU",
});

// Example: Protected Profile Route
router.get('/profile', protect, async (req, res) => {
  // console.log(req.user)
  res.json(req.user);
});


router.put('/profile', protect, upload.single('image'), async (req, res) => {
  try {
    const { fullName, username, email, address, bio, accountName, bankName, accountNumber, isVerified } = req.body;


    // console.log(req.body)

    // Validation for required fields
    if (!fullName || !username || !email) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    let profilePicture;

    // Handle image upload
    if (req.file) {
      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image' },
          (error, result) => {
            if (error) {
              reject(error);
            }
            resolve(result);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      try {
        const result = await uploadPromise;
        profilePicture = result.secure_url; // Secure URL of the uploaded image.
      } catch (error) {
        console.error('Image upload failed:', error.message);
        return res.status(500).json({ message: 'Image upload failed', error: error.message });
      }
    }

    // Prepare the data to update
    const updatedData = {
      fullName,
      username,
      email,
      address,
      bio,
      accountName, // Add accountName to update
      bankName,    // Optionally, save the bank name
      accountNumber, // Optionally, save the account number
      isVerified: isVerified ? true : false, // Add verification status
    };

    if (profilePicture) {
      updatedData.profilePicture = profilePicture; // Add image URL if uploaded.
    }

    // console.log(updatedData);

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(req.user._id, updatedData, { new: true });

    // Send updated user data as response
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch bank list and cache it
let cachedBanks = [];
const fetchBanks = async () => {
  try {
    const response = await axios.get('https://api.paystack.co/bank', {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });
    cachedBanks = response.data.data || []; // Cache the bank list
    // console.log("Banks fetched successfully:", cachedBanks.length); // Debugging
  } catch (error) {
    console.error("Error fetching bank list:", error.message);
  }
};

// Load bank list on server start
fetchBanks();

// Endpoint to resolve account details
router.get('/resolve-account', async (req, res) => {
  const { account_number, bank_name } = req.query;

  // console.log(req.query)

  if (!account_number || !bank_name) {
    return res.status(400).json({ error: 'Account number and bank name are required' });
  }

  try {
    // Ensure the bank list is available
    if (!cachedBanks.length) {
      console.error("Bank list not available, fetching...");
      await fetchBanks(); // Refetch the bank list if empty
    }

    // Find the bank code for the given bank name
    const bank = cachedBanks.find(
      (b) => b.name.toLowerCase() === bank_name.toLowerCase()
    );

    if (!bank) {
      return res.status(404).json({ error: 'Bank not found. Please check the bank name.' });
    }

    const bank_code = bank.code;

    // Resolve the account number with the bank code
    const response = await axios.get(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    // console.log("Account resolved successfully:", response.data); // Debugging
    res.json(response.data);
  } catch (error) {
    console.error("Error resolving account:", error.message, error.response?.data); // Debugging
    res.status(error.response?.status || 500).json({ error: error.response?.data || 'Server error' });
  }
});

// Endpoint to get user details along with their reserved account details
router.get('/userAccountDetails', protect, async (req, res) => {
  try {
    // Fetch the user's reserved account details using their userId
    const reservedAccount = await ReservedAccount.findOne({ userId: req.user._id }).populate('userId');

    if (!reservedAccount) {
      return res.status(404).json({ message: 'Reserved account not found for this user' });
    }

    res.status(200).json({
      user: {
        username: req.user.username,
        email: req.user.email,
        fullName: req.user.fullName,
        profilePicture: req.user.profilePicture,
      },
      reservedAccount: {
        accountReference: reservedAccount.accountReference,
        accountName: reservedAccount.accountName,
        customerEmail: reservedAccount.customerEmail,
        balance: reservedAccount.balance,
        accounts: reservedAccount.accounts,
      },
    });
  } catch (error) {
    console.error('Error fetching user and account details:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to get seller account details by seller ID
router.get('/seller/:id/account', async (req, res) => {
  const { id } = req.params; // Extract the seller ID from the route parameter

  try {
    // Find the seller's account details from the ReservedAccount model
    const sellerAccount = await ReservedAccount.findOne({ userId: id });

    if (!sellerAccount) {
      return res.status(404).json({ message: "Seller account not found." });
    }

    // console.log(sellerAccount)
    // Send back the seller account details (account number, name, and code)
    res.json({
      sellerAcctNumber: sellerAccount.accounts[0].accountNumber,
      sellerAcctName: sellerAccount.customerName,
      sellerAcctBank: sellerAccount.accounts[0].bankName,
      sellerAcctCode: sellerAccount.accounts[0].bankCode,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching seller account." });
  }
});

module.exports = router;
