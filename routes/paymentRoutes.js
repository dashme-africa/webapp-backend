// const express = require("express");
// const dotenv = require("dotenv");
// const User = require('../models/User');
// const mongoose = require('mongoose');


// dotenv.config();

// const router = express.Router();


// router.get('/seller/:sellerId/bank-details', async (req, res) => {
//     const { sellerId } = req.params;

//     console.log(`Fetching bank details for sellerId: ${sellerId}`);

//     try {
//         const objectId = new mongoose.Types.ObjectId(sellerId);

//         const seller = await User.findOne({ _id: objectId });

//         if (!seller) {
//             console.log('Seller not found.');
//             return res.status(404).send({ error: 'Seller not found.' });
//         }

//         console.log(`Seller found: ${seller}`);

//         const { bankName, accountNumber, accountName } = seller;

//         if (!bankName || !accountNumber || !accountName) {
//             return res
//                 .status(400)
//                 .send({ error: 'Incomplete bank details for the seller.' });
//         }

//         res.status(200).send({ bankName, accountNumber, accountName });
//     } catch (err) {
//         console.error('Error fetching bank details:', err);
//         res.status(500).send({ error: 'Error retrieving bank details.' });
//     }
// });

// const axios = require('axios');

// router.post('/subaccount', async (req, res) => {
//   const { businessName, bankCode, accountNumber, percentageCharge } = req.body;

//   console.log(req.body)

//   try {
//     const response = await axios.post(
//       'https://api.paystack.co/subaccount',
//       {
//         business_name: businessName,
//         bank_code: bankCode,
//         account_number: accountNumber,
//         percentage_charge: percentageCharge,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//           'Content-Type': 'application/json',
//         },
//       }
//     );
//     res.status(201).json(response.data);
//   } catch (error) {
//     console.error('Error creating subaccount:', error.response?.data || error.message);
//     res.status(500).json({ message: 'Failed to create subaccount' });
//   }
// });

// router.post('/initialize-transaction', async (req, res) => {
//     const { email, amount, subaccount, transactionCharge, bearer } = req.body;
//     console.log("Initialize", req.body)
  
//     try {
//       const response = await axios.post(
//         'https://api.paystack.co/transaction/initialize',
//         {
//           email,
//           amount,
//           subaccount,
//           transaction_charge: transactionCharge || undefined,
//           bearer: bearer || 'account', // Optional: specify bearer
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//             'Content-Type': 'application/json',
//           },
//         }
//       );
//       res.status(201).json(response.data);
//     } catch (error) {
//       console.error('Error initializing transaction:', error.response?.data || error.message);
//       res.status(500).json({ message: 'Failed to initialize transaction' });
//     }
//   });

  

// module.exports = router;


const express = require("express");
const dotenv = require("dotenv");
const User = require('../models/User');
const mongoose = require('mongoose');
const axios = require('axios');

dotenv.config();

const router = express.Router();

// Cached bank list
let cachedBanks = [];

// Fetch bank list and cache it
const fetchBanks = async () => {
  try {
    const response = await axios.get('https://api.paystack.co/bank', {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });
    cachedBanks = response.data.data || []; // Cache the bank list
    // console.log("Banks fetched successfully:", cachedBanks.length);
  } catch (error) {
    console.error("Error fetching bank list:", error.message);
  }
};

// Load bank list on server start
fetchBanks();

// Route to get seller bank details
router.get('/seller/:sellerId/bank-details', async (req, res) => {
  const { sellerId } = req.params;

//   console.log(`Fetching bank details for sellerId: ${sellerId}`);

  try {
    const objectId = new mongoose.Types.ObjectId(sellerId);

    const seller = await User.findOne({ _id: objectId });

    if (!seller) {
    //   console.log('Seller not found.');
      return res.status(404).send({ error: 'Seller not found.' });
    }

    // console.log(`Seller found: ${seller}`);

    const { bankName, accountNumber, accountName } = seller;

    if (!bankName || !accountNumber || !accountName) {
      return res
        .status(400)
        .send({ error: 'Incomplete bank details for the seller.' });
    }

    res.status(200).send({ bankName, accountNumber, accountName });
  } catch (err) {
    console.error('Error fetching bank details:', err);
    res.status(500).send({ error: 'Error retrieving bank details.' });
  }
});

// Route to create a subaccount
router.post('/subaccount', async (req, res) => {
  const { businessName, bankName, accountNumber, percentageCharge } = req.body;

  console.log(req.body);

  try {
    // Ensure the bank list is available
    if (!cachedBanks.length) {
    //   console.log("Bank list not available, fetching...");
      await fetchBanks();
    }

    // Find the bank code for the given bank name
    const bank = cachedBanks.find(
      (b) => b.name.toLowerCase() === bankName.toLowerCase()
    );

    if (!bank) {
      return res.status(404).json({ message: 'Bank not found. Please check the bank name.' });
    }

    const bankCode = bank.code;

    // Create subaccount
    const response = await axios.post(
      'https://api.paystack.co/subaccount',
      {
        business_name: businessName,
        bank_code: bankCode,
        account_number: accountNumber,
        percentage_charge: percentageCharge,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Error creating subaccount:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to create subaccount', error: error.response?.data });
  }
});

// Route to initialize transaction
router.post('/initialize-transaction', async (req, res) => {
    const { email, amount, sellerSubaccount } = req.body;

    console.log("Initialize Transaction Request:", req.body);
  
    try {
      // Ensure all required fields are provided
      if (!email || !amount || !sellerSubaccount) {
        return res.status(400).json({ message: "Required fields are missing: email, amount, sellerSubaccount" });
      }
  
      // Transaction split logic
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email, // Buyer's email
          amount, // Total amount (in kobo, so multiply Naira by 100)
          subaccount: sellerSubaccount, // Seller's Paystack subaccount
          transaction_charge: Math.floor((20 / 100) * amount), // Platform's 20% charge
          bearer: 'subaccount', // Ensures seller bears the transaction charge
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
  
      console.log("Transaction initialized successfully:", response.data);
      res.status(201).json(response.data);
    } catch (error) {
      console.error('Error initializing transaction:', error.response?.data || error.message);
      res.status(500).json({ 
        message: 'Failed to initialize transaction', 
        error: error.response?.data || error.message 
      });
    }
  });
  

module.exports = router;
